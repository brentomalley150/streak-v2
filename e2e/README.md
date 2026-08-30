# Smoke tests

    npm run test:e2e        # headless
    npm run test:e2e:ui     # watch them run
    npm run test:all        # vitest + playwright

Vite starts automatically; an already-running dev server is reused.

## Why these exist

146 unit tests cover `src/core/`. **None touch `src/ui/`** — 1,257 lines where
every user-visible bug so far has lived:

| Bug | Found by |
|---|---|
| "Add a kid" unreachable for every one-kid family | a human, on the live site |
| Create-a-challenge dead-ended at a sign-in that existed nowhere | a human, on the live site |

Both were "the button isn't there" or "the button leads nowhere" — what a smoke
test catches and a unit test structurally cannot. Both now have a named
regression test, and **both were verified to fail when the original bug is
reintroduced.** A regression test that has never seen its bug fail is a guess.

## Scope — deliberately small

Reachability and honesty, not behaviour. Does the app render, are the parent
affordances present, does an invite link recover. Nothing about styling; nothing
the core tests already prove.

**Do not grow this into a comprehensive suite.** Logic belongs in vitest, where
it runs in milliseconds. This exists for what only a browser can tell you.

## What is NOT covered, and why

**Everything behind Google sign-in.** Creating a challenge, joining one, the
group leaderboard, the rollup, sync. Automating Google OAuth needs a test-auth
path — a mechanism for signing in as a fixture account without the popup.

That is real work, and it is the honest next step if this proves its worth. Two
of the flows it would cover (create and join) are the product's core mechanic
and are currently **verified only by hand**.

Until then, after touching anything signed-in, check by hand:

1. Sign in, tap **Challenges & invites → Start a challenge**
2. Name it, create it, copy the link
3. Open the link in another browser signed into a different account
4. Confirm the consent screen names the inviter and the track, then join

## Adding a test

Only when a defect gets past the unit tests to a user. Name the regression in a
comment, and **confirm it fails against the bug before you commit it.**
