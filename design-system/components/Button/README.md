# Button
The one tappable action style: a full-width purple primary, a ghost secondary, a text link and a small inline size.

**Use** `.btn` for the screen's main action ("Continue", "Save & start"). One primary per screen. `.btn--ghost` for a secondary choice beside it, `.btn--link` for a quiet escape ("Not now — start with Declan", "← Back"), `.btn--small` inside rows (prize "Cash in", "Confirm").

**Markup:** a real `<button type="button" class="btn">`. Add `btn--ghost`, `btn--link` or `btn--small`; `btn--link btn--small` combine.

- Primary is `purple` with `text-on-accent`: 7.03:1 parent, 9.42:1 kid. Height 48px; radius `r-md`.
- Disabled is `disabled` at 45% opacity with a not-allowed cursor. Keep the label: a disabled "Continue" says what unlocks it.
- Labels say what happens: "Agree & continue", "Set a parent PIN", "I did it! +5 pts". Never "OK" or "Submit".
- Don't use green, gold or red for a button. Gold is for achievements; red only confirms a destructive step.
