import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildDigest, retrieveWeek, RuleDiagnostician, projectionNote } from './digest.js';
import { makeEntry, pointsForEntry } from './engine.js';
import { asDateKey, type DayEntry, type TrackDefinition, type TrackState } from './types.js';
import { READING_SLIDE } from '../tracks/reading-slide.js';
import { MUSIC_PRACTICE } from '../tracks/music-practice.js';

const d = asDateKey;
// Monday 24 Aug 2026 → the week under test. "Now" is Sunday, a full week.
const SUN = new Date(2026, 7, 30);

function stateWith(
  def: TrackDefinition, days: Array<[string, string[]]>,
  baseline: Record<string, number | null> = {},
): TrackState {
  const entries: Record<string, DayEntry> = {};
  for (const [date, acts] of days) {
    const e = makeEntry(def, d(date));
    for (const a of acts) e.completed[a] = true;
    e.points = pointsForEntry(def, e);
    entries[date] = e;
  }
  return {
    trackId: def.trackId, enrolledAt: d('2026-08-24'), startDate: d('2026-08-24'),
    theme: 'chess', entries, weeklyChallengesCompleted: {}, weeklyAdjustments: {},
    earnedBadges: {}, pointAdjustments: 0, prizes: [], claimHistory: [], baseline,
  };
}
const week = (days: Array<[string, string[]]>) => stateWith(READING_SLIDE, days);

describe('RETRIEVE — the evidence layer', () => {
  it('counts only this week, ignoring earlier entries', () => {
    const s = week([
      ['2026-08-17', ['read']],                 // previous week
      ['2026-08-24', ['read']], ['2026-08-25', ['read']],
    ]);
    expect(retrieveWeek(READING_SLIDE, s, SUN).daysLogged).toBe(2);
  });

  it('counts completions per activity from the definition', () => {
    const s = week([
      ['2026-08-24', ['read', 'write']], ['2026-08-25', ['read']], ['2026-08-26', ['read']],
    ]);
    const f = retrieveWeek(READING_SLIDE, s, SUN);
    expect(f.perActivity['read']).toBe(3);
    expect(f.perActivity['write']).toBe(1);
  });

  it('sums numeric fields the track declared', () => {
    const s = week([['2026-08-24', ['read']], ['2026-08-25', ['read']]]);
    s.entries['2026-08-24']!.values['minutes'] = 20;
    s.entries['2026-08-25']!.values['minutes'] = 25;
    expect(retrieveWeek(READING_SLIDE, s, SUN).totals['minutes']).toBe(45);
  });

  it('measures the longest gap', () => {
    const s = week([['2026-08-24', ['read']], ['2026-08-28', ['read']]]);
    expect(retrieveWeek(READING_SLIDE, s, SUN).longestGap).toBeGreaterThanOrEqual(3);
  });
});

describe('DIAGNOSE — the five cases from the behavior spec', () => {
  const dx = new RuleDiagnostician();
  const dig = (days: Array<[string, string[]]>) =>
    dx.diagnose(retrieveWeek(READING_SLIDE, week(days), SUN), READING_SLIDE);

  it('volume on pace but one activity skipped — the spec’s headline case', () => {
    // 4 days: enough to see the pattern, not so many that it is a strong week.
    const i = dig([
      ['2026-08-24', ['read']], ['2026-08-25', ['read']],
      ['2026-08-26', ['read']], ['2026-08-27', ['read']],
    ]);
    expect(i.id).toBe('lopsided');
    expect(i.headline.toLowerCase()).toContain('behind on write');
    expect(i.proposal?.kind).toBe('set-focus');
  });

  it('a multi-day gap proposes a SMALLER goal, not catching up', () => {
    const i = dig([['2026-08-24', ['read', 'write']], ['2026-08-29', ['read']]]);
    expect(i.id).toBe('gap');
    expect(i.proposal?.kind).toBe('smaller-goal');
  });

  it('a strong balanced week celebrates and offers a stretch', () => {
    const i = dig([
      ['2026-08-24', ['read', 'write', 'math']], ['2026-08-25', ['read', 'write']],
      ['2026-08-26', ['read', 'write', 'math']], ['2026-08-27', ['read', 'write']],
      ['2026-08-28', ['read', 'write', 'math']],
    ]);
    expect(i.severity).toBe('celebrate');
    expect(i.proposal?.kind).toBe('stretch-goal');
  });

  it('an empty week restarts gently rather than scolding', () => {
    const i = dig([]);
    expect(i.id).toBe('no-activity');
    expect(i.proposal?.kind).toBe('smaller-goal');
  });

  it('a steady week proposes no change at all', () => {
    // Two balanced days: nothing skipped, no gap, not strong enough to celebrate.
    const i = dig([['2026-08-24', ['read', 'write']], ['2026-08-25', ['read', 'write']]]);
    expect(i.id).toBe('steady');
    expect(i.proposal).toBeNull();
  });

  it('surfaces exactly one headline — never ten metrics', () => {
    const i = dig([['2026-08-24', ['read']], ['2026-08-25', ['read']], ['2026-08-26', ['read']]]);
    expect(i.headline.split('\n')).toHaveLength(1);
  });
});

