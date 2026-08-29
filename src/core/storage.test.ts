import { describe, it, expect, beforeEach } from 'vitest';
import { KEYS, migrate, migrateV1State, loadProfiles, readV1Profiles } from './storage.js';
import { computeStats, currentStreak } from './engine.js';
import { READING_SLIDE } from '../tracks/reading-slide.js';
import { LADDERS } from '../tracks/ladders.js';
import { asDateKey } from './types.js';

/** Minimal in-memory Storage so tests need no DOM. */
class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

/** A realistic v1 blob, in v1's exact shape (snake_case fields and all). */
const v1State = {
  player: { name: 'Declan' },
  playerAvatar: '👑',
  preference: 'chess',
  summerStart: '2026-06-01',
  pointAdjustments: 5,
  weeklyAdjustments: { 1: 10 },
  entries: {
    '2026-06-01': { date: '2026-06-01', read: true, write: true, math: false, closeout: false,
      minutes: 20, book: 'Hatchet', writing_topic: 'My dog', words: 40,
      books_finished: 0, combo_claimed: false, points: 6 },
    '2026-06-02': { date: '2026-06-02', read: true, write: false, math: true, closeout: false,
      minutes: 25, book: 'Hatchet', books_finished: 1, points: 5 },
    // v1's ghost entry: created but nothing done. Must not count.
    '2026-06-03': { date: '2026-06-03', read: false, write: false, math: false, closeout: false,
      minutes: 0, book: '', points: 0 },
  },
  prizes: [{ id: 'pz1', name: 'Elitch Gardens', icon: '🎢', cost: 140, claimed: false }],
  claimHistory: ['sticker'],
  baseline: { mapRit: 185, lexile: 375, writtenExpression: 17 },
  friends: ['Sebastian'],
  parentAuth: { setupComplete: true, adminName: 'Kate', adminPinHash: 'x9', parents: [] },
  coParentName: 'Kate', coParentEmail: 'kate@example.com',
};

let ls: MemStorage;
beforeEach(() => {
  ls = new MemStorage();
  ls.setItem(KEYS.v1Profiles, JSON.stringify([{ id: 'p_declan', state: v1State }]));
});

describe('migration preserves the family (DATA-MODEL §5.1)', () => {
  it('carries every logged day across', () => {
    const s = migrateV1State('p_declan', v1State);
    const t = s.tracks['reading-slide']!;
    expect(Object.keys(t.entries)).toHaveLength(3);
  });

  it('translates v1 booleans into completed{} keyed by activity id', () => {
    const s = migrateV1State('p_declan', v1State);
    const e = s.tracks['reading-slide']!.entries['2026-06-01']!;
    expect(e.completed).toEqual({ read: true, write: true });
    expect(e.completed['math']).toBeUndefined();
  });

  it('translates snake_case payload fields into values{}', () => {
    const s = migrateV1State('p_declan', v1State);
    const e = s.tracks['reading-slide']!.entries['2026-06-01']!;
    expect(e.values).toMatchObject({ minutes: 20, book: 'Hatchet', writingTopic: 'My dog', words: 40 });
  });

  it('keeps prizes, claim history, baseline and parent auth', () => {
    const s = migrateV1State('p_declan', v1State);
    const t = s.tracks['reading-slide']!;
    expect(t.prizes).toHaveLength(1);
    expect(t.claimHistory).toEqual(['sticker']);
    expect(t.baseline['mapRit']).toBe(185);
    expect(s.parentAuth.adminName).toBe('Kate');
    expect(s.parentAuth.adminPinHash).toBe('x9');
  });

  it('preserves the theme as a per-track value', () => {
    const s = migrateV1State('p_declan', v1State);
    expect(s.tracks['reading-slide']!.theme).toBe('chess');
  });
});

