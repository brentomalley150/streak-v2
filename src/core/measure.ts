/**
 * The activity summary behind the measurement plan (items 1 and 2).
 *
 * Kept in the family's own record, v2/families/{uid}/activity/{profileId},
 * readable only by that account (and by the founders for aggregate counts).
 * It holds what the plan's metrics need and nothing else: per track, the
 * enrollment date and instrument; per day, which activities were done,
 * whether it was a perfect day, and whether it was filled in later. No
 * names, no values a kid typed, no scores.
 *
 * Written as a multi-path update over a short recent window, so a sync
 * costs a few small writes rather than the whole history. The window
 * covers the 7 days a kid can back-fill, plus slack.
 */
import type { ProfileState } from './types.js';
import type { DateKey } from './types.js';
import { addDays, isActiveEntry } from './engine.js';

export const SUMMARY_WINDOW_DAYS = 10;

export interface DaySummary {
  /** Activity ids completed that day. */
  acts: Record<string, true>;
  perfect: boolean;
  /** Something was ticked on a later day than this one. */
  late: boolean;
}

/**
 * Paths under v2/families/{uid}/activity/{profileId}, each with its value.
 * A day in the window with nothing done maps to null, so an un-ticked day
 * disappears from the summary too.
 */
export function activitySummaryPaths(
  state: ProfileState, today: DateKey, windowDays = SUMMARY_WINDOW_DAYS,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [trackId, t] of Object.entries(state.tracks)) {
    out[`tracks/${trackId}/enrolledAt`] = t.enrolledAt;
    out[`tracks/${trackId}/variant`] = t.variant ?? null;
    for (let i = 0; i < windowDays; i += 1) {
      const date = addDays(today, -i);
      const e = t.entries[date];
      const path = `tracks/${trackId}/days/${date}`;
      if (!e || !isActiveEntry(e)) { out[path] = null; continue; }
      const acts: Record<string, true> = {};
      for (const [id, done] of Object.entries(e.completed)) if (done) acts[id] = true;
      out[path] = { acts, perfect: e.comboClaimed === true, late: e.filledLater === true } satisfies DaySummary;
    }
  }
  return out;
}
