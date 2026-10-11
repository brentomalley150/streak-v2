/**
 * The PRD v2 feature set: retired Math, themes and ideas, weekly bonus,
 * prizes, routines from scores, chores, challenge windows, teams, and the
 * opt-in fall projection. Each block names the requirement it holds to.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  bonusPoints, canLogDate, challengeWindow, computeStats, confirmActivity, currentStreak, earliestLoggable, effectiveDef,
  ideaRotation, ideasFor, makeEntry, maxPointsPerDay, pendingConfirmations, PERFECT_DAY_BONUS, pointsForEntry, pointsInWindow, prizeStatus,
  routinePlan, toggleActivity,
} from './engine.js';
import { buildRow, weeklyPoints } from './sync.js';
import { buildDigest } from './digest.js';
import { projectionFor, readingV1, hasProjection } from './projection.js';
import {
  disclosureFor, groupWindow, joinLink, memberBoard, newGroup, readTeamFromUrl, teamBoard,
} from './groups.js';
import { migrateV1State } from './storage.js';
import { Store } from './store.js';
import { fromBackup } from './backup.js';
import { activitySummaryPaths } from './measure.js';
import { asActivityId, asDateKey, type DayEntry, type TrackDefinition, type TrackState } from './types.js';
import type { AuthUser, Backend, LeaderboardRow, V1Kid } from './sync.js';
import { v1KidsFromLeaderboard } from './sync.js';
import type { Group, GroupMember, Team } from './groups.js';
import { TRACKS } from '../tracks/index.js';
import { READING_SLIDE } from '../tracks/reading-slide.js';
import { MUSIC_PRACTICE } from '../tracks/music-practice.js';
import { HOME_HELPER } from '../tracks/home-helper.js';
import { LADDERS, RANK_THRESHOLDS, THEMES, ladderFor } from '../tracks/ladders.js';

const d = asDateKey;

/** Freeze the clock at noon on a date, so logging windows are deterministic. */
const at = (date: string) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${date}T12:00:00`));
};
afterEach(() => { vi.useRealTimers(); });

function stateWith(def: TrackDefinition, days: Array<[string, string[]]>, extra: Partial<TrackState> = {}): TrackState {
  const entries: Record<string, DayEntry> = {};
  for (const [date, acts] of days) {
    const e = makeEntry(def, d(date));
    for (const a of acts) e.completed[a] = true;
    e.points = pointsForEntry(def, e);
    entries[date] = e;
  }
  return {
    trackId: def.trackId, enrolledAt: d('2026-06-01'), startDate: d('2026-06-01'),
    theme: 'chess', entries, weeklyChallengesCompleted: {}, weeklyAdjustments: {},
    earnedBadges: {}, pointAdjustments: 0, prizes: [], claimHistory: [], baseline: {},
    ...extra,
  };
}

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

/* ------------------------------------------------------------------------ */

describe('engine still names no track', () => {
  it('has none of the new track ids either', () => {
    const src = readFileSync(fileURLToPath(new URL('./engine.ts', import.meta.url)), 'utf8');
    for (const id of ['home-helper', 'mindful-kid', 'back-to-school', 'reading-v1', "'math'"]) {
      expect(src).not.toContain(id);
    }
  });
});

describe('Math became its own track — and nobody lost points', () => {
  it('Reading is read + write + wrap-up, 15/10/5', () => {
    expect(READING_SLIDE.activities.map((a) => a.id)).toEqual(['read', 'write', 'closeout']);
    expect(READING_SLIDE.activities.map((a) => a.minutes)).toEqual([15, 10, 5]);
    expect(TRACKS.some((t) => t.trackId === 'math-facts')).toBe(true);
  });

  it("a migrated v1 day with Math still scores Math's points", () => {
    const s = stateWith(READING_SLIDE, [['2026-06-02', ['read', 'math']]]);
    expect(computeStats(READING_SLIDE, s, LADDERS['chess']!).points).toBe(5);
  });

  it('a full v1 profile keeps exactly the points it had', () => {
    const v1 = {
      player: { name: 'Declan' },
      entries: {
        '2026-06-01': { read: true, write: true, math: true, closeout: true, points: 9 },
        '2026-06-02': { read: true, math: true, points: 5 },
      },
    };
    const st = migrateV1State('p1', v1).tracks['reading-slide']!;
    expect(computeStats(READING_SLIDE, st, ladderFor(READING_SLIDE, st)).points).toBe(14);
  });
});

describe('kid-chosen themes (FR23)', () => {
  it('every ladder shares the same seven thresholds', () => {
    expect(THEMES.map((t) => t.id)).toEqual(
      ['chess', 'sports', 'gaming', 'music', 'animals', 'dance', 'art', 'space', 'fantasy']);
    for (const t of THEMES) {
      expect(LADDERS[t.id]!.map((r) => r.min)).toEqual([...RANK_THRESHOLDS]);
    }
  });

  it('switching theme renames the rank but keeps the level and the points', () => {
    const s = stateWith(READING_SLIDE, Array.from({ length: 8 }, (_, i) =>
      [`2026-06-${String(i + 1).padStart(2, '0')}`, ['read', 'write', 'closeout']] as [string, string[]]));
    const chess = computeStats(READING_SLIDE, s, ladderFor(READING_SLIDE, s));
    s.theme = 'dance';
    const dance = computeStats(READING_SLIDE, s, ladderFor(READING_SLIDE, s));
    expect(dance.points).toBe(chess.points);
    const level = (name: string, l: string) => LADDERS[l]!.findIndex((r) => r.name === name);
    expect(level(dance.rank.name, 'dance')).toBe(level(chess.rank.name, 'chess'));
    expect(dance.rank.name).not.toBe(chess.rank.name);
  });

  it('every theme has its own rank names, and no two rungs in a ladder share one', () => {
    for (const t of THEMES) {
      const names = LADDERS[t.id]!.map((r) => r.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('a theme with no ideas of its own still shows the general ones', () => {
    for (const t of TRACKS) {
      for (const a of t.activities) {
        if (!t.ideas?.[String(a.id)]) continue;
        expect(ideasFor(t, String(a.id), 'fantasy', d('2026-10-10')).length).toBeGreaterThan(0);
      }
    }
  });

  it('wherever one theme has its own ideas, every theme does', () => {
    for (const t of TRACKS) {
      for (const [act, pool] of Object.entries(t.ideas ?? {})) {
        if (!THEMES.some((th) => pool[th.id])) continue;
        for (const th of THEMES) expect(pool[th.id]?.length, `${t.trackId} ${act} ${th.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('every track offers every theme', () => {
    for (const t of TRACKS) expect([...t.themes].sort()).toEqual(THEMES.map((x) => x.id).sort());
  });
});

