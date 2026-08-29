# Beat the Slide v2 — Data Model & Migration Spec

**Status:** Draft v1 · **Date:** 2026-08-28
**Owner:** Kate O'Malley · **Author:** Brent O'Malley
**Unblocks:** PRD v2.0 requirements FR2, FR5, FR6, FR7, FR8

> **This document is grounded in v1's actual code**, read from
> `declansummerlearning/dashboard.html` — not from the PRD's description of it.
> Where the PRD and the shipped code disagree, the code wins and the difference
> is flagged inline.

---

## 1. Why this document exists

PRD v2.0 asserts two things it never specifies:

- **FR2** — "`trackId` field on every leaderboard entry, weekly challenge, day entry, weekly winner"
- **FR8** — "Auto-migration of existing v1 users into the new track-aware data model"

FR8 is a **data migration against live production user data**. There is no written
schema for either side of it. This document supplies both, and the migration between.

---

## 2. v1 as it actually exists today

### 2.1 Two stores, different roles

| Store | Holds | Authority |
|---|---|---|
| `localStorage` | Full per-kid state (all activity, prizes, goals, parent auth) | **Source of truth for gameplay** |
| Firebase RTDB | Leaderboard projection + weekly winners | **Source of truth for competition** |

v1 is **local-first**. Firebase receives a *projection* of local state for the
social layer; it is not a full backup.

> ⚠️ **Correction to `feature-breakdown.html`**, which lists "Cross-device sync &
> account recovery" as a P0 missing capability and "the biggest hidden risk."
> That doc is stale — Firebase sync and a Restore-from-Cloud path both shipped in
> v1. PRD Appendix A is correct. **But the caveat is real:** only the fields in
> §2.3 are synced. Prizes, goals, claim history, baseline scores and parent auth
> exist **only** on the device. See §5.3.

### 2.2 localStorage keys (exact, from code)

| Key | Contents |
|---|---|
| `summerstreak-profiles` | `[{ id, state }]` — the profile array; **source of truth** |
| `summerstreak-current-profile` | Active profile id |
| `declan-dashboard-v2` | Legacy pre-profile state (migration source) |
| `declan-dashboard-v1` | Legacy pre-profile state (migration source) |
| `summerstreak-firebase-config` | Optional config override |
| `summerstreak-leaderboard-mode` | Leaderboard display preference |
| `parent-section-open` | UI toggle state |

**v1 already carries a migration chain** (`v1 → v2 → profiles`) in `loadState()`.
v2's migration is the fourth link, and must preserve the earlier ones — a family
that hasn't opened the app since the v1 key era still needs to land correctly.

### 2.3 Per-profile `state` object (from `defaultState()`)

```js
{
  player: { name: "" },          // blank by default; never seeded with a real child's name
  entries: {},                   // { 'YYYY-MM-DD': DayEntry }  <-- the activity log
  weeklyChallengesCompleted: {}, // { weekNum: 'YYYY-MM-DD' }
  weeklyAdjustments: {},         // { weekNum: points }  bonuses bucketed by week
  earnedBadges: {},
  prizes: [...],                 // DEFAULT_PRIZES clone; parent-editable
  claimHistory: [],
  pointAdjustments: 0,
  summerStart: DEFAULT_SUMMER_START,
  selectedDate: 'YYYY-MM-DD',
  friends: [],
  playerAvatar: '👑',
  playerGoals: [],
  acceptedInvites: [],
  preference: 'chess',           // chess | sports | music | gaming  <-- THEME
  coParentName: '', coParentEmail: '',
  baseline: { mapRit: null, lexile: null, writtenExpression: null },
  parentAuth: { setupComplete, adminName, adminPinHash, parents: [] }
}
```

### 2.4 `DayEntry` — the single most important record

```js
state.entries['YYYY-MM-DD'] = {
  date: 'YYYY-MM-DD',
  read: false, write: false, closeout: false, math: false,  // <-- READING-TRACK-SPECIFIC
  tournament: false, combo_claimed: false,
  minutes: 0, book: '', writing_topic: '', new_word: '',    // <-- READING-TRACK-SPECIFIC
  words: 0, bonus_minutes: 0, books_finished: 0,
  points: 0
}
```

