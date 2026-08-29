# FR6 — the parent rollup, and the profile switcher it depends on

Status: **spec, not built.** Written 2026-08-29.

FR6 is the last unfinished P0. Every other P0 (FR1–FR5, FR7, FR8) ships today.

## What exists

The write path is done. `Store.publishAll()` builds a `LeaderboardRow` per
enrolled track and calls `backend.saveRollup(profileId, rows)`, which writes:

    v2/families/${auth.uid}/rollup/${profileId}/${trackId}
      → { trackId, points, currentStreak, rank, lastSeen }

The security rule already scopes it correctly — `.read` and `.write` both require
`auth.uid === $uid`, so a family's rollup is private to that family and readable
by the parent who owns it.

**Nothing reads it.** There is no `loadRollup`, no `watchRollup`, no rollup view
in the router (`onboarding | daily | marketplace | digest`). The data has been
accumulating in Firebase since sync shipped, unread. US-3 — "one dashboard
showing all 4 streaks" — does not exist in any form.

## Two bugs to fix first

These are not cosmetic; the feature is wrong without them.

### 1. `publishAll` only ever writes the current profile

    const s = this.state;   // ← the CURRENT profile only

`state` resolves to `currentId`. So a two-kid family writes a rollup for whichever
kid is active and never for the sibling. A cross-kid dashboard reading that path
would show one kid, or show stale data for the other from whenever they were last
open.

Fix: iterate `this.profiles`, not `this.state`. Every profile publishes its own
rollup on sync. This is a precondition for FR6 — the dashboard cannot aggregate
what was never written.

Note this also means the rollup is only as fresh as the last time that kid's
profile was opened on that device. Say so in the UI (see "Staleness" below)
rather than implying live data.

### 2. There is no profile switcher

`Store` has `profiles: Profile[]`, `currentId`, and `switchProfile(id)`. **No UI
calls `switchProfile`.** A second kid is unreachable: onboarding creates one
profile and the daily screen renders `store.profile`, which is always the first.

So the multi-kid data model is real in storage, real in the type system, and
completely unreachable in the product. FR6 is the feature that exposes it, which
is why these two ship together — a cross-kid dashboard whose rows you cannot
open is not worth building.

## Scope

### A. `Backend.loadRollup()`

    loadRollup(): Promise<Record<string, Record<string, RollupEntry>>>

Reads `v2/families/${uid}/rollup` — all profiles, all tracks, one call. Returns
`{}` when signed out or offline. The no-op backend returns `{}`, so the app keeps
working with sync disabled, exactly as `subscribeLeaderboard` already does.

Prefer a one-shot read over a subscription. This is a glance-at surface, not a
live scoreboard, and a `.once` read avoids holding a listener open on a screen
the parent leaves in seconds. (The one live listener we do hold — the leaderboard
— is already unsubscribed on re-render; don't add a second lifecycle to manage.)

### B. `renderRollup` — the dashboard

A new `'rollup'` view in the `main.ts` router. Follow `digest.ts` exactly: set
`data-surface="parent"` on entry, reset it to `'kid'` in the back button. That
attribute is what flips the whole visual language from kid to parent, and the
digest is the reference implementation.

Grouped **by kid first, then by track** (US-3 is explicit about this). Each row:

    kid · track · current streak · rank · last activity

Clicking a row deep-links into that kid + track — meaning `switchProfile(kidId)`,
then `setActiveTrack(trackId)`, then show `daily`. This is the acceptance
criterion from US-3 and the reason the switcher belongs in this change.

Entry point: the daily screen already has a parent affordance for the digest.
Put the rollup next to it. Only show it when the family has 2+ profiles or 2+
tracks — a one-kid one-track family learns nothing from a one-row table.

### C. Local-first, network-second

Render the **local** profiles immediately — `store.all` is in localStorage and
needs no network. Merge Firebase rollup data over it when the read resolves.

A parent on a plane still sees their kids and every track on that device; they
just don't see a sibling's progress from the other parent's phone. This mirrors
how the app already treats local state as the source of truth and sync as an
enhancement, and it avoids a spinner on a screen that mostly shows data we have.

### D. Staleness

Every row carries `lastSeen`. Show it as relative time ("2h ago", "yesterday").
Where a track has never synced, say so plainly rather than rendering a zero — a
0 that means "no data" and a 0 that means "no activity" are different facts and a
parent will read the wrong one.

## Empty and loading states

Per the pattern already established for the leaderboard: never render a bare
empty list. Loading is `—`, not a blank. A signed-out parent gets "Sign in to see
progress from other devices" and still sees local rows.

## Out of scope

- Editing anything from the rollup. It is read-only; the daily screen owns writes.
- Parent PIN gating. Specced separately in `HANDOFF.md`; the rollup shows no
  money and no destructive action, so it does not block on that work.
- FR10 (email) and FR11 (PDF), which are P1 and are separate surfaces.

## Test plan

`digest.test.ts` is the model — assert behaviour, not markup.

- `publishAll` writes a rollup for **every** profile, not just the current one
  (this is bug 1; it should fail before the fix).
- `loadRollup` returns `{}` on the no-op backend and never throws offline.
- Building the rollup view model does not mutate store state.
- A kid with no synced tracks renders a stated empty state, not a zero.
- Rows group by kid, then by track, in a stable order.

## Open question

The rollup reads `v2/families/${uid}`, so it only ever shows what **this parent's
account** wrote. A two-parent household signed into two Google accounts has two
disjoint rollups and neither sees the whole family. `coParentName` and
`coParentEmail` exist in `ProfileState` and are — like `friends` — never read.
Sharing a family across two accounts is a real design question, not a bug to
patch here.
