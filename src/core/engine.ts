/**
 * The track engine. Pure functions over state + a TrackDefinition.
 *
 * INVARIANT: no track id appears anywhere in this file. Everything is read
 * from the definition passed in. This is the executable form of PRD
 * Assumption 1 ("the engine generalizes"), and engine.test.ts asserts it.
 */
import type {
  Activity, DateKey, DayEntry, IdeaPool, Prize, Rank, TrackDefinition, TrackState, TrackStats,
  TrackVariant,
} from './types.js';
import { BILLING_ENABLED } from './flags.js';
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

/**
 * The definition as this kid actually plays it. A track that allows it can
 * have its activity list replaced by a parent (Home Helper's chores), and a
 * track with variants takes on the kid's pick (Music's instrument). Any other
 * track is returned untouched.
 */
export function effectiveDef(def: TrackDefinition, state: TrackState | null | undefined): TrackDefinition {
  return withVariant(withCustomActivities(def, state), state?.variant);
}

function withCustomActivities(def: TrackDefinition, state: TrackState | null | undefined): TrackDefinition {
  if (!def.customizableActivities) return def;
  const custom = state?.customActivities;
  const removed = state?.retiredCustomActivities ?? [];
  if ((!custom || custom.length === 0) && removed.length === 0) return def;
  const activities = custom && custom.length ? custom : def.activities;
  const live = new Set(activities.map((a) => String(a.id)));
  return {
    ...def,
    activities,
    // Removed chores keep scoring so history never loses points.
    retiredActivities: [
      ...(def.retiredActivities ?? []),
      ...removed.filter((a) => !live.has(String(a.id))),
    ],
  };
}

/** The kid's chosen variant, or null if none is picked (or it no longer exists). */
export function variantFor(def: TrackDefinition, variantId: string | undefined): TrackVariant | null {
  if (!variantId) return null;
  return def.variants?.options.find((v) => v.id === variantId) ?? null;
}

/**
 * Words only — ids, points and fields stay put, so switching instrument never
 * moves a single point.
 */
function withVariant(def: TrackDefinition, variantId: string | undefined): TrackDefinition {
  const v = variantFor(def, variantId);
  if (!v) return def;
  const activities = def.activities.map((a) => {
    const o = v.activities?.[String(a.id)];
    if (!o) return a;
    return {
      ...a,
      icon: o.icon ?? a.icon,
      fields: a.fields.map((f) => {
        const placeholder = o.placeholders?.[f.id];
        return placeholder ? { ...f, placeholder } : f;
      }),
    };
  });
  const ideas: Record<string, IdeaPool> = { ...(def.ideas ?? {}) };
  for (const [actId, list] of Object.entries(v.ideas ?? {})) {
    ideas[actId] = { ...(ideas[actId] ?? {}), '*': list };
  }
  return { ...def, activities, ideas };
}

/** True when an activity's tap has earned its points. */
export function activityScores(a: Activity, entry: DayEntry): boolean {
  if (!entry.completed[a.id]) return false;
  return !a.needsParentConfirm || entry.confirmed?.[a.id] === true;
}

/**
 * Points for one day = sum of completed activities' point values.
 * Retired activities still score, so history never loses points; activities
 * that need a parent's confirmation score only once confirmed.
 */
export function pointsForEntry(def: TrackDefinition, entry: DayEntry): number {
  const all = [...def.activities, ...(def.retiredActivities ?? [])];
  return all.reduce((sum, a) => (activityScores(a, entry) ? sum + a.points : sum), 0);
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

/** Points from weekly bonus activities completed in this version (FR26). */
export function bonusPoints(def: TrackDefinition, state: TrackState): number {
  const per = def.weeklyBonusPoints ?? 0;
  return Object.keys(state.bonusCompleted ?? {}).length * per;
}

export function computeStats(
  rawDef: TrackDefinition,
  state: TrackState,
  ladder: readonly Rank[],
  today: DateKey = todayKey(),
): TrackStats {
  const def = effectiveDef(rawDef, state);
  const entries = Object.values(state.entries);
  const earned = entries.reduce((s, e) => s + pointsForEntry(def, e), 0);
  const adjustments = Object.values(state.weeklyAdjustments)
    .reduce((s, n) => s + n, 0);
  const points = earned + adjustments + state.pointAdjustments + bonusPoints(def, state);
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
  // Un-ticking clears any parent confirmation, so a re-tick needs a fresh one.
  const confirmed = { ...(entry.confirmed ?? {}) };
  if (!completed[activityId]) delete confirmed[activityId];
  const updated: DayEntry = { ...entry, completed, confirmed };
  return { ...updated, points: pointsForEntry(def, updated) };
}

/** A parent confirms a chore the kid ticked (FR30). Returns a new entry. */
export function confirmActivity(
  def: TrackDefinition, entry: DayEntry, activityId: string,
): DayEntry {
  if (!entry.completed[activityId]) return entry;
  const confirmed = { ...(entry.confirmed ?? {}), [activityId]: true };
  const updated: DayEntry = { ...entry, confirmed };
  return { ...updated, points: pointsForEntry(def, updated) };
}

/** Ticked chores still waiting for a parent, oldest first. */
export function pendingConfirmations(
  rawDef: TrackDefinition, state: TrackState,
): Array<{ date: DateKey; activity: Activity }> {
  const def = effectiveDef(rawDef, state);
  const all = [...def.activities, ...(def.retiredActivities ?? [])];
  const out: Array<{ date: DateKey; activity: Activity }> = [];
  for (const key of Object.keys(state.entries).sort()) {
    const e = state.entries[key];
    if (!e) continue;
    for (const a of all) {
      if (a.needsParentConfirm && e.completed[a.id] && e.confirmed?.[a.id] !== true) {
        out.push({ date: asDateKey(key), activity: a });
      }
    }
  }
  return out;
}

/* ---- Theme ideas (FR24) ------------------------------------------------ */

/** Days since 1970 for a date key — a stable seed that changes once a day. */
function dayNumber(date: DateKey): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * Ideas for one activity, for the kid's theme, rotating daily. Falls back to
 * the '*' list when a theme has none. Deterministic: the same day always
 * shows the same ideas, so nothing reshuffles while a kid is looking.
 */
export function ideasFor(
  def: TrackDefinition, activityId: string, theme: string, date: DateKey, count = 2,
): string[] {
  const pool = def.ideas?.[activityId];
  if (!pool) return [];
  const list = pool[theme] ?? pool['*'] ?? [];
  if (list.length <= count) return [...list];
  const start = dayNumber(date) % list.length;
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) out.push(list[(start + i) % list.length]!);
  return out;
}

