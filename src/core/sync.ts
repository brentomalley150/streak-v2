/**
 * Firebase sync — DATA-MODEL §3.5.
 *
 * Two rules shape this file:
 *   1. LOCAL-FIRST. localStorage stays the source of truth for gameplay, exactly
 *      as in v1. Firebase receives a *projection* for the social layer. If the
 *      network is gone, or Firebase was never configured, the app works.
 *   2. NO FIREBASE TYPES LEAK OUT. Everything below is behind the Backend
 *      interface so the rest of the app — and the tests — never import the SDK.
 */
import type { Rank, TrackDefinition, TrackState } from './types.js';
import { computeStats, todayKey } from './engine.js';

/** One kid on one track, as the leaderboard sees them. */
export interface LeaderboardRow {
  uid: string;
  profileId: string;
  leaderboardKey: string;
  ownerEmail: string;
  name: string;
  avatar: string;
  trackId: string;
  theme: string;
  points: number;
  weeklyPoints: number;
  weekStartKey: string;
  rank: string;
  rankPiece: string;
  stats: Record<string, number>;
  currentStreak: number;
  lastSeen: number;
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
}

export interface Backend {
  readonly enabled: boolean;
  readonly user: AuthUser | null;
  signIn(): Promise<AuthUser>;
  signOut(): Promise<void>;
  onAuth(fn: (u: AuthUser | null) => void): () => void;
  publish(row: LeaderboardRow): Promise<void>;
  subscribeLeaderboard(trackId: string, fn: (rows: LeaderboardRow[]) => void): () => void;
  saveRollup(profileId: string, rows: LeaderboardRow[]): Promise<void>;
}

/** `${googleUid}_${profileId}` — one slot per kid, siblings distinct. */
export function leaderboardKey(uid: string, profileId: string): string {
  return `${uid}_${profileId}`;
}

/** Monday of the week a date falls in — the bucket weeklyPoints belongs to. */
export function weekStartKey(date = new Date()): string {
  const d = new Date(date);
  const offset = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - offset);
  return todayKey(d);
}

/** Points earned since Monday. */
export function weeklyPoints(def: TrackDefinition, state: TrackState, today = new Date()): number {
  const start = weekStartKey(today);
  return Object.values(state.entries)
    .filter((e) => e.date >= start)
    .reduce(
      (sum, e) => sum + def.activities.reduce((n, a) => (e.completed[a.id] ? n + a.points : n), 0),
      0,
    );
}

/**
 * Build the row to publish. Pure — no Firebase, no clock beyond what's passed in,
 * so it is fully testable.
 */
export function buildRow(args: {
  def: TrackDefinition;
  state: TrackState;
  ladder: readonly Rank[];
  user: AuthUser;
  profileId: string;
  playerName: string;
  playerAvatar: string;
  now?: Date;
}): LeaderboardRow {
  const { def, state, ladder, user, profileId, playerName, playerAvatar } = args;
  const now = args.now ?? new Date();
  const stats = computeStats(def, state, ladder, todayKey(now));
  return {
    uid: user.uid,
    profileId,
    leaderboardKey: leaderboardKey(user.uid, profileId),
    ownerEmail: user.email,
    // A first name only. Never a last name, photo or location — the promise the
    // onboarding consent screen makes to the parent.
    name: playerName,
    avatar: playerAvatar,
    trackId: String(def.trackId),
    theme: state.theme,
    points: stats.points,
    weeklyPoints: weeklyPoints(def, state, now),
    weekStartKey: weekStartKey(now),
    rank: stats.rank.name,
    rankPiece: stats.rank.piece,
    stats: stats.stats,
    currentStreak: stats.currentStreak,
    lastSeen: now.getTime(),
  };
}

/** Used when Firebase isn't configured. The app runs exactly as before. */
export class NullBackend implements Backend {
  readonly enabled = false;
  readonly user: AuthUser | null = null;
  async signIn(): Promise<AuthUser> { throw new Error('Firebase is not configured'); }
  async signOut(): Promise<void> { /* nothing to do */ }
  onAuth(fn: (u: AuthUser | null) => void): () => void { fn(null); return () => {}; }
  async publish(): Promise<void> { /* offline: local state is already the truth */ }
  subscribeLeaderboard(_trackId: string, fn: (rows: LeaderboardRow[]) => void): () => void {
    fn([]); return () => {};
  }
  async saveRollup(): Promise<void> { /* nothing to do */ }
}
