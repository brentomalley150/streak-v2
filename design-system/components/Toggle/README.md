# Toggle
An on/off switch for a single parent setting, such as turning the fall estimate on.

**Markup:** `<button class="toggle" role="switch" aria-checked="false">` containing `<span class="toggle-knob"></span>` and the label text. Flip `aria-checked`; the knob slides to `purple`.

- Off by default for anything the PRD makes opt-in (the fall estimate).
- `disabled` at 45% when a prerequisite is missing — and say what's missing next to it ("Needs a spring MAP Reading score").
- Parent surface only.
