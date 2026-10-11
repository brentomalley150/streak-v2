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
  /** Target time for the daily routine, e.g. 15 for "15 min read". */
  readonly minutes?: number;
  /**
   * Done off-screen (a chore), so a parent confirms it before it scores.
   * The kid's tap still counts for the streak — it is their effort — but the
   * points wait for a grown-up (FR30).
   */
  readonly needsParentConfirm?: boolean;
}

/**
 * Theme ideas for one activity (FR24). Keyed by theme id; '*' is the fallback
 * used for any theme without its own list. Human-written, never generated.
 */
export type IdeaPool = Readonly<Record<string, readonly string[]>>;

/**
 * One assessment subscore the routine can emphasise. When several are
 * entered, the LOWEST picks the focus (FR22) — fixed rules, no model.
 */
export interface FocusRule {
  readonly fieldId: string;
  readonly activityId: string;
  readonly tip: string;
}

/**
 * How a track turns spring scores into a routine. Data, so the engine still
 * names no track. `levelField` sets the reading level band shown on the read
 * activity; `focus` picks one activity to emphasise.
 */
export interface RoutineRules {
  readonly levelField?: string;
  /** Offsets around the level score, e.g. [-100, 50] for a Lexile band. */
  readonly levelBand?: readonly [number, number];
  readonly levelActivityId?: string;
  readonly levelUnit?: string;
  readonly focus: readonly FocusRule[];
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
  /** A projection model id from core/projection.ts, or null for none. */
  readonly projection: string | null;
  /** The baseline field the projection runs on (e.g. MAP RIT). */
  readonly projectionField?: string;
  readonly routine?: RoutineRules;
}

/**
 * One flavour of a track the kid picks for themselves — the instrument on
 * Music Practice. It never changes scoring: same activities, same points.
 * It only swaps the words a kid sees (icons, placeholders, ideas), so two
 * friends on different instruments still share one leaderboard.
 */
export interface TrackVariant {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  /** Per-activity overrides, keyed by activity id. */
  readonly activities?: Readonly<Record<string, {
    readonly icon?: string;
    /** Field placeholders, keyed by field id. */
    readonly placeholders?: Readonly<Record<string, string>>;
  }>>;
  /** Replaces an activity's '*' ideas; a theme's own list still wins. */
  readonly ideas?: Readonly<Record<string, readonly string[]>>;
}

export interface TrackVariants {
  /** What the picker asks, e.g. "What do you play?" */
  readonly prompt: string;
  /** What one option is called, e.g. "instrument". */
  readonly noun: string;
  readonly options: readonly TrackVariant[];
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
  /** Shown to kids as the weekly bonus activity (FR26). */
  readonly weeklyChallenges: readonly WeeklyChallenge[];
  /** Points for completing the week's bonus. Optional — never touches the streak. */
  readonly weeklyBonusPoints?: number;
  readonly outcomeModel: OutcomeModel | null;
  /** Theme ideas, keyed by activity id (FR24). */
  readonly ideas?: Readonly<Record<string, IdeaPool>>;
  /**
   * Activities that no longer appear but still SCORE, so history keeps its
   * points. Reading's old Math activity lives here after Math became its own
   * track: a migrated family keeps every point it earned.
   */
  readonly retiredActivities?: readonly Activity[];
  /** A parent may replace the activity list (Home Helper's chore list). */
  readonly customizableActivities?: boolean;
  /**
   * Extra points for a perfect day — every activity done. Defaults to the
   * engine's PERFECT_DAY_BONUS; 0 turns it off for a track.
   */
  readonly perfectDayBonus?: number;
  /** Kid-picked flavours of the track (Music's instrument). */
  readonly variants?: TrackVariants;
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
  /**
   * True when this day was a perfect day (every activity scored) as of the
   * last tick or confirmation. Stored, not recomputed, so a later change to a
   * parent's chore list can never take a perfect-day bonus away.
   */
  comboClaimed: boolean;
  /** Parent confirmations for needsParentConfirm activities, keyed by activity id. */
  confirmed?: Record<string, boolean>;
  /** Something was ticked on a later day than this one (logging a missed day). */
  filledLater?: boolean;
}

/**
 * A family prize (FR27–FR28). `cost` is kept as the field name for v1
 * compatibility but means the UNLOCK threshold: a prize unlocks when total
 * points reach it, exactly like a rank. Cashing in never spends points.
 */
export interface Prize {
  readonly id: string;
  name: string;
  icon: string;
  cost: number;
  /** True once a parent has marked it as given. */
  claimed: boolean;
  /** When the kid asked to cash it in (ISO). */
  requestedAt?: string;
  /** When a parent marked it as given (ISO). */
  givenAt?: string;
}

/** A challenge this kid has joined — what the family needs to score it. */
export interface JoinedChallenge {
  readonly groupId: string;
  readonly trackId: string;
  readonly name: string;
  readonly startDate: string;
  readonly lengthWeeks: number;
  readonly teamId?: string;
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
  /**
   * Weekly bonus completions this version awards points for, week -> date.
   * Separate from v1's weeklyChallengesCompleted so migrated history keeps
   * exactly the points it had.
   */
  bonusCompleted?: Record<number, DateKey>;
  /** Opt-in fall projection (FR25). Off unless a parent turns it on. */
  projectionOn?: boolean;
  /** The kid's pick from the track's variants (e.g. 'drums'). Unset = generic. */
  variant?: string;
  /** A parent-edited activity list, for tracks that allow it. */
  customActivities?: Activity[];
  /**
   * Chores a parent removed. Still scored, never shown — removing a chore must
   * not take away the points it already earned.
   */
  retiredCustomActivities?: Activity[];
}

/** A kid's SummerStreak totals, as v1 synced them. */
export interface SummerRecap {
  points: number;
  rank: string;
  booksFinished: number;
  totalMinutes: number;
  totalWords: number;
  /** When v1 last heard from this kid (ms). */
  lastSeen: number;
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
  /** Challenges this kid joined, so the family can publish window scores. */
  joinedChallenges?: JoinedChallenge[];
  /**
   * What this kid did in SummerStreak (v1), when brought in from v1's cloud
   * rows. The points already count (as pointAdjustments on Reading Slide);
   * this is kept for the welcome-back card and never published.
   */
  summer?: SummerRecap;
  /** The welcome-back card was closed. */
  summerRecapSeen?: boolean;
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
