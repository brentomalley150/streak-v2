# ConsentCheck
The parent's consent block: square checkboxes beside the exact promise being agreed to.

**Markup:** `<div class="consent">` of `<div class="line">` each with `<button class="check" role="checkbox" aria-checked>✓</button>` and `<span class="txt">` (bold the key terms in `<strong>`).

- The "Agree & continue" button stays disabled until every box is checked.
- Checked fills `green` with a `text-on-accent` tick. Parent surface: white on green is 3.77:1, short of 4.5:1 for the 14px tick — a known gap from the source, kept exact. The tick is also shape, not color alone.
- Say what's stored in plain words: "first name and daily activity only. No ads, never sold."
