# Handoff — how the kid gets access

Status: **partly built.** Written 2026-08-29.

- §2 Parent PIN — **shipped**. v1 hash compatibility is pinned by tests against
  hashes v1 itself produced, so a migrated family keeps their existing PIN.
- §3 Profile switcher — **shipped** (see `ROLLUP.md`; it landed with FR6).
- §1 Handoff screen — **shipped** as step 7 of onboarding.
- §4 Restore on a new device — still unbuilt.

## The problem

Onboarding ends and calls `done()`, which routes straight to the daily screen
on the parent's phone (`main.ts`, `renderOnboarding(root, store, () => show('daily'))`).
There is no completion step, and nothing is generated that a parent could send.

A parent who asks "how do I give this to my kid?" has exactly one answer today:
hand over the unlocked phone. Onboarding step 4 already assumes it — *"Hand them
the phone for this one."*

That is a coherent product. It is just undocumented and unsupported: the app
never says it, and nothing protects the parent-only surfaces once the phone is
handed over.

## Why there is no link to send

The kid is not an identity. Auth is Google sign-in scoped to the parent, and all
kid data is namespaced under the parent's uid:

    v2/families/${auth.uid}/rollup/${profileId}

A `profileId` is a record inside the parent's account. There is nothing to
authenticate as, so there is no URL that could carry a kid into their own state.
Any real "send them a link" feature requires kid identity, which is a
restructure, not a feature.

## Decision

Ship the **shared-device** model. It is what the app already assumes and what
the data model already supports. Do not build kid accounts for this.

Rationale: the target user is a kid under 13 whose parent just checked a
guardian-consent box. A separate kid login means real under-13 auth, a second
consent surface, and COPPA questions that the current design deliberately avoids
by storing only a first name and daily activity. The shared device sidesteps all
of it.

## What already exists

`ProfileState.parentAuth` is in the type and survives the v1 migration:

    interface ParentAuth {
      setupComplete: boolean;
      adminName: string;
      adminPinHash: string;
    }

In v2 it is **written once at profile creation and never read** — `store.ts` seeds
it empty, `storage.ts` migrates it from v1, and nothing else touches it. v1 used
it: `admin.html` gated the parent dashboard behind `hashPin(pin)`, a 4+ digit PIN.

So the field is not speculative scaffolding. It is a v1 feature that was carried
across and left unwired. This spec finishes it.

Note `hashPin` in v1 is a djb2 string hash, not a password hash. That is fine for
its actual job — keeping a 10-year-old out of the settings screen — and it should
not be described as security. It stops a kid, not an attacker with the device.

## Scope

### 1. A handoff screen at the end of onboarding

`step6.finish()` currently calls `done()` immediately. Insert a step 7 before it.

The screen states the model in plain language, because nothing currently does:

- This lives on this phone. Hand it to `${name}` when it's their turn.
- Their progress syncs to your account, so a new phone can restore it.
- Set a parent PIN to keep them out of settings and scores.

One primary action (`Set a PIN`) and one secondary (`Not now`). Both call
`done()`. The PIN is optional — a parent who skips it gets exactly today's
behaviour, which must remain a supported path, not a degraded one.

### 2. Parent PIN

Wire `parentAuth` for real:

- `store.setParentPin(pin)` → validates 4+ digits, sets `adminPinHash` and
  `setupComplete: true`.
- `store.checkParentPin(pin)` → boolean.
- Reuse v1's `hashPin` shape so a migrated v1 family's existing PIN keeps working.
  Verify this against a real v1 profile before shipping; a silent hash mismatch
  would lock a migrating parent out of their own settings.

Gate behind it, only when `setupComplete` is true:

- the marketplace / add-a-track flow (it is where money appears)
- profile deletion and data reset
- baseline test scores

Do **not** gate the daily screen. The kid must reach their own track with zero
friction — that is the entire point of the handoff.

### 3. Profile switcher

`Store` already holds `profiles: Profile[]`, a `currentId`, and `switchProfile(id)`.
There is **no UI for any of it** — a two-kid family currently cannot reach the
second kid. Add a switcher in the daily-screen header. This is the smallest
change that makes the multi-profile data model reachable, and it is required for
the handoff story to work in a household with more than one child.

Switching is not PIN-gated. Kids switching to their own track is normal use.

### 4. Restore on a new device

Already possible in principle — the rollup is under the parent's uid — but there
is no entry point. The parent signs in with Google on the new phone and their
profiles rehydrate. v1 shipped this as "Restore from Cloud" (`summerslide`
commit `5da37fb`); mirror that.

## Explicitly out of scope

**Friends and invites.** `friends: string[]` and `acceptedInvites: string[]` exist
in `ProfileState` and are initialised to `[]` by `store.ts`. Nothing ever writes
to either. They imply a social graph that was never built.

The misleading copy that promised it is fixed (see below), but the dead fields
remain. Either build the feature or delete the fields — leaving them invites the
next person to assume a social layer exists. That decision is not part of this
spec.

## Already shipped alongside this spec

Two strings in `daily.ts` promised a social feature with no implementation:

- empty leaderboard: *"No one here yet — invite a friend."* → now states the real
  mechanism, that the board fills as other families start the same track.
- signed-out leaderboard: *"Sign in to compare with friends."* → *"Sign in to see
  how other families are doing on this track."*

Neither had a button, and no code path adds a friend. This is the recurring
"UI promise gap" defect: nothing fails when copy and code diverge, so it survives
review. Grep the implementing code before trusting user-facing copy.

## Open questions

1. Does the kid ever need their own device? If yes, this spec is a stopgap and
   kid identity needs its own design — including where consent lives.
2. What happens on a shared family iPad with two kids and one parent PIN? The
   switcher makes every profile reachable to whoever holds the device.
3. Should the leaderboard be opt-in? It currently exposes a first name and score
   to other families by default, which onboarding discloses but never asks about.