**This is the coupling point the PRD's Assumption #1 is betting on.** The activity
booleans and the payload fields are Reading-track vocabulary hardcoded into the
record. A Music track needs `practice / listen / learn_a_piece`; Back to School
needs `homework_started / packed_bag`. See §3.3 for how v2 breaks this.

### 2.5 Firebase paths (exact, from code)

```
/leaderboard/{leaderboardKey}        <-- live; overwritten each sync
/weeklyHistory/{weekNum}/{key}       <-- preserves the week after Monday rollover
/weeklyWinners/{weekNum}             <-- canonical winner, write-once
```

`leaderboardKey` = `` `${googleUid}_${profileId}` `` — one slot per kid, siblings
distinct under one parent account.

**`/leaderboard/{key}` payload:**
```js
{ uid, profileId, leaderboardKey, ownerEmail, name, avatar,
  theme, points, weeklyPoints, weekStartKey, rank, rankPiece,
  booksFinished, totalMinutes, totalWords, currentStreak, lastSeen }
```
`booksFinished`, `totalMinutes`, `totalWords` are **Reading-specific columns in a
shared table** — the second coupling point.

**`/weeklyWinners/{weekNum}`:** `{ name, avatar, points, recordedBy, recordedAt }`
Write-once; a Firebase rule blocks overwrite, which is what makes the
first-client-to-notice race safe. **Preserve this rule in v2** (§4).

---

## 3. The v2 track-aware model

### 3.1 Principle

> A **track** is data, not code. Adding a track must never require touching the
> engine — only adding a track definition.

This is the testable form of PRD Assumption #1 ("the engine generalizes… ≥80%
reusable"). If adding Music Practice requires engine edits, the assumption failed
and Phase 2's learning goal #2 has its answer.

### 3.2 TrackDefinition — the new core object

```js
{
  trackId: 'reading-slide',
  version: 1,
  name: 'Reading Slide',
  description: '...', recommendedAge: '5-11', dailyMinutes: 20,
  lengthWeeks: 12,

  // Replaces the hardcoded booleans of §2.4
  activities: [
    { id: 'read',     label: 'Read',      points: 3, fields: [
        { id: 'minutes', type: 'number', label: 'Minutes' },
        { id: 'book',    type: 'text',   label: 'Book' } ] },
    { id: 'write',    label: 'Write',     points: 3, fields: [
        { id: 'writing_topic', type: 'text' }, { id: 'words', type: 'number' } ] },
    { id: 'math',     label: 'Math',      points: 2, fields: [] },
    { id: 'closeout', label: 'Wrap-up',   points: 1, fields: [] }
  ],

  // Which numbers this track contributes to a leaderboard (replaces §2.5's
  // hardcoded booksFinished/totalMinutes/totalWords)
  statColumns: [
    { id: 'totalMinutes',  label: 'Minutes', from: 'sum:minutes' },
    { id: 'booksFinished', label: 'Books',   from: 'sum:books_finished' }
  ],

  themes: ['chess','sports','music','gaming'],
  rankLadder: 'chess',
  weeklyChallenges: [ /* 12 curated entries */ ],
  ideaPool: { chess: [...], sports: [...] },
  outcomeModel: {              // null for tracks with no measurable outcome
    baselineFields: [
      { id: 'mapRit', label: 'MAP Reading RIT' },
      { id: 'lexile', label: 'Lexile' },
      { id: 'writtenExpression', label: 'Written Expression %' } ],
    projection: 'reading-v1'
  }
}
```

> `outcomeModel: null` is the structural answer to **PRD Open Question #7**
> ("what's the outcome projection for Music? Mindful Kid?"). Tracks without one
> render no projection panel. Nothing else changes.

### 3.3 The v2 `DayEntry` — generalized