describe('theme ideas for each activity (FR24)', () => {
  it("shows the kid's theme, rotates daily, and is stable within a day", () => {
    const a = ideasFor(READING_SLIDE, 'write', 'animals', d('2026-10-10'));
    expect(a).toHaveLength(2);
    expect(ideaRotation(READING_SLIDE.ideas!['write']!, 'animals')).toEqual(expect.arrayContaining(a));
    expect(ideasFor(READING_SLIDE, 'write', 'animals', d('2026-10-10'))).toEqual(a);
    expect(ideasFor(READING_SLIDE, 'write', 'animals', d('2026-10-11'))).not.toEqual(a);
  });

  it("mixes the theme's ideas evenly into the general ones", () => {
    const pool = {
      '*': Array.from({ length: 14 }, (_, i) => `g${i + 1}`),
      chess: Array.from({ length: 7 }, (_, i) => `t${i + 1}`),
    };
    const r = ideaRotation(pool, 'chess');
    expect(r).toHaveLength(21);
    expect(new Set(r).size).toBe(21); // every idea once per cycle
    expect(r.filter((x) => x.startsWith('t'))).toEqual(pool.chess); // theme order kept
    // Spread out, not bunched: never more than two general ideas in a row,
    // so the theme shows up on two days out of every three.
    expect(r.join(',')).not.toMatch(/g\d+,g\d+,g\d+/);
    // A theme with no list of its own just gets the general ones.
    expect(ideaRotation(pool, 'dance')).toEqual(pool['*']);
  });

  it("falls back to the '*' list for a theme without its own", () => {
    expect(ideasFor(READING_SLIDE, 'closeout', 'dance', d('2026-10-10')).length).toBe(2);
  });

  it('every idea list points at a real activity', () => {
    for (const t of TRACKS) {
      const ids = new Set(t.activities.map((a) => String(a.id)));
      for (const key of Object.keys(t.ideas ?? {})) expect(ids.has(key)).toBe(true);
    }
  });
});

describe('logging a day the kid forgot', () => {
  const enrolled = (startedOn: string, today: string) => {
    at(startedOn);
    const store = new Store(new MemStorage());
    store.init(); store.addProfile('Declan'); store.enroll('reading-slide', 'chess');
    at(today);
    return store;
  };

  it('logs yesterday and keeps the streak alive', () => {
    const store = enrolled('2026-09-01', '2026-10-11');
    store.toggle('read', d('2026-10-09'));
    store.toggle('read', d('2026-10-11'));
    const t = store.activeTrack!;
    expect(currentStreak(t, d('2026-10-11'))).toBe(1);
    store.toggle('read', d('2026-10-10')); // the forgotten day
    expect(currentStreak(t, d('2026-10-11'))).toBe(3);
    expect(t.entries['2026-10-10']!.points).toBe(3);
  });

  it('goes back a week, and no further', () => {
    const store = enrolled('2026-09-01', '2026-10-11');
    store.toggle('read', d('2026-10-04'));
    store.toggle('read', d('2026-10-03'));
    const t = store.activeTrack!;
    expect(t.entries['2026-10-04']?.completed['read']).toBe(true);
    expect(t.entries['2026-10-03']).toBeUndefined();
  });

  it('never before the kid started, and never the future', () => {
    const store = enrolled('2026-10-09', '2026-10-11');
    store.toggle('read', d('2026-10-08'));
    store.toggle('read', d('2026-10-12'));
    const t = store.activeTrack!;
    expect(Object.keys(t.entries)).toEqual([]);
    expect(earliestLoggable(t, d('2026-10-11'))).toBe('2026-10-09');
    expect(canLogDate(t, d('2026-10-09'), d('2026-10-11'))).toBe(true);
  });

  it('counts in the week the day belongs to, not the week it was logged', () => {
    const store = enrolled('2026-09-01', '2026-10-11');
    const t = store.activeTrack!;
    const before = weeklyPoints(READING_SLIDE, t, new Date('2026-10-11T12:00:00'));
    store.toggle('read', d('2026-10-04')); // a week ago Sunday
    expect(weeklyPoints(READING_SLIDE, t, new Date('2026-10-11T12:00:00'))).toBe(before);
  });
});

describe('perfect day bonus', () => {
  const tick = (def: TrackDefinition, ids: string[]) =>
    ids.reduce((e, id) => toggleActivity(def, e, id), makeEntry(def, d('2026-10-10')));

  it('all three activities earn +2 on top of their points', () => {
    expect(tick(READING_SLIDE, ['read', 'write']).points).toBe(6);
    const e = tick(READING_SLIDE, ['read', 'write', 'closeout']);
    expect(e.comboClaimed).toBe(true);
    expect(e.points).toBe(3 + 3 + 1 + PERFECT_DAY_BONUS);
    expect(maxPointsPerDay(READING_SLIDE)).toBe(7 + PERFECT_DAY_BONUS);
  });

  it('un-ticking one takes the bonus back', () => {
    const e = toggleActivity(READING_SLIDE, tick(READING_SLIDE, ['read', 'write', 'closeout']), 'write');
    expect(e.comboClaimed).toBe(false);
    expect(e.points).toBe(4);
  });

  it('chores earn it only once a grown-up has confirmed them all', () => {
    let e = tick(HOME_HELPER, HOME_HELPER.activities.map((a) => String(a.id)));
    expect(e.comboClaimed).toBe(false);
    for (const a of HOME_HELPER.activities) e = confirmActivity(HOME_HELPER, e, String(a.id));
    expect(e.comboClaimed).toBe(true);
    expect(pointsForEntry(HOME_HELPER, e)).toBe(maxPointsPerDay(HOME_HELPER));
  });

  it("a parent adding a chore later doesn't take an earned bonus away", () => {
    let e = tick(HOME_HELPER, HOME_HELPER.activities.map((a) => String(a.id)));
    for (const a of HOME_HELPER.activities) e = confirmActivity(HOME_HELPER, e, String(a.id));
    const extra = { id: asActivityId('dishes'), label: 'Dishes', icon: '🍽️', points: 4, needsParentConfirm: true, fields: [] };
    const s = stateWith(HOME_HELPER, [], {
      entries: { '2026-10-10': e },
      customActivities: [...HOME_HELPER.activities, extra],
    });
    expect(computeStats(HOME_HELPER, s, ladderFor(HOME_HELPER, s), d('2026-10-10')).points)
      .toBe(pointsForEntry(HOME_HELPER, e));
  });

  it('a track can turn it off', () => {
    const off = { ...READING_SLIDE, perfectDayBonus: 0 };
    expect(tick(off, ['read', 'write', 'closeout']).points).toBe(7);
  });
});

