# Chip
A small pill label: streak status, the current rank, or a tappable theme or instrument control.

**Markup:** `<span class="chip chip--alive">`, `chip chip--rank`, or `<button class="chip chip--theme">` for a control ("🎨 Art theme · change").

- `chip--alive`: `green` on `panel-alt`. `chip--rank`: `gold` with a `border`. Both are kid-surface chips — on the parent surface they fall to 3.44:1 and 2.90:1, below AA for 13px text (a known gap from the source, kept exact).
- Always pair the emoji with words; the chip is never color alone.
