Beat the Slide turns a kid's daily habit into a game. Two people use it, so it has two surfaces: a **kid surface** that feels like a game and a **parent surface** that feels calm and credible. Build every screen for one of them.

## Two surfaces

| | Kid surface — theme `kid` | Parent surface — theme `parent` |
|---|---|---|
| Mood | A game: energetic, rewarding | Calm, credible, informational |
| Ground | `bg` deep navy | `bg` white |
| Type | Larger. Nothing below `body` (16px) | Standard reading sizes |
| Density | One decision per screen | Tables and rollups are fine |
| Reading level | About 2nd grade | Adult |
| Motion | Celebrations (streak, rank-up) | Minimal |

- The daily screen, onboarding's theme pick and anything a kid taps use the `kid` theme. In the app that is `:root[data-surface="kid"]`; here it is the `kid` theme.
- Parent screens behind the PIN — prizes, scores, the weekly summary, challenges — use `parent`.
- The app is one column, 480px wide at most, centered on `bg-alt`.

## Content fundamentals

- **Write to the kid on kid screens, to the parent on parent screens.** Kid copy is short, concrete and encouraging: "Play your groove for two minutes without stopping." Parent copy is plain and exact: "Off. Nothing about the fall is shown anywhere — here, in emails, or to your kid."
- **Say what happened, in the kid's terms.** Toasts confirm the action: "Logged for Yesterday", "🌟 Perfect day! +2 bonus points", "Asked a grown-up — your points stay!"
- **Name buttons by what they do:** "Agree & continue", "Set a parent PIN", "I did it! +5 pts", "Apply this". Never "OK" or "Submit".
- **Never shame.** A day in progress is not a lapse. Celebrate first; nudge gently ("💡 One small change"); "👀 Worth a look" is as strong as it gets.
- **Points are always visible and never taken away.** Every activity tile shows its points. Cashing in a prize never costs a point, and the copy says so.
- **Estimates are labelled as estimates:** "Estimate based on activity pace — not a test result."
- **American English:** favorite, color, practice, and "measure" (not "bar") in music.
- **Privacy in plain words:** "first name and daily activity only. No ads, never sold." A challenge shows a first name, an avatar and a score — nothing else.
- Sentence case for headings and buttons. Uppercase only in `micro` eyebrows and module heads ("TODAY'S IDEAS · SPACE").

## Color

One palette, two themes. Themes like Chess or Space change rank names, icons and ideas — never the palette.

- **`purple` is the brand.** Primary buttons, links, selected state, eyebrows and the focus ring. One primary button per screen. `purple-dark` for hover and pressed; `purple-light` is a fill only, never text.
- **`gold` means achievement, and only that:** the streak number, the rank chip, the progress bar, a won perfect day, a past-day outline. Never a button, a link or body copy. On the parent surface gold is 3.19:1 — use it at 24px and up or for icons; set smaller gold text in `gold-text`.
- **`green` means done or alive:** a finished activity, "🔥 Still alive", a checked box, a toast. It's never the primary action — that's purple. On the parent surface use `green-text` for text under 24px.
- **`red` means broken or destructive** — a broken streak, a destructive confirm, an error. Never decorative.
- **Text:** `ink` for headings and body, `soft` for secondary lines and ideas, `muted` for captions and labels — all on `panel`, `panel-alt` or `bg`. Every one of those pairs passes 4.5:1 in both themes.
- **Grounds:** `bg` the page, `panel` cards and tiles, `panel-alt` selected or tinted cards and chips, `border` outlines.
- **On a fill** (`purple`, `green`) set text in `text-on-accent`.
- **Never color alone.** A done tile says "✓ Done"; a streak chip says "Still alive"; a waiting chore says "⏳ Grown-up checks". About 1 in 12 boys has some color-vision deficiency — the core audience.
- **Known gaps, kept exact from the app:** `border` is decorative (1.19:1 parent, 1.71:1 kid), so a control's label or focus state must carry its edge. Several kid components (`chip--alive`, `chip--rank`, the done label, the toast, the checked box) fall below AA if placed on the parent surface — keep them on the kid surface.