describe('music: the kid picks an instrument', () => {
  const day = (acts: string[]) => stateWith(MUSIC_PRACTICE, [['2026-06-02', acts]]);

  it('offers drums, guitar, piano and trombone', () => {
    const ids = MUSIC_PRACTICE.variants!.options.map((v) => v.id);
    expect(ids).toEqual(expect.arrayContaining(['drums', 'guitar', 'piano', 'trombone']));
  });

  it("swaps the words — drums get drum ideas, not piano ones", () => {
    const drums = effectiveDef(MUSIC_PRACTICE, { ...day([]), variant: 'drums' });
    expect(drums.activities.find((a) => a.id === 'practice')!.icon).toBe('🥁');
    const ideas = ideasFor(drums, 'practice', 'chess', d('2026-10-10'), 10);
    expect(ideas.join(' ')).toMatch(/fill|groove|paradiddle|roll/i);
    expect(ideas.join(' ')).not.toMatch(/hands together|bar/);
  });

  it("never moves a point — same score on every instrument", () => {
    const base = computeStats(MUSIC_PRACTICE, day(['practice', 'learn']), LADDERS['chess']!, d('2026-06-02')).points;
    for (const v of MUSIC_PRACTICE.variants!.options) {
      const s = { ...day(['practice', 'learn']), variant: v.id };
      expect(computeStats(MUSIC_PRACTICE, s, LADDERS['chess']!, d('2026-06-02')).points).toBe(base);
      expect(effectiveDef(MUSIC_PRACTICE, s).activities.map((a) => [a.id, a.points]))
        .toEqual(MUSIC_PRACTICE.activities.map((a) => [a.id, a.points]));
    }
  });

  it("a theme's own ideas still show alongside the instrument's", () => {
    const drums = effectiveDef(MUSIC_PRACTICE, { ...day([]), variant: 'drums' });
    expect(ideaRotation(drums.ideas!['listen']!, 'gaming'))
      .toEqual(expect.arrayContaining([...MUSIC_PRACTICE.ideas!['listen']!['gaming']!]));
  });

  it('no pick (or an unknown one) plays the general track', () => {
    expect(effectiveDef(MUSIC_PRACTICE, day([]))).toBe(MUSIC_PRACTICE);
    expect(effectiveDef(MUSIC_PRACTICE, { ...day([]), variant: 'kazoo' })).toBe(MUSIC_PRACTICE);
  });

  it('every variant override points at a real activity and field', () => {
    for (const t of TRACKS) {
      for (const v of t.variants?.options ?? []) {
        for (const [actId, o] of Object.entries(v.activities ?? {})) {
          const a = t.activities.find((x) => String(x.id) === actId);
          expect(a, `${v.id}.${actId}`).toBeDefined();
          for (const f of Object.keys(o.placeholders ?? {})) expect(a!.fields.some((x) => x.id === f)).toBe(true);
        }
        for (const actId of Object.keys(v.ideas ?? {})) expect(t.activities.some((x) => String(x.id) === actId)).toBe(true);
      }
    }
  });

  it('the store records the pick at enroll and on change', () => {
    const store = new Store(new MemStorage());
    store.addProfile('Declan');
    store.enroll('music-practice', 'chess', 'drums');
    expect(store.state!.tracks['music-practice']!.variant).toBe('drums');
    store.setVariant('music-practice', 'guitar');
    expect(store.state!.tracks['music-practice']!.variant).toBe('guitar');
  });
});

describe('weekly bonus activity (FR26)', () => {
  it('adds points and never touches the streak', () => {
    const s = stateWith(READING_SLIDE, [['2026-10-09', ['read']]]);
    const before = computeStats(READING_SLIDE, s, LADDERS['chess']!, d('2026-10-10'));
    s.bonusCompleted = { 3: d('2026-10-10') };
    const after = computeStats(READING_SLIDE, s, LADDERS['chess']!, d('2026-10-10'));
    expect(after.points - before.points).toBe(READING_SLIDE.weeklyBonusPoints);
    expect(after.currentStreak).toBe(before.currentStreak);
    expect(bonusPoints(READING_SLIDE, s)).toBe(5);
  });

  it("v1's old weekly-challenge record awards nothing new", () => {
    const s = stateWith(READING_SLIDE, [], { weeklyChallengesCompleted: { 1: d('2026-06-03') } });
    expect(computeStats(READING_SLIDE, s, LADDERS['chess']!).points).toBe(0);
  });

  it('counts toward this week on the leaderboard', () => {
    const s = stateWith(READING_SLIDE, [['2026-10-06', ['read']]], { bonusCompleted: { 2: d('2026-10-07') } });
    expect(weeklyPoints(READING_SLIDE, s, new Date(2026, 9, 8))).toBe(3 + 5);
  });
});

describe('family prizes (FR27–FR28)', () => {
  it('unlock like ranks; cashing in changes status, never points', () => {
    const p = { id: 'x', name: 'Movie night', icon: '🎬', cost: 20, claimed: false };
    expect(prizeStatus(p, 10)).toBe('locked');
    expect(prizeStatus(p, 20)).toBe('unlocked');
    expect(prizeStatus({ ...p, requestedAt: 'now' }, 20)).toBe('requested');
    expect(prizeStatus({ ...p, claimed: true }, 0)).toBe('given');
  });

  it('a full ask-and-give round trip leaves points, rank and streak alone', () => {
    const store = new Store(new MemStorage());
    store.init();
    store.addProfile('Declan');
    at('2026-10-01');
    store.enroll('reading-slide', 'chess');
    at('2026-10-03');
    for (let i = 0; i < 3; i++) store.toggle('read', d(`2026-10-0${i + 1}`));
    store.toggle('write', d('2026-10-03'));
    const t = store.activeTrack!;
    const stats = () => computeStats(READING_SLIDE, t, ladderFor(READING_SLIDE, t), d('2026-10-03'));
    const before = stats();
    expect(store.addPrize('reading-slide', 'Ice cream', '🍦', 10)).toBe(true);
    const id = t.prizes[0]!.id;
    store.requestPrize('reading-slide', id);
    store.givePrize('reading-slide', id);
    expect(t.prizes[0]!.claimed).toBe(true);
    expect(stats()).toEqual(before);
  });

  it('rejects a prize with no name or a non-positive threshold', () => {
    const store = new Store(new MemStorage());
    store.init(); store.addProfile('A'); store.enroll('reading-slide', 'chess');
    expect(store.addPrize('reading-slide', '  ', '🎁', 10)).toBe(false);
    expect(store.addPrize('reading-slide', 'X', '🎁', 0)).toBe(false);
  });
});

