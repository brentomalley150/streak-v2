# TrackSwitcher
The full-width control at the top of the daily screen that switches tracks (or kids), opening a menu below it.

**Markup:** `<button class="switcher" aria-expanded>` with the icon and name on the left and "▼ Switch" (`muted`) on the right. When open, a `<div class="menu">` of `<button aria-current>` rows; `.meta` holds a right-aligned note.

- The current row is `purple` on `panel-alt`.
- The menu's last row adds something ("＋ Add a track") in `purple`.
- Hide the kid switcher for a one-kid family; never hide the only route to adding a kid.
