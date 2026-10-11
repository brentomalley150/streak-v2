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
import type { ProfileBackup } from './backup.js';
import type { Group, GroupMember, Team } from './groups.js';
import { computeStats, effectiveDef, pointsForEntry, todayKey } from './engine.js';

/** One kid on one track, as the leaderboard sees them. */
export interface LeaderboardRow {
  uid: string;
  profileId: string;
  leaderboardKey: string;
  // No ownerEmail, deliberately. This row is written to a node any signed-in
  // user can read, so it must carry only what the consent screen discloses:
  // a first name, an avatar and progress. v2.0 published the parent's account
  // email here.
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

/**
 * One track's slice of a kid's rollup, as saveRollup writes it. Deliberately
 * narrower than LeaderboardRow: the parent view needs progress, not the
 * published name and avatar that the leaderboard carries.
 */
export interface RollupEntry {
  trackId: string;
  points: number;
  currentStreak: number;
  rank: string;
  lastSeen: number;
}

/** profileId -> trackId -> entry, exactly the shape stored under the family. */
export type FamilyRollup = Record<string, Record<string, RollupEntry>>;

export interface Backend {
  readonly enabled: boolean;
  readonly user: AuthUser | null;
  signIn(): Promise<AuthUser>;
  signOut(): Promise<void>;
  onAuth(fn: (u: AuthUser | null) => void): () => void;
  publish(row: LeaderboardRow): Promise<void>;
  subscribeLeaderboard(trackId: string, fn: (rows: LeaderboardRow[]) => void): () => void;
  saveRollup(profileId: string, rows: LeaderboardRow[]): Promise<void>;
  /** Every kid, every track, one read. `{}` when signed out or offline. */
  loadRollup(): Promise<FamilyRollup>;
  /**
   * This account's kids from SummerStreak (v1), read from v1's leaderboard in
   * the same database. `[]` when signed out, offline, or new to Beat the Slide.
   */
  loadV1Kids(): Promise<V1Kid[]>;
  /**
   * Remove one kid from the cloud: their leaderboard row and weekly history on
   * each track, their family-rollup entry, and their challenge memberships.
   * Throws when it can't, so the caller can keep the kid rather than orphan
   * data no one can reach.
   */
  deleteKidData(kid: { key: string; profileId: string; trackIds: string[]; groupIds: string[] }): Promise<void>;
  /** Remove this account's whole family record (rollup and challenge index). */
  deleteFamilyRecord(): Promise<void>;
  /** Save one kid's restorable copy to this account's private family record. */
  saveProfileBackup(profileId: string, backup: ProfileBackup): Promise<void>;
  /** Every kid this account has backed up, raw, by profile id. `{}` signed out. */
  loadProfileBackups(): Promise<Record<string, unknown>>;

  /** Groups (FR13–FR18). All no-ops offline; the app stays usable without them. */
  createGroup(group: Group): Promise<void>;
  /** `null` when the code matches nothing — an unknown link must not throw. */
  loadGroup(groupId: string): Promise<Group | null>;
  joinGroup(groupId: string, key: string, member: GroupMember): Promise<void>;
  leaveGroup(groupId: string, key: string): Promise<void>;
  /** The groups this account owns. */
  loadMyGroups(): Promise<Group[]>;
  /** A kid's points inside a challenge window, written by their own family. */
  saveMemberScore(groupId: string, key: string, points: number): Promise<void>;
  /** Add a team (a class) to a team challenge (FR31). */
  createTeam(groupId: string, teamId: string, team: Team): Promise<void>;
  /** The challenge owner removes a team (e.g. one added by mistake). */
  deleteTeam(groupId: string, teamId: string): Promise<void>;
}

/** One kid's SummerStreak row, reduced to what the import needs. */
export interface V1Kid {
  profileId: string;
  name: string;
  avatar: string;
  theme: string;
  points: number;
  rank: string;
  booksFinished: number;
  totalMinutes: number;
  totalWords: number;
  lastSeen: number;
}

const V1_PLACEHOLDER_NAMES = new Set(['', 'player', 'unnamed', 'kid', 'new device']);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/**
 * This account's kids out of v1's /leaderboard. Only rows whose `uid` is this
 * account; placeholder names are skipped, as v1 itself refused to sync them.
 * v1 rows also carry the parent's email; it is deliberately not read.
 */
export function v1KidsFromLeaderboard(rows: Record<string, unknown>, uid: string): V1Kid[] {
  const byId = new Map<string, V1Kid>();
  for (const raw of Object.values(rows ?? {})) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (r['uid'] !== uid || typeof r['profileId'] !== 'string' || !r['profileId']) continue;
    const name = String(r['name'] ?? '').trim();
    if (V1_PLACEHOLDER_NAMES.has(name.toLowerCase())) continue;
    const kid: V1Kid = {
      profileId: r['profileId'] as string,
      name: name.slice(0, 24),
      avatar: typeof r['avatar'] === 'string' && r['avatar'] ? (r['avatar'] as string).slice(0, 8) : '👑',
      theme: typeof r['theme'] === 'string' ? (r['theme'] as string) : 'chess',
      points: num(r['points']),
      rank: typeof r['rank'] === 'string' ? (r['rank'] as string) : '',
      booksFinished: num(r['booksFinished']),
      totalMinutes: num(r['totalMinutes']),
      totalWords: num(r['totalWords']),
      lastSeen: num(r['lastSeen']),
    };
    const prev = byId.get(kid.profileId);
    if (!prev || kid.lastSeen > prev.lastSeen) byId.set(kid.profileId, kid);
  }
  return [...byId.values()].sort((a, b) => b.lastSeen - a.lastSeen);
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

/**
 * Points earned since Monday. Uses the engine's own scoring, so retired
 * activities, parent-confirmed chores and bonus activities all count exactly
 * as they do in the kid's total.
 */
export function weeklyPoints(rawDef: TrackDefinition, state: TrackState, today = new Date()): number {
  const def = effectiveDef(rawDef, state);
  const start = weekStartKey(today);
  const fromEntries = Object.values(state.entries)
    .filter((e) => e.date >= start)
    .reduce((sum, e) => sum + pointsForEntry(def, e), 0);
  const per = def.weeklyBonusPoints ?? 0;
  const fromBonus = Object.values(state.bonusCompleted ?? {}).filter((d) => d >= start).length * per;
  return fromEntries + fromBonus;
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
  async loadRollup(): Promise<FamilyRollup> { return {}; }
  async loadV1Kids(): Promise<V1Kid[]> { return []; }
  async deleteKidData(): Promise<void> { /* nothing in the cloud */ }
  async deleteFamilyRecord(): Promise<void> { /* nothing in the cloud */ }
  async saveProfileBackup(): Promise<void> { /* offline: the device is the copy */ }
  async loadProfileBackups(): Promise<Record<string, unknown>> { return {}; }
  async createGroup(): Promise<void> { /* offline: nothing to share with */ }
  async loadGroup(): Promise<Group | null> { return null; }
  async joinGroup(): Promise<void> { /* offline */ }
  async leaveGroup(): Promise<void> { /* offline */ }
  async loadMyGroups(): Promise<Group[]> { return []; }
  async saveMemberScore(): Promise<void> { /* offline */ }
  async createTeam(): Promise<void> { /* offline */ }
  async deleteTeam(): Promise<void> { /* offline */ }
}
