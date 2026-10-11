/**
 * Groups — a challenge someone runs and invites kids to (FR13–FR18).
 *
 * The entity that makes the product's core mechanic expressible. Everything
 * else lives under `v2/families/${auth.uid}`, scoped to one account, so no
 * object could span households. A group is deliberately top-level:
 *
 *     v2/groups/${groupId}
 *       meta:    { name, trackId, ownerUid, ownerName, createdAt, open,
 *                  startDate, lengthWeeks, mode }
 *       teams:   { ${teamId}: { name, ownerUid, ownerName, createdAt } }
 *       members: { ${leaderboardKey}: { name, avatar, joinedAt, points?, team? } }
 *
 * A challenge runs for its own window (FR29): `points` on a member is what that
 * kid earned between startDate and the end date, written by the kid's own
 * family. A kid who has played for months does not start ahead of one who
 * joined today. In 'teams' mode (FR31) each class is a team and teams rank by
 * average points per member, so class size does not decide the winner.
 *
 * **Membership is a reference, not a copy.** A group stores no entries, no
 * baselines, no consent. Progress stays under each family; the group only says
 * who is in it. Delete a group and nobody loses data.
 *
 * The groupId IS the join code. That keeps lookup a single direct read rather
 * than an index that would have to be world-readable and kept in sync.
 */
import type { LeaderboardRow } from './sync.js';

export interface GroupMeta {
  name: string;
  trackId: string;
  ownerUid: string;
  /** First name only — the same disclosure the leaderboard already makes. */
  ownerName: string;
  createdAt: number;
  /** A closed group refuses new members without deleting the existing ones. */
  open: boolean;
  /** 'YYYY-MM-DD'. Older groups without one started when they were created. */
  startDate?: string;
  /** How long the challenge runs (FR29). Defaults to 12. */
  lengthWeeks?: number;
  /** 'teams' = classroom vs. classroom (FR31). Absent means kids compete. */
  mode?: 'kids' | 'teams';
}

export interface Team {
  name: string;
  /** The teacher (or parent) who runs this team and manages its roster. */
  ownerUid: string;
  ownerName: string;
  createdAt: number;
}

export interface GroupMember {
  name: string;
  avatar: string;
  joinedAt: number;
  /** Points earned inside the challenge window, written by the kid's family. */
  points?: number;
  /** Team id, in a team challenge. */
  team?: string;
}

export interface Group {
  id: string;
  meta: GroupMeta;
  members: Record<string, GroupMember>;
  teams?: Record<string, Team>;
}

export const DEFAULT_LENGTH_WEEKS = 12;
export const LENGTH_CHOICES = [2, 4, 6, 8, 12] as const;

/** Start date and length, with defaults for groups made before FR29. */
export function groupWindow(g: Group): { startDate: string; lengthWeeks: number } {
  const lengthWeeks = g.meta.lengthWeeks && g.meta.lengthWeeks > 0 ? g.meta.lengthWeeks : DEFAULT_LENGTH_WEEKS;
  const startDate = g.meta.startDate ?? isoDay(new Date(g.meta.createdAt));
  return { startDate, lengthWeeks };
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Unambiguous alphabet: no O/0, I/1, or similar. A join code gets read aloud,
 * typed from a photo of a whiteboard, and copied out of a group chat.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * A 8-character code from a 31-letter alphabet is ~40 bits — far beyond
 * guessing a specific group, and unguessable in bulk at any rate a client can
 * sustain. GROUPS.md flags short codes as an open question; this answers it by
 * making the code long enough that revocation is not load-bearing.
 */
export function generateJoinCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 8; i++) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return out;
}

/** Codes are case-insensitive and forgiving of spacing when typed by hand. */
export function normalizeJoinCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidJoinCode(code: string): boolean {
  const c = normalizeJoinCode(code);
  return c.length === 8 && [...c].every((ch) => ALPHABET.includes(ch));
}

/**
 * The link a creator shares. Relative, so it works on any host. A team link
 * also carries the team, so a parent's kid lands in the right class.
 */
export function joinLink(code: string, origin: string, path = '/app/', team?: string): string {
  const t = team ? `&team=${encodeURIComponent(team)}` : '';
  return `${origin.replace(/\/$/, '')}${path}?join=${code}${t}`;
}

