/**
 * The cloud backup of one kid, so a family can restore on a new device.
 *
 * Stored at v2/families/{uid}/profiles/{profileId}, which only that account
 * can read or write. Two things never leave the device:
 *   - test scores (baseline) and the fall-estimate switch — the privacy
 *     policy and FR21 promise scores stay on the device;
 *   - the parent PIN — a restored device asks a parent to set a new one.
 *
 * Firebase drops empty objects and arrays and rejects `undefined`, so
 * toBackup() strips undefined values and fromBackup() puts every container
 * back. fromBackup() returns null for anything that isn't a kid.
 */
import type { DayEntry, ProfileState, TrackState } from './types.js';
import { asDateKey, asTrackId } from './types.js';

export interface ProfileBackup {
  savedAt: number;
  state: ProfileState;
}

/** A copy safe to upload: no scores, no PIN, no undefined values. */
export function toBackup(state: ProfileState, savedAt = Date.now()): ProfileBackup {
  const copy = JSON.parse(JSON.stringify(state)) as ProfileState;
  copy.parentAuth = { setupComplete: false, adminName: '', adminPinHash: '' };
  for (const t of Object.values(copy.tracks)) {
    t.baseline = {};
    delete t.projectionOn;
  }
  return { savedAt, state: copy };
}

const obj = <T>(v: unknown): Record<string, T> =>
  (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Record<string, T>;
const arr = <T>(v: unknown): T[] =>
  Array.isArray(v) ? v as T[] : v && typeof v === 'object' ? Object.values(v) as T[] : [];

function restoreEntry(raw: unknown, trackId: string, date: string): DayEntry {
  const e = obj<unknown>(raw);
  return {
    date: asDateKey(typeof e['date'] === 'string' ? e['date'] : date),
    trackId: asTrackId(typeof e['trackId'] === 'string' ? e['trackId'] : trackId),
    completed: obj<boolean>(e['completed']),
    values: obj<string | number>(e['values']),
    points: typeof e['points'] === 'number' ? e['points'] : 0,
    comboClaimed: e['comboClaimed'] === true,
    ...(e['confirmed'] ? { confirmed: obj<boolean>(e['confirmed']) } : {}),
  };
}

function restoreTrack(raw: unknown, trackId: string): TrackState {
  const t = obj<unknown>(raw);
  const entries: Record<string, DayEntry> = {};
  for (const [date, e] of Object.entries(obj<unknown>(t['entries']))) entries[date] = restoreEntry(e, trackId, date);
  const out: TrackState = {
    ...(t as unknown as TrackState),
    trackId: asTrackId(trackId),
    entries,
    weeklyChallengesCompleted: obj(t['weeklyChallengesCompleted']),
    weeklyAdjustments: obj(t['weeklyAdjustments']),
    earnedBadges: obj(t['earnedBadges']),
    pointAdjustments: typeof t['pointAdjustments'] === 'number' ? t['pointAdjustments'] : 0,
    prizes: arr(t['prizes']),
    claimHistory: arr(t['claimHistory']),
    baseline: {},
  };
  if (t['customActivities'] !== undefined) out.customActivities = arr(t['customActivities']);
  if (t['retiredCustomActivities'] !== undefined) out.retiredCustomActivities = arr(t['retiredCustomActivities']);
  for (const p of out.prizes) if (!p.icon) p.icon = '🎁';
  for (const a of [...(out.customActivities ?? []), ...(out.retiredCustomActivities ?? [])]) {
    (a as { fields: unknown }).fields = arr(a.fields);
  }
  delete out.projectionOn;
  return out;
}

/** A kid back from the cloud, or null if the record isn't one. */
export function fromBackup(raw: unknown): ProfileBackup | null {
  const b = obj<unknown>(raw);
  const s = obj<unknown>(b['state']);
  if (typeof s['profileId'] !== 'string' || !s['profileId'] || typeof s['playerName'] !== 'string') return null;
  const tracks: Record<string, TrackState> = {};
  for (const [id, t] of Object.entries(obj<unknown>(s['tracks']))) tracks[id] = restoreTrack(t, id);
  const consent = obj<unknown>(s['consent']);
  const state: ProfileState = {
    ...(s as unknown as ProfileState),
    tracks,
    friends: arr(s['friends']),
    acceptedInvites: arr(s['acceptedInvites']),
    coParentName: typeof s['coParentName'] === 'string' ? s['coParentName'] : '',
    coParentEmail: typeof s['coParentEmail'] === 'string' ? s['coParentEmail'] : '',
    parentAuth: { setupComplete: false, adminName: '', adminPinHash: '' },
    entitlement: s['entitlement'] === 'family' ? 'family' : 'free',
    consent: {
      guardian: consent['guardian'] === true,
      data: consent['data'] === true,
      recordedAt: typeof consent['recordedAt'] === 'string' ? consent['recordedAt'] : null,
    },
    activeTrackId: typeof s['activeTrackId'] === 'string' && tracks[s['activeTrackId']]
      ? asTrackId(s['activeTrackId'])
      : (Object.keys(tracks)[0] ? asTrackId(Object.keys(tracks)[0]!) : null),
  };
  if (s['joinedChallenges'] !== undefined) state.joinedChallenges = arr(s['joinedChallenges']);
  return { savedAt: typeof b['savedAt'] === 'number' ? b['savedAt'] : 0, state };
}
