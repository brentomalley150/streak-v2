import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from './store.js';
import type { Backend, AuthUser, LeaderboardRow } from './sync.js';

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