```js
state.tracks[trackId].entries['YYYY-MM-DD'] = {
  date: 'YYYY-MM-DD',
  trackId: 'reading-slide',
  completed: { read: true, write: false, math: true },  // keyed by activity id
  values:    { minutes: 22, book: 'Hatchet', words: 40 },
  points: 8,
  combo_claimed: false
}
```

The Reading booleans become **keys in `completed`**; the Reading payload fields
become **keys in `values`**. Same information, no track vocabulary in the engine.

### 3.4 v2 profile state

```js
{
  profileId, player: { name }, playerAvatar,
  activeTrackId: 'reading-slide',
  tracks: {
    'reading-slide': {
      trackId, enrolledAt, startDate, preference: 'chess',
      entries: {}, weeklyChallengesCompleted: {}, weeklyAdjustments: {},
      earnedBadges: {}, pointAdjustments: 0,
      prizes: [...], claimHistory: [], playerGoals: [],
      baseline: { mapRit, lexile, writtenExpression }
    }
  },
  // Account-level, NOT per-track:
  friends: [], acceptedInvites: [],
  coParentName, coParentEmail,
  parentAuth: { setupComplete, adminName, adminPinHash, parents: [] }
}
```

**The per-track / per-account split is the load-bearing decision.** Prizes, goals
and baseline are per-track (a Math prize shouldn't unlock from Reading points).
Parent auth and co-parent contact are per-account (one PIN, not one per track).

### 3.5 v2 Firebase paths

```
/v2/tracks/{trackId}/leaderboard/{leaderboardKey}
/v2/tracks/{trackId}/weeklyHistory/{weekNum}/{leaderboardKey}
/v2/tracks/{trackId}/weeklyWinners/{weekNum}
/v2/families/{googleUid}/rollup/{profileId}   <-- parent-only, for FR6
```

`leaderboardKey` stays `` `${googleUid}_${profileId}` ``. **Track is a path
segment, not a field** — this is what delivers FR5 (leaderboard isolation) by
construction rather than by client-side filtering. A kid on Math cannot read the
Reading leaderboard because the security rule scopes to the path.

Stat columns become a nested map instead of fixed keys:
```js
{ uid, profileId, leaderboardKey, ownerEmail, name, avatar,
  trackId, theme, points, weeklyPoints, weekStartKey, rank, rankPiece,
  stats: { totalMinutes: 340, booksFinished: 2 },   // <-- from statColumns
  currentStreak, lastSeen }
```

The `/v2/` prefix means **v1 and v2 can run simultaneously against the same
Firebase project** during rollout. v1 keeps reading `/leaderboard`, untouched.

---

## 4. Security rules

FR5 and the NFR "kids can only write to their own track entries" require:

```
/v2/tracks/{trackId}/leaderboard/{key}
  .read:  auth != null
  .write: auth != null && key.beginsWith(auth.uid + '_')   // own slot only

/v2/tracks/{trackId}/weeklyWinners/{weekNum}
  .read:  auth != null
  .write: auth != null && !data.exists()                   // WRITE-ONCE — preserve from v1

/v2/families/{googleUid}/**
  .read/.write: auth != null && auth.uid == googleUid      // parent rollup is private
```

The write-once winners rule is carried over from v1 deliberately: it is what makes
the concurrent winner-commit safe without a server.

**Open:** free-tier single-track enforcement (FR7) cannot be enforced by RTDB rules
alone without an entitlement node. Recommend `/v2/families/{uid}/entitlement`
written only by a trusted context. Client-side enforcement is bypassable — acceptable
for launch, not for a paid tier. Flagged as a decision, not resolved here.

---

## 5. Migration (FR8)

### 5.1 Guarantee

> A v1 family opens the app after the v2 deploy and finds **every day they logged,
> their streak, rank, prizes and claim history intact**, now inside a track called
> Reading Slide.

### 5.2 Algorithm

Runs client-side on first v2 load, per profile. Idempotent — safe to re-run.

```
for each profile in summerstreak-profiles:
  if profile.schemaVersion == 2: skip

  s = profile.state
  t = {
    trackId: 'reading-slide', enrolledAt: s.summerStart,
    startDate: s.summerStart, preference: s.preference || 'chess',
    weeklyChallengesCompleted: s.weeklyChallengesCompleted,
    weeklyAdjustments: s.weeklyAdjustments,
    earnedBadges: s.earnedBadges, pointAdjustments: s.pointAdjustments,
    prizes: s.prizes, claimHistory: s.claimHistory,
    playerGoals: s.playerGoals, baseline: s.baseline,
    entries: {}
  }

  for each [dateKey, e] in s.entries:
    t.entries[dateKey] = {
      date: e.date, trackId: 'reading-slide',
      completed: pickTrue(e, ['read','write','math','closeout','tournament']),
      values: pickDefined(e, ['minutes','book','writing_topic','new_word',
                              'words','bonus_minutes','books_finished']),
      points: e.points, combo_claimed: e.combo_claimed
    }

  profile.state = {
    profileId: profile.id, player: s.player, playerAvatar: s.playerAvatar,
    activeTrackId: 'reading-slide', tracks: { 'reading-slide': t },
    friends: s.friends, acceptedInvites: s.acceptedInvites,
    coParentName: s.coParentName, coParentEmail: s.coParentEmail,
    parentAuth: s.parentAuth
  }
  profile.schemaVersion = 2
```

**Run v1's existing legacy chain first** (`declan-dashboard-v1/v2` → profiles),
then this. A family returning after a long absence migrates through both.

### 5.3 The real migration risk

Because v1 is local-first (§2.1), **the migration can only see one device.**
Prizes, goals, claim history, baseline scores and parent auth were never synced.

- A family that switches devices post-migration loses those (this is a **pre-existing
  v1 limitation**, not one v2 introduces — but v2 is when it becomes visible).
- **Mitigation:** write a full state backup to `/v2/families/{uid}/backup/{profileId}`
  *before* transforming, and add a Restore path. v1 already has Restore-from-Cloud
  to model this on.

### 5.4 Safety requirements

1. **Back up before transforming.** Copy the raw profiles array to
   `summerstreak-profiles-v1-backup` and keep it for one full season.
2. **Never destructive.** Migration writes new structure; it does not delete v1 keys.
3. **Version-stamp.** `schemaVersion` on each profile makes it idempotent.
4. **Firebase is not migrated.** v1 leaderboard entries stay at `/leaderboard`.
   v2 writes fresh entries under `/v2/tracks/reading-slide/`. Lifetime points carry
   from local state, so the kid's rank is preserved. **Accept:** the first v2 sync
   re-establishes each kid on the new leaderboard; weekly winner history before
   the cutover is not carried forward. Decide whether to backfill `/weeklyHistory`
   or start a fresh season at the transition (recommend: fresh season, aligned to
   the Back to School track launch).
5. **Test against a copy of production before shipping.** Export the real RTDB and
   a real profiles blob; run the migration; diff computed stats (points, streak,
   rank, days-done) before and after. **They must be identical.**

---

## 6. Open decisions

| # | Decision | Recommendation |
|---|---|---|
| 1 | Free-tier track limit enforcement (FR7) | Entitlement node; client-only at launch, server-enforced before paid tier |
| 2 | Carry weekly-winner history across cutover? | No — start a fresh season at Back to School launch |
| 3 | Does a track own its own friends list, or is friends account-level? | Account-level (§3.4); FR-friend-invite-by-track filters by enrollment |
| 4 | Points comparable across tracks? | No. Never show a cross-track leaderboard; parent rollup shows per-track rows (FR6) |
| 5 | `trackId` naming | kebab-case, stable forever, never reused — it is a Firebase path segment |

---

## 7. What this unblocks

| Requirement | Resolved by |
|---|---|
| FR2 `trackId` everywhere | §3.3, §3.5 |
| FR5 per-track leaderboard isolation | §3.5 path scoping + §4 rules |
| FR6 parent cross-track rollup | §3.5 `/v2/families/{uid}/rollup/` |
| FR7 free-tier track limit | §4 (partial — see Open Decision 1) |
| FR8 auto-migration | §5 |
| Open Question #7 (non-academic outcomes) | §3.2 `outcomeModel: null` |
