# SegmentedControl
A row of pill buttons for one choice among a few, like a challenge's length or kids-versus-teams.

**Markup:** `<div class="seg">` of `<button aria-pressed="true|false">`. Exactly one pressed.

- Selected: `purple` border and text on `panel-alt`. Unselected: `soft` on `panel`.
- Short labels — "4 wk", "Kids compete", "Class vs. class". Wraps on narrow screens.
