/**
 * The weekly parent digest — the agentic layer from docs/agentic-ai.html.
 *
 * The architecture split that defines the product:
 *   KID side  = deterministic rules. Fair, instant, offline, no model output
 *               ever reaches a child.
 *   PARENT side = judgment. Retrieve → Diagnose → Prioritise → Propose →
 *               Confirm-before-action.
 *
 * This file implements that loop with rules rather than a model. Two reasons
 * that is the right first step, not a shortcut:
 *   1. Every guardrail becomes a property a test can enforce, instead of a
 *      sentence in a prompt that a model may ignore.
 *   2. `Diagnosis` and `Insight` below are a seam. Swapping in an LLM means
 *      implementing one function, not rewriting the feature.
 *
 * GUARDRAILS (agentic-ai.html §5) — enforced here, asserted in digest.test.ts:
 *   1. Every claim grounded in logged numbers. Nothing is invented.
 *   2. A projection is an estimate, never a promise.
 *   3. No clinical or diagnostic language — escalate to the teacher instead.
 *   4. Supportive tone; never shame the child or the parent.
 *   5. A minor's data never crosses families.
 *   6. Confirm-before-action on anything that writes back to the kid app.
 */
import type { DayEntry, TrackDefinition, TrackState } from './types.js';
import { asDateKey } from './types.js';
import { weekStartKey } from './sync.js';
import { todayKey, addDays } from './engine.js';

/** What the loop RETRIEVED — the evidence every claim must cite. */
export interface WeekFacts {
  weekStart: string;
  daysLogged: number;
  daysInWeek: number;
  pointsThisWeek: number;
  maxPointsThisWeek: number;
  /** completions per activity id, e.g. { read: 6, write: 1 } */
  perActivity: Record<string, number>;
  /** summed numeric fields, e.g. { minutes: 142 } */
  totals: Record<string, number>;
  longestGap: number;
  hasBaseline: boolean;
}

export type Severity = 'celebrate' | 'nudge' | 'attention';

/** What the loop DIAGNOSED and PRIORITISED — exactly one headline. */
export interface Insight {
  id: string;
  severity: Severity;
  /** The one thing that matters this week. Never a list of ten metrics. */
  headline: string;
  /** Plain language, citing the retrieved numbers. */
  detail: string;
  /** The numbers this claim rests on — makes guardrail 1 checkable. */
  evidence: string[];
  /** The PROPOSED action. Null when nothing should change. */
  proposal: Proposal | null;
}

/** A proposed write-back. Never applied without explicit parent confirmation. */
export interface Proposal {
  kind: 'set-focus' | 'smaller-goal' | 'stretch-goal';
  label: string;
  /** Draft message a parent can send the kid, in their words if they want. */
  nudge: string;
  /** Applied only after confirm(). */
  apply: { activityId?: string; note: string };
}

/** The seam an LLM would implement later. Rules satisfy it today. */
export interface Diagnostician {
  diagnose(facts: WeekFacts, def: TrackDefinition): Insight;
}

/* ─────────────────────────── RETRIEVE ─────────────────────────── */