describe('§5.4 rule 4 — computed stats must be identical after migration', () => {
  it('produces the same points v1 would have', () => {
    // v1 stored a per-day `points` value and summed THAT. v2 recomputes from the
    // track's activity definitions instead, so points can never drift from what
    // was actually completed. Both agree here, which is the property that matters:
    //   day1 read(3)+write(3) = 6   day2 read(3)+math(2) = 5   day3 ghost = 0
    //   + weeklyAdjustments 10 + pointAdjustments 5 = 26
    const stored = Object.values(v1State.entries).reduce((n, e) => n + (e.points ?? 0), 0);
    const v1Total = stored + 10 + 5;

    const s = migrateV1State('p_declan', v1State);
    const stats = computeStats(READING_SLIDE, s.tracks['reading-slide']!,
      LADDERS['chess']!, asDateKey('2026-06-03'));

    expect(stats.points).toBe(26);
    expect(stats.points).toBe(v1Total); // recomputed === v1's stored total
  });

  it('recomputes rather than trusting a stored total that disagrees', () => {
    // If a v1 entry's stored points were wrong (hand-edited, or an old scoring
    // rule), v2 uses the activities as the source of truth. This is deliberate:
    // a stored total that drifts from what was completed is unfixable later.
    const tampered = structuredClone(v1State) as typeof v1State;
    (tampered.entries['2026-06-01'] as { points: number }).points = 999;
    const s = migrateV1State('p_declan', tampered);
    const stats = computeStats(READING_SLIDE, s.tracks['reading-slide']!,
      LADDERS['chess']!, asDateKey('2026-06-03'));
    expect(stats.points).toBe(26); // unchanged — 999 is ignored
  });

  it('does not let the ghost entry inflate the streak', () => {
    const s = migrateV1State('p_declan', v1State);
    // Only 06-01 and 06-02 were real; 06-03 is empty, so on 06-03 the run is 2.
    expect(currentStreak(s.tracks['reading-slide']!, asDateKey('2026-06-03'))).toBe(2);
  });

  it('does not let the ghost entry inflate days-done', () => {
    const s = migrateV1State('p_declan', v1State);
    const stats = computeStats(READING_SLIDE, s.tracks['reading-slide']!,
      LADDERS['chess']!, asDateKey('2026-06-03'));
    expect(stats.daysDone).toBe(2);
  });

  it('carries the stat columns v1 tracked', () => {
    const s = migrateV1State('p_declan', v1State);
    const stats = computeStats(READING_SLIDE, s.tracks['reading-slide']!,
      LADDERS['chess']!, asDateKey('2026-06-03'));
    expect(stats.stats['totalMinutes']).toBe(45);
    expect(stats.stats['totalWords']).toBe(40);
  });
});

describe('§5.4 safety rules', () => {
  it('rule 1 — backs up the raw v1 blob before transforming', () => {
    migrate(ls);
    expect(ls.getItem(KEYS.backup)).toBeTruthy();
    expect(JSON.parse(ls.getItem(KEYS.backup)!)[0].state.entries['2026-06-01'].read).toBe(true);
  });

  it('rule 2 — never destroys v1 data', () => {
    migrate(ls);
    expect(ls.getItem(KEYS.v1Profiles)).toBeTruthy();
  });

  it('rule 3 — is idempotent', () => {
    expect(migrate(ls).migrated).toBe(1);
    expect(migrate(ls).migrated).toBe(0);
    expect(loadProfiles(ls)).toHaveLength(1);
  });

  it('stamps schemaVersion 2', () => {
    migrate(ls);
    expect(loadProfiles(ls)[0]!.schemaVersion).toBe(2);
  });
});

describe("v1's own legacy chain", () => {
  it('migrates a pre-profile blob from declan-dashboard-v2', () => {
    const bare = new MemStorage();
    bare.setItem(KEYS.v1Legacy2, JSON.stringify(v1State));
    expect(readV1Profiles(bare)).toHaveLength(1);
    expect(migrate(bare).migrated).toBe(1);
  });

  it('does nothing for a brand-new family', () => {
    const fresh = new MemStorage();
    expect(migrate(fresh)).toEqual({ migrated: 0, skipped: 0 });
    expect(fresh.getItem(KEYS.backup)).toBeNull();
  });

  it('survives corrupt JSON without throwing', () => {
    const bad = new MemStorage();
    bad.setItem(KEYS.v1Profiles, '{not json');
    expect(() => migrate(bad)).not.toThrow();
  });
});