describe('routine from scores (FR22)', () => {
  it('no scores means no personalisation — the default routine still runs', () => {
    expect(routinePlan(READING_SLIDE, {})).toEqual({ level: null, focus: null });
  });

  it('Lexile sets the book band; the lowest subscore picks the focus', () => {
    const plan = routinePlan(READING_SLIDE, { lexile: 375, writtenExpression: 17, cmasVocab: 80 });
    expect(plan.level).toEqual({ activityId: 'read', text: 'Books around 275–425L' });
    expect(plan.focus?.activityId).toBe('write');
  });

  it('the kid-facing tip never contains a score', () => {
    for (const f of READING_SLIDE.outcomeModel!.routine!.focus) expect(f.tip).not.toMatch(/\d/);
  });
});

describe('Home Helper chores need a parent (FR30)', () => {
  it('a ticked chore keeps the streak but scores only once confirmed', () => {
    let e = toggleActivity(HOME_HELPER, makeEntry(HOME_HELPER, d('2026-10-10')), 'bed');
    expect(pointsForEntry(HOME_HELPER, e)).toBe(0);
    const s = stateWith(HOME_HELPER, [], { entries: { '2026-10-10': e } });
    expect(currentStreak(s, d('2026-10-10'))).toBe(1);
    expect(pendingConfirmations(HOME_HELPER, s)).toHaveLength(1);
    e = confirmActivity(HOME_HELPER, e, 'bed');
    expect(pointsForEntry(HOME_HELPER, e)).toBe(2);
  });

  it('un-ticking clears the confirmation', () => {
    let e = toggleActivity(HOME_HELPER, makeEntry(HOME_HELPER, d('2026-10-10')), 'bed');
    e = confirmActivity(HOME_HELPER, e, 'bed');
    e = toggleActivity(HOME_HELPER, e, 'bed');
    e = toggleActivity(HOME_HELPER, e, 'bed');
    expect(pointsForEntry(HOME_HELPER, e)).toBe(0);
  });

  it("a parent's own chore list replaces the defaults", () => {
    const custom = [{ id: asActivityId('dishes'), label: 'Dishes', icon: '🍽️', points: 4, needsParentConfirm: true, fields: [] }];
    const s = stateWith(HOME_HELPER, [], { customActivities: custom });
    expect(effectiveDef(HOME_HELPER, s).activities.map((a) => a.id)).toEqual(['dishes']);
    // Only tracks that allow it can be customised.
    expect(effectiveDef(READING_SLIDE, { ...s, trackId: READING_SLIDE.trackId }).activities).toBe(READING_SLIDE.activities);
  });
});

describe('challenge windows (FR29)', () => {
  it('knows upcoming, running and ended', () => {
    expect(challengeWindow(d('2026-10-12'), 2, d('2026-10-10')).phase).toBe('upcoming');
    const run = challengeWindow(d('2026-10-01'), 2, d('2026-10-10'));
    expect(run).toMatchObject({ phase: 'running', day: 10, totalDays: 14, endDate: '2026-10-14' });
    expect(challengeWindow(d('2026-10-01'), 2, d('2026-10-15')).phase).toBe('ended');
  });

  it('counts only points earned inside the window', () => {
    const s = stateWith(READING_SLIDE, [
      ['2026-09-30', ['read', 'write']], // before
      ['2026-10-01', ['read']],          // day 1
      ['2026-10-14', ['write']],         // last day
      ['2026-10-15', ['read']],          // after
    ], { bonusCompleted: { 1: d('2026-10-02'), 9: d('2026-09-20') } });
    expect(pointsInWindow(READING_SLIDE, s, d('2026-10-01'), 2)).toBe(3 + 3 + 5);
  });

  it('a group made before FR29 defaults to 12 weeks from its creation day', () => {
    const g: Group = { id: 'X', members: {}, meta: {
      name: 'Old', trackId: 'reading-slide', ownerUid: 'u', ownerName: 'K', open: true,
      createdAt: new Date(2026, 8, 1).getTime(),
    } };
    expect(groupWindow(g)).toEqual({ startDate: '2026-09-01', lengthWeeks: 12 });
  });

  it('newGroup clamps the length to 1–52 weeks', () => {
    expect(newGroup('A', 'n', 't', 'u', 'K', 0, { lengthWeeks: 99 }).meta.lengthWeeks).toBe(52);
    expect(newGroup('A', 'n', 't', 'u', 'K', 0, { lengthWeeks: 0 }).meta.lengthWeeks).toBe(1);
  });
});

