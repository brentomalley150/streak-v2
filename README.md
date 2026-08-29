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

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 35 tests
npm run build      # typecheck + production build
```

In dev, the console exposes `bts.reset()` and `bts.demo()`.

## How it is put together

| Path | What it is |
|---|---|
| `src/core/types.ts` | The contract from `docs/DATA-MODEL.md` §3, as types |
| `src/core/engine.ts` | Pure track engine. **Names no track** — enforced by a test |
| `src/core/storage.ts` | localStorage + the v1 → v2 migration (§5) |
| `src/core/store.ts` | State container, persists on change |
| `src/tracks/*.ts` | Track definitions — **data, not code** |
| `src/ui/*.ts` | Onboarding and the daily screen |

### The one rule

> A track is data. Adding a track means adding a file in `src/tracks/` and one
> line in `src/tracks/index.ts`. Nothing else changes.

`engine.test.ts` asserts this mechanically by grepping `engine.ts` for track ids
and for v1's hardcoded activity vocabulary. If that test fails, the abstraction
has leaked.

### Status

Built: the track engine, all three tracks, onboarding with a blocking COPPA
consent gate, the daily screen, the track switcher, the marketplace, the
free-tier limit, and the v1 migration.

Not yet built: Firebase sync (paths are specced in `docs/DATA-MODEL.md` §3.5),
per-track leaderboards, prizes and trophies, the parent rollup, and the agentic
weekly digest.
