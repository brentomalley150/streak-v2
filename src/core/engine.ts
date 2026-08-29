/**
 * The track engine. Pure functions over state + a TrackDefinition.
 *
 * INVARIANT: no track id appears anywhere in this file. Everything is read
 * from the definition passed in. This is the executable form of PRD
 * Assumption 1 ("the engine generalizes"), and engine.test.ts asserts it.
 */
import type {
  DateKey, DayEntry, Rank, TrackDefinition, TrackState, TrackStats,
} from './types.js';
import { asDateKey } from './types.js';

export const todayKey = (d: Date = new Date()): DateKey =>
  asDateKey(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  );

export function addDays(key: DateKey, n: number): DateKey {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return todayKey(new Date(y, m - 1, d + n));
}

/** A blank entry for a date. Activity keys come from the definition. */
export function makeEntry(def: TrackDefinition, date: DateKey): DayEntry {
  return {
    date,
    trackId: def.trackId,
    completed: {},
    values: {},
    points: 0,
    comboClaimed: false,
  };
}

export function getEntry(
  state: TrackState, def: TrackDefinition, date: DateKey,
): DayEntry {
  return state.entries[date] ?? makeEntry(def, date);
}

/** Points for one day = sum of completed activities' point values. */
export function pointsForEntry(def: TrackDefinition, entry: DayEntry): number {
  return def.activities.reduce(
    (sum, a) => (entry.completed[a.id] ? sum + a.points : sum),
    0,
  );
}

export function maxPointsPerDay(def: TrackDefinition): number {
  return def.activities.reduce((sum, a) => sum + a.points, 0);
}

/** An entry counts as activity only if at least one activity is completed. */
export function isActiveEntry(entry: DayEntry): boolean {
  return Object.values(entry.completed).some(Boolean);
}

/**
 * Current streak = consecutive active days ending today or yesterday.
 * Yesterday still counts: the streak is alive until today is over.
 */
export function currentStreak(state: TrackState, today: DateKey = todayKey()): number {
  const active = (k: DateKey) => {
    const e = state.entries[k];
    return e !== undefined && isActiveEntry(e);
  };
  let cursor: DateKey = active(today) ? today : addDays(today, -1);
  if (!active(cursor)) return 0;
  let n = 0;
  while (active(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function longestStreak(state: TrackState): number {
  const keys = Object.keys(state.entries).sort();
  let best = 0, run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    const e = state.entries[k];
    if (e === undefined || !isActiveEntry(e)) { run = 0; prev = k; continue; }
    run = prev !== null && addDays(asDateKey(prev), 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

/** Stat columns are declared by the track, so this never names a field. */
export function computeStatColumns(
  def: TrackDefinition, state: TrackState,
): Record<string, number> {
  const out: Record<string, number> = {};
  const entries = Object.values(state.entries);
  for (const col of def.statColumns) {
    const [kind, key] = col.from.split(':') as [string, string];
    out[col.id] = entries.reduce((sum, e) => {
      if (kind === 'sum') {
        const v = e.values[key];
        return sum + (typeof v === 'number' ? v : 0);
      }
      return sum + (e.completed[key] ? 1 : 0);
    }, 0);
  }
  return out;
}

export function rankFor(ladder: readonly Rank[], points: number): {
  rank: Rank; next: Rank | null;
} {
  // A ladder always has at least one rung; guard anyway for noUncheckedIndexedAccess.
  const first = ladder[0];
  if (first === undefined) throw new Error('ladder is empty');
  let rank: Rank = first;
  let next: Rank | null = ladder[1] ?? null;
  for (let i = 0; i < ladder.length; i += 1) {
    const r = ladder[i];
    if (r !== undefined && points >= r.min) {
      rank = r;
      next = ladder[i + 1] ?? null;
    }
  }
  return { rank, next };
}

export function computeStats(
  def: TrackDefinition,
  state: TrackState,
  ladder: readonly Rank[],
  today: DateKey = todayKey(),
): TrackStats {
  const entries = Object.values(state.entries);
  const earned = entries.reduce((s, e) => s + pointsForEntry(def, e), 0);
  const adjustments = Object.values(state.weeklyAdjustments)
    .reduce((s, n) => s + n, 0);
  const points = earned + adjustments + state.pointAdjustments;
  const { rank, next } = rankFor(ladder, points);
  return {
    points,
    currentStreak: currentStreak(state, today),
    longestStreak: longestStreak(state),
    daysDone: entries.filter(isActiveEntry).length,
    stats: computeStatColumns(def, state),
    rank,
    nextRank: next,
    pointsToNext: next ? Math.max(0, next.min - points) : 0,
  };
}

/** Toggle one activity. Returns a new entry; caller persists it. */
export function toggleActivity(
  def: TrackDefinition, entry: DayEntry, activityId: string,
): DayEntry {
  const known = def.activities.some((a) => a.id === activityId);
  if (!known) throw new Error(`unknown activity "${activityId}" for track ${def.trackId}`);
  const completed = { ...entry.completed, [activityId]: !entry.completed[activityId] };
  const updated: DayEntry = { ...entry, completed };
  return { ...updated, points: pointsForEntry(def, updated) };
}

/** Which challenge week a date falls in (1-based), clamped to track length. */
export function weekNumber(def: TrackDefinition, start: DateKey, date: DateKey): number {
  const toMs = (k: DateKey) => {
    const [y, m, d] = k.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d).getTime();
  };
  const days = Math.floor((toMs(date) - toMs(start)) / 86_400_000);
  return Math.min(Math.max(1, Math.floor(days / 7) + 1), def.lengthWeeks);
}

export function challengeForWeek(
  def: TrackDefinition, week: number,
): TrackDefinition['weeklyChallenges'][number] | null {
  return def.weeklyChallenges.find((c) => c.week === week) ?? null;
}

/** FR7 — free tier allows one active track. */
export function canEnroll(
  entitlement: 'free' | 'family', enrolledCount: number,
): boolean {
  return entitlement === 'family' || enrolledCount < 1;
}