export function retrieveWeek(
  def: TrackDefinition, state: TrackState, now = new Date(),
): WeekFacts {
  const start = weekStartKey(now);
  const today = todayKey(now);
  const days: DayEntry[] = [];
  for (let i = 0; i < 7; i += 1) {
    const key = addDays(asDateKey(start), i);
    if (key > today) break;
    const e = state.entries[key];
    if (e) days.push(e);
  }

  const perActivity: Record<string, number> = {};
  for (const a of def.activities) perActivity[a.id] = 0;
  const totals: Record<string, number> = {};
  let points = 0;
  let logged = 0;

  for (const e of days) {
    let active = false;
    for (const a of def.activities) {
      if (e.completed[a.id]) {
        perActivity[a.id] = (perActivity[a.id] ?? 0) + 1;
        points += a.points;
        active = true;
      }
    }
    if (active) logged += 1;
    for (const [k, v] of Object.entries(e.values)) {
      if (typeof v === 'number') totals[k] = (totals[k] ?? 0) + v;
    }
  }

  // Days elapsed in the week so far — calendar days, NOT number of entries.
  const daysInWeek = Math.max(1, Math.min(7,
    Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000) + 1));

  // Longest run of unlogged days that has since been CLOSED by a logged day.
  // Trailing unlogged days are not a gap — today at 9am is a day in progress,
  // not a lapse, and calling it one would be exactly the shaming guardrail 4
  // rules out.
  let gap = 0, run = 0;
  for (let i = 0; i < daysInWeek; i += 1) {
    const key = addDays(asDateKey(start), i);
    const e = state.entries[key];
    const active = e ? def.activities.some((a) => e.completed[a.id]) : false;
    if (active) { gap = Math.max(gap, run); run = 0; } else { run += 1; }
  }

  return {
    weekStart: start,
    daysLogged: logged,
    daysInWeek,
    pointsThisWeek: points,
    maxPointsThisWeek: def.activities.reduce((n, a) => n + a.points, 0) * daysInWeek,
    perActivity,
    totals,
    longestGap: gap,
    hasBaseline: Object.values(state.baseline).some((v) => v !== null && v !== undefined),
  };
}

/* ──────────────────── DIAGNOSE + PRIORITISE ──────────────────── */

const pluralDays = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/**
 * Rules covering the five cases the behavior spec names, in priority order.
 * Exactly one Insight comes back — "the one thing that matters this week".
 */
export class RuleDiagnostician implements Diagnostician {
  diagnose(f: WeekFacts, def: TrackDefinition): Insight {
    const acts = def.activities;
    const first = acts[0];
    const done = Object.values(f.perActivity).reduce((a, b) => a + b, 0);

    // 1. Nothing logged at all.
    if (done === 0) {
      return {
        id: 'no-activity',
        severity: 'attention',
        headline: 'No activity logged this week yet',
        detail: `Nothing has been logged since ${f.weekStart}. A short session today is enough to restart the streak — it does not have to be a big one.`,
        evidence: [`0 of ${f.daysInWeek} days logged`],
        proposal: first ? {
          kind: 'smaller-goal',
          label: `Set a smaller goal: just ${first.label.toLowerCase()}`,
          nudge: `Want to do a quick ${first.label.toLowerCase()} with me? Five minutes counts.`,
          apply: { activityId: String(first.id), note: 'Smaller daily goal for the rest of the week' },
        } : null,
      };
    }

    // 2. A real gap. Surfaced gently — never shaming (guardrail 4).
    if (f.longestGap >= 3) {
      return {
        id: 'gap',
        severity: 'attention',
        headline: `A ${pluralDays(f.longestGap)} gap this week`,
        detail: `${pluralDays(f.daysLogged)} logged out of ${f.daysInWeek}. Gaps happen — the fastest way back is a smaller goal for a few days rather than trying to catch up.`,
        evidence: [
          `${f.daysLogged} of ${f.daysInWeek} days logged`,
          `longest gap ${pluralDays(f.longestGap)}`,
        ],
        proposal: first ? {
          kind: 'smaller-goal',
          label: 'Set a smaller daily goal',
          nudge: `Let's get back on it tonight — just ${first.label.toLowerCase()}, then we're done.`,
          apply: { activityId: String(first.id), note: 'Smaller daily goal to re-engage' },
        } : null,
      };
    }

    // 3. A strong, balanced week wins over any "behind on X" nudge. Leading
    //    with a shortfall when a family logged 5+ days reads as criticism of
    //    someone who is already winning — guardrail 4 is about tone, not just
    //    banned words. The stretch goal is the right ask here.
    if (f.daysLogged >= 5) {
      return {
        id: 'strong-week',
        severity: 'celebrate',
        headline: `A strong week — ${pluralDays(f.daysLogged)} logged`,
        detail: `${f.pointsThisWeek} of a possible ${f.maxPointsThisWeek} points. This is the pattern that actually builds the habit.`,
        evidence: [
          `${f.daysLogged} of ${f.daysInWeek} days logged`,
          `${f.pointsThisWeek} of ${f.maxPointsThisWeek} points`,
        ],
        proposal: {
          kind: 'stretch-goal',
          label: 'Add a stretch goal',
          nudge: 'Great week. Want to try for a perfect day tomorrow — everything on the list?',
          apply: { note: 'Stretch goal: one perfect day' },
        },
      };
    }

    // 4. Volume is fine but one activity is being skipped. The spec's
    //    headline example: minutes on pace, writing skipped.
    const skipped = acts
      .filter((a) => (f.perActivity[a.id] ?? 0) <= 1 && f.daysLogged >= 3)
      .sort((a, b) => b.points - a.points)[0];
    const strongest = acts
      .slice()
      .sort((a, b) => (f.perActivity[b.id] ?? 0) - (f.perActivity[a.id] ?? 0))[0];

    if (skipped && strongest && (f.perActivity[strongest.id] ?? 0) >= 3) {
      const n = f.perActivity[skipped.id] ?? 0;
      return {
        id: 'lopsided',
        severity: 'nudge',
        headline: `On pace for ${strongest.label.toLowerCase()}, behind on ${skipped.label.toLowerCase()}`,
        detail: `${strongest.label} is happening ${pluralDays(f.perActivity[strongest.id] ?? 0)} this week, but ${skipped.label.toLowerCase()} only ${n === 0 ? 'has not happened yet' : `${pluralDays(n)}`}. Worth one small ${skipped.label.toLowerCase()} attached to a session that is already working.`,
        evidence: [
          `${skipped.label}: ${n} of ${f.daysInWeek} days`,
          `${strongest.label}: ${f.perActivity[strongest.id] ?? 0} of ${f.daysInWeek} days`,
        ],
        proposal: {
          kind: 'set-focus',
          label: `Make ${skipped.label.toLowerCase()} this week's focus`,
          nudge: `You're crushing the ${strongest.label.toLowerCase()}. Want to add one small ${skipped.label.toLowerCase()} after it tonight?`,
          apply: { activityId: String(skipped.id), note: `Focus: ${skipped.label}` },
        },
      };
    }

    // 5. Middling week — steady, no change proposed.
    return {
      id: 'steady',
      severity: 'nudge',
      headline: `${pluralDays(f.daysLogged)} logged so far this week`,
      detail: `${f.pointsThisWeek} points. Steady. One more day this week would make it a habit rather than a handful of sessions.`,
      evidence: [
        `${f.daysLogged} of ${f.daysInWeek} days logged`,
        `${f.pointsThisWeek} points`,
      ],
      proposal: null,
    };
  }
}

