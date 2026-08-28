# Streak v2 — Design System

**Status:** Draft v1 · **Date:** 2026-08-28
**Owner:** Kate O'Malley · **Author:** Brent O'Malley
**Supports:** PRD v2.0 NFR "Mobile-first; WCAG AA contrast", P1 "Light theme + dark theme"

> Every contrast ratio in this document was **computed, not estimated**. Values
> marked ✅ pass WCAG AA for normal text (≥4.5:1). Values marked ⚠️ pass only for
> large text (≥3:1, i.e. ≥24px or ≥19px bold) and **must not** be used for body copy.

---

## 1. Why this document exists

Four Streak surfaces exist today and **all four use different, conflicting palettes**:

| Surface | Base | Primary | Tokens? |
|---|---|---|---|
| v1 kid app (`dashboard.html`) | `#0F1A2E` dark navy | `--gold #FFD84A` | ✅ 16 tokens |
| Hub (`index.html`) | `#FFFFFF` light | `--gold #D97706` | ✅ 17 tokens |
| Landing (`landing.html`) | `#FAFAFE` light | `--purple #6C2BD9` | ✅ 11 tokens |
| Prototype (`prototype.html`) | light | `#5B21B6` | ❌ **none — all hardcoded** |

The prototype — the thing that most looks like the v2 app — has **zero tokens** and
uses ten ad-hoc font sizes (9, 10, 11, 12, 13, 15, 17, 18, 20, 22px) with no scale.

Without this document, v2 re-derives these decisions inconsistently in code, and
the AA requirement in the PRD silently goes unmet.

---

## 2. The two-surface principle

Streak has **two audiences with opposite needs**, and this is a design constraint,
not a style preference. It mirrors the split already established in
`agentic-ai.html` (rules for the kid, agent for the parent).

| | **Kid surface** | **Parent / marketing surface** |
|---|---|---|
| Mood | Game. Energetic, rewarding | Calm, credible, informational |
| Base | **Dark** (`--bg #0F1A2E`) | **Light** (`--bg #FFFFFF`) |
| Type | Larger, chunkier, high contrast | Standard reading sizes |
| Motion | Celebratory (streak, rank-up) | Minimal |
| Density | Low — one decision per screen | Higher — tables, rollups |
| Reading level | ~2nd grade Lexile | Adult professional |

v1's dark kid dashboard is **retained deliberately** — it reads as a game, not
homework, and it already passes AA comfortably (§3.2). The PRD's P1 "light theme"
item applies to **parent-facing surfaces**, which are light by default here.

---

## 3. Color

### 3.1 Decision: Purple is the v2 brand color

v1 was gold-on-navy. Three of four current surfaces already moved to purple, and
purple carries the strongest contrast headroom. **Resolve the conflict toward
`#6C2BD9`** (the landing page value) as the single brand primary.

Gold is **retained as the achievement accent only** — rank-ups, streak flames,
trophies. It is a reward color, not a UI color.

### 3.2 Kid surface tokens (dark) — all verified vs `#0F1A2E`

```css
:root[data-surface="kid"] {
  --bg:           #0F1A2E;   /* base */
  --bg-light:     #1A2942;
  --panel:        #1E3050;
  --panel-light:  #2A3F63;
  --border:       #3A5380;

  --ink:          #FFFFFF;   /* 17.39:1 ✅ */
  --soft:         #D6E2F5;   /* 13.30:1 ✅ */
  --muted:        #B8C7DF;   /* 10.16:1 ✅ */

  --purple:       #C4B5FD;   /*  9.42:1 ✅  brand, lightened for dark bg */
  --gold:         #FFD84A;   /* 12.57:1 ✅  achievement only */
  --green:        #5EEA93;   /* 11.32:1 ✅  success / streak alive */
  --red:          #FF6B6B;   /*  6.27:1 ✅  streak broken */
  --blue:         #7EB6FF;
  --orange:       #FFA552;

  --text-on-accent: #0F1A2E; /* dark text ON light accent chips */
}
```

Carried forward from v1 unchanged — it already passes. **Do not re-theme the kid
app for aesthetic reasons; it is proven and accessible.**

### 3.3 Parent / marketing tokens (light) — all verified vs `#FFFFFF`