describe('classroom vs. classroom (FR31)', () => {
  const g: Group = {
    id: 'G', meta: { name: 'Fall', trackId: 'reading-slide', ownerUid: 'u1', ownerName: 'Ms R', createdAt: 0, open: true, mode: 'teams' },
    teams: {
      big: { name: 'Room 12', ownerUid: 'u1', ownerName: 'R', createdAt: 0 },
      small: { name: 'Room 14', ownerUid: 'u2', ownerName: 'T', createdAt: 0 },
      empty: { name: 'Room 16', ownerUid: 'u3', ownerName: 'S', createdAt: 0 },
    },
    members: {
      a: { name: 'A', avatar: '🙂', joinedAt: 0, points: 10, team: 'big' },
      b: { name: 'B', avatar: '🙂', joinedAt: 0, points: 10, team: 'big' },
      c: { name: 'C', avatar: '🙂', joinedAt: 0, points: 10, team: 'big' },
      e: { name: 'E', avatar: '🙂', joinedAt: 0, points: 25, team: 'small' },
    },
  };

  it('ranks teams by average points per kid, not by size', () => {
    const board = teamBoard(g);
    expect(board.map((t) => t.teamId)).toEqual(['small', 'big', 'empty']);
    expect(board[1]).toMatchObject({ total: 30, members: 3, average: 10 });
    expect(board[2]!.average).toBe(0);
  });

  it('member board sorts by window points', () => {
    expect(memberBoard(g)[0]!.name).toBe('E');
  });

  it('team links carry the team, and only a sane team id is read back', () => {
    expect(joinLink('ABCDEFGH', 'https://x.com', '/app/', 'tABC1234')).toBe('https://x.com/app/?join=ABCDEFGH&team=tABC1234');
    expect(readTeamFromUrl('?join=ABCDEFGH&team=tABC1234')).toBe('tABC1234');
    expect(readTeamFromUrl('?team=<script>')).toBeNull();
  });

  it('the join screen promises never to share test scores', () => {
    const lines = disclosureFor(g, 'Reading Slide', 'Room 12');
    expect(lines.join(' ')).toMatch(/Room 12/);
    expect(lines.join(' ').toLowerCase()).toMatch(/never test scores/);
  });
});

describe('the fall projection (FR25, PRD §3.6)', () => {
  it("reproduces the PRD's worked example", () => {
    // Baseline 185, 12 weeks, week 6 with 70% of the routine done.
    const p = readingV1({ baseline: 185, lengthWeeks: 12, completed: 0.7 * 42 * 3, perDay: 3, daysElapsed: 42, totalDays: 84 });
    expect(p.noRoutine).toBe(183);
    expect(p.fullRoutine).toBe(193);
    expect(p.keepPace).toEqual({ score: 190, low: 187, high: 193 });
    expect(p.finishStrong.score).toBe(192); // 85% of the way → 191.5
  });

  it('is off unless a parent turns it on, and needs a baseline', () => {
    const s = stateWith(READING_SLIDE, [['2026-10-01', ['read']]], { startDate: d('2026-10-01'), baseline: { mapRit: 185 } });
    expect(projectionFor(READING_SLIDE, s, d('2026-10-05'))).toBeNull();
    s.projectionOn = true;
    expect(projectionFor(READING_SLIDE, s, d('2026-10-05'))).not.toBeNull();
    s.baseline = {};
    expect(projectionFor(READING_SLIDE, s, d('2026-10-05'))).toBeNull();
  });

  it('tracks without a model never offer one', () => {
    expect(hasProjection(READING_SLIDE)).toBe(true);
    expect(hasProjection(MUSIC_PRACTICE)).toBe(false);
    expect(hasProjection(HOME_HELPER)).toBe(false);
  });

  it('the weekly digest stays silent about the fall unless it is on', () => {
    const s = stateWith(READING_SLIDE, [['2026-10-05', ['read']]], { baseline: { mapRit: 185 } });
    expect(buildDigest({ def: READING_SLIDE, state: s, kidName: 'D', now: new Date(2026, 9, 11) }).projection).toBeNull();
    s.projectionOn = true;
    expect(buildDigest({ def: READING_SLIDE, state: s, kidName: 'D', now: new Date(2026, 9, 11) }).projection).not.toBeNull();
  });

  it('is never part of anything published', () => {
    const s = stateWith(READING_SLIDE, [['2026-10-05', ['read']]], {
      baseline: { mapRit: 187, writtenExpression: 17 }, projectionOn: true,
    });
    const row = buildRow({
      def: READING_SLIDE, state: s, ladder: LADDERS['chess']!, user: USER,
      profileId: 'p1', playerName: 'D', playerAvatar: '🙂', now: new Date(2026, 9, 6),
    });
    const json = JSON.stringify(row);
    expect(json).not.toMatch(/baseline|projection|mapRit|187/);
  });
});

/* ---- Store + backend: joining and window scores ------------------------- */

const USER: AuthUser = { uid: 'u_kate', email: 'k@example.com', displayName: 'Kate O' };

class FakeBackend implements Backend {
  readonly enabled = true;
  user: AuthUser | null = USER;
  joined: Array<{ groupId: string; key: string; member: GroupMember }> = [];
  scores: Array<{ groupId: string; key: string; points: number }> = [];
  teams: Array<{ groupId: string; teamId: string; team: Team }> = [];
  async signIn() { return USER; }
  async signOut() {}
  onAuth() { return () => {}; }
  async publish(_r: LeaderboardRow) {}
  subscribeLeaderboard(_t: string, fn: (rows: LeaderboardRow[]) => void) { fn([]); return () => {}; }
  async saveRollup() {}
  async loadRollup() { return {}; }
  v1Kids: V1Kid[] = [];
  async loadV1Kids() { return this.v1Kids; }
  deleted: Array<{ key: string; profileId: string; trackIds: string[]; groupIds: string[] }> = [];
  familyDeleted = false;
  failDeletes = false;
  async deleteKidData(kid: { key: string; profileId: string; trackIds: string[]; groupIds: string[] }) {
    if (this.failDeletes) throw new Error('offline');
    this.deleted.push(kid);
  }
  async deleteFamilyRecord() { this.familyDeleted = true; }
  backups: Record<string, unknown> = {};
  async saveProfileBackup(profileId: string, backup: unknown) { this.backups[profileId] = JSON.parse(JSON.stringify(backup)); }
  async loadProfileBackups() { return this.backups; }
  summaries: Record<string, Record<string, unknown>> = {};
  async saveActivitySummary(profileId: string, paths: Record<string, unknown>) { this.summaries[profileId] = { ...(this.summaries[profileId] ?? {}), ...paths }; }
  async createGroup() {}
  async loadGroup() { return null; }
  async joinGroup(groupId: string, key: string, member: GroupMember) { this.joined.push({ groupId, key, member }); }
  async leaveGroup() {}
  async loadMyGroups() { return []; }
  async saveMemberScore(groupId: string, key: string, points: number) { this.scores.push({ groupId, key, points }); }
  async createTeam(groupId: string, teamId: string, team: Team) { this.teams.push({ groupId, teamId, team }); }
  async deleteTeam() {}
}