/* ─────────────────────────── PROPOSE ─────────────────────────── */

/**
 * The projection. Guardrail 2: an ESTIMATE, never a promise — the wording
 * here is deliberate and digest.test.ts asserts it stays that way.
 */
export function projectionNote(f: WeekFacts, def: TrackDefinition): string | null {
  if (!def.outcomeModel || !f.hasBaseline) return null;   // no model → no claim
  const rate = f.daysInWeek > 0 ? f.daysLogged / f.daysInWeek : 0;
  if (rate >= 0.7) {
    return 'At this rate, the fall estimate is tracking toward the target. This is a projection from activity so far, not a guarantee.';
  }
  return 'At this rate the fall estimate drifts below target. More consistent days are the single change that would bend it back. This is a projection, not a guarantee.';
}

export interface Digest {
  weekStart: string;
  trackName: string;
  kidName: string;
  facts: WeekFacts;
  insight: Insight;
  projection: string | null;
}

export function buildDigest(args: {
  def: TrackDefinition; state: TrackState; kidName: string;
  now?: Date; diagnostician?: Diagnostician;
}): Digest {
  const { def, state, kidName } = args;
  const facts = retrieveWeek(def, state, args.now ?? new Date());
  const dx = args.diagnostician ?? new RuleDiagnostician();
  return {
    weekStart: facts.weekStart,
    trackName: def.name,
    kidName,
    facts,
    insight: dx.diagnose(facts, def),
    projection: projectionNote(facts, def),
  };
}
