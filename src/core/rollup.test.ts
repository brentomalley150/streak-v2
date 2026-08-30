import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from './store.js';
import { buildFamilyRollup, relativeTime } from './rollup.js';
import type { Profile } from './types.js';
import type { Backend, AuthUser, FamilyRollup, LeaderboardRow } from './sync.js';

/** Minimal in-memory Storage so tests need no DOM. */
class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const USER: AuthUser = { uid: 'u_kate', email: 'kate@example.com', displayName: 'Kate O.' };

/**
 * Records what sync actually wrote. The rollup is the parent's only cross-kid
 * view (FR6), so what lands here is the whole feature.
 */
class RecordingBackend implements Backend {
  readonly enabled = true;
  user: AuthUser | null = USER;
  rollups: Array<{ profileId: string; trackIds: string[] }> = [];
  published: LeaderboardRow[] = [];

  async signIn(): Promise<AuthUser> { return USER; }
  async signOut(): Promise<void> { this.user = null; }
  // Deliberately inert: attachBackend publishes on auth, and these tests drive
  // publishAll explicitly so each assertion covers one known sync.
  onAuth(): () => void { return () => {}; }
  async publish(row: LeaderboardRow): Promise<void> { this.published.push(row); }
  subscribeLeaderboard(_t: string, fn: (rows: LeaderboardRow[]) => void): () => void {
    fn([]); return () => {};
  }
  async saveRollup(profileId: string, rows: LeaderboardRow[]): Promise<void> {
    this.rollups.push({ profileId, trackIds: rows.map((r) => String(r.trackId)) });
  }
  stored: FamilyRollup = {};
  async loadRollup(): Promise<FamilyRollup> { return this.stored; }
}

/**
 * emit() fires publishAll() fire-and-forget on every mutation, so setup leaves
 * promises in flight. Let them settle before clearing, or their writes land
 * after the reset and get counted against the call under test.
 */
async function drainPendingSyncs(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

let ls: MemStorage;
let backend: RecordingBackend;
let store: Store;

/** A family with two kids, each enrolled in a track — the FR6 case. */
function twoKidFamily(): { declan: string; sophie: string } {
  const declan = store.addProfile('Declan').id;
  store.enroll('reading-slide', 'chess');
  const sophie = store.addProfile('Sophie').id;   // addProfile switches to the new kid
  store.enroll('math-facts', 'sports');
  return { declan, sophie };
}

beforeEach(() => {
  ls = new MemStorage();
  backend = new RecordingBackend();
  store = new Store(ls);
  store.init();
  store.attachBackend(backend);
});

describe('FR6 — the rollup must cover every kid, not just the active one', () => {
  it('writes a rollup for each profile in the family', async () => {
    const { declan, sophie } = twoKidFamily();
    // Every mutation above already triggered a sync via emit(). Only the
    // profiles covered by one explicit publishAll are under test here.
    await drainPendingSyncs();
    backend.rollups = [];

    await store.publishAll();

    const ids = backend.rollups.map((r) => r.profileId).sort();
    // Sophie is active. Declan is not, and before the fix he was silently
    // skipped — so his dashboard row would have had nothing to read.
    expect(ids).toEqual([declan, sophie].sort());
  });

  it("carries each kid's own tracks, not the active kid's", async () => {
    const { declan, sophie } = twoKidFamily();
    await drainPendingSyncs();
    backend.rollups = [];

    await store.publishAll();

    const byId = new Map(backend.rollups.map((r) => [r.profileId, r.trackIds]));
    expect(byId.get(declan)).toEqual(['reading-slide']);
    expect(byId.get(sophie)).toEqual(['math-facts']);
  });

  it('still publishes a leaderboard row for every kid', async () => {
    twoKidFamily();
    await drainPendingSyncs();
    backend.published = [];

    await store.publishAll();

    const keys = backend.published.map((r) => r.leaderboardKey);
    expect(new Set(keys).size).toBe(2);
  });

  it('leaves the active profile unchanged — syncing must not switch kids', async () => {
    const { sophie } = twoKidFamily();

    await store.publishAll();

    expect(store.profile?.id).toBe(sophie);
  });
});

describe('switching profiles — the second kid must be reachable', () => {
  it('gives each kid a distinct id even when added in the same millisecond', () => {
    const a = store.addProfile('Declan').id;
    const b = store.addProfile('Sophie').id;
    expect(a).not.toBe(b);
    expect(store.all).toHaveLength(2);
  });

  it('resolves the active profile to the kid actually switched to', () => {
    const declan = store.addProfile('Declan').id;
    store.addProfile('Sophie');

    store.switchProfile(declan);

    expect(store.profile?.id).toBe(declan);
    expect(store.state?.playerName).toBe('Declan');
  });

  it('keeps each kid on their own track', () => {
    const declan = store.addProfile('Declan').id;
    store.enroll('reading-slide', 'chess');
    const sophie = store.addProfile('Sophie').id;
    store.enroll('math-facts', 'sports');

    store.switchProfile(declan);
    expect(store.activeTrack?.trackId).toBe('reading-slide');

    store.switchProfile(sophie);
    expect(store.activeTrack?.trackId).toBe('math-facts');
  });

  it('ignores a switch to an unknown id rather than blanking the app', () => {
    const declan = store.addProfile('Declan').id;

    store.switchProfile('p_does_not_exist');

    expect(store.profile?.id).toBe(declan);
  });

  it('survives a reload — the chosen kid is still active', () => {
    store.addProfile('Declan');
    const sophie = store.addProfile('Sophie').id;
    store.switchProfile(sophie);

    const reloaded = new Store(ls);
    reloaded.init();

    expect(reloaded.profile?.id).toBe(sophie);
    expect(reloaded.state?.playerName).toBe('Sophie');
  });
});

describe('profile ids survive a reload', () => {
  it('does not reuse an id after the session counter resets', () => {
    store.addProfile('Declan');
    const firstIds = store.all.map((p) => p.id);

    // A reload starts a fresh Store with seq back at 0. Ids must still differ
    // from the ones already persisted, or the new kid shadows an existing one.
    const reloaded = new Store(ls);
    reloaded.init();
    reloaded.addProfile('Sophie');

    const ids = reloaded.all.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(firstIds));
  });
});

