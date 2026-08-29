/**
 * Core domain types — the contract from docs/DATA-MODEL.md §3.
 *
 * The single rule this file exists to enforce:
 *   A track is DATA, not code. Nothing in the engine may name a track.
 *
 * Adding a fifth track must mean adding a TrackDefinition and nothing else.
 * If you find yourself writing `if (trackId === 'reading-slide')` anywhere
 * outside src/tracks/, the abstraction has leaked — fix the type, not the call site.
 */

export type TrackId = string & { readonly __brand: 'TrackId' };
export type ActivityId = string & { readonly __brand: 'ActivityId' };
export type DateKey = string & { readonly __brand: 'DateKey' }; // 'YYYY-MM-DD'

export const asTrackId = (s: string): TrackId => s as TrackId;
export const asActivityId = (s: string): ActivityId => s as ActivityId;
export const asDateKey = (s: string): DateKey => s as DateKey;

/** A field the kid fills in when logging an activity (minutes, book title…). */
export interface ActivityField {
  readonly id: string;
  readonly type: 'number' | 'text';
  readonly label: string;
  readonly placeholder?: string;
}

export interface Activity {
  readonly id: ActivityId;
  readonly label: string;
  readonly icon: string;
  readonly points: number;
  readonly fields: readonly ActivityField[];
}

/**
 * Which numbers this track contributes to a leaderboard row.
 * Replaces v1's hardcoded booksFinished / totalMinutes / totalWords.
 * `from` is 'sum:<fieldId>' or 'count:<activityId>'.
 */
export interface StatColumn {
  readonly id: string;
  readonly label: string;
  readonly from: `sum:${string}` | `count:${string}`;
}

export interface Rank {
  readonly name: string;
  readonly piece: string;
  readonly min: number;
  readonly motto: string;
}

export type LadderId = string;

export interface WeeklyChallenge {
  readonly week: number;
  readonly emoji: string;
  readonly name: string;
  readonly short: string;
  readonly full: string;
}

/**
 * null means the track has no measurable outcome — the structural answer to
 * PRD open question 7. Music and Mindful render no projection panel, and
 * nothing else in the engine changes.
 */
export interface OutcomeModel {
  readonly baselineFields: readonly ActivityField[];
  readonly projection: string;
}

export interface TrackDefinition {
  readonly trackId: TrackId;
  readonly version: number;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly recommendedAge: string;
  readonly dailyMinutes: number;
  readonly lengthWeeks: number;
  readonly activities: readonly Activity[];
  readonly statColumns: readonly StatColumn[];
  readonly themes: readonly string[];
  readonly ladder: LadderId;
  readonly weeklyChallenges: readonly WeeklyChallenge[];
  readonly outcomeModel: OutcomeModel | null;
}

/** DATA-MODEL §3.3 — the generalized DayEntry. */
export interface DayEntry {
  readonly date: DateKey;
  readonly trackId: TrackId;
  /** keyed by activity id — replaces v1's fixed read/write/math booleans */
  completed: Record<string, boolean>;
  /** keyed by field id — replaces v1's fixed minutes/book/words */
  values: Record<string, string | number>;
  points: number;
  comboClaimed: boolean;
}

export interface Prize {
  readonly id: string;
  name: string;
  icon: string;
  cost: number;
  claimed: boolean;
}

/** Per-track state. Prizes/goals/baseline are per-track (DATA-MODEL §3.4). */
export interface TrackState {
  readonly trackId: TrackId;
  enrolledAt: DateKey;
  startDate: DateKey;
  theme: string;
  entries: Record<string, DayEntry>;
  weeklyChallengesCompleted: Record<number, DateKey>;
  weeklyAdjustments: Record<number, number>;
  earnedBadges: Record<string, boolean>;
  pointAdjustments: number;
  prizes: Prize[];
  claimHistory: string[];
  baseline: Record<string, number | null>;
  /** Set ONLY by a parent-confirmed digest proposal (guardrail 6). */
  weekFocus?: string;
  /** The week a proposal was last dismissed, so it isn't re-offered. */
  proposalDismissedWeek?: string;
}

export interface ParentAuth {
  setupComplete: boolean;
  adminName: string;
  adminPinHash: string;
}

/** Account-level state. One PIN, one friends list — not per track. */
export interface ProfileState {
  readonly profileId: string;
  playerName: string;
  playerAvatar: string;
  activeTrackId: TrackId | null;
  tracks: Record<string, TrackState>;
  friends: string[];
  acceptedInvites: string[];
  coParentName: string;
  coParentEmail: string;
  parentAuth: ParentAuth;
  /** FR7 — free tier allows one active track. */
  entitlement: 'free' | 'family';
  /** COPPA — recorded at onboarding, never assumed. */
  consent: { guardian: boolean; data: boolean; recordedAt: string | null };
}

export interface Profile {
  readonly id: string;
  schemaVersion: 2;
  state: ProfileState;
}

/** Computed, never stored — derived from entries so it can't drift. */
export interface TrackStats {
  points: number;
  currentStreak: number;
  longestStreak: number;
  daysDone: number;
  stats: Record<string, number>;
  rank: Rank;
  nextRank: Rank | null;
  pointsToNext: number;
}
