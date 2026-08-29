/**
 * localStorage persistence + the v1 → v2 migration (DATA-MODEL §5).
 *
 * Safety rules, from §5.4 — all four are enforced here:
 *   1. Back up before transforming.
 *   2. Never destructive: v1 keys are read, never deleted.
 *   3. Version-stamped, so migration is idempotent.
 *   4. Same computed stats before and after (asserted in storage.test.ts).
 */
import type { DayEntry, Profile, ProfileState, TrackState } from './types.js';
import { asDateKey, asTrackId } from './types.js';

export const KEYS = {
  profiles: 'bts-profiles',
  current: 'bts-current-profile',
  // v1 keys — read for migration, never written or removed.
  v1Profiles: 'summerstreak-profiles',
  v1Current: 'summerstreak-current-profile',
  v1Legacy2: 'declan-dashboard-v2',
  v1Legacy1: 'declan-dashboard-v1',
  backup: 'summerstreak-profiles-v1-backup',
} as const;

/** v1's activity booleans, in the order they carried points. */
const V1_ACTIVITIES = ['read', 'write', 'math', 'closeout', 'tournament'] as const;
/** v1's payload fields, renamed to camelCase where v1 used snake_case. */
const V1_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ['minutes', 'minutes'],
  ['book', 'book'],
  ['writing_topic', 'writingTopic'],
  ['new_word', 'newWord'],
  ['words', 'words'],
  ['bonus_minutes', 'bonusMinutes'],
  ['books_finished', 'booksFinished'],
];

const READING = 'reading-slide';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

/** Transform one v1 state blob into a v2 ProfileState. Pure. */
export function migrateV1State(id: string, v1: Record<string, any>): ProfileState {
  const entries: Record<string, DayEntry> = {};
  const src = (v1['entries'] ?? {}) as Record<string, any>;

  for (const [dateKey, e] of Object.entries(src)) {
    if (!e || typeof e !== 'object') continue;
    const completed: Record<string, boolean> = {};
    for (const a of V1_ACTIVITIES) if (e[a] === true) completed[a] = true;

    const values: Record<string, string | number> = {};
    for (const [from, to] of V1_FIELDS) {
      const v = e[from];
      if (v !== undefined && v !== null && v !== '' && v !== 0) values[to] = v;
    }
    entries[dateKey] = {
      date: asDateKey(dateKey),
      trackId: asTrackId(READING),
      completed,
      values,
      points: typeof e['points'] === 'number' ? e['points'] : 0,
      comboClaimed: e['combo_claimed'] === true,
    };
  }

  const start = asDateKey(String(v1['summerStart'] ?? '2026-06-01'));
  const track: TrackState = {
    trackId: asTrackId(READING),
    enrolledAt: start,
    startDate: start,
    theme: String(v1['preference'] ?? 'chess'),
    entries,
    weeklyChallengesCompleted: v1['weeklyChallengesCompleted'] ?? {},
    weeklyAdjustments: v1['weeklyAdjustments'] ?? {},
    earnedBadges: v1['earnedBadges'] ?? {},
    pointAdjustments: Number(v1['pointAdjustments'] ?? 0),
    prizes: Array.isArray(v1['prizes']) ? v1['prizes'] : [],
    claimHistory: Array.isArray(v1['claimHistory']) ? v1['claimHistory'] : [],
    baseline: (v1['baseline'] ?? {}) as Record<string, number | null>,
  };

  const auth = (v1['parentAuth'] ?? {}) as Record<string, any>;
  return {
    profileId: id,
    playerName: String(v1['player']?.name ?? ''),
    playerAvatar: String(v1['playerAvatar'] ?? '👑'),
    activeTrackId: asTrackId(READING),
    tracks: { [READING]: track },
    friends: Array.isArray(v1['friends']) ? v1['friends'] : [],
    acceptedInvites: Array.isArray(v1['acceptedInvites']) ? v1['acceptedInvites'] : [],
    coParentName: String(v1['coParentName'] ?? ''),
    coParentEmail: String(v1['coParentEmail'] ?? ''),
    parentAuth: {
      setupComplete: auth['setupComplete'] === true,
      adminName: String(auth['adminName'] ?? ''),
      adminPinHash: String(auth['adminPinHash'] ?? ''),
    },
    entitlement: 'free',
    // A migrated family already used v1; consent is grandfathered but recorded
    // as unset so the app can ask once rather than assume.
    consent: { guardian: false, data: false, recordedAt: null },
  };
}

/** Read v1 profiles, including v1's own legacy chain. Non-destructive. */
export function readV1Profiles(ls: Storage): Array<{ id: string; state: any }> {
  const arr = safeParse<Array<{ id: string; state: any }>>(ls.getItem(KEYS.v1Profiles));
  if (arr && arr.length) return arr;
  // Pre-profile era: a single blob under one of two legacy keys.
  for (const k of [KEYS.v1Legacy2, KEYS.v1Legacy1]) {
    const blob = safeParse<Record<string, any>>(ls.getItem(k));
    if (blob) return [{ id: 'p_migrated', state: blob }];
  }
  return [];
}

/**
 * Run the migration if needed. Idempotent — a profile already at
 * schemaVersion 2 is skipped, so re-running is safe.
 */
export function migrate(ls: Storage): { migrated: number; skipped: number } {
  const existing = safeParse<Profile[]>(ls.getItem(KEYS.profiles)) ?? [];
  const done = new Set(existing.filter((p) => p.schemaVersion === 2).map((p) => p.id));

  const v1 = readV1Profiles(ls);
  if (!v1.length) return { migrated: 0, skipped: 0 };

  // Rule 1: back up the raw v1 blob before transforming anything.
  if (!ls.getItem(KEYS.backup)) {
    ls.setItem(KEYS.backup, JSON.stringify(v1));
  }

  let migrated = 0, skipped = 0;
  const out = [...existing];
  for (const p of v1) {
    if (done.has(p.id)) { skipped += 1; continue; }
    out.push({ id: p.id, schemaVersion: 2, state: migrateV1State(p.id, p.state ?? {}) });
    migrated += 1;
  }
  if (migrated) ls.setItem(KEYS.profiles, JSON.stringify(out));
  return { migrated, skipped };
}

export function loadProfiles(ls: Storage): Profile[] {
  return safeParse<Profile[]>(ls.getItem(KEYS.profiles)) ?? [];
}

export function saveProfiles(ls: Storage, profiles: Profile[]): void {
  ls.setItem(KEYS.profiles, JSON.stringify(profiles));
}

export function currentProfileId(ls: Storage): string | null {
  return ls.getItem(KEYS.current);
}

export function setCurrentProfileId(ls: Storage, id: string): void {
  ls.setItem(KEYS.current, id);
}
