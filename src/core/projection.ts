/**
 * The fall projection — PRD §3.6 (FR25).
 *
 * A rule, not a model:
 *
 *   projected = noRoutine + pace × (fullRoutine − noRoutine)
 *
 * where noRoutine is where a child typically lands after the break with no
 * practice, fullRoutine is baseline + the target gain for doing every day, and
 * pace is the share of the scheduled routine actually completed so far.
 *
 * Guardrails, enforced by code and asserted in projection.test.ts:
 *   - OFF unless a parent turned it on (projectionOn), and needs a baseline.
 *   - Always a RANGE, never a single promised number.
 *   - Parent-only: nothing here is ever published or shown on a kid surface.
 *
 * Projection ids are model names, not track ids, so the engine rule
 * ("no track id outside src/tracks") still holds.
 */
import type { DateKey, TrackDefinition, TrackState } from './types.js';
import { challengeWindow, effectiveDef, todayKey, addDays } from './engine.js';

/**
 * The pilot's working target: +8 RIT over 12 weeks (185 → 193).
 * A hypothesis, not a research figure — see PRD open question 13.
 */
export const READING_V1_TARGET_GAIN_12W = 8;

/**
 * Typical change over a 12-week break with no practice.
 * PROVISIONAL placeholder pending a published source (PRD open question 13).
 * The parent-facing explanation says so.
 */
export const READING_V1_NO_ROUTINE_12W = -2;

/** About MAP's own test-to-test variation, so the range is honest. */
export const READING_V1_RANGE = 3;

export interface ProjectionPoint { score: number; low: number; high: number }

export interface Projection {
  baseline: number;
  noRoutine: number;
  fullRoutine: number;
  /** 0..1 — share of the scheduled routine completed so far. */
  pace: number;
  keepPace: ProjectionPoint;
  finishStrong: ProjectionPoint;
  daysElapsed: number;
  totalDays: number;
  /** Plain-language, for the one-tap "how is this calculated". */
  explanation: string[];
}

interface Inputs {
  baseline: number;
  lengthWeeks: number;
  completed: number;
  perDay: number;
  daysElapsed: number;
  totalDays: number;
}

const point = (score: number): ProjectionPoint => {
  const s = Math.round(score);
  return { score: s, low: s - READING_V1_RANGE, high: s + READING_V1_RANGE };
};

/** The pure calculation, separated so it can be tested with exact numbers. */
export function readingV1(i: Inputs): Projection {
  const scale = i.lengthWeeks / 12;
  const noRoutine = i.baseline + READING_V1_NO_ROUTINE_12W * scale;
  const fullRoutine = i.baseline + READING_V1_TARGET_GAIN_12W * scale;
  const scheduledSoFar = Math.max(1, i.daysElapsed * i.perDay);
  const pace = Math.min(1, i.completed / scheduledSoFar);
  const remaining = Math.max(0, i.totalDays - i.daysElapsed) * i.perDay;
  const totalScheduled = Math.max(1, i.totalDays * i.perDay);
  const strongPace = Math.min(1, (i.completed + remaining) / totalScheduled);
  const span = fullRoutine - noRoutine;
  return {
    baseline: i.baseline,
    noRoutine: Math.round(noRoutine),
    fullRoutine: Math.round(fullRoutine),
    pace,
    keepPace: point(noRoutine + pace * span),
    finishStrong: point(noRoutine + strongPace * span),
    daysElapsed: i.daysElapsed,
    totalDays: i.totalDays,
    explanation: [
      `Starting point: the spring MAP Reading score you entered (${i.baseline}).`,
      `With no practice over the break, kids typically land around ${Math.round(noRoutine)}. (This reference value is provisional while we confirm the research.)`,
      `Doing every day of the routine aims for ${Math.round(fullRoutine)} — the pilot's target of +${READING_V1_TARGET_GAIN_12W} over 12 weeks.`,
      `So far ${Math.round(pace * 100)}% of the routine is done, so the estimate sits ${Math.round(pace * 100)}% of the way between those two.`,
      `It's shown as a range of ±${READING_V1_RANGE}, about how much MAP scores vary from test to test anyway.`,
    ],
  };
}

const MODELS: Record<string, (i: Inputs) => Projection> = {
  'reading-v1': readingV1,
};

/** Does this track have a projection a parent could turn on? */
export function hasProjection(def: TrackDefinition): boolean {
  const id = def.outcomeModel?.projection;
  return !!id && id in MODELS && !!def.outcomeModel?.projectionField;
}

/**
 * The projection for one kid on one track, or null when it must not show:
 * the track has no model, the parent has not turned it on, or there is no
 * baseline score to start from.
 */
export function projectionFor(
  rawDef: TrackDefinition, state: TrackState, today: DateKey = todayKey(),
): Projection | null {
  if (!state.projectionOn || !hasProjection(rawDef)) return null;
  const om = rawDef.outcomeModel!;
  const base = state.baseline[om.projectionField!];
  if (typeof base !== 'number' || !Number.isFinite(base)) return null;

  const def = effectiveDef(rawDef, state);
  const win = challengeWindow(state.startDate, def.lengthWeeks, today);
  const ids = new Set(def.activities.map((a) => String(a.id)));
  // Today counts as elapsed only once something is logged: at 9am a day is in
  // progress, not missed, and treating it as missed would drag the estimate
  // down (and make "complete every remaining day" leave today out).
  const todayEntry = state.entries[today];
  const todayActive = !!todayEntry && Object.entries(todayEntry.completed).some(([id, v]) => v && ids.has(id));
  const daysElapsed = win.phase === 'upcoming' ? 0
    : win.phase === 'ended' ? win.totalDays
    : win.day - 1 + (todayActive ? 1 : 0);
  let completed = 0;
  const last = win.phase === 'ended' ? win.endDate : today;
  for (let k = state.startDate; k <= last; k = addDays(k, 1)) {
    const e = state.entries[k];
    if (!e) continue;
    for (const [id, done] of Object.entries(e.completed)) if (done && ids.has(id)) completed += 1;
  }
  return MODELS[om.projection!]!({
    baseline: base,
    lengthWeeks: def.lengthWeeks,
    completed,
    perDay: def.activities.length,
    daysElapsed,
    totalDays: win.totalDays,
  });
}