/** Team ids are short random tokens; anything else in the URL is ignored. */
export function readTeamFromUrl(search: string): string | null {
  try {
    const raw = new URLSearchParams(search).get('team');
    return raw && /^[A-Za-z0-9_-]{4,24}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function generateTeamId(random: () => number = Math.random): string {
  let out = 't';
  for (let i = 0; i < 7; i++) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return out;
}

/** Reads `?join=` defensively — the app has never read anything from the URL. */
export function readJoinCodeFromUrl(search: string): string | null {
  try {
    const raw = new URLSearchParams(search).get('join');
    if (!raw) return null;
    const code = normalizeJoinCode(raw);
    return isValidJoinCode(code) ? code : null;
  } catch {
    return null;
  }
}

export function newGroup(
  id: string, name: string, trackId: string,
  ownerUid: string, ownerName: string, now: number,
  opts: { startDate?: string; lengthWeeks?: number; mode?: 'kids' | 'teams' } = {},
): Group {
  const lengthWeeks = Math.min(52, Math.max(1, Math.round(opts.lengthWeeks ?? DEFAULT_LENGTH_WEEKS)));
  return {
    id,
    meta: {
      name, trackId, ownerUid, ownerName, createdAt: now, open: true,
      startDate: opts.startDate ?? isoDay(new Date(now)),
      lengthWeeks,
      mode: opts.mode ?? 'kids',
    },
    members: {},
    ...(opts.mode === 'teams' ? { teams: {} } : {}),
  };
}

/** Teams this account runs inside a group. */
export function teamsOwnedBy(g: Group, uid: string | null): string[] {
  if (!uid) return [];
  return Object.entries(g.teams ?? {}).filter(([, t]) => t.ownerUid === uid).map(([id]) => id);
}

export function isOwner(group: Group, uid: string | null): boolean {
  return !!uid && group.meta.ownerUid === uid;
}

/** A kid is in the group iff their leaderboard key has a member entry. */
export function isMember(group: Group, leaderboardKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(group.members, leaderboardKey);
}

/**
 * The group's board: the track leaderboard filtered to members.
 *
 * A filter, not a second source of truth. Points come from the same published
 * rows as the global board, so a group can never disagree with it, and joining
 * a group publishes nothing new.
 */
export function groupLeaderboard(
  group: Group, rows: readonly LeaderboardRow[],
): LeaderboardRow[] {
  return rows
    .filter((r) => isMember(group, r.leaderboardKey))
    .sort((a, b) => b.points - a.points);
}

/** Members ranked by points earned inside the challenge window. */
export function memberBoard(group: Group): Array<{ key: string } & GroupMember> {
  return Object.entries(group.members ?? {})
    .map(([key, m]) => ({ key, ...m }))
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
}

export interface TeamStanding {
  teamId: string;
  name: string;
  members: number;
  total: number;
  /** Average points per member — what teams are ranked by (FR31). */
  average: number;
}

/**
 * Team standings: average points per member, so a class of 30 does not beat a
 * class of 18 just by being bigger. A team with nobody in it yet averages 0.
 */
export function teamBoard(group: Group): TeamStanding[] {
  const out: TeamStanding[] = Object.entries(group.teams ?? {}).map(([teamId, t]) => {
    const ms = Object.values(group.members ?? {}).filter((m) => m.team === teamId);
    const total = ms.reduce((n, m) => n + (m.points ?? 0), 0);
    return { teamId, name: t.name, members: ms.length, total, average: ms.length ? total / ms.length : 0 };
  });
  return out.sort((a, b) => b.average - a.average || b.members - a.members);
}

/**
 * What a join actually discloses, for the confirmation screen (FR14).
 * Stated as data so the UI cannot drift from the truth, and so a test can
 * assert the promise the consent screen makes.
 */
export function disclosureFor(group: Group, trackName: string, teamName?: string): string[] {
  const lines = [
    `Your kid's first name and avatar`,
    `Their score on ${trackName} during this challenge — and nothing from any other track`,
    `Visible to ${group.meta.ownerName} and the other families in "${group.meta.name}"`,
  ];
  if (teamName) lines.push(`Their team: ${teamName}`);
  lines.push('Never test scores or the fall estimate');
  return lines;
}
