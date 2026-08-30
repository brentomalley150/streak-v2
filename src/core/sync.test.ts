import { describe, it, expect } from 'vitest';
import { buildRow, leaderboardKey, weekStartKey, weeklyPoints, NullBackend } from './sync.js';
import { makeEntry, pointsForEntry } from './engine.js';
import { asDateKey, type DayEntry, type TrackDefinition, type TrackState } from './types.js';
import { READING_SLIDE } from '../tracks/reading-slide.js';
import { MATH_FACTS } from '../tracks/math-facts.js';
import { LADDERS } from '../tracks/ladders.js';

const d = asDateKey;
const USER = { uid: 'u_abc', email: 'kate@example.com', displayName: 'Kate O.' };

function stateWith(def: TrackDefinition, days: Array<[string, string[]]>): TrackState {
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
  };
}

describe('leaderboard key', () => {
  it('is uid_profileId, so siblings get distinct slots', () => {
    expect(leaderboardKey('u_abc', 'p_declan')).toBe('u_abc_p_declan');
    expect(leaderboardKey('u_abc', 'p_declan')).not.toBe(leaderboardKey('u_abc', 'p_sophie'));
  });
});

describe('week bucketing', () => {
  it('resolves any day to that week’s Monday', () => {
    expect(weekStartKey(new Date(2026, 7, 26))).toBe('2026-08-24'); // Wed -> Mon
    expect(weekStartKey(new Date(2026, 7, 24))).toBe('2026-08-24'); // Mon -> itself
    expect(weekStartKey(new Date(2026, 7, 30))).toBe('2026-08-24'); // Sun -> that Mon
  });

  it('counts only points earned since Monday', () => {
    const s = stateWith(READING_SLIDE, [
      ['2026-08-23', ['read', 'write']], // Sunday — previous week
      ['2026-08-24', ['read']],          // Monday  — 3
      ['2026-08-26', ['read', 'math']],  // Wednesday — 5
    ]);
    expect(weeklyPoints(READING_SLIDE, s, new Date(2026, 7, 26))).toBe(8);
  });
});

describe('buildRow', () => {
  const now = new Date(2026, 7, 26);

  it('projects track-declared stats, not fixed columns', () => {
    const s = stateWith(READING_SLIDE, [['2026-08-24', ['read']], ['2026-08-25', ['read']]]);
    s.entries['2026-08-24']!.values['minutes'] = 20;
    s.entries['2026-08-25']!.values['minutes'] = 25;
    const row = buildRow({
      def: READING_SLIDE, state: s, ladder: LADDERS['chess']!, user: USER,
      profileId: 'p_declan', playerName: 'Declan', playerAvatar: '👑', now,
    });
    expect(row.stats['totalMinutes']).toBe(45);
    expect(Object.keys(row.stats)).toEqual(READING_SLIDE.statColumns.map((c) => c.id));
  });

  it('carries the track id so the row lands under the right path', () => {
    const s = stateWith(MATH_FACTS, [['2026-08-24', ['drill']]]);
    const row = buildRow({
      def: MATH_FACTS, state: s, ladder: LADDERS['gaming']!, user: USER,
      profileId: 'p_declan', playerName: 'Declan', playerAvatar: '👑', now,
    });
    expect(row.trackId).toBe('math-facts');
    expect(row.rank).toBe('Level 1');           // gaming ladder, not chess
    expect(Object.keys(row.stats)).not.toContain('totalMinutes');
  });

  it('publishes a first name only — never a last name, photo or location', () => {
    // The promise the consent screen makes to the parent, asserted.
    const s = stateWith(READING_SLIDE, [['2026-08-24', ['read']]]);
    const row = buildRow({
      def: READING_SLIDE, state: s, ladder: LADDERS['chess']!, user: USER,
      profileId: 'p_declan', playerName: 'Declan', playerAvatar: '👑', now,
    });
    const json = JSON.stringify(row);
    expect(row.name).toBe('Declan');
    expect(json).not.toContain('O.');            // the parent's surname
    expect(json).not.toContain(USER.displayName);
    for (const k of ['photo', 'photoURL', 'location', 'lastName', 'address']) {
      expect(Object.keys(row)).not.toContain(k);
    }
  });

  it('separates lifetime points from this week’s points', () => {
    const s = stateWith(READING_SLIDE, [
      ['2026-08-17', ['read', 'write']], // last week — 6
      ['2026-08-24', ['read']],          // this week — 3
    ]);
    const row = buildRow({
      def: READING_SLIDE, state: s, ladder: LADDERS['chess']!, user: USER,
      profileId: 'p_declan', playerName: 'Declan', playerAvatar: '👑', now,
    });
    expect(row.points).toBe(9);
    expect(row.weeklyPoints).toBe(3);
  });
});

describe('NullBackend — the app must work with no Firebase', () => {
  it('reports itself disabled and yields no user', () => {
    const b = new NullBackend();
    expect(b.enabled).toBe(false);
    expect(b.user).toBeNull();
  });

  it('publishes and rolls up without throwing', async () => {
    const b = new NullBackend();
    await expect(b.publish()).resolves.toBeUndefined();
    await expect(b.saveRollup()).resolves.toBeUndefined();
  });

  it('yields an empty leaderboard rather than hanging', () => {
    const b = new NullBackend();
    let rows: unknown[] | null = null;
    b.subscribeLeaderboard('reading-slide', (r) => { rows = r; });
    expect(rows).toEqual([]);
  });

  it('fails loudly only when sign-in is actually attempted', async () => {
    await expect(new NullBackend().signIn()).rejects.toThrow(/not configured/);
  });
});

describe('buildRow must not publish the parent’s identity', () => {
  it('carries no email field', () => {
    const s = stateWith(READING_SLIDE, [['2026-08-24', ['read']]]);
    const row = buildRow({
      def: READING_SLIDE, state: s, ladder: LADDERS['chess']!, user: USER,
      profileId: 'p_declan', playerName: 'Declan', playerAvatar: '👑',
      now: new Date(2026, 7, 26),
    });
    expect(JSON.stringify(row)).not.toContain(USER.email);
    expect('ownerEmail' in row).toBe(false);
  });
});
