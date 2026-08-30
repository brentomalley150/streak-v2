import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  computeStats, currentStreak, longestStreak, pointsForEntry, rankFor,
  toggleActivity, makeEntry, weekNumber, canEnroll, canEnrollNow, computeStatColumns, addDays,
} from './engine.js';
import { asDateKey, type DayEntry, type Rank, type TrackDefinition, type TrackState } from './types.js';
import { READING_SLIDE } from '../tracks/reading-slide.js';
import { MATH_FACTS } from '../tracks/math-facts.js';
import { LADDERS } from '../tracks/ladders.js';

const d = asDateKey;

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

describe('the engine never names a track', () => {
  it('contains no track id literals', () => {
    const src = readFileSync(fileURLToPath(new URL('./engine.ts', import.meta.url)), 'utf8');
    // The whole bet of the v2 architecture: adding a track must not touch the engine.
    for (const id of ['reading-slide', 'math-facts', 'music-practice', 'back-to-school']) {
      expect(src).not.toContain(id);
    }
    // Nor v1's hardcoded activity vocabulary.
    for (const word of ["'read'", "'write'", "'closeout'", "'minutes'", "'booksFinished'"]) {
      expect(src).not.toContain(word);
    }
  });
});

describe('points', () => {
  it('sums only completed activities, using the track definition', () => {
    const e = makeEntry(READING_SLIDE, d('2026-06-01'));
    e.completed['read'] = true;   // 3
    e.completed['math'] = true;   // 2
    expect(pointsForEntry(READING_SLIDE, e)).toBe(5);
  });

  it('scores the same shape differently per track', () => {
    const r = makeEntry(READING_SLIDE, d('2026-06-01'));
    r.completed['read'] = true;
    const m = makeEntry(MATH_FACTS, d('2026-06-01'));
    m.completed['drill'] = true;
    expect(pointsForEntry(READING_SLIDE, r)).toBe(3);
    expect(pointsForEntry(MATH_FACTS, m)).toBe(3);
  });

  it('rejects an activity the track does not define', () => {
    const e = makeEntry(READING_SLIDE, d('2026-06-01'));
    expect(() => toggleActivity(READING_SLIDE, e, 'drill')).toThrow(/unknown activity/);
  });
});

describe('streaks', () => {
  it('counts consecutive active days ending today', () => {
    const s = stateWith(READING_SLIDE, [
      ['2026-06-01', ['read']], ['2026-06-02', ['read']], ['2026-06-03', ['read']],
    ]);
    expect(currentStreak(s, d('2026-06-03'))).toBe(3);
  });

  it('stays alive when yesterday was logged but today is not yet', () => {
    const s = stateWith(READING_SLIDE, [['2026-06-01', ['read']], ['2026-06-02', ['read']]]);
    expect(currentStreak(s, d('2026-06-03'))).toBe(2);
  });

  it('breaks after a full missed day', () => {
    const s = stateWith(READING_SLIDE, [['2026-06-01', ['read']], ['2026-06-02', ['read']]]);
    expect(currentStreak(s, d('2026-06-04'))).toBe(0);
  });

  it('ignores empty entries — v1 had a ghost-entry bug here', () => {
    const s = stateWith(READING_SLIDE, [
      ['2026-06-01', ['read']], ['2026-06-02', []], ['2026-06-03', ['read']],
    ]);
    expect(currentStreak(s, d('2026-06-03'))).toBe(1);
  });

  it('finds the longest historical run', () => {
    const s = stateWith(READING_SLIDE, [
      ['2026-06-01', ['read']], ['2026-06-02', ['read']], ['2026-06-03', ['read']],
      ['2026-06-05', ['read']],
    ]);
    expect(longestStreak(s)).toBe(3);
  });
});

describe('ranks come from the track, not the engine', () => {
  const chess = LADDERS['chess'] as readonly Rank[];
  const gaming = LADDERS['gaming'] as readonly Rank[];

  it('maps points onto the chess ladder', () => {
    expect(rankFor(chess, 0).rank.name).toBe('Pawn');
    expect(rankFor(chess, 112).rank.name).toBe('Rook');
    expect(rankFor(chess, 999).rank.name).toBe('Grandmaster');
    expect(rankFor(chess, 999).next).toBeNull();
  });

  it('gives the same points a different rank on a different ladder', () => {
    // The bug found in the prototype: Math Facts showed a chess rank.
    expect(rankFor(chess, 41).rank.name).not.toBe(rankFor(gaming, 41).rank.name);
  });
});

describe('stat columns are declared by the track', () => {
  it('sums a numeric field the track named', () => {
    const s = stateWith(READING_SLIDE, [['2026-06-01', ['read']], ['2026-06-02', ['read']]]);
    s.entries['2026-06-01']!.values['minutes'] = 20;
    s.entries['2026-06-02']!.values['minutes'] = 25;
    expect(computeStatColumns(READING_SLIDE, s)['totalMinutes']).toBe(45);
  });

  it('produces the columns that track declares and no others', () => {
    const s = stateWith(MATH_FACTS, [['2026-06-01', ['drill']]]);
    const cols = Object.keys(computeStatColumns(MATH_FACTS, s));
    expect(cols).toEqual(MATH_FACTS.statColumns.map((c) => c.id));
    expect(cols).not.toContain('totalMinutes');
  });
});

describe('computeStats', () => {
  it('includes weekly adjustments and manual point adjustments', () => {
    const s = stateWith(READING_SLIDE, [['2026-06-01', ['read']]]); // 3
    s.weeklyAdjustments[1] = 10;
    s.pointAdjustments = 5;
    expect(computeStats(READING_SLIDE, s, LADDERS['chess']!, d('2026-06-01')).points).toBe(18);
  });
});

describe('weeks and enrollment', () => {
  it('computes the challenge week from the track start', () => {
    expect(weekNumber(READING_SLIDE, d('2026-06-01'), d('2026-06-01'))).toBe(1);
    expect(weekNumber(READING_SLIDE, d('2026-06-01'), d('2026-06-08'))).toBe(2);
  });

  it('clamps to the track length', () => {
    expect(weekNumber(READING_SLIDE, d('2026-06-01'), d('2027-06-01')))
      .toBe(READING_SLIDE.lengthWeeks);
  });

  it('enforces the free-tier single-track limit (FR7)', () => {
    expect(canEnroll('free', 0)).toBe(true);
    expect(canEnroll('free', 1)).toBe(false);
    expect(canEnroll('family', 5)).toBe(true);
  });
});

describe('date maths', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays(d('2026-06-30'), 1)).toBe('2026-07-01');
    expect(addDays(d('2026-01-01'), -1)).toBe('2025-12-31');
  });
});

describe('billing is switched off while we build', () => {
  it('canEnroll still encodes FR7 unchanged, so the rule survives', () => {
    expect(canEnroll('free', 0)).toBe(true);
    expect(canEnroll('free', 1)).toBe(false);
    expect(canEnroll('family', 5)).toBe(true);
  });

  it('canEnrollNow allows everything while BILLING_ENABLED is false', () => {
    // Nothing should imply a limit we are not charging for.
    expect(canEnrollNow('free', 0)).toBe(true);
    expect(canEnrollNow('free', 3)).toBe(true);
    expect(canEnrollNow('family', 9)).toBe(true);
  });
});
