# Firebase setup

The app runs **fully offline without any of this**. Follow it when you want
progress to survive losing a phone, and leaderboards to work.

> **v2 shares the existing `summerstreak` project with the live v1 app.**
> v1 owns `/leaderboard`, `/weeklyHistory`, `/weeklyWinners`, `/admins`.
> v2 lives entirely under `/v2`. They never touch the same nodes.

## ⚠️ The one thing that can break v1

Security rules are **a single document for the whole database**. v1's live
rules and v2's new rules share it.

`firebase.rules.json` in this repo is the **merged** document — v1's rules
copied unchanged, plus v2's underneath. Paste it whole.

**Do not** paste only the v2 section, and do not hand-edit the v1 blocks. Doing
either removes the rules protecting real families' v1 data.

## 1. Add v2's rules

1. <https://console.firebase.google.com> → **summerstreak**
2. **Build → Realtime Database → Rules**
3. **Before changing anything**, copy what is currently there into a scratch
   file. That is your undo.
4. Select all, paste the full contents of
   [`firebase.rules.json`](../firebase.rules.json), **Publish**.
5. Open <https://beatthesummerslide.com> and confirm the v1 leaderboard still
   loads. If it does not, paste your saved copy back and tell Brent.

### What the v2 rules enforce

| Rule | Why |
|---|---|
| Write only to `{yourUid}_*` | A family can only write their own kids' rows |
| `uid` must equal `auth.uid` | Can't publish as someone else |
| `trackId` must match the path | Can't write a Math row into Reading's leaderboard |
| `name` ≤ 24 chars | Backstop against a tampered client sending a full name |
| Winners are write-once | First client to notice a week's end commits it; no overwrite races |
| `families/{uid}` is self-only | The parent rollup is private to that parent |
| v1 admins keep their override | The existing admin tools keep working on v2 nodes too |

## 2. Google sign-in

Already enabled for v1 — nothing to do. Confirm under
**Build → Authentication → Sign-in method** that Google is on.

Then **Authentication → Settings → Authorized domains**: `localhost` is there;
add wherever v2 will be hosted when you deploy it.

## 3. Wire up the app

The web config is the same one v1 already uses. From
**Project settings → General → Your apps → Web**, or copy from v1's
`firebase-config.js`:

```bash
cp .env.example .env.local
```

```
VITE_FB_API_KEY=AIzaSyAeEnGzV9_6tI0NCEyyGchd2va659azTRw
VITE_FB_AUTH_DOMAIN=summerstreak.firebaseapp.com
VITE_FB_DATABASE_URL=https://summerstreak-default-rtdb.firebaseio.com
VITE_FB_PROJECT_ID=summerstreak
VITE_FB_APP_ID=1:497057038711:web:3a8349095541781de1a172
```

Restart `npm run dev`. The first onboarding button becomes **Sign in with
Google** rather than **Get started**.

> The web API key is public by design — it identifies the project, it doesn't
> authorise anything. Security comes from the rules above plus Auth.
> [Google's note on this.](https://firebase.google.com/docs/projects/api-keys)

## What gets published

Only what a leaderboard needs, and only a **first name**:

```
uid, profileId, leaderboardKey, ownerEmail, name, avatar,
trackId, theme, points, weeklyPoints, weekStartKey,
rank, rankPiece, stats{}, currentStreak, lastSeen
```

No last name, no photo, no location — the promise the consent screen makes to
the parent. `sync.test.ts` asserts it, and the `name` rule backstops it.

## Free-tier headroom

v1 and v2 now share one quota. The Spark plan allows 1 GB stored and 10 GB/month
transferred; a leaderboard row is well under 1 KB and a family syncs a handful
of times a day. At the current scale this is not close. Worth a look at
**Usage** if v2 reaches a few hundred families.

## If it breaks

| Symptom | Cause |
|---|---|
| **v1 leaderboard stopped loading** | Rules were replaced rather than merged. Paste your step-1 backup back immediately |
| Button still says "Get started" | `.env.local` missing a value; every field is required |
| `auth/unauthorized-domain` | Add the domain under Authentication → Settings |
| v2 writes silently fail | Rules not published, or the row's `uid` ≠ signed-in uid |
| Leaderboard empty | Nobody else is enrolled on that track yet — it is per-track by design |

Sync failures are non-fatal by design: local storage stays the source of truth,
so a broken connection means a stale leaderboard, never lost progress.