describe('buildFamilyRollup — merging local truth with the family rollup', () => {
  function familyOf(...kids: Array<[string, string[]]>): Profile[] {
    const s = new Store(new MemStorage());
    s.init();
    for (const [name, trackIds] of kids) {
      s.addProfile(name);
      for (const t of trackIds) s.enroll(t, 'chess');
    }
    return [...s.all];
  }

  it('lists every kid, with every track they have on this device', () => {
    const profiles = familyOf(['Declan', ['reading-slide']], ['Sophie', ['math-facts']]);

    const rows = buildFamilyRollup(profiles, {});

    expect(rows.map((k) => k.name)).toEqual(['Declan', 'Sophie']);
    expect(rows[0]!.tracks.map((t) => t.trackId)).toEqual(['reading-slide']);
    expect(rows[1]!.tracks.map((t) => t.trackId)).toEqual(['math-facts']);
  });

  it('works with no rollup at all — a parent offline still sees the family', () => {
    const profiles = familyOf(['Declan', ['reading-slide']]);

    const rows = buildFamilyRollup(profiles, {});

    expect(rows).toHaveLength(1);
    expect(rows[0]!.tracks[0]!.remoteOnly).toBe(false);
    expect(rows[0]!.tracks[0]!.lastSeen).toBeNull();
  });

  it('surfaces a track the kid only does on another device', () => {
    const profiles = familyOf(['Declan', ['reading-slide']]);
    const id = profiles[0]!.state.profileId;
    const remote: FamilyRollup = {
      [id]: {
        'math-facts': { trackId: 'math-facts', points: 40, currentStreak: 3, rank: 'Level 2', lastSeen: 1000 },
      },
    };

    const rows = buildFamilyRollup(profiles, remote);

    const math = rows[0]!.tracks.find((t) => t.trackId === 'math-facts')!;
    expect(math.remoteOnly).toBe(true);
    expect(math.points).toBe(40);
  });

  it('prefers this device over the rollup for a track held locally', () => {
    const profiles = familyOf(['Declan', ['reading-slide']]);
    const id = profiles[0]!.state.profileId;
    // Stale remote numbers for a track this device also has.
    const remote: FamilyRollup = {
      [id]: {
        'reading-slide': { trackId: 'reading-slide', points: 999, currentStreak: 99, rank: 'King', lastSeen: 5 },
      },
    };

    const rows = buildFamilyRollup(profiles, remote);

    const reading = rows[0]!.tracks.find((t) => t.trackId === 'reading-slide')!;
    expect(reading.remoteOnly).toBe(false);
    expect(reading.points).toBe(0);      // local truth, not the stale 999
    expect(reading.lastSeen).toBe(5);    // freshness can only come from remote
  });

  it('does not mutate the profiles it reads', () => {
    const profiles = familyOf(['Declan', ['reading-slide']]);
    const before = JSON.stringify(profiles);

    buildFamilyRollup(profiles, {});

    expect(JSON.stringify(profiles)).toBe(before);
  });
});

describe('relativeTime — never renders a zero for "no data"', () => {
  const now = 1_000_000_000;

  it('returns null when nothing has synced, so the view must say something else', () => {
    expect(relativeTime(null, now)).toBeNull();
  });

  it('reads in units a parent scans', () => {
    expect(relativeTime(now - 30_000, now)).toBe('just now');
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5m ago');
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(relativeTime(now - 26 * 3_600_000, now)).toBe('yesterday');
    expect(relativeTime(now - 3 * 86_400_000, now)).toBe('3d ago');
    expect(relativeTime(now - 9 * 86_400_000, now)).toBe('a week ago');
  });

  it('treats a clock skewed into the future as now, not a negative age', () => {
    expect(relativeTime(now + 60_000, now)).toBe('just now');
  });
});

/**
 * A one-kid family must be able to become a two-kid family.
 *
 * "Add a kid" originally lived only inside the kid switcher, which is hidden
 * until a family has 2+ kids — so the only route to a second kid required
 * already having one. The affordance now sits outside that menu; these assert
 * the store side works from a single-kid family, which is the state a real
 * parent is in when they go looking for it.
 */
describe('a one-kid family can add a second', () => {
  it('appends a second kid without disturbing the first', () => {
    store.addProfile('Declan');
    store.enroll('reading-slide', 'chess');
    const declan = store.profile!.id;
    expect(store.all).toHaveLength(1);

    store.addProfile('Sophie');
    store.enroll('math-facts', 'sports');

    expect(store.all).toHaveLength(2);
    const first = store.all.find((p) => p.id === declan)!;
    expect(first.state.playerName).toBe('Declan');
    expect(Object.keys(first.state.tracks)).toEqual(['reading-slide']);
  });

  it('leaves the new kid active, so onboarding lands on them', () => {
    store.addProfile('Declan');
    store.addProfile('Sophie');
    expect(store.profile?.state.playerName).toBe('Sophie');
  });
});
