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
npm test           # unit tests (vitest)
npm run build      # typecheck + production build
```

In dev, the console exposes `bts.reset()` and `bts.demo()`.

## How it is put together

| Path | What it is |
|---|---|
| `src/core/types.ts` | The contract from `docs/DATA-MODEL.md` §3, as types |
| `src/core/engine.ts` | Pure track engine. **Names no track** — enforced by a test |
| `src/core/storage.ts` | localStorage + the v1 → v2 migration (§5) |
| `src/core/sync.ts` | Backend contract + pure projection logic. No SDK import |
| `src/core/firebase.ts` | The only file that touches Firebase. Lazy-loaded |
| `src/core/digest.ts` | The parent-side agentic loop. Rules today, LLM-ready seam |
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

Built: the track engine, all six tracks, onboarding with a blocking COPPA
consent gate, the daily screen, the track switcher, the marketplace, the
free-tier limit, and the v1 migration.

Firebase sync is built: Google sign-in, per-track leaderboards, and the parent
rollup, behind a `Backend` interface. **It is optional** — with no config the
app runs entirely on localStorage and says so honestly in the UI. See
[docs/FIREBASE-SETUP.md](docs/FIREBASE-SETUP.md).

The weekly parent digest is built: the Retrieve → Diagnose → Prioritise →
Propose → Confirm loop from `agentic-ai.html`, implemented as deterministic
rules behind a `Diagnostician` interface an LLM can replace. All six guardrails
are enforced by tests rather than promised in a prompt.

### PRD v2 features (October 2026)

Built to the updated PRD (US-9 to US-17, FR20 to FR32):

- **Reading is read 15 + write 10 + wrap-up 5.** Math is its own track (Math
  Facts). Reading's old Math activity is kept as `retiredActivities`, so every
  point a migrated family earned with it still counts.
- **Six kid-chosen themes** (chess, sports, gaming, music, animals, dance). The
  rank ladder follows the theme, and every ladder shares v1's thresholds, so
  switching theme renames the rank without moving the kid up or down.
- **Theme ideas** for each daily activity, rotating daily (`ideas` on a track).
- **Weekly bonus activity**: optional extra points, never touches the streak.
- **Family prizes**: parents set the unlock points; the kid asks to cash in; a
  parent marks it given. Cashing in never spends points.
- **Spring scores → routine**: optional MAP RIT, Lexile and CMAS subscores
  (PIN-gated, family-private). Fixed rules set a book band and one focus tip
  (`outcomeModel.routine`). Kids see the tip, never the score.
- **Fall estimate** (`src/core/projection.ts`, PRD §3.6): off until a parent
  turns it on, parent-only, shown as a range with a plain-language explanation.
  `READING_V1_NO_ROUTINE_12W` is a provisional placeholder pending a research
  source (PRD open question 13).
- **New tracks**: Back to School, Home Helper (chores a parent confirms before
  they score; parents can edit the chore list), Mindful Kid.
- **Challenge length**: a challenge has a start date and 2–12 week length;
  members' points count only inside the window, written by each kid's family.
- **Class vs. class**: teams inside a challenge, ranked by average points per
  kid. Each teacher adds their own class and shares their class's link.

**Firebase rules changed** (`firebase.rules.json` / `.paste.json`): group meta
gains `startDate`, `lengthWeeks`, `mode`; members gain `points` and `team`; a
new `teams` node. Publish the paste file in the Firebase console before using
challenges against the live database. Challenge creation is now a multi-path
update, because the rules grant write on `meta` and `teams`, never on the group
node itself.
