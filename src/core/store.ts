/**
 * App state container. Owns the current profile, persists on every change,
 * and notifies subscribers. Deliberately tiny — no framework.
 */
import type { Activity, Profile, ProfileState, TrackId, TrackState } from './types.js';
import { asDateKey, asTrackId } from './types.js';
import { getTrack } from '../tracks/index.js';
import {
  todayKey, toggleActivity, getEntry, canLogDate, confirmActivity, effectiveDef, pointsInWindow,
} from './engine.js';
import {
  loadProfiles, saveProfiles, currentProfileId, setCurrentProfileId, clearCurrentProfileId, migrate,
  addDeleted, loadDeleted,
} from './storage.js';
import type { AuthUser, Backend, FamilyRollup, LeaderboardRow, V1Kid } from './sync.js';
import { buildRow } from './sync.js';
import { hashPin, isValidPin, verifyPin } from './pin.js';
import type { Group } from './groups.js';
import { generateJoinCode, generateTeamId, groupWindow, newGroup } from './groups.js';
import { leaderboardKey } from './sync.js';
import { fromBackup, toBackup, type ProfileBackup } from './backup.js';
import { activitySummaryPaths } from './measure.js';
import { ladderFor } from '../tracks/ladders.js';

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
  publishAll(): Promise<void> {
    // Decide now: a change made while signed out publishes nothing.
    const b = this.backend;
    if (!b?.enabled || !b.user) return this.chain;
    // One sync at a time, so an older one can never land after a newer one
    // and overwrite the backup with stale data. Requests that arrive while
    // one is still waiting share it: it reads the latest state when it runs.
    if (this.queued) return this.chain;
    this.queued = true;
    this.chain = this.chain.then(() => { this.queued = false; return this.publishNow(); });
    return this.chain;
  }

  /** Resolves once every requested sync has finished. */
  whenSynced(): Promise<void> { return this.chain; }

  private chain: Promise<void> = Promise.resolve();
  private queued = false;
  /** Kids being deleted: never re-published while their cloud data goes. */
  private deleting = new Set<string>();

  private async publishNow(): Promise<void> {
    const b = this.backend;
    if (!b?.enabled || !b.user) return;
    // Every profile, not just the active one. The rollup is the parent's
    // cross-kid view (FR6), so a sibling who happens not to be on screen must
    // still be written — otherwise their dashboard row has nothing to read.
    // Reads only; the active profile is untouched.
    try {
      for (const p of this.profiles) {
        if (this.deleting.has(p.id)) continue;
        const s = p.state;
        const rows: LeaderboardRow[] = [];
        for (const id of Object.keys(s.tracks)) {
          const st = s.tracks[id];
          if (!st) continue;
          const def = getTrack(id);
          rows.push(buildRow({
            def, state: st, ladder: ladderFor(def, st),
            user: b.user, profileId: s.profileId,
            playerName: s.playerName, playerAvatar: s.playerAvatar,
          }));
        }
        await Promise.all(rows.map((r) => b.publish(r)));
        await b.saveRollup(s.profileId, rows);
        // The restorable copy: everything but test scores and the PIN.
        await b.saveProfileBackup(s.profileId, toBackup(s));
        // The measurement summary: recent days and each track's enrollment.
        await b.saveActivitySummary(s.profileId, activitySummaryPaths(s, todayKey()));
        // Each challenge this kid joined gets their points inside its window
        // (FR29). Written under their own key, so the rules let only this
        // family write it.
        const key = leaderboardKey(b.user.uid, s.profileId);
        for (const jc of s.joinedChallenges ?? []) {
          const st = s.tracks[jc.trackId];
          if (!st) continue;
          const pts = pointsInWindow(getTrack(jc.trackId), st, asDateKey(jc.startDate), jc.lengthWeeks);
          await b.saveMemberScore(jc.groupId, key, pts).catch(() => { /* group may be gone */ });
        }
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
   * SummerStreak kids on this account that aren't on this device yet. `[]`
   * when signed out, offline, or nothing to bring in.
   */
  async findSummerKids(): Promise<V1Kid[]> {
    const b = this.backend;
    if (!b?.enabled || !b.user) return [];
    const kids = await b.loadV1Kids();
    const gone = new Set(loadDeleted(this.ls));
    return kids.filter((k) => !gone.has(k.profileId) && !this.profiles.some((p) => p.id === k.profileId));
  }

  /**
   * Bring SummerStreak kids in: each becomes a profile under its v1 id, on
   * Reading Slide with its v1 theme, keeping its lifetime points (and so its
   * rank) as a point adjustment. The day-by-day log stays on the device v1
   * ran on; streaks start fresh. Consent is recorded per kid, as onboarding
   * does. Returns how many were added.
   */
  importSummerKids(kids: readonly V1Kid[], consent: { guardian: boolean; data: boolean }): number {
    let added = 0;
    for (const k of kids) {
      if (this.profiles.some((p) => p.id === k.profileId)) continue;
      const p = newProfile(k.profileId, k.name);
      p.state.playerAvatar = k.avatar;
      p.state.consent = { ...consent, recordedAt: new Date().toISOString() };
      p.state.summer = {
        points: k.points, rank: k.rank, booksFinished: k.booksFinished,
        totalMinutes: k.totalMinutes, totalWords: k.totalWords, lastSeen: k.lastSeen,
      };
      const t = newTrackState(asTrackId('reading-slide'), k.theme);
      t.pointAdjustments = k.points;
      p.state.tracks['reading-slide'] = t;
      p.state.activeTrackId = asTrackId('reading-slide');
      this.profiles.push(p);
      if (added === 0) this.currentId = p.id;
      added += 1;
    }
    if (added) this.emit();
    return added;
  }

  /**
   * Delete one kid (the consent screen's "Delete anytime"). Cloud first: their
   * leaderboard rows, weekly history, rollup entry and challenge memberships.
   * Only once the cloud confirms does the kid leave this device, so a failed
   * delete never leaves data behind that nothing can reach any more. Signed
   * out, only this device can be cleared, and the result says so.
   */
  async deleteProfile(id: string): Promise<'deleted' | 'device-only' | 'failed'> {
    const p = this.profiles.find((x) => x.id === id);
    if (!p) return 'failed';
    const b = this.backend;
    const inCloud = !!(b?.enabled && b.user);
    if (inCloud) {
      this.deleting.add(id);
      try {
        await this.whenSynced();
        await b!.deleteKidData({
          key: leaderboardKey(b!.user!.uid, id),
          profileId: id,
          trackIds: Object.keys(p.state.tracks),
          groupIds: (p.state.joinedChallenges ?? []).map((c) => c.groupId),
        });
      } catch {
        this.deleting.delete(id);
        return 'failed';
      }
    }
    this.profiles = this.profiles.filter((x) => x.id !== id);
    addDeleted(this.ls, id);
    this.deleting.delete(id);
    if (this.currentId === id) this.currentId = this.profiles[0]?.id ?? null;
    if (!this.currentId) clearCurrentProfileId(this.ls);
    this.emit();
    return inCloud ? 'deleted' : 'device-only';
  }

  /** Delete every kid, then the family's own cloud record. */
  async deleteEverything(): Promise<'deleted' | 'device-only' | 'failed'> {
    let result: 'deleted' | 'device-only' = 'device-only';
    for (const p of [...this.profiles]) {
      const r = await this.deleteProfile(p.id);
      if (r === 'failed') return 'failed';
      result = r;
    }
    const b = this.backend;
    if (b?.enabled && b.user) {
      try { await b.deleteFamilyRecord(); result = 'deleted'; } catch { return 'failed'; }
    }
    return result;
  }

  /**
   * Kids this account backed up that aren't on this device: what a parent
   * gets back on a new phone. Deleted kids are never offered. Newest first.
   */
  async findRestorableKids(): Promise<ProfileBackup[]> {
    const b = this.backend;
    if (!b?.enabled || !b.user) return [];
    const raw = await b.loadProfileBackups();
    const gone = new Set(loadDeleted(this.ls));
    return Object.values(raw)
      .map((r) => fromBackup(r))
      .filter((k): k is ProfileBackup => !!k
        && !gone.has(k.state.profileId)
        && !this.profiles.some((p) => p.id === k.state.profileId))
      .sort((a, z) => z.savedAt - a.savedAt);
  }

  /**
   * Put backed-up kids on this device, with everything the backup holds.
   * Test scores and the PIN were never in it: scores stay on the old device,
   * and a parent sets a new PIN here. Returns how many were added.
   */
  restoreKids(kids: readonly ProfileBackup[]): number {
    let added = 0;
    for (const k of kids) {
      const id = k.state.profileId;
      if (this.profiles.some((p) => p.id === id)) continue;
      this.profiles.push({ id, schemaVersion: 2, state: k.state });
      if (added === 0) this.currentId = id;
      added += 1;
    }
    if (added) this.emit();
    return added;
  }

  /** Close the welcome-back card for the current kid. */
  dismissSummerRecap(): void {
    const s = this.state;
    if (s) { s.summerRecapSeen = true; this.emit(); }
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

  /** True once a parent has set a PIN. Nothing is gated before that. */
  get pinIsSet(): boolean {
    return this.state?.parentAuth.setupComplete === true
      && this.state.parentAuth.adminPinHash !== '';
  }

  /**
   * Set (or change) the parent PIN. Returns false for an invalid pin so the
   * caller can say why rather than silently doing nothing.
   */
  setParentPin(pin: string, adminName = ''): boolean {
    const s = this.state;
    if (!s || !isValidPin(pin)) return false;
    s.parentAuth.adminPinHash = hashPin(pin);
    s.parentAuth.setupComplete = true;
    if (adminName) s.parentAuth.adminName = adminName;
    this.emit();
    return true;
  }

  checkParentPin(pin: string): boolean {
    const s = this.state;
    if (!s) return false;
    return verifyPin(pin, s.parentAuth.adminPinHash);
  }

  /** Remove the PIN entirely, ungating everything. Requires the current pin. */
  clearParentPin(pin: string): boolean {
    const s = this.state;
    if (!s || !this.checkParentPin(pin)) return false;
    s.parentAuth.adminPinHash = '';
    s.parentAuth.setupComplete = false;
    this.emit();
    return true;
  }

  /* ---- Groups (FR13–FR18) ------------------------------------------- */

  /** This kid's slot on any board. Null until the family has signed in. */
  leaderboardKeyFor(profileId?: string): string | null {
    const u = this.user;
    const id = profileId ?? this.state?.profileId;
    return u && id ? leaderboardKey(u.uid, id) : null;
  }

  /**
   * Create a challenge others can join. The generated code IS the group id, so
   * an invite resolves in one read. Returns null when there is no account to
   * own it — a group has to belong to somebody.
   */
  async createGroup(
    name: string, trackId: string,
    opts: { startDate?: string; lengthWeeks?: number; mode?: 'kids' | 'teams'; teamName?: string } = {},
  ): Promise<Group | null> {
    const b = this.backend;
    const u = this.user;
    if (!b?.enabled || !u || !this.state) return null;
    // First name only: the same disclosure the leaderboard already makes.
    const ownerName = (u.displayName || 'A parent').split(' ')[0]!;
    const g = newGroup(
      generateJoinCode(), name.trim(), trackId, u.uid, ownerName, Date.now(),
      {
        ...(opts.startDate ? { startDate: opts.startDate } : {}),
        ...(opts.lengthWeeks ? { lengthWeeks: opts.lengthWeeks } : {}),
        ...(opts.mode ? { mode: opts.mode } : {}),
      },
    );
    if (opts.mode === 'teams') {
      // The creator's own class is the first team.
      g.teams = { [generateTeamId()]: {
        name: (opts.teamName || `${ownerName}'s class`).trim().slice(0, 40),
        ownerUid: u.uid, ownerName, createdAt: Date.now(),
      } };
    }
    try {
      await b.createGroup(g);
    } catch {
      // Most likely the groups rules are not deployed. Null lets the UI say
      // something useful instead of leaving a spinner on screen.
      return null;
    }
    return g;
  }

  /**
   * Another teacher adds their class to a team challenge (FR31). They own that
   * team and manage only its roster. Returns the new team id, or null.
   */
  async addTeam(group: Group, teamName: string): Promise<string | null> {
    const b = this.backend;
    const u = this.user;
    if (!b?.enabled || !u || group.meta.mode !== 'teams') return null;
    const id = generateTeamId();
    const team = {
      name: teamName.trim().slice(0, 40) || 'Our class',
      ownerUid: u.uid,
      ownerName: (u.displayName || 'A teacher').split(' ')[0]!,
      createdAt: Date.now(),
    };
    try {
      await b.createTeam(group.id, id, team);
    } catch {
      return null;
    }
    group.teams = { ...(group.teams ?? {}), [id]: team };
    return id;
  }

  /** The challenge owner removes a team. Its kids' own data is untouched. */
  async removeTeam(group: Group, teamId: string): Promise<boolean> {
    const b = this.backend;
    if (!b?.enabled || !this.user || group.meta.ownerUid !== this.user.uid) return false;
    try {
      await b.deleteTeam(group.id, teamId);
    } catch {
      return false;
    }
    if (group.teams) delete group.teams[teamId];
    return true;
  }

  /** Resolve an invite code. Null for anything that does not exist. */
  async loadGroup(code: string): Promise<Group | null> {
    const b = this.backend;
    if (!b?.enabled) return null;
    return b.loadGroup(code);
  }

  /**
   * Join, for ONE kid, by their own parent (FR15). Returns false rather than
   * throwing so the caller can explain why.
   */
  async joinGroup(group: Group, profileId?: string, teamId?: string): Promise<boolean> {
    const b = this.backend;
    const key = this.leaderboardKeyFor(profileId);
    const p = profileId ? this.profiles.find((x) => x.id === profileId) : this.profile;
    if (!b?.enabled || !key || !p || !group.meta.open) return false;
    // A team challenge needs a real team; never guess which class a kid is in.
    if (group.meta.mode === 'teams' && (!teamId || !group.teams?.[teamId])) return false;
    try {
      await b.joinGroup(group.id, key, {
        name: p.state.playerName || 'Unnamed',
        avatar: p.state.playerAvatar || '🙂',
        joinedAt: Date.now(),
        ...(teamId ? { team: teamId } : {}),
      });
    } catch {
      return false;
    }
    // Remember the challenge so this family keeps its window score current.
    const { startDate, lengthWeeks } = groupWindow(group);
    const list = (p.state.joinedChallenges ?? []).filter((c) => c.groupId !== group.id);
    list.push({
      groupId: group.id, trackId: group.meta.trackId, name: group.meta.name,
      startDate, lengthWeeks, ...(teamId ? { teamId } : {}),
    });
    p.state.joinedChallenges = list;
    // Make sure the kid is on the challenge's track, without changing what
    // they're looking at if they already are.
    if (!p.state.tracks[group.meta.trackId]) {
      const cur = p.state.activeTrackId ? p.state.tracks[String(p.state.activeTrackId)]?.theme : undefined;
      p.state.tracks[group.meta.trackId] = newTrackState(asTrackId(group.meta.trackId), cur ?? 'chess');
      if (!p.state.activeTrackId) p.state.activeTrackId = asTrackId(group.meta.trackId);
    }
    this.emit();
    return true;
  }

  /** Leave in one action (FR18). */
  async leaveGroup(groupId: string, profileId?: string): Promise<boolean> {
    const b = this.backend;
    const key = this.leaderboardKeyFor(profileId);
    if (!b?.enabled || !key) return false;
    await b.leaveGroup(groupId, key);
    const p = profileId ? this.profiles.find((x) => x.id === profileId) : this.profile;
    if (p) {
      p.state.joinedChallenges = (p.state.joinedChallenges ?? []).filter((c) => c.groupId !== groupId);
      this.emit();
    }
    return true;
  }

  async myGroups(): Promise<Group[]> {
    const b = this.backend;
    if (!b?.enabled || !b.user) return [];
    return b.loadMyGroups();
  }

  switchProfile(id: string): void {
    if (this.profiles.some((p) => p.id === id)) { this.currentId = id; this.emit(); }
  }

  enroll(trackId: string, theme: string, variant?: string): void {
    const s = this.state;
    if (!s) return;
    if (!s.tracks[trackId]) {
      s.tracks[trackId] = newTrackState(asTrackId(trackId), theme);
      if (variant) s.tracks[trackId]!.variant = variant;
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

  /** The kid's instrument (or other variant). Words only — points never move. */
  setVariant(trackId: string, variant: string): void {
    const t = this.state?.tracks[trackId];
    if (t) { t.variant = variant; this.emit(); }
  }

  recordConsent(guardian: boolean, data: boolean): void {
    const s = this.state;
    if (!s) return;
    s.consent = { guardian, data, recordedAt: new Date().toISOString() };
    this.emit();
  }

  setBaseline(trackId: string, values: Record<string, number | null>): void {
    const t = this.state?.tracks[trackId];
    if (!t) return;
    t.baseline = { ...t.baseline, ...values };
    // No score to run on means no fall estimate — never a stale one.
    const pf = getTrack(trackId).outcomeModel?.projectionField;
    if (pf && typeof t.baseline[pf] !== 'number') t.projectionOn = false;
    this.emit();
  }

  /** Delete every score for a track (FR20: deletable any time). */
  clearBaseline(trackId: string): void {
    const t = this.state?.tracks[trackId];
    if (!t) return;
    t.baseline = {};
    t.projectionOn = false;
    this.emit();
  }

  /**
   * Toggle an activity for the active track — today by default, or a recent
   * day the kid forgot to log. Days outside the window are refused.
   */
  toggle(activityId: string, date = todayKey()): void {
    const s = this.state;
    const t = this.activeTrack;
    if (!s || !t || !canLogDate(t, asDateKey(date))) return;
    const def = effectiveDef(getTrack(t.trackId), t);
    const entry = getEntry(t, def, date);
    const next = toggleActivity(def, entry, activityId);
    // Measurement: a tick on a later day marks the day as filled in later.
    if (date !== todayKey() && next.completed[activityId]) next.filledLater = true;
    t.entries[date] = next;
    this.emit();
  }

  /* ---- Weekly bonus (FR26) ------------------------------------------ */

  /** Mark this week's bonus done (or undo it). Never touches the streak. */
  toggleBonus(week: number, date = todayKey()): void {
    const t = this.activeTrack;
    if (!t) return;
    const done = { ...(t.bonusCompleted ?? {}) };
    if (done[week]) delete done[week]; else done[week] = date;
    t.bonusCompleted = done;
    this.emit();
  }

  /* ---- Chores (FR30) ------------------------------------------------ */

  /** A parent confirms a ticked chore, which is when it scores. */
  confirmChore(date: string, activityId: string, trackId?: string): void {
    const s = this.state;
    const t = trackId ? s?.tracks[trackId] : this.activeTrack;
    if (!t) return;
    const def = effectiveDef(getTrack(t.trackId), t);
    const e = t.entries[date];
    if (!e) return;
    t.entries[date] = confirmActivity(def, e, activityId);
    this.emit();
  }

  /** Replace a customizable track's activity list (Home Helper's chores). */
  setCustomActivities(trackId: string, acts: Activity[]): void {
    const t = this.state?.tracks[trackId];
    const def = getTrack(trackId);
    if (!t || !def.customizableActivities) return;
    // Anything dropped from the list is retired, not deleted: its earned points
    // stay, and any tick still waiting for a parent can still be confirmed.
    const before = effectiveDef(def, t).activities;
    const keep = new Set(acts.map((a) => String(a.id)));
    const retired = [...(t.retiredCustomActivities ?? []), ...before.filter((a) => !keep.has(String(a.id)))]
      .filter((a, i, arr) => !keep.has(String(a.id)) && arr.findIndex((x) => x.id === a.id) === i);
    if (retired.length) t.retiredCustomActivities = retired; else delete t.retiredCustomActivities;
    if (acts.length) t.customActivities = acts; else delete t.customActivities;
    this.emit();
  }

  /* ---- Prizes (FR27–FR28) ------------------------------------------- */

  addPrize(trackId: string, name: string, icon: string, threshold: number): boolean {
    const t = this.state?.tracks[trackId];
    const clean = name.trim().slice(0, 40);
    if (!t || !clean || !Number.isFinite(threshold) || threshold < 1) return false;
    t.prizes.push({
      id: `pz_${Date.now().toString(36)}_${(this.seq++).toString(36)}`,
      name: clean, icon: icon || '🎁', cost: Math.round(threshold), claimed: false,
    });
    t.prizes.sort((a, b) => a.cost - b.cost);
    this.emit();
    return true;
  }

  removePrize(trackId: string, prizeId: string): void {
    const t = this.state?.tracks[trackId];
    if (!t) return;
    t.prizes = t.prizes.filter((p) => p.id !== prizeId);
    this.emit();
  }

  /** The kid asks to cash in an unlocked prize. Points are untouched. */
  requestPrize(trackId: string, prizeId: string): void {
    const p = this.state?.tracks[trackId]?.prizes.find((x) => x.id === prizeId);
    if (!p || p.claimed || p.requestedAt) return;
    p.requestedAt = new Date().toISOString();
    this.emit();
  }

  /** A parent marks a prize as given. Points, rank and leaderboard are unchanged. */
  givePrize(trackId: string, prizeId: string): void {
    const t = this.state?.tracks[trackId];
    const p = t?.prizes.find((x) => x.id === prizeId);
    if (!t || !p || p.claimed) return;
    p.claimed = true;
    p.givenAt = new Date().toISOString();
    t.claimHistory.push(`${p.givenAt} ${p.name}`);
    this.emit();
  }

  /* ---- Fall projection (FR25) --------------------------------------- */

  /** Off by default; a parent turns it on and off. */
  setProjection(trackId: string, on: boolean): void {
    const t = this.state?.tracks[trackId];
    if (!t) return;
    t.projectionOn = on;
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
    const begun = new Date(start);
    begun.setDate(begun.getDate() - 7);
    t.startDate = todayKey(begun);
    t.enrolledAt = t.startDate;
    for (let i = 7; i >= 0; i -= 1) {
      const dt = new Date(start);
      dt.setDate(dt.getDate() - i);
      const key = todayKey(dt);
      t.entries[key] = {
        date: asDateKey(key), trackId: asTrackId('reading-slide'),
        completed: i % 3 === 0 ? { read: true, write: true, closeout: true } : { read: true, closeout: true },
        values: { minutes: 15 + (i % 4) * 5, book: 'Hatchet' },
        points: 0, comboClaimed: false,
      };
      t.entries[key]!.points = i % 3 === 0 ? 7 : 4;
    }
    t.baseline = { grade: 4, mapRit: 185, lexile: 375, writtenExpression: 17, cmasVocab: 80 };
    t.prizes = [
      { id: 'pz_demo1', name: 'Pick the family movie', icon: '🎬', cost: 20, claimed: false },
      { id: 'pz_demo2', name: 'Ice cream trip', icon: '🍦', cost: 60, claimed: false },
    ];
    this.emit();
  }
}
