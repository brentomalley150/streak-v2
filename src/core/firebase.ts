/**
 * The real Backend, on Firebase. The ONLY file that imports the SDK.
 *
 * Config comes from Vite env vars (VITE_FB_*). If they're absent the app falls
 * back to NullBackend and keeps working offline — so a missing .env is a
 * degraded experience, never a crash.
 */
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Database } from 'firebase/database';
import type { AuthUser, Backend, FamilyRollup, LeaderboardRow } from './sync.js';
import type { Group, GroupMember } from './groups.js';
import { NullBackend } from './sync.js';

function readConfig(): Record<string, string> | null {
  const e = import.meta.env;
  const cfg = {
    apiKey: e['VITE_FB_API_KEY'],
    authDomain: e['VITE_FB_AUTH_DOMAIN'],
    databaseURL: e['VITE_FB_DATABASE_URL'],
    projectId: e['VITE_FB_PROJECT_ID'],
    appId: e['VITE_FB_APP_ID'],
  } as Record<string, string | undefined>;
  // Every field is required; a partial config fails confusingly at call time.
  if (Object.values(cfg).some((v) => !v)) return null;
  return cfg as Record<string, string>;
}

type Sdk = {
  getAuth: typeof import('firebase/auth')['getAuth'];
  GoogleAuthProvider: typeof import('firebase/auth')['GoogleAuthProvider'];
  signInWithPopup: typeof import('firebase/auth')['signInWithPopup'];
  fbSignOut: typeof import('firebase/auth')['signOut'];
  onAuthStateChanged: typeof import('firebase/auth')['onAuthStateChanged'];
  getDatabase: typeof import('firebase/database')['getDatabase'];
  ref: typeof import('firebase/database')['ref'];
  set: typeof import('firebase/database')['set'];
  update: typeof import('firebase/database')['update'];
  onValue: typeof import('firebase/database')['onValue'];
  get: typeof import('firebase/database')['get'];
  serverTimestamp: typeof import('firebase/database')['serverTimestamp'];
};

class FirebaseBackend implements Backend {
  readonly enabled = true;
  user: AuthUser | null = null;
  private auth: Auth;
  private db: Database;

  constructor(app: FirebaseApp, private sdk: Sdk) {
    this.auth = sdk.getAuth(app);
    this.db = sdk.getDatabase(app);
    sdk.onAuthStateChanged(this.auth, (u) => {
      this.user = u
        ? { uid: u.uid, email: u.email ?? '', displayName: u.displayName ?? '' }
        : null;
    });
  }

  async signIn(): Promise<AuthUser> {
    const provider = new this.sdk.GoogleAuthProvider();
    const cred = await this.sdk.signInWithPopup(this.auth, provider);
    const u = cred.user;
    this.user = { uid: u.uid, email: u.email ?? '', displayName: u.displayName ?? '' };
    return this.user;
  }

  async signOut(): Promise<void> {
    await this.sdk.fbSignOut(this.auth);
    this.user = null;
  }

  onAuth(fn: (u: AuthUser | null) => void): () => void {
    return this.sdk.onAuthStateChanged(this.auth, (u) => {
      fn(u ? { uid: u.uid, email: u.email ?? '', displayName: u.displayName ?? '' } : null);
    });
  }

  /**
   * Track is a PATH SEGMENT, not a field — this is what makes FR5 leaderboard
   * isolation structural rather than a client-side filter.
   */
  async publish(row: LeaderboardRow): Promise<void> {
    const t = row.trackId;
    const payload = { ...row, lastSeen: this.sdk.serverTimestamp() };
    await this.sdk.set(this.sdk.ref(this.db, `v2/tracks/${t}/leaderboard/${row.leaderboardKey}`), payload);
    // weeklyHistory preserves the week after Monday rollover, so winners can be
    // computed later. Same trick v1 used, kept deliberately.
    await this.sdk.set(
      this.sdk.ref(this.db, `v2/tracks/${t}/weeklyHistory/${row.weekStartKey}/${row.leaderboardKey}`),
      {
        name: row.name, avatar: row.avatar,
        weeklyPoints: row.weeklyPoints, weekStartKey: row.weekStartKey,
        lastSeen: this.sdk.serverTimestamp(),
      },
    );
  }

  subscribeLeaderboard(trackId: string, fn: (rows: LeaderboardRow[]) => void): () => void {
    const r = this.sdk.ref(this.db, `v2/tracks/${trackId}/leaderboard`);
    return this.sdk.onValue(r, (snap) => {
      const val = (snap.val() ?? {}) as Record<string, LeaderboardRow>;
      fn(Object.values(val).sort((a, b) => b.points - a.points));
    }, () => fn([]));
  }

