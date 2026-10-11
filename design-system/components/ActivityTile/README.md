# ActivityTile
The core kid interaction: one tile per daily activity, one tap to mark it done.

**Markup:** `<div class="acts">` (auto-fit grid, 96px minimum) of `<button class="act" aria-pressed>` with `.ico`, `.label`, `.pts` ("+3 pts"), optional `.mins` ("15 min") and, when done, `.done` ("✓ Done") or `.done done--wait` ("⏳ Grown-up checks").

- Done: `green` border and label on `panel-alt`, plus the "✓ Done" word — never color alone.
- Every tile shows its points; "+1 pt" for one.
- A chore waiting for a parent shows `done--wait` in `gold-text` and scores only once confirmed.
- Kid surface. On the parent surface the done label is 3.44:1, below AA.