describe('summer families bring their SummerStreak progress', () => {
  const v1Row = (over: Record<string, unknown> = {}) => ({
    uid: 'u_kate', profileId: 'p_declan', leaderboardKey: 'u_kate_p_declan', ownerEmail: 'k@example.com',
    name: 'Declan', avatar: '👑', theme: 'chess', points: 160, weeklyPoints: 0, rank: 'Queen',
    booksFinished: 3, totalMinutes: 640, totalWords: 1200, currentStreak: 0, lastSeen: 1_786_000_000_000, ...over,
  });

  it("reads only this account's kids, skips placeholders, and never the parent's email", () => {
    const kids = v1KidsFromLeaderboard({
      a: v1Row(),
      b: v1Row({ uid: 'someone_else', profileId: 'p_x', name: 'Sebastian' }),
      c: v1Row({ profileId: 'p_new', name: 'New device' }),
      d: v1Row({ profileId: 'p_sis', name: 'Ava', points: 120, lastSeen: 1_785_000_000_000 }),
    }, 'u_kate');
    expect(kids.map((k) => k.name)).toEqual(['Declan', 'Ava']);
    expect(JSON.stringify(kids)).not.toContain('k@example.com');
  });

  it('keeps lifetime points, so the rank carries over; streaks start fresh', () => {
    const store = new Store(new MemStorage());
    store.init();
    const [declan] = v1KidsFromLeaderboard({ a: v1Row() }, 'u_kate');
    expect(store.importSummerKids([declan!], { guardian: true, data: true })).toBe(1);
    const t = store.activeTrack!;
    expect(store.profile!.id).toBe('p_declan');
    expect(store.state!.playerName).toBe('Declan');
    expect(t.theme).toBe('chess');
    const stats = computeStats(READING_SLIDE, t, ladderFor(READING_SLIDE, t));
    expect(stats.points).toBe(160);
    expect(stats.rank.name).toBe('Queen');
    expect(stats.currentStreak).toBe(0);
    expect(store.state!.consent.guardian).toBe(true);
    expect(store.state!.summer?.booksFinished).toBe(3);
  });

  it("offers only kids not already here, and importing twice adds nothing", async () => {
    const store = new Store(new MemStorage());
    const b = new FakeBackend();
    b.v1Kids = v1KidsFromLeaderboard({ a: v1Row(), d: v1Row({ profileId: 'p_sis', name: 'Ava' }) }, 'u_kate');
    store.attachBackend(b);
    store.init();
    store.importSummerKids([b.v1Kids[0]!], { guardian: true, data: true });
    const left = await store.findSummerKids();
    expect(left.map((k) => k.name)).toEqual(['Ava']);
    expect(store.importSummerKids(b.v1Kids, { guardian: true, data: true })).toBe(1);
    expect(store.all.length).toBe(2);
  });
});

describe('"Delete anytime": a parent deletes a kid', () => {
  function family() {
    const store = new Store(new MemStorage());
    const b = new FakeBackend();
    store.attachBackend(b);
    store.init();
    const declan = store.addProfile('Declan');
    store.enroll('reading-slide', 'chess');
    store.enroll('music-practice', 'chess');
    store.state!.joinedChallenges = [{ groupId: 'g1', trackId: 'reading-slide', name: 'Book club', startDate: '2026-10-01', lengthWeeks: 4 }];
    const ava = store.addProfile('Ava');
    store.enroll('math-facts', 'space');
    return { store, b, declan, ava };
  }

  it('removes the kid from the cloud first, then from this device', async () => {
    const { store, b, declan } = family();
    expect(await store.deleteProfile(declan.id)).toBe('deleted');
    expect(b.deleted).toEqual([{
      key: `u_kate_${declan.id}`, profileId: declan.id,
      trackIds: ['reading-slide', 'music-practice'], groupIds: ['g1'],
    }]);
    expect(store.all.map((p) => p.state.playerName)).toEqual(['Ava']);
  });

  it('keeps the kid when the cloud delete fails, so nothing is orphaned', async () => {
    const { store, b, declan } = family();
    b.failDeletes = true;
    expect(await store.deleteProfile(declan.id)).toBe('failed');
    expect(store.all.length).toBe(2);
  });

  it('signed out, clears this device and says so', async () => {
    const store = new Store(new MemStorage());
    store.init();
    const p = store.addProfile('Declan');
    expect(await store.deleteProfile(p.id)).toBe('device-only');
    expect(store.hasProfile).toBe(false);
  });

  it('a deleted kid stays deleted: no v1 re-migration, no summer re-offer', async () => {
    const ls = new MemStorage();
    ls.setItem('summerstreak-profiles', JSON.stringify([{ id: 'p_declan', state: { player: { name: 'Declan' }, entries: {} } }]));
    const store = new Store(ls);
    const b = new FakeBackend();
    b.v1Kids = v1KidsFromLeaderboard({ a: { uid: 'u_kate', profileId: 'p_declan', name: 'Declan', points: 40 } }, 'u_kate');
    store.attachBackend(b);
    store.init();
    expect(store.all.map((p) => p.id)).toEqual(['p_declan']);
    expect(await store.deleteProfile('p_declan')).toBe('deleted');
    const again = new Store(ls);
    again.attachBackend(b);
    again.init();
    expect(again.hasProfile).toBe(false);
    expect(await again.findSummerKids()).toEqual([]);
  });

  it('"Delete everything" removes every kid and the family record', async () => {
    const { store, b } = family();
    expect(await store.deleteEverything()).toBe('deleted');
    expect(store.hasProfile).toBe(false);
    expect(b.deleted.length).toBe(2);
    expect(b.familyDeleted).toBe(true);
  });
});

/** What Firebase does to a stored value: drops empty objects and arrays. */
function asFirebaseStores(v: unknown): unknown {
  if (Array.isArray(v)) {
    const a = v.map(asFirebaseStores).filter((x) => x !== undefined);
    return a.length ? a : undefined;
  }
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) { const y = asFirebaseStores(x); if (y !== undefined) o[k] = y; }
    return Object.keys(o).length ? o : undefined;
  }
  return v;
}