  /** Parent-only cross-track view (FR6). Scoped to the signed-in uid. */
  async saveRollup(profileId: string, rows: LeaderboardRow[]): Promise<void> {
    if (!this.user) return;
    const byTrack: Record<string, unknown> = {};
    for (const r of rows) {
      byTrack[r.trackId] = {
        trackId: r.trackId, points: r.points, currentStreak: r.currentStreak,
        rank: r.rank, lastSeen: r.lastSeen,
      };
    }
    await this.sdk.update(this.sdk.ref(this.db, `v2/families/${this.user.uid}/rollup/${profileId}`), byTrack);
  }

  /**
   * One-shot read of the whole family (FR6). A glance-at parent screen, so a
   * single get beats holding a listener open. A failure yields {} — the view
   * falls back to local profiles rather than showing an error for a screen
   * that is mostly local data anyway.
   */
  /**
   * Groups (FR13–FR18). The groupId is the join code, so resolving an invite is
   * one direct read rather than an index that would need its own rules and
   * could drift out of sync.
   */
  async createGroup(group: Group): Promise<void> {
    if (!this.user) return;
    await this.sdk.set(this.sdk.ref(this.db, `v2/groups/${group.id}`), {
      meta: group.meta, members: group.members ?? {},
    });
  }

  async loadGroup(groupId: string): Promise<Group | null> {
    try {
      const snap = await this.sdk.get(this.sdk.ref(this.db, `v2/groups/${groupId}`));
      const v = snap.val();
      // A bad code is an ordinary outcome, not an error: someone mistyped it.
      if (!v?.meta) return null;
      return { id: groupId, meta: v.meta, members: v.members ?? {} };
    } catch {
      return null;
    }
  }

  async joinGroup(groupId: string, key: string, member: GroupMember): Promise<void> {
    if (!this.user) return;
    await this.sdk.set(this.sdk.ref(this.db, `v2/groups/${groupId}/members/${key}`), member);
  }

  async leaveGroup(groupId: string, key: string): Promise<void> {
    if (!this.user) return;
    // FR18: leaving removes the entry outright, not a tombstone.
    await this.sdk.set(this.sdk.ref(this.db, `v2/groups/${groupId}/members/${key}`), null);
  }

  async loadMyGroups(): Promise<Group[]> {
    if (!this.user) return [];
    try {
      const snap = await this.sdk.get(this.sdk.ref(this.db, 'v2/groups'));
      const all = (snap.val() ?? {}) as Record<string, { meta?: Group['meta']; members?: Group['members'] }>;
      return Object.entries(all)
        .filter(([, v]) => v?.meta?.ownerUid === this.user!.uid)
        .map(([id, v]) => ({ id, meta: v.meta!, members: v.members ?? {} }));
    } catch {
      return [];
    }
  }

  async loadRollup(): Promise<FamilyRollup> {
    if (!this.user) return {};
    try {
      const snap = await this.sdk.get(this.sdk.ref(this.db, `v2/families/${this.user.uid}/rollup`));
      return (snap.val() ?? {}) as FamilyRollup;
    } catch {
      return {};
    }
  }
}

/**
 * Returns a real backend when configured, otherwise a working no-op.
 * The SDK is imported dynamically so an offline family never downloads it.
 */
export async function createBackend(): Promise<Backend> {
  const cfg = readConfig();
  if (!cfg) {
    console.info('[beat-the-slide] Firebase not configured — running offline.');
    return new NullBackend();
  }
  try {
    const [app, auth, db] = await Promise.all([
      import('firebase/app'), import('firebase/auth'), import('firebase/database'),
    ]);
    const sdk: Sdk = {
      getAuth: auth.getAuth, GoogleAuthProvider: auth.GoogleAuthProvider,
      signInWithPopup: auth.signInWithPopup, fbSignOut: auth.signOut,
      onAuthStateChanged: auth.onAuthStateChanged,
      getDatabase: db.getDatabase, ref: db.ref, set: db.set, update: db.update,
      onValue: db.onValue, get: db.get, serverTimestamp: db.serverTimestamp,
    };
    return new FirebaseBackend(app.initializeApp(cfg), sdk);
  } catch (err) {
    console.warn('[beat-the-slide] Firebase init failed, running offline.', err);
    return new NullBackend();
  }
}
