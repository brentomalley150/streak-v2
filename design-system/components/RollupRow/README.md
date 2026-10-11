# RollupRow
One kid-and-track line in the family rollup, tappable to open that kid's track.

**Markup:** `<button class="kidrow">` with the track icon, a `.grow` block (track name, then a `muted` caption: "2h ago", "on this device"), and on the right the streak ("9d") over the rank. Rows sit under the kid's name. `disabled` when the track lives only on another device — the caption then says "on another device · yesterday".
