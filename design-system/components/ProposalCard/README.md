# ProposalCard
A suggested change the parent can accept — a stretch goal or a focus for next week.

**Markup:** `<div class="proposal">` with `.proposal-head` (eyebrow), `.proposal-label` (the change), a `.nudge` box (`.nudge-tag` + a `<p>` of the exact wording the kid would see), then "Apply this" (`btn`) and "Not now" (`btn btn--ghost`) in a row, and the line "Nothing changes in the app until you apply it."

- Never applies itself: proposed → the parent taps confirm → applied. Every time.
- The `.nudge` box ("Draft message") shows the exact words, in quotes, so the parent approves what will be said.
- The 3px `purple` left edge is the source's own mark for "awaiting your decision"; keep it for proposals only.
