/**
 * App state container. Owns the current profile, persists on every change,
 * and notifies subscribers. Deliberately tiny — no framework.
 */
import type { Profile, ProfileState, TrackId, TrackState } from './types.js';
import { asDateKey, asTrackId } from './types.js';
import { getTrack } from '../tracks/index.js';
import { todayKey, toggleActivity, getEntry } from './engine.js';
import {
  loadProfiles, saveProfiles, currentProfileId, setCurrentProfileId, migrate,
} from './storage.js';
import type { AuthUser, Backend, FamilyRollup, LeaderboardRow } from './sync.js';
import { buildRow } from './sync.js';
import { LADDERS } from '../tracks/ladders.js';

type Listener = () => void;

export function newTrackState(trackId: TrackId, theme: string): TrackState {
  const today = todayKey();
  const def = getTrack(trackId);
  return {
    trackId,
    enrolledAt: today,
    startDate: today,
    theme: def.themes.includes(theme) ? theme : (def.themes[0] ?? 'chess'),
    entries: {},
    weeklyChallengesCompleted: {},
    weeklyAdjustments: {},
    earnedBadges: {},
    pointAdjustments: 0,
    prizes: [],
    claimHistory: [],
    baseline: {},
  };
}

export function newProfile(id: string, name: string): Profile {
  return {
    id,
    schemaVersion: 2,
    state: {
      profileId: id,
      playerName: name,
      playerAvatar: '👑',
      activeTrackId: null,
      tracks: {},
      friends: [],
      acceptedInvites: [],
      coParentName: '',
      coParentEmail: '',
      parentAuth: { setupComplete: false, adminName: '', adminPinHash: '' },
      entitlement: 'free',
      consent: { guardian: false, data: false, recordedAt: null },
    },
  };
}

export class Store {
  private profiles: Profile[] = [];
  private currentId: string | null = null;
  private listeners = new Set<Listener>();

  private backend: Backend | null = null;
  /** Monotonic within a session; only ever used to disambiguate profile ids. */
  private seq = 0;

  constructor(private ls: Storage) {}

  /**
   * Attach a backend. Optional by design — with none, or with one that is
   * disabled, everything below still works against localStorage alone.
   */
  attachBackend(b: Backend): void {
    this.backend = b;
    b.onAuth((u) => { if (u) void this.publishAll(); });
  }

  get user(): AuthUser | null { return this.backend?.user ?? null; }
  get syncEnabled(): boolean { return this.backend?.enabled === true; }

  async signIn(): Promise<AuthUser | null> {
    if (!this.backend?.enabled) return null;
    const u = await this.backend.signIn();
    await this.publishAll();
    return u;
  }

  /**
   * Push every enrolled track for the current profile.
   * Failure is non-fatal: local state is the source of truth, so a dropped
   * network means a stale leaderboard, never lost progress.
   */
  async publishAll(): Promise<void> {
    const b = this.backend;
    if (!b?.enabled || !b.user) return;
    // Every profile, not just the active one. The rollup is the parent's
    // cross-kid view (FR6), so a sibling who happens not to be on screen must
    // still be written — otherwise their dashboard row has nothing to read.
    // Reads only; the active profile is untouched.
    try {
      for (const p of this.profiles) {
        const s = p.state;
        const rows: LeaderboardRow[] = [];
        for (const id of Object.keys(s.tracks)) {
          const st = s.tracks[id];
          if (!st) continue;
          const def = getTrack(id);
          rows.push(buildRow({
            def, state: st, ladder: LADDERS[def.ladder] ?? LADDERS['chess']!,
            user: b.user, profileId: s.profileId,
            playerName: s.playerName, playerAvatar: s.playerAvatar,
          }));
        }
        await Promise.all(rows.map((r) => b.publish(r)));
        await b.saveRollup(s.profileId, rows);
      }
    } catch (err) {
      console.warn('[beat-the-slide] sync failed; local data is unaffected.', err);
    }
  }

  /** Migrate v1 data if present, then load. Safe to call once at boot. */
  init(): { migrated: number } {
    const { migrated } = migrate(this.ls);
    this.profiles = loadProfiles(this.ls);
    this.currentId = currentProfileId(this.ls)
      ?? this.profiles[0]?.id
      ?? null;
    return { migrated };
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    saveProfiles(this.ls, this.profiles);
    if (this.currentId) setCurrentProfileId(this.ls, this.currentId);
    for (const fn of this.listeners) fn();
    void this.publishAll();   // fire-and-forget; never blocks the UI
  }

  get hasProfile(): boolean { return this.profiles.length > 0; }
  get all(): readonly Profile[] { return this.profiles; }

  get profile(): Profile | null {
    return this.profiles.find((p) => p.id === this.currentId) ?? this.profiles[0] ?? null;
  }

  get state(): ProfileState | null { return this.profile?.state ?? null; }

  get activeTrack(): TrackState | null {
    const s = this.state;
    if (!s?.activeTrackId) return null;
    return s.tracks[String(s.activeTrackId)] ?? null;
  }

