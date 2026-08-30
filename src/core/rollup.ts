/**
 * The parent's cross-kid view model (FR6 / US-3).
 *
 * Local profiles are the source of truth for who and what exists; the Firebase
 * rollup only fills in progress this device has not seen. That ordering is
 * deliberate — a parent offline still sees every kid and track on this device,
 * and a sibling's progress from another phone merges in when it arrives.
 *
 * Pure: no Store, no network, no clock beyond the `now` passed in.
 */
import type { Profile } from './types.js';
import type { FamilyRollup } from './sync.js';
import { getTrack } from '../tracks/index.js';
import { LADDERS } from '../tracks/ladders.js';
import { computeStats } from './engine.js';

export interface RollupTrackRow {
  trackId: string;
  trackName: string;
  icon: string;
  points: number;
  currentStreak: number;
  rank: string;
  /** Epoch ms of the last activity, or null when this track has never synced. */
  lastSeen: number | null;
  /** True when the numbers came from another device rather than this one. */
  remoteOnly: boolean;
}

export interface RollupKidRow {
  profileId: string;
  name: string;
  avatar: string;
  tracks: RollupTrackRow[];
}

/**
 * Merge local profiles with whatever the family rollup holds.
 *
 * A track present locally always wins: this device's entries are authoritative
 * for a kid who uses it. A track present only in the rollup is a track the kid
 * does on another device, and is surfaced as remoteOnly so the view can say so
 * rather than implying it can be opened here.
 */
export function buildFamilyRollup(
  profiles: readonly Profile[], remote: FamilyRollup,
): RollupKidRow[] {
  const kids: RollupKidRow[] = [];

  for (const p of profiles) {
    const s = p.state;
    const seen = new Set<string>();
    const tracks: RollupTrackRow[] = [];

    for (const id of Object.keys(s.tracks)) {
      const st = s.tracks[id];
      if (!st) continue;
      const def = getTrack(id);
      const stats = computeStats(def, st, LADDERS[def.ladder] ?? LADDERS['chess']!);
      const r = remote[s.profileId]?.[id];
      seen.add(id);
      tracks.push({
        trackId: id,
        trackName: def.name,
        icon: def.icon,
        points: stats.points,
        currentStreak: stats.currentStreak,
        rank: stats.rank.name,
        // Local state carries no timestamp, so freshness can only come from
        // the rollup. Absent it, the view says "on this device" rather than
        // inventing a time.
        lastSeen: r?.lastSeen ?? null,
        remoteOnly: false,
      });
    }

    // Tracks this kid does elsewhere. Without these a parent checking from
    // their own phone would see an incomplete picture of their own kid.
    for (const [id, r] of Object.entries(remote[s.profileId] ?? {})) {
      if (seen.has(id)) continue;
      const def = getTrack(id);
      tracks.push({
        trackId: id,
        trackName: def.name,
        icon: def.icon,
        points: r.points,
        currentStreak: r.currentStreak,
        rank: r.rank,
        lastSeen: r.lastSeen ?? null,
        remoteOnly: true,
      });
    }

    kids.push({
      profileId: s.profileId,
      name: s.playerName || 'Unnamed',
      avatar: s.playerAvatar || '🙂',
      tracks,
    });
  }

  return kids;
}

/**
 * "2h ago". Returns null when there is no timestamp — the caller must say
 * something true about that ("on this device"), never render a zero, since a
 * 0 meaning "no data" and a 0 meaning "no activity" read identically.
 */
export function relativeTime(lastSeen: number | null, now: number): string | null {
  if (lastSeen === null) return null;
  const ms = now - lastSeen;
  if (ms < 0) return 'just now';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'a week ago' : `${weeks}w ago`;
}
