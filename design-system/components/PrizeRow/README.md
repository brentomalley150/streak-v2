# PrizeRow
One family prize in a list: icon, name, its point level, and its state or action.

**Markup:** `<div class="prize prize--locked|unlocked|requested|given">` with `.prize-ico` (🔒 while locked), a `.grow` block (name, then "Unlocks at 60 pts" in `muted`), and on the right "14 pts to go", a `btn btn--small` "Cash in", a "⏳ Asked" chip or a "🎉 Cashed in" `chip--alive`. Locked rows sit at 75% opacity.

- Kid view: locked shows "14 pts to go", unlocked shows a "Cash in" button. Parent view labels: "Unlocks at 60", "Unlocked", "Asked to cash in", "Given".
- Cashing in never costs points. The cash-in toast says so: "Asked a grown-up — your points stay!"