## Type

The system font stack (`font-sans`) — no webfont, to keep first load under 2 seconds on 4G. Keep `--font` swappable so a dyslexia-friendly face can be added later.

- Use the named styles only: `hero` (the marketing headline — the landing page's hero, once, never in the app), `display` (the largest in-app heading; marketing section titles), `h1` (one per screen), `h2` (section), `h3` (card title), `body` (default), `body-sm` (dense parent tables), `caption` (labels, metadata), `micro` (uppercase eyebrows and chips only — never a sentence), `streak` (the streak number).
- **The hero is fluid:** `clamp(var(--t-display), 7vw, var(--t-hero))` — 40px on phones up to 64px on wide screens. Marketing section titles use `clamp(var(--t-h1), 4vw, var(--t-display))`.
- **Kid floor:** nothing a kid reads goes below `body` (16px). On the kid surface `caption` rises to 14px and `micro` to 12px.
- Figures that line up or count — streaks, points, scores — use `font-variant-numeric: tabular-nums`.
- Weights are heavy: 800 for headings, labels and numbers, 700 for card titles and controls, 400 for running text.

## Spacing, radius, elevation

- A 4px base: `s-1` 4 · `s-2` 8 · `s-3` 12 · `s-4` 16 · `s-5` 24 · `s-6` 32 · `s-7` 48 · `s-8` 64. Screen gutter and card padding `s-4` on mobile, `s-5` on desktop; section rhythm `s-6`; stacked items `s-3` apart; tile grids `s-2`.
- Radius by role: `r-sm` (8) checkboxes, picker cells, menu rows; `r-md` (12) buttons, inputs, cards, tiles; `r-lg` (16) the hero card only; `r-pill` chips, pills, bars, toggles.
- Borders mark objects more than shadows do. Shadows: `e-1` a card at rest, `e-2` raised or hovered, `e-3` toasts and modals.

## Interaction and states

- **Touch targets:** 44px minimum; 48px on the kid surface. Activity tiles are 76px tall.
- **Focus is always visible:** a 2px `purple` outline, 2px offset. Never `outline: none` without a replacement (inputs swap to a `purple` border).
- **Selected** = `green` border on `panel-alt` for a done activity or a chosen option; `purple` border for a selected segment, menu row or icon.
- **Disabled** = 45% opacity and a not-allowed cursor, label kept.
- **Loading shows "—"**, never 0. A bare 0 reads as a broken streak. Every data-backed component ships a loading and an empty state.
- **Nothing the system suggests applies itself.** A suggestion is proposed, the parent taps "Apply this", then it changes.
- **Motion** is for celebrations on the kid surface, and `prefers-reduced-motion` turns it into an instant change.

## Iconography

- **Emoji are the icon set.** Activities, tracks, themes, prizes and ranks each carry one: 📖 Read, 🥁 Drums, 🚀 Space, 🍦 Ice cream trip, 🌍 Cadet. They render in the device's emoji font; there is no icon font and no SVG set.
- One emoji per item, beside its words, never instead of them. Give an emoji-only button an `aria-label`.
- 🔥 is the streak, 🌟 the perfect day, ⏳ waiting for a grown-up, 🔒 a locked prize, ✓ done.
- **No logo file exists.** The wordmark is "Beat the Slide" set in `font-sans` at weight 900, `purple`, after a 🔥 — as in the site's nav.

## Using the components

The stylesheet is `components/bundle.css`: class-based, plain HTML, no framework. Load `tokens.css`, then `bundle.css`, and set the theme on the root. Each component card lists the exact markup and attributes it expects (`aria-pressed`, `aria-checked`, `aria-expanded`), and which surface it belongs to.
