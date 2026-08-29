# Firebase setup

The app runs **fully offline without any of this**. Follow it when you want
progress to survive losing a phone, and leaderboards to work.

> **Use a NEW Firebase project.** Do not point v2 at `summerstreak` — that
> project holds real kids' v1 data.

## 1. Create the project

1. <https://console.firebase.google.com> → **Add project** → name it
   `beat-the-slide`.
2. Google Analytics is optional; skip it.

## 2. Turn on Google sign-in

**Build → Authentication → Get started → Google → Enable.** Set the support
email, save.

Then **Authentication → Settings → Authorized domains**, add wherever the app
will run: `localhost` is there already; add your Pages or hosting domain.

## 3. Create the Realtime Database

**Build → Realtime Database → Create database.**
Pick a region, then start in **locked mode** — the rules in step 4 replace it.

## 4. Paste the security rules

Open the **Rules** tab and paste the contents of
[`firebase.rules.json`](../firebase.rules.json). Publish.

What they enforce:

| Rule | Why |
|---|---|
| Write only to `{yourUid}_*` | A family can only write their own kids' rows |
| `uid` must equal `auth.uid` | Can't publish as someone else |
| `trackId` must match the path | Can't write a Math row into Reading's leaderboard |
| `name` ≤ 24 chars | Backstop against a tampered client sending a full name |
| Winners are write-once | The first client to notice a week's end commits it; no overwrite races |
| `families/{uid}` is self-only | The parent rollup is private to that parent |

## 5. Wire up the app

**Project settings → General → Your apps → Web (`</>`)**, register the app,
copy the config values, then:

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```
VITE_FB_API_KEY=AIza...
VITE_FB_AUTH_DOMAIN=beat-the-slide.firebaseapp.com
VITE_FB_DATABASE_URL=https://beat-the-slide-default-rtdb.firebaseio.com
VITE_FB_PROJECT_ID=beat-the-slide
VITE_FB_APP_ID=1:123...:web:abc...
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
the parent. `sync.test.ts` asserts it, and the `name` rule above backstops it.

## If it breaks

| Symptom | Cause |
|---|---|
| Button still says "Get started" | `.env.local` missing a value; every field is required |
| `auth/unauthorized-domain` | Add the domain under Authentication → Settings |
| Writes silently fail | Rules not published, or the row's `uid` ≠ signed-in uid |
| Leaderboard empty | Nobody else is enrolled on that track yet — it is per-track by design |

Sync failures are non-fatal by design: local storage stays the source of truth,
so a broken connection means a stale leaderboard, never lost progress.