/* ---- Routine from scores (FR22) ---------------------------------------- */

export interface RoutinePlan {
  /** e.g. "Books around 275–425L", shown on the level activity. */
  level: { activityId: string; text: string } | null;
  /** The one activity to emphasise, and why — never the score itself. */
  focus: { activityId: string; tip: string } | null;
}

/**
 * Fixed rules from the track's RoutineRules. No scores entered means no
 * personalisation: the routine still runs at its default targets.
 */
export function routinePlan(
  def: TrackDefinition, baseline: Record<string, number | null> | undefined,
): RoutinePlan {
  const rules = def.outcomeModel?.routine;
  const b = baseline ?? {};
  const num = (k: string): number | null => {
    const v = b[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  if (!rules) return { level: null, focus: null };

  let level: RoutinePlan['level'] = null;
  if (rules.levelField && rules.levelActivityId) {
    const v = num(rules.levelField);
    if (v !== null) {
      const [lo, hi] = rules.levelBand ?? [0, 0];
      const unit = rules.levelUnit ?? '';
      level = {
        activityId: rules.levelActivityId,
        text: `Books around ${Math.max(0, v + lo)}–${v + hi}${unit}`,
      };
    }
  }

  let focus: RoutinePlan['focus'] = null;
  let lowest = Infinity;
  for (const f of rules.focus) {
    const v = num(f.fieldId);
    if (v !== null && v < lowest) { lowest = v; focus = { activityId: f.activityId, tip: f.tip }; }
  }
  return { level, focus };
}

/* ---- Prizes (FR27–FR28) ------------------------------------------------ */

export type PrizeStatus = 'locked' | 'unlocked' | 'requested' | 'given';

/** Prizes unlock like ranks. Cashing in changes status, never points. */
export function prizeStatus(prize: Prize, points: number): PrizeStatus {
  if (prize.claimed) return 'given';
  if (points < prize.cost) return 'locked';
  return prize.requestedAt ? 'requested' : 'unlocked';
}

/* ---- Challenge windows (FR29) ------------------------------------------ */

export interface WindowStatus {
  phase: 'upcoming' | 'running' | 'ended';
  /** 1-based day within the challenge while running. */
  day: number;
  totalDays: number;
  endDate: DateKey;
}

export function challengeWindow(
  startDate: DateKey, lengthWeeks: number, today: DateKey = todayKey(),
): WindowStatus {
  const totalDays = Math.max(1, Math.round(lengthWeeks * 7));
  const endDate = addDays(startDate, totalDays - 1);
  if (today < startDate) return { phase: 'upcoming', day: 0, totalDays, endDate };
  if (today > endDate) return { phase: 'ended', day: totalDays, totalDays, endDate };
  let day = 1;
  for (let k = startDate; k < today; k = addDays(k, 1)) day += 1;
  return { phase: 'running', day, totalDays, endDate };
}

/**
 * Points earned inside a challenge's window — what a time-boxed challenge
 * compares, so a kid who has played for months does not start ahead of one who
 * joined today. Bonus activities count in the week they were done.
 */
export function pointsInWindow(
  rawDef: TrackDefinition, state: TrackState, startDate: DateKey, lengthWeeks: number,
): number {
  const def = effectiveDef(rawDef, state);
  const { endDate } = challengeWindow(startDate, lengthWeeks, startDate);
  let pts = 0;
  for (const e of Object.values(state.entries)) {
    if (e.date >= startDate && e.date <= endDate) pts += pointsForEntry(def, e);
  }
  const per = def.weeklyBonusPoints ?? 0;
  for (const d of Object.values(state.bonusCompleted ?? {})) {
    if (d >= startDate && d <= endDate) pts += per;
  }
  return pts;
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

/**
 * FR7 — free tier allows one active track.
 *
 * Pure and unconditional: the rule itself is unchanged and still tested. Call
 * sites consult `canEnrollNow()` instead, which honours the billing flag, so
 * the rule survives intact while billing is switched off.
 */
export function canEnroll(
  entitlement: 'free' | 'family', enrolledCount: number,
): boolean {
  return entitlement === 'family' || enrolledCount < 1;
}

/**
 * What the UI should actually allow right now. With billing off, everything is
 * enrollable — we do not enforce a limit we are not charging for.
 */
export function canEnrollNow(
  entitlement: 'free' | 'family', enrolledCount: number,
): boolean {
  return !BILLING_ENABLED || canEnroll(entitlement, enrolledCount);
}
