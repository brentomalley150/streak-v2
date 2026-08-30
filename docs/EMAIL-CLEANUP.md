# Cleaning published emails from existing rows

Status: **script written, not run.** Written 2026-08-29. Needs Brent to execute.

## What happened

v2.0 published the parent's Google account email onto
`v2/tracks/${trackId}/leaderboard/${key}`, a node whose rule is
`".read": "auth != null"` — readable by any signed-in user of the app.

The app **stopped writing it** in `streak-v2 e5e1426`, live since 2026-08-29.
This document is about the rows written *before* that, which still carry the
field. A code fix stops new leaks; it cannot retract published ones.

## Scope — how bad is it

Unknown until someone with access looks, and that is the first task. The
affected set is every leaderboard row ever published by a signed-in family, on
any track. Families who never signed in were never published and are unaffected.

Two nodes carry it, because `publish()` writes both:

- `v2/tracks/${trackId}/leaderboard/${key}`
- `v2/tracks/${trackId}/weeklyHistory/${week}/${key}`

## Will it clean itself?

Partly, and not reliably. Every row is rewritten on that family's next sync, and
the new payload has no `ownerEmail` — but Realtime Database `set()` replaces the
node, so an active family's row does clear on its next open.

That leaves **dormant families**, whose rows persist indefinitely with the email
intact. Do not treat self-healing as the plan.

## The script

`scripts/strip-owner-email.mjs`

- **Dry run by default.** Changes nothing without `--apply`.
- Writes `null` to the single `ownerEmail` field. Never touches points, streaks
  or anything else; never deletes a row.
- Covers `leaderboard` *and* `weeklyHistory`.
- Idempotent — running twice is harmless.
- Verifies after applying, and reports anything left.

## Permissions — the part that needs a decision

The write rule is:

    auth != null && ($key.beginsWith(auth.uid + '_')
                     || root.child('admins').child(auth.uid).val() === true)

So an ordinary account can only clean **its own** rows. Cleaning everyone's
requires a uid listed under `/admins`, which is deliberately not client-writable
and must be set in the Firebase console.

Note also that `.read` is `auth != null`, so **even the dry run must sign in**.
Running it unauthenticated fails with a clear message rather than a stack trace.

### Two routes

**A — Firebase console, by hand.** For a small dataset this is likely fastest
and needs no credentials in a shell. Open Realtime Database, walk
`v2/tracks/*/leaderboard`, delete each `ownerEmail` field. Tedious but obvious,
and there is no risk of a scripted write going wrong.

**B — the script, as an admin.** Warranted if the dataset is larger than a
handful of rows.

1. In the Firebase console, add your uid under `/admins` (v1's `admin.html` has
   a "Copy my UID" button, or read it from the console's Authentication tab).
2. The script signs in with email/password, because a Node script cannot do the
   Google popup the app uses. **That provider may not be enabled on this
   project** — the app only ever uses Google. Enabling Email/Password auth just
   for this is a real change to the project's auth surface; prefer route A if
   the row count is small.
3. Dry run, read the output, then `--apply`.

```bash
cd ~/Documents/streak-v2

# 1. dry run — changes nothing
BTS_ADMIN_EMAIL=you@example.com BTS_ADMIN_PASSWORD=... \
  node scripts/strip-owner-email.mjs

# 2. apply, once the dry-run output looks right
BTS_ADMIN_EMAIL=you@example.com BTS_ADMIN_PASSWORD=... \
  node scripts/strip-owner-email.mjs --apply
```

## Do this first

**Paste `firebase.rules.paste.json` into the Firebase console.** The tightened
rule denies `ownerEmail` explicitly and denies unknown fields via `$other`.
Until it is published, nothing stops a field like this being written again —
including by an older cached copy of the app still running in someone's browser.

That file was itself stale before this fix and had drifted from
`firebase.rules.json`; a test now asserts they match.

## Afterwards

Nothing to verify in the app — it never read the field. Confirm by re-running
the dry run: it should report nothing to clean.