```css
:root {
  --bg:           #FFFFFF;
  --bg-alt:       #FAFAFE;   /* page wash */
  --panel:        #FFFFFF;
  --panel-alt:    #F5F3FF;   /* purple-tinted card */
  --border:       #EDE9FF;

  --ink:          #1A1F2E;   /* 16.41:1 ✅  headings + body */
  --soft:         #4A5568;   /*  7.53:1 ✅  secondary body */
  --muted:        #5B6472;   /*  5.98:1 ✅  captions — SEE NOTE */

  --purple:       #6C2BD9;   /*  7.03:1 ✅  BRAND primary */
  --purple-dark:  #4A1A9E;   /* 10.87:1 ✅  hover / pressed */
  --purple-light: #F0ECFF;   /*             tint fill only, never text */

  --gold:         #D97706;   /*  3.19:1 ⚠️  LARGE TEXT / ICONS ONLY */
  --gold-text:    #B45309;   /*  5.02:1 ✅  use for gold-colored body copy */
  --green:        #059669;   /*  3.77:1 ⚠️  large only */
  --green-text:   #047857;   /*  5.48:1 ✅ */
  --red:          #DC2626;   /*  4.83:1 ✅ */
  --blue:         #2563EB;   /*  5.17:1 ✅ */

  --text-on-accent: #FFFFFF;
}
```

> **⚠️ Three fixes to current code.** These are live AA failures today:
> - Hub `--muted #8B95A7` is **3.02:1 — fails** for body text. Replaced above with `#5B6472`.
> - Landing `--muted #9180C4` is **3.45:1 — fails**. Same replacement.
> - `--gold #D97706` (3.19:1) and `--green #059669` (3.77:1) are used as text in
>   places. Use `--gold-text` / `--green-text` for any text under 24px.

### 3.4 Semantic usage

| Token | Use for | Never |
|---|---|---|
| `--purple` | Primary action, brand, active nav, links | Body text at <4.5:1 on tinted bg |
| `--gold` | Rank badges, trophies, streak flame | Buttons, body copy, links |
| `--green` | Streak alive, activity complete | Primary CTA (reserved for purple) |
| `--red` | Streak broken, destructive confirm | Any decorative use |
| `--purple-light` | Card fills, chips, selected rows | Text of any size |

**Track theming is content, not chrome.** The four v1 themes (chess/sports/music/
gaming) change icons, rank names and idea copy — **never the palette**. This keeps
one accessible palette instead of four unverified ones. Per-track accent, if ever
needed, is a single hue swap on `--purple` and must be re-verified against §3.3.

---

## 4. Typography

### 4.1 Scale

Replaces the ten ad-hoc sizes found in the prototype. Named steps only.

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `--t-display` | 40 / 1.1 | 800 | Landing hero |
| `--t-h1` | 30 / 1.2 | 800 | Page title |
| `--t-h2` | 22 / 1.3 | 700 | Section heading |
| `--t-h3` | 18 / 1.4 | 700 | Card title |
| `--t-body` | 16 / 1.55 | 400 | **Default body — never smaller for parents** |
| `--t-body-sm` | 14 / 1.5 | 400 | Dense tables, secondary |
| `--t-caption` | 13 / 1.45 | 600 | Labels, metadata |
| `--t-micro` | 11 / 1.3 | 800 | Uppercase eyebrows, chips only |

```css
:root {
  --t-display: 40px; --t-h1: 30px; --t-h2: 22px; --t-h3: 18px;
  --t-body: 16px; --t-body-sm: 14px; --t-caption: 13px; --t-micro: 11px;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
```

**Rules**
- **Kid surface floor is `--t-body` (16px).** Nothing a child reads goes below it.
- `--t-micro` is uppercase chips only — never a sentence.
- The prototype's 9px and 10px text is **removed**; it fails both readability and
  the kid-surface floor.
- System font stack — no webfont. Preserves the "< 2s on 4G" NFR.

---

## 5. Spacing, radius, elevation

4px base unit. Use tokens, not arbitrary values.

```css
:root {
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px;

  --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-pill: 999px;

  --e-1: 0 1px 3px rgba(26,31,46,.08);    /* card at rest */
  --e-2: 0 4px 12px rgba(26,31,46,.10);   /* raised / hover */
  --e-3: 0 10px 30px rgba(26,31,46,.14);  /* modal */
}
```