describe('GUARDRAILS (agentic-ai.html §5)', () => {
  const dx = new RuleDiagnostician();
  const allInsights = [
    [] as Array<[string, string[]]>,
    [['2026-08-24', ['read', 'write']], ['2026-08-29', ['read']]],
    [['2026-08-24', ['read']], ['2026-08-25', ['read']],
     ['2026-08-26', ['read']], ['2026-08-27', ['read']]],
    [['2026-08-24', ['read', 'write', 'math']], ['2026-08-25', ['read', 'write']],
     ['2026-08-26', ['read', 'write', 'math']], ['2026-08-27', ['read', 'write']],
     ['2026-08-28', ['read', 'write', 'math']]],
    [['2026-08-24', ['read', 'write']], ['2026-08-25', ['read', 'write']]],
  ].map((days) => dx.diagnose(
    retrieveWeek(READING_SLIDE, week(days as Array<[string, string[]]>), SUN), READING_SLIDE));

  it('1 — every insight cites the numbers it rests on', () => {
    for (const i of allInsights) {
      expect(i.evidence.length).toBeGreaterThan(0);
      for (const e of i.evidence) expect(e).toMatch(/\d/);
    }
  });

  it('2 — a projection is always an estimate, never a promise', () => {
    const withBaseline = stateWith(READING_SLIDE, [['2026-08-24', ['read']]], { mapRit: 185 });
    for (const state of [withBaseline]) {
      const note = projectionNote(retrieveWeek(READING_SLIDE, state, SUN), READING_SLIDE);
      expect(note).toBeTruthy();
      expect(note!.toLowerCase()).toMatch(/projection|estimate/);
      expect(note!.toLowerCase()).toMatch(/not a guarantee/);
      expect(note!.toLowerCase()).not.toMatch(/\bwill (reach|hit|achieve)\b|guaranteed|promise/);
    }
  });

  it('2b — no projection at all without a baseline or an outcome model', () => {
    const noBaseline = stateWith(READING_SLIDE, [['2026-08-24', ['read']]]);
    expect(projectionNote(retrieveWeek(READING_SLIDE, noBaseline, SUN), READING_SLIDE)).toBeNull();
    // Music has outcomeModel: null — PRD open question 7.
    const music = stateWith(MUSIC_PRACTICE, [['2026-08-24', ['practice']]], { anything: 1 });
    expect(projectionNote(retrieveWeek(MUSIC_PRACTICE, music, SUN), MUSIC_PRACTICE)).toBeNull();
  });

  it('3 — never uses clinical or diagnostic language', () => {
    const banned = /dyslex|adhd|disorder|diagnos|deficit|disabilit|impair|syndrome/i;
    for (const i of allInsights) {
      expect(`${i.headline} ${i.detail} ${i.proposal?.nudge ?? ''}`).not.toMatch(banned);
    }
  });

  it('4 — never shames the child or the parent', () => {
    const shaming = /\b(lazy|failed|failing|bad|behind schedule|disappoint|should have|you didn'?t|not good enough|poor)\b/i;
    for (const i of allInsights) {
      expect(`${i.headline} ${i.detail} ${i.proposal?.nudge ?? ''}`).not.toMatch(shaming);
    }
  });

  it('5 — a digest references only this family', () => {
    const digest = buildDigest({ def: READING_SLIDE, state: week([['2026-08-24', ['read']]]),
      kidName: 'Declan', now: SUN });
    const json = JSON.stringify(digest);
    for (const other of ['Sebastian', 'Cooper', 'Sophie']) expect(json).not.toContain(other);
  });

  it('6 — a proposal is inert until confirmed: it carries no side effect', () => {
    const before = week([['2026-08-24', ['read']], ['2026-08-25', ['read']],
      ['2026-08-26', ['read']], ['2026-08-27', ['read']], ['2026-08-28', ['read']]]);
    const snapshot = JSON.stringify(before);
    const digest = buildDigest({ def: READING_SLIDE, state: before, kidName: 'Declan', now: SUN });
    expect(digest.insight.proposal).toBeTruthy();
    // Building a digest must not mutate the kid's data. Only confirm() may.
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('the engine stays track-agnostic', () => {
  it('names no track and no v1 activity vocabulary', () => {
    const src = readFileSync(fileURLToPath(new URL('./digest.ts', import.meta.url)), 'utf8');
    for (const id of ['reading-slide', 'math-facts', 'music-practice']) {
      expect(src).not.toContain(id);
    }
    for (const w of ["'read'", "'write'", "'minutes'"]) expect(src).not.toContain(w);
  });

  it('diagnoses a different track using its own activities', () => {
    const s = stateWith(MUSIC_PRACTICE, [
      ['2026-08-24', ['practice']], ['2026-08-25', ['practice']], ['2026-08-26', ['practice']],
      ['2026-08-27', ['practice']], ['2026-08-28', ['practice']],
    ]);
    const i = new RuleDiagnostician().diagnose(retrieveWeek(MUSIC_PRACTICE, s, SUN), MUSIC_PRACTICE);
    expect(i.id).toBe('strong-week');
    // Music's own max is 7 points/day (3+1+3), not Reading's 9 — so 7 x 7 = 49.
    expect(i.detail).toContain('49');
    const lopsided = new RuleDiagnostician().diagnose(
      retrieveWeek(MUSIC_PRACTICE, stateWith(MUSIC_PRACTICE, [
        ['2026-08-24', ['practice']], ['2026-08-25', ['practice']],
        ['2026-08-26', ['practice']], ['2026-08-27', ['practice']],
      ]), SUN), MUSIC_PRACTICE);
    expect(`${lopsided.headline} ${lopsided.detail}`.toLowerCase()).toMatch(/listen|learn/);
  });
});