  addProfile(name: string): Profile {
    // Date.now() alone collides when two kids are added in the same
    // millisecond, and a duplicate id makes the second kid unreachable:
    // `profile` resolves by find(), so it always returns the first match.
    // A counter suffix keeps ids unique without depending on wall-clock gaps.
    // A reload resets seq to 0, so the counter alone is not enough: bump past
    // anything already stored until the id is genuinely unused.
    let id = `p_${Date.now().toString(36)}_${(this.seq++).toString(36)}`;
    while (this.profiles.some((x) => x.id === id)) {
      id = `p_${Date.now().toString(36)}_${(this.seq++).toString(36)}`;
    }
    const p = newProfile(id, name);
    this.profiles.push(p);
    this.currentId = p.id;
    this.emit();
    return p;
  }

  /**
   * The family's rollup for the parent view (FR6). Yields {} with no backend,
   * signed out, or offline — the view renders local profiles regardless.
   */
  async loadRollup(): Promise<FamilyRollup> {
    const b = this.backend;
    if (!b?.enabled || !b.user) return {};
    return b.loadRollup();
  }

  switchProfile(id: string): void {
    if (this.profiles.some((p) => p.id === id)) { this.currentId = id; this.emit(); }
  }

  enroll(trackId: string, theme: string): void {
    const s = this.state;
    if (!s) return;
    if (!s.tracks[trackId]) {
      s.tracks[trackId] = newTrackState(asTrackId(trackId), theme);
    }
    s.activeTrackId = asTrackId(trackId);
    this.emit();
  }

  setActiveTrack(trackId: string): void {
    const s = this.state;
    if (!s || !s.tracks[trackId]) return;
    s.activeTrackId = asTrackId(trackId);
    this.emit();
  }

  setTheme(trackId: string, theme: string): void {
    const t = this.state?.tracks[trackId];
    if (t) { t.theme = theme; this.emit(); }
  }

  recordConsent(guardian: boolean, data: boolean): void {
    const s = this.state;
    if (!s) return;
    s.consent = { guardian, data, recordedAt: new Date().toISOString() };
    this.emit();
  }

  setBaseline(trackId: string, values: Record<string, number | null>): void {
    const t = this.state?.tracks[trackId];
    if (t) { t.baseline = { ...t.baseline, ...values }; this.emit(); }
  }

  /** Toggle an activity on today's entry for the active track. */
  toggle(activityId: string, date = todayKey()): void {
    const s = this.state;
    const t = this.activeTrack;
    if (!s || !t) return;
    const def = getTrack(t.trackId);
    const entry = getEntry(t, def, date);
    t.entries[date] = toggleActivity(def, entry, activityId);
    this.emit();
  }

  setValue(fieldId: string, value: string | number, date = todayKey()): void {
    const t = this.activeTrack;
    if (!t) return;
    const def = getTrack(t.trackId);
    const entry = getEntry(t, def, date);
    entry.values[fieldId] = value;
    t.entries[date] = entry;
    this.emit();
  }

  /**
   * Apply a digest proposal. This is the ONLY path by which the parent-side
   * agent writes back to the kid app — guardrail 6, confirm-before-action.
   * Called from the confirm button's handler, never from rendering.
   */
  applyProposal(note: string, activityId?: string): void {
    const t = this.activeTrack;
    if (!t) return;
    t.weekFocus = activityId ? `${note}` : note;
    this.emit();
  }

  /** Parent declined. Remember it so the same week isn't re-asked. */
  dismissProposal(): void {
    const t = this.activeTrack;
    if (!t) return;
    t.proposalDismissedWeek = new Date().toISOString().slice(0, 10);
    this.emit();
  }

  /** Subscribe to one track's leaderboard. Returns an unsubscribe function. */
  watchLeaderboard(trackId: string, fn: (rows: LeaderboardRow[]) => void): () => void {
    if (!this.backend?.enabled) { fn([]); return () => {}; }
    return this.backend.subscribeLeaderboard(trackId, fn);
  }

  /** Dev/testing helper — wipes v2 keys only, never v1's. */
  resetV2(): void {
    this.profiles = [];
    this.currentId = null;
    this.emit();
    this.ls.setItem('bts-current-profile', '');
  }

  seedDemo(): void {
    const p = this.addProfile('Declan');
    p.state.consent = { guardian: true, data: true, recordedAt: new Date().toISOString() };
    this.enroll('reading-slide', 'chess');
    const t = p.state.tracks['reading-slide']!;
    const start = new Date();
    for (let i = 7; i >= 0; i -= 1) {
      const dt = new Date(start);
      dt.setDate(dt.getDate() - i);
      const key = todayKey(dt);
      t.entries[key] = {
        date: asDateKey(key), trackId: asTrackId('reading-slide'),
        completed: i % 3 === 0 ? { read: true, write: true, math: true } : { read: true, math: true },
        values: { minutes: 20 + (i % 4) * 5, book: 'Hatchet' },
        points: 0, comboClaimed: false,
      };
      t.entries[key]!.points = i % 3 === 0 ? 8 : 5;
    }
    this.emit();
  }
}
