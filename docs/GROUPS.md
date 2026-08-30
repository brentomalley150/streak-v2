# Groups — shared streaks for families and classrooms

Status: **design, nothing built.** Written 2026-08-29.

Answers: a parent or teacher sets up a streak, shares a link, and other
families' kids join it. One `Group` object, owned by whoever created it.

## Where the PRD stands

This is **not** specified. What exists:

- **"Friend invite by track" — P1** (§3.2): *"Invite Cooper to your Math track
  without exposing your Reading streak."* It is US-4, and it has **no FR**.
  FR1–FR12 contain no invite mechanism, which is why it was never built and why
  the leaderboard shipped promising friends with no way to get any.
- **"Teacher / classroom portal" — P2, year 2** (§3.2), and school pilots are
  Phase 4 (Aug 2027).
- **Pricing already assumes schools**: §1 sells *"schools and tutors pay
  $5/student/year for classroom dashboards"*, and Year-5 revenue assumes 50
  schools.

So the business model depends on classrooms while the requirements defer them
to year 2 and the data model forbids them outright. Building this means the PRD
changes: US-4 needs real FRs, and the teacher portal moves out of P2.

## The core conflict

Everything today is namespaced under `v2/families/${auth.uid}`, and the rule
scopes read *and* write to `auth.uid === $uid`. **There is no object that spans
accounts.** A teacher with 25 students is not a large family — those 25 kids
belong to 25 other households, and their data cannot live under the teacher's
uid without the teacher owning other people's children's records.

That single fact drives the whole design: a group must be its **own top-level
entity**, and it must hold *references*, never copies.

## Model

    v2/groups/${groupId}
      meta:    { name, trackId, ownerUid, createdAt, startDate, joinCode, open }
      members: { ${leaderboardKey}: { name, avatar, joinedAt } }

`leaderboardKey` is already `${uid}_${profileId}` — one slot per kid, siblings
distinct. Reusing it means a member reference carries no new identity.

**Membership is a reference, not a copy.** A group never stores entries,
baselines or consent. Progress continues to live under the family, exactly as
now; the group only says who is in it. Delete a group and no family loses a
thing.

### Why the group holds a trackId

US-4's requirement is *"without exposing your Reading streak"*. A group is
scoped to one track, so joining a Math group reveals Math and nothing else.
That is a structural guarantee, the same trick FR5 uses by making track a path
segment rather than a filter.

## Joining

1. Owner creates a group; the app generates a short `joinCode` and a link
   carrying it (`/app/?join=CODE`).
2. Another parent opens the link **on their own device, signed into their own
   account**. They are not signing into the owner's account, and there is no
   account for the kid.
3. The app resolves the code, shows *whose* group it is and *what* it shares,
   and asks that parent to confirm — a join is a disclosure, so it is opt-in
   per kid, never automatic.
4. On accept, the joiner writes only their own member entry.

The app currently reads **nothing** from the URL — no params, no hash, no
routing. `?join=` is the first, so it must be handled defensively: unknown or
expired codes land in normal onboarding with an explanation, never a dead end.

## Security rules

The shape that makes this safe without opening families to each other:

    "groups": {
      "$groupId": {
        ".read": "auth != null",
        "meta": {
          ".write": "auth != null && (!data.exists() || data.child('ownerUid').val() === auth.uid)"
        },
        "members": {
          "$key": {
            ".write": "auth != null && ($key.beginsWith(auth.uid + '_')
                        || root.child('v2/groups/' + $groupId + '/meta/ownerUid').val() === auth.uid)"
          }
        }
      }
    }

Three properties this buys:

- A member can add or remove **only their own** kid — same key-prefix trick the
  leaderboard already uses.
- An owner can remove anyone (a teacher must be able to drop a student) but can
  never write another family's progress, because progress is not here.
- `v2/families/$uid` is **untouched**. No cross-family read is introduced.

Group membership being world-readable to signed-in users matches the existing
leaderboard, which is already `".read": "auth != null"`.

## Parent-run vs teacher-run

Same object, different owner and defaults:

|  | Parent group | Teacher group |
|---|---|---|
| Typical size | a handful | 25+ |
| Who joins | friends' parents | students' parents |
| Owner sees | names, avatars, points | same |
| Extra needs | none | roster view, per-student progress |

The teacher portal (P2) becomes a **view over this object**, not a second
system. That is the whole reason to build one Group rather than a friends
feature now and a classroom feature later.

## COPPA — the part that needs a real answer

This is the first feature that discloses a child's information **outside their
own family**, so consent gets a second surface.

- Today's consent covers storing *"first name and daily activity"* and promises
  *"Friends see only a first name and a score. Never a last name, photo, or
  location."* A group discloses exactly that much — no more — so the existing
  promise still holds **only if** the group surfaces nothing else.
- Joining must be an explicit per-kid act by the joining parent. Never
  auto-enroll from a link; US-4's "friend's dashboard auto-enrolls them" is
  wrong on this point and should be revised.
- A teacher is **not** a guardian. A teacher-created group must not be able to
  add a student; only that student's own parent can join them. The teacher
  invites; the parent consents.
- Leaving must be one action, and it must remove the member entry immediately.

### A defect to fix first

`buildRow` puts **`ownerEmail: user.email`** on the row, and `publish` spreads
the whole row into `v2/tracks/${trackId}/leaderboard/...`, which is readable by
any signed-in user. **A parent's email address is already world-readable
today.** That contradicts the consent screen's "only a first name and a score",
and groups would make it far more discoverable.

Fix this before shipping groups, and independently of them: drop `ownerEmail`
from the published payload, and add a `.validate` that rejects unexpected
fields the way `name` is already length-capped.

## Build order

1. **Stop publishing `ownerEmail`.** Standalone privacy fix, no dependency.
2. **Group model + rules**, with tests for the rules as `rules.test.ts` already
   does for v1.
3. **Create + join** — code generation, `?join=` handling, the confirm screen.
4. **Group leaderboard** — filter the existing per-track board by membership.
   This is where US-4's value actually lands.
5. **Teacher view** — roster over the same object. P2 becomes a view, not a
   rebuild.

Steps 1–4 deliver the parent case end to end. Step 5 is additive.

## Open questions

1. **Does a group need its own 12-week window?** A track is a 12-week program.
   If a classroom starts in September, do members re-baseline, or does the
   group just observe whatever week each family is on?
2. **What happens when the owner leaves or deletes?** A teacher's class should
   probably outlive their account for the term; a parent's group probably
   should not.
3. **Can one kid be in several groups on the same track?** Their class and
   their friends both doing Math Facts is plausible. The model allows it; the
   leaderboard UI assumes one board per track and would need to choose.
4. **Is a join code enough?** A short code is guessable and grants visibility
   of first names and scores. Long random ids, revocation, or an expiry may be
   warranted — decide before a classroom's roster is behind one.
