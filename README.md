# Beat the Slide v2

The next-generation Beat the Slide app — built by **Kate** (founder) and **Brent** (advisor).

Successor to SummerStreak v1: taking the proven summer reading challenge and
making it a year-round, multi-persona streak platform.

## Status

🚧 In development — this repo is the app codebase.

## Where everything lives

| What | Repo | Live at |
|---|---|---|
| **Founders hub** — vision, PRD, prototype, decks | `streak-app` | https://beattheslide.com |
| **v2 app** (this repo) | `streak-v2` | — |
| **v1 app** — the live, proven original | `declansummerlearning` (private) | https://beatthesummerslide.com |

## Start here

Before writing code, read the product docs in the hub:

- **Vision Hub** — https://beattheslide.com
- **PRD v2.0** — https://beattheslide.com/PRD.html
- **What we've proven** — https://beattheslide.com/proof.html
- **Interactive prototype** (9 screens, 3 personas) — https://beattheslide.com/prototype.html

## Inherited from v1

v1 is a static HTML app backed by Firebase Realtime Database (Google Sign-In,
per-parent stable UID, composite leaderboard keys). See `BACKEND-SETUP.md` in the
`declansummerlearning` repo for how that backend is wired.

**v2 should use its own Firebase project** — do not point it at the live v1
`summerstreak` database, which holds real user data.
