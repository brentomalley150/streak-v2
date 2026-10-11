# StreakHero
The top card of the kid's daily screen: the streak in big gold figures, a status chip, points and the bar to the next rank.

**Markup:** `<div class="hero">` holding `.streak-num` (44px, `gold`, tabular figures) over "day streak", a `chip chip--alive`, a points row and `<div class="bar"><i style="width:N%"></i></div>`.

- Before data loads show "—", never 0: a 0 reads as a broken streak.
- The chip carries a word as well as a color: "🔥 Still alive" or "🌱 Start today".
- Kid surface. On the parent surface gold is 3.19:1, fine at 44px but not for smaller text.
