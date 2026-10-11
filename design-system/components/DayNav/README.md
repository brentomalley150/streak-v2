# DayNav
The day picker above the activity tiles: step back up to a week to log a missed day.

**Markup:** `<div class="daynav">` with `<button class="daynav-btn" aria-label="Previous day">‹</button>`, a `<div class="daynav-label">` and the next button. Add `daynav--past` on any day but today; the label then adds "Logging a day you missed" and a "Back to today" link.

- A past day takes a `gold` outline so the kid knows they're not on today.
- Disable ‹ at the earliest loggable day and › on today, never hide them.
- Labels: "Today", "Yesterday", then "Thu, Oct 8".