describe('restore on a new device', () => {
  function oldPhone() {
    const store = new Store(new MemStorage());
    const b = new FakeBackend();
    store.attachBackend(b);
    store.init();
    store.addProfile('Declan');
    store.enroll('reading-slide', 'chess');
    store.toggle('read');
    store.toggle('write');
    store.setBaseline('reading-slide', { mapRit: 185, lexile: 375 });
    store.setParentPin('2468');
    store.addPrize('reading-slide', 'Ice cream', '🍦', 20);
    store.state!.consent = { guardian: true, data: true, recordedAt: '2026-10-01T00:00:00Z' };
    return { store, b };
  }

  it('backs up progress and prizes, never test scores or the PIN', async () => {
    const { store, b } = oldPhone();
    await store.publishAll();
    const saved = JSON.stringify(b.backups);
    expect(saved).toContain('Ice cream');
    expect(saved).not.toContain('185');
    expect(saved).not.toContain(store.state!.parentAuth.adminPinHash);
  });

  it('a new phone gets the kid back with the same points, rank and log', async () => {
    const { store: old, b } = oldPhone();
    await old.publishAll();
    const t0 = old.activeTrack!;
    const before = computeStats(READING_SLIDE, t0, ladderFor(READING_SLIDE, t0));
    // Firebase drops empty containers; the restore has to put them back.
    b.backups = asFirebaseStores(b.backups) as Record<string, unknown>;

    const fresh = new Store(new MemStorage());
    fresh.attachBackend(b);
    fresh.init();
    const found = await fresh.findRestorableKids();
    expect(found.map((k) => k.state.playerName)).toEqual(['Declan']);
    expect(fresh.restoreKids(found)).toBe(1);

    const t = fresh.activeTrack!;
    const after = computeStats(READING_SLIDE, t, ladderFor(READING_SLIDE, t));
    expect(after.points).toBe(before.points);
    expect(after.rank.name).toBe(before.rank.name);
    expect(t.prizes.map((p) => p.name)).toEqual(['Ice cream']);
    expect(t.baseline).toEqual({});
    expect(fresh.pinIsSet).toBe(false);
    expect(fresh.state!.consent.guardian).toBe(true);
    fresh.toggle('closeout'); // still a working profile
    expect(fresh.activeTrack!.entries[Object.keys(t.entries)[0]!]!.completed['closeout']).toBe(true);
  });

  it("doesn't offer kids already here, or kids a parent deleted", async () => {
    const { store, b } = oldPhone();
    await store.publishAll();
    expect(await store.findRestorableKids()).toEqual([]);
    const fresh = new Store(new MemStorage());
    fresh.attachBackend(b);
    fresh.init();
    const [k] = await fresh.findRestorableKids();
    fresh.restoreKids([k!]);
    await fresh.deleteProfile(k!.state.profileId);
    expect(await fresh.findRestorableKids()).toEqual([]);
  });

  it('ignores a record that is not a kid', () => {
    expect(fromBackup({ savedAt: 1, state: { nope: true } })).toBeNull();
    expect(fromBackup(null)).toBeNull();
  });
});

describe('measurement summary (plan items 1 and 2)', () => {
  it('records activities, perfect days, filled-in-later days, instrument and enrollment', () => {
    at('2026-10-01');
    const store = new Store(new MemStorage());
    store.init(); store.addProfile('Declan'); store.enroll('music-practice', 'chess', 'drums');
    at('2026-10-11');
    store.toggle('practice'); store.toggle('listen'); store.toggle('learn'); // perfect today
    store.toggle('practice', d('2026-10-09'));                               // filled in later
    const paths = activitySummaryPaths(store.state!, d('2026-10-11'));
    expect(paths['tracks/music-practice/enrolledAt']).toBe('2026-10-01');
    expect(paths['tracks/music-practice/variant']).toBe('drums');
    expect(paths['tracks/music-practice/days/2026-10-11']).toEqual({ acts: { practice: true, listen: true, learn: true }, perfect: true, late: false });
    expect(paths['tracks/music-practice/days/2026-10-09']).toEqual({ acts: { practice: true }, perfect: false, late: true });
    expect(paths['tracks/music-practice/days/2026-10-10']).toBeNull();
    expect(JSON.stringify(paths)).not.toContain('Declan');
  });

  it('is written on sync, and deleted with the kid', async () => {
    const store = new Store(new MemStorage());
    const b = new FakeBackend();
    store.attachBackend(b);
    store.init();
    const p = store.addProfile('Declan');
    store.enroll('reading-slide', 'chess');
    store.toggle('read');
    await store.whenSynced();
    expect(Object.keys(b.summaries[p.id] ?? {})).toContain('tracks/reading-slide/enrolledAt');
    await store.deleteProfile(p.id);
    expect(b.deleted.map((x) => x.profileId)).toEqual([p.id]);
  });
});

describe('joining a challenge records it and publishes window points', () => {
  function setup() {
    const store = new Store(new MemStorage());
    const b = new FakeBackend();
    store.attachBackend(b);
    store.init();
    store.addProfile('Declan');
    store.enroll('reading-slide', 'chess');
    return { store, b };
  }

  it('a team challenge refuses a join without a real team', async () => {
    const { store } = setup();
    const g = newGroup('ABCDEFGH', 'Fall', 'reading-slide', 'u_t', 'T', Date.now(), { mode: 'teams' });
    expect(await store.joinGroup(g)).toBe(false);
    expect(await store.joinGroup(g, undefined, 'tNOPE')).toBe(false);
  });

  it('records the challenge and writes the in-window score', async () => {
    const { store, b } = setup();
    const today = new Date();
    const g = newGroup('ABCDEFGH', 'Fall', 'reading-slide', 'u_t', 'T', today.getTime(), { lengthWeeks: 4 });
    store.toggle('read');
    expect(await store.joinGroup(g)).toBe(true);
    expect(store.state!.joinedChallenges).toHaveLength(1);
    await store.whenSynced(); // let background syncs settle
    b.scores = [];
    await store.publishAll();
    expect(b.scores).toEqual([{ groupId: 'ABCDEFGH', key: `u_kate_${store.state!.profileId}`, points: 3 }]);
  });

  it('a teacher adding their class creates a team they own', async () => {
    const { store, b } = setup();
    const g = newGroup('ABCDEFGH', 'Fall', 'reading-slide', 'u_t', 'T', Date.now(), { mode: 'teams' });
    const id = await store.addTeam(g, 'Room 14');
    expect(id).toBeTruthy();
    expect(b.teams[0]!.team).toMatchObject({ name: 'Room 14', ownerUid: 'u_kate' });
    expect(await store.joinGroup(g, undefined, id!)).toBe(true);
    expect(b.joined[0]!.member.team).toBe(id);
  });
});

