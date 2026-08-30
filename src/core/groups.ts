/**
 * Groups — a challenge someone runs and invites kids to (FR13–FR18).
 *
 * The entity that makes the product's core mechanic expressible. Everything
 * else lives under `v2/families/${auth.uid}`, scoped to one account, so no
 * object could span households. A group is deliberately top-level:
 *
 *     v2/groups/${groupId}
 *       meta:    { name, trackId, ownerUid, ownerName, createdAt, open }
 *       members: { ${leaderboardKey}: { name, avatar, joinedAt } }
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
}

export interface GroupMember {
  name: string;
  avatar: string;
  joinedAt: number;
}

export interface Group {
  id: string;
  meta: GroupMeta;
  members: Record<string, GroupMember>;
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

/** The link a creator shares. Relative, so it works on any host. */
export function joinLink(code: string, origin: string, path = '/app/'): string {
  return `${origin.replace(/\/$/, '')}${path}?join=${code}`;
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
): Group {
  return {
    id,
    meta: { name, trackId, ownerUid, ownerName, createdAt: now, open: true },
    members: {},
  };
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

/**
 * What a join actually discloses, for the confirmation screen (FR14).
 * Stated as data so the UI cannot drift from the truth, and so a test can
 * assert the promise the consent screen makes.
 */
export function disclosureFor(group: Group, trackName: string): string[] {
  return [
    `Your kid's first name and avatar`,
    `Their score and streak on ${trackName} — and nothing from any other track`,
    `Visible to ${group.meta.ownerName} and the other families in "${group.meta.name}"`,
  ];
}
