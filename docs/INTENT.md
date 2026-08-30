# What this app is for — and what the PRD lost

Written 2026-08-29, reconstructing intent from the v1 source.

## The intent

**A parent or a teacher sets up a challenge, then invites kids to join it.**

That is the product. The challenge is the shared object; the invite is how it
spreads. It began as Kate setting up a reading challenge and inviting other
kids. v2 generalises the *challenge author* — any parent, any teacher — and the
*subject* — reading, math, music, anything. It does not change the shape.

Three roles follow from that, and v1 shipped a surface for each:

| Role | v1 surface | What it is |
|---|---|---|
| **Challenge creator** | `index.html` | Sets up the challenge, invites kids |
| **Kid** | `dashboard.html` | Does the daily thing, sees the leaderboard |
| **Admin** | `admin.html` | Operates it — support, data repair, Firebase |

## v1 really did this — the receipts

Not a recollection. From `summerslide/`:

- `index.html` is a **public challenge landing page** with an enrolment modal:
  *"🎉 Enroll your child"*, *"30 seconds to set up. Their dashboard is saved on
  this device — no account, no password."* Enrolment happened **on the landing
  page**, not inside a private app.
- It has a **"Challenge your friends"** section stating the model outright:
  *"Send your friends an invite link. They get their own dashboard. Everyone's
  points show up on a shared leaderboard."*
- It **handled invite links**: `params.has('invite')` at line 1002, forwarding
  to the dashboard. v1 read `invite`, `restore`, `parent`, `avatar`, `lexile`
  from the URL.
- `admin.html` is a real operator console — copy UID, open Firebase console,
  unstick users — gated behind `hashPin`.
- It had **restore**: *"Already enrolled your kids on another device? Restore
  them here →"*.

So the shared-challenge model, the invite link, the three roles, and
cross-device restore all **existed and shipped**. None is speculative.

## What v2 has instead

| v1 | v2 today |
|---|---|
| Public enrolment on a landing page | Onboarding inside the app, one family |
| Invite link (`?invite=`) | **None.** v2 reads *nothing* from the URL |
| Shared leaderboard framed as friends you invited | Global per-track board you cannot join |
| Admin console | **None** |
| Restore on another device | **None.** Sync writes outward only |
| Challenge as a thing you create | Track as a thing you *enrol in*, authored by us |

That last row is the substantive change. **v1's challenge was authored by a
person and joined by invitation. v2's track is authored by us and enrolled in
privately.** Everything else on this list follows from that one inversion.

## How it got lost

Not through a decision. Through **a scope note that quietly became the
architecture**:

1. The PRD's §3.2 lists *"Friend invite by track"* as **P1** — the invite
   survived, but demoted to a feature rather than the mechanic.
2. It has **no functional requirement**. FR1–FR12 contain no invite. A P1 with
   no FR is not scheduled work; it is a wish.
3. *"Teacher / classroom portal"* went to **P2, year 2**, and school pilots to
   Phase 4 (Aug 2027) — so the *other* challenge author was pushed past the
   horizon too.
4. Meanwhile §1 prices *"schools and tutors pay $5/student/year for classroom
   dashboards"* and Year-5 revenue assumes 50 schools. **The business model
   kept the classroom the requirements deferred.**
5. FR1 says *"All v1 functional requirements preserved"* — but v1's invite,
   admin and restore surfaces were never enumerated as FRs, so "preserved"
   silently excluded them.
6. The data model was then built for the *stated* requirements: everything
   under `v2/families/${auth.uid}`, read and write scoped to that uid. That
   choice makes a cross-family challenge **structurally impossible**, not
   merely unbuilt.

The PRD never says "drop the invite". It just never made it a requirement, and
the architecture hardened around its absence. By the time `friends: []` and
`acceptedInvites: []` were written into `ProfileState`, they were vestigial —
fields with no writer, marking where a mechanic used to be.

## What this means now

- **The PRD needs revision, not interpretation.** US-4 needs real FRs; the
  challenge-creator role needs to exist in §4; the teacher case cannot stay P2
  while §1 sells it.
- **`docs/GROUPS.md` is the design that restores the model** — one Group object
  owned by a parent or teacher, holding references not copies, because
  `v2/families/${uid}` cannot span accounts.
- **Two v1 capabilities are still missing and are not groups**: restore on a
  new device (`HANDOFF.md` §4) and an admin surface. Neither is in the PRD as
  an FR either.
- **The roles are unequal in v2.** The kid surface is complete. The creator
  exists only as "the person who did onboarding". The admin does not exist.

## The honest summary

v2 built a **better engine** — the track abstraction, per-track leaderboards,
sync, consent, the digest — on top of a **narrower product**. It turned a
shared challenge into a private tracker, and nobody wrote that down, because
the PRD described features rather than the mechanic those features were for.