Card padding `--s-4` mobile / `--s-5` desktop. Section rhythm `--s-6`.

---

## 6. Components

Minimum set for v2. Each needs all states built — **not just the happy path**.

| Component | Notes | States required |
|---|---|---|
| **ActivityButton** | The core kid interaction. One tap = done | default, complete, locked (already done today), disabled |
| **StreakBadge** | Flame + count | alive, at-risk (today unlogged), broken |
| **RankBadge** | Ladder piece + name | per theme; rank-up animation |
| **TrackSwitcher** | FR3. Hero control, 2+ tracks | collapsed, open, single-track (hidden) |
| **TrackCard** | Marketplace (FR4) | available, enrolled, locked (free-tier limit) |
| **StatTile** | Number + label | loading, value, empty ("—") |
| **LeaderboardRow** | Avatar, name, points | self (highlighted), peer, winner |
| **RollupRow** | FR6. kid · track · week · streak | per §3.4 of DATA-MODEL |
| **PriorityCard** | The agentic weekly digest | loading, insight, action-proposed, confirmed |
| **Button** | primary / secondary / ghost / destructive | default, hover, active, disabled, loading |
| **PinGate** | Parent section | entry, error, locked-out |
| **EmptyState** | Any zero-data view | — |

### 6.1 Loading and empty states are mandatory

> Every data-backed component ships a **loading** and an **empty** state in the same
> commit as its populated state.

This is a hard rule, not a suggestion. A component that renders nothing while data
loads reads to the user as "broken" or, worse, as real data ("0 day streak" when the
streak is actually 12). Use `—` or a spinner; never a bare `0` before data arrives.

### 6.2 Confirm-before-action

`agentic-ai.html` requires the parent approve anything the agent writes back to the
kid app. **PriorityCard must never auto-apply.** `action-proposed` → explicit
confirm → `confirmed`. No exceptions.

---

## 7. Accessibility

Non-negotiable, and currently unmet in three places (§3.3).

- **Contrast:** AA (4.5:1 text, 3:1 large/UI). Every new color re-verified before merge.
- **Touch targets:** ≥44×44px. Kid surface ≥48px — smaller hands, faster taps.
- **Never color-alone:** streak alive/broken carries an icon and a label, not just
  green/red. ~8% of boys have some color vision deficiency; this is core audience.
- **Focus visible:** 2px `--purple` outline, 2px offset. Never `outline: none`.
- **Motion:** honor `prefers-reduced-motion`; celebration animations become instant
  state changes.
- **Semantics:** real `<button>`, one `<h1>`, labelled inputs.
- **Dyslexia-friendly option** is flagged P1 in `feature-breakdown.html` for a
  *reading* product. Reserve `--font` as a swappable token so it can be added
  without a refactor.

---

## 8. Implementation

1. **`tokens.css` first**, before any component. Both surfaces, `:root` +
   `[data-surface="kid"]`.
2. **No hardcoded hex, ever.** The prototype's 31 instances of `#5B21B6` are the
   anti-pattern this prevents. Enforce in review.
3. **Extract, don't reinvent.** The prototype already made most layout decisions —
   port them onto tokens rather than redesigning.
4. **Verify contrast in CI** if possible; otherwise verify manually at review.

### 8.1 Migration of existing surfaces

| Surface | Action |
|---|---|
| v1 kid dashboard | Keep palette (§3.2). Adopt type scale + spacing when track work touches it |
| Hub `index.html` | Fix `--muted` → `#5B6472`. Align gold usage to `--gold-text` |
| Landing `landing.html` | Fix `--muted` → `#5B6472`. Otherwise already close to §3.3 |
| Prototype | Reference only. Its values are superseded by this document |

---

## 9. Open decisions

| # | Decision | Recommendation |
|---|---|---|
| 1 | Purple over v1 gold as brand | Yes — 3 of 4 surfaces already moved; better contrast headroom |
| 2 | Per-track accent colors? | No. One palette; themes change content, not chrome (§3.4) |
| 3 | Keep kid surface dark? | Yes — reads as game not homework; already AA-clean |
| 4 | Webfont? | No. System stack protects the <2s 4G load NFR |
| 5 | Does the brand name change affect this? | PRD Open Q #1 unresolved. Palette/scale are name-independent — safe to build now |
