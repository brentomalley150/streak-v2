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
  ideasFor, makeEntry, maxPointsPerDay, pendingConfirmations, PERFECT_DAY_BONUS, pointsForEntry, pointsInWindow, prizeStatus,
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
import { asActivityId, asDateKey, type DayEntry, type TrackDefinition, type TrackState } from './types.js';
import type { AuthUser, Backend, LeaderboardRow } from './sync.js';
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

describe('six kid-chosen themes (FR23)', () => {
  it('every ladder shares the same seven thresholds', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['chess', 'sports', 'gaming', 'music', 'animals', 'dance']);
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

  it('every track offers all six themes', () => {
    for (const t of TRACKS) expect([...t.themes].sort()).toEqual(THEMES.map((x) => x.id).sort());
  });
});

describe('theme ideas for each activity (FR24)', () => {
  it("shows the kid's theme, rotates daily, and is stable within a day", () => {
    const a = ideasFor(READING_SLIDE, 'write', 'animals', d('2026-10-10'));
    expect(a).toHaveLength(2);
    expect(READING_SLIDE.ideas!['write']!['animals']).toEqual(expect.arrayContaining(a));
    expect(ideasFor(READING_SLIDE, 'write', 'animals', d('2026-10-10'))).toEqual(a);
    expect(ideasFor(READING_SLIDE, 'write', 'animals', d('2026-10-11'))).not.toEqual(a);
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
  async createGroup() {}
  async loadGroup() { return null; }
  async joinGroup(groupId: string, key: string, member: GroupMember) { this.joined.push({ groupId, key, member }); }
  async leaveGroup() {}
  async loadMyGroups() { return []; }
  async saveMemberScore(groupId: string, key: string, points: number) { this.scores.push({ groupId, key, points }); }
  async createTeam(groupId: string, teamId: string, team: Team) { this.teams.push({ groupId, teamId, team }); }
  async deleteTeam() {}
}

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
    for (let i = 0; i < 10; i++) await Promise.resolve(); // let background syncs settle
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