/* ---- Regression tests from the independent review ----------------------- */

describe('review fixes', () => {
  it('removing a chore keeps the points it already earned, and its pending ticks', () => {
    const store = new Store(new MemStorage());
    at('2026-10-01');
    store.init(); store.addProfile('D'); store.enroll('home-helper', 'animals');
    at('2026-10-02');
    store.toggle('bed', d('2026-10-01'));
    store.confirmChore('2026-10-01', 'bed');
    store.toggle('bed', d('2026-10-02')); // ticked, not yet confirmed
    const t = store.activeTrack!;
    const pts = () => computeStats(HOME_HELPER, t, ladderFor(HOME_HELPER, t)).points;
    expect(pts()).toBe(2);
    const keep = HOME_HELPER.activities.filter((a) => a.id !== 'bed').map((a) => ({ ...a }));
    store.setCustomActivities('home-helper', keep);
    expect(effectiveDef(HOME_HELPER, t).activities.map((a) => a.id)).not.toContain('bed');
    expect(pts()).toBe(2);
    expect(pendingConfirmations(HOME_HELPER, t).map((p) => p.activity.id)).toEqual(['bed']);
    store.confirmChore('2026-10-02', 'bed');
    expect(pts()).toBe(4);
  });

  it('clearing the MAP score switches the fall estimate off', () => {
    const store = new Store(new MemStorage());
    store.init(); store.addProfile('D'); store.enroll('reading-slide', 'chess');
    store.setBaseline('reading-slide', { mapRit: 185, lexile: 375 });
    store.setProjection('reading-slide', true);
    store.setBaseline('reading-slide', { mapRit: null });
    expect(store.activeTrack!.projectionOn).toBe(false);
  });

  it("today counts toward the projection only once something is logged", () => {
    const s = stateWith(READING_SLIDE, [['2026-10-01', ['read', 'write', 'closeout']]], {
      startDate: d('2026-10-01'), baseline: { mapRit: 185 }, projectionOn: true,
    });
    expect(projectionFor(READING_SLIDE, s, d('2026-10-02'))!.daysElapsed).toBe(1);
    s.entries['2026-10-02'] = { ...makeEntry(READING_SLIDE, d('2026-10-02')), completed: { read: true } };
    expect(projectionFor(READING_SLIDE, s, d('2026-10-02'))!.daysElapsed).toBe(2);
    const fresh = stateWith(READING_SLIDE, [], { startDate: d('2026-10-01'), baseline: { mapRit: 185 }, projectionOn: true });
    expect(projectionFor(READING_SLIDE, fresh, d('2026-10-01'))!.daysElapsed).toBe(0);
  });

  it('the digest scores chores only once confirmed, and counts the bonus', () => {
    let e = toggleActivity(HOME_HELPER, makeEntry(HOME_HELPER, d('2026-10-06')), 'bed');
    const s = stateWith(HOME_HELPER, [], { entries: { '2026-10-06': e } });
    let dg = buildDigest({ def: HOME_HELPER, state: s, kidName: 'D', now: new Date(2026, 9, 7) });
    expect(dg.facts.daysLogged).toBe(1);
    expect(dg.facts.pointsThisWeek).toBe(0);
    e = confirmActivity(HOME_HELPER, e, 'bed');
    s.entries['2026-10-06'] = e;
    s.bonusCompleted = { 1: d('2026-10-07') };
    dg = buildDigest({ def: HOME_HELPER, state: s, kidName: 'D', now: new Date(2026, 9, 7) });
    expect(dg.facts.pointsThisWeek).toBe(2 + 5);
    expect(dg.facts.pointsThisWeek).toBeLessThanOrEqual(dg.facts.maxPointsThisWeek);
  });

  it("a parent's custom chores show up in the digest", () => {
    const custom = [{ id: asActivityId('dishes'), label: 'Dishes', icon: '🍽️', points: 4, needsParentConfirm: true, fields: [] }];
    const e = { ...makeEntry(HOME_HELPER, d('2026-10-06')), completed: { dishes: true }, confirmed: { dishes: true } };
    const s = stateWith(HOME_HELPER, [], { customActivities: custom, entries: { '2026-10-06': e } });
    const dg = buildDigest({ def: HOME_HELPER, state: s, kidName: 'D', now: new Date(2026, 9, 7) });
    expect(dg.facts.daysLogged).toBe(1);
    expect(dg.facts.pointsThisWeek).toBe(4);
  });
});

describe('group rules hold the line (FR17, FR31)', () => {
  const rules = JSON.parse(readFileSync(fileURLToPath(new URL('../../firebase.rules.json', import.meta.url)), 'utf8')).rules;
  const g = rules.v2.groups.$groupId;

  it('a challenge owner may only REMOVE a member, never rewrite their points or team', () => {
    const w: string = g.members.$key['.write'];
    // The owner clause sits inside the !newData.exists() branch.
    const ownerAt = w.indexOf("child('meta').child('ownerUid')");
    const deleteAt = w.indexOf('!newData.exists() && (');
    expect(deleteAt).toBeGreaterThan(-1);
    expect(ownerAt).toBeGreaterThan(deleteAt);
  });

  it("a member's team can be set once and never changed", () => {
    expect(g.members.$key.team['.validate']).toContain('newData.val() === data.val()');
  });

  it('a team challenge requires a team on every member', () => {
    expect(g.members.$key['.validate']).toContain("newData.hasChild('team')");
  });

  it('new teams only while the challenge is open; the owner can remove any team', () => {
    const w: string = g.teams.$teamId['.write'];
    expect(w).toContain("child('open').val() === true");
    expect(w).toMatch(/!newData\.exists\(\) && root\.child\('v2'\)\.child\('groups'\)\.child\(\$groupId\)\.child\('meta'\)\.child\('ownerUid'\)/);
  });

  it('there is still no read on v2/groups as a whole', () => {
    expect(rules.v2.groups['.read']).toBeUndefined();
  });

  it('the paste file is the rules file minus its comment', () => {
    const full = JSON.parse(readFileSync(fileURLToPath(new URL('../../firebase.rules.json', import.meta.url)), 'utf8'));
    const paste = JSON.parse(readFileSync(fileURLToPath(new URL('../../firebase.rules.paste.json', import.meta.url)), 'utf8'));
    delete full._comment;
    expect(paste).toEqual(full);
  });
});
