/**
 * The daily screen: v1's game with the v2 track switcher on top.
 * Everything rendered here comes from the TrackDefinition — no track is named.
 */
import type { Store } from '../core/store.js';
import type { TrackState } from '../core/types.js';
import { asDateKey } from '../core/types.js';
import { getTrack, TRACKS } from '../tracks/index.js';
import { THEMES, ladderFor, themeInfo } from '../tracks/ladders.js';
import {
  computeStats, todayKey, addDays, earliestLoggable, getEntry, weekNumber, challengeForWeek, maxPointsPerDay, pointsForEntry, perfectDayBonus, canEnrollNow, freeTrackLimit,
  effectiveDef, variantFor, ideasFor, routinePlan, activityScores, prizeStatus, pendingConfirmations,
  challengeWindow, pointsInWindow,
} from '../core/engine.js';
import { el, clear, on } from './dom.js';
import { leaderboardKey, type LeaderboardRow } from '../core/sync.js';
import { memberBoard, teamBoard } from '../core/groups.js';

let themeMenuOpen = false;
let variantMenuOpen = false;
/** Days back from today the kid is logging; 0 is today. */
let dayOffset = 0;

let menuOpen = false;
let kidMenuOpen = false;
let unsubscribeLeaderboard: (() => void) | null = null;

function toast(msg: string): void {
  document.querySelector('.toast')?.remove();
  const t = el('div', { class: 'toast', role: 'status' }, [msg]);
  document.body.append(t);
  setTimeout(() => t.remove(), 2400);
}

/** "Today", "Yesterday", or a short date like "Thu, Oct 8". */
function dayLabel(day: string, today: string): string {
  if (day === today) return 'Today';
  if (day === addDays(asDateKey(today), -1)) return 'Yesterday';
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function renderDaily(
  root: HTMLElement, store: Store,
  onMarketplace: () => void, onDigest?: () => void, onAddKid?: () => void,
  onRollup?: () => void, onSetPin?: () => void, onGroups?: () => void,
  onPrizes?: () => void, onScores?: () => void, onSettings?: () => void, onRecap?: () => void,
): void {
  const s = store.state;
  const t: TrackState | null = store.activeTrack;
  if (!s || !t) { onMarketplace(); return; }

  const rerender = (): void => renderDaily(
    root, store, onMarketplace, onDigest, onAddKid, onRollup, onSetPin, onGroups, onPrizes, onScores, onSettings, onRecap,
  );

  const def = effectiveDef(getTrack(t.trackId), t);
  const ladder = ladderFor(def, t);
  const stats = computeStats(def, t, ladder);
  const today = todayKey();
  // The day being logged. Clamped every render, so a kid switch, a track with
  // a later start, or midnight passing can never leave it out of the window.
  const earliest = earliestLoggable(t, today);
  let day = addDays(today, -dayOffset);
  if (day < earliest) { day = earliest; }
  if (day > today) { day = today; }
  const isToday = day === today;
  const entry = getEntry(t, def, day);

  clear(root);
  document.documentElement.dataset['surface'] = 'kid';
  const screen = el('div', { class: 'screen' });

  // header
  screen.append(el('div', { class: 'row row--between', style: 'margin-bottom:12px' }, [
    el('div', { style: 'font-weight:700;color:var(--soft)' }, [`Hey ${s.playerName || 'there'} 👋`]),
    el('span', { class: 'chip chip--rank' }, [`${stats.rank.piece} ${stats.rank.name}`]),
  ]));

  // Welcome back from SummerStreak: once, until closed.
  if (s.summer && !s.summerRecapSeen) {
    const r = s.summer;
    const bits = [`${r.points} points`, r.rank, r.booksFinished ? `${r.booksFinished} ${r.booksFinished === 1 ? 'book' : 'books'}` : '',
      r.totalMinutes ? `${r.totalMinutes} minutes read` : ''].filter(Boolean);
    const ok = el('button', { class: 'btn btn--link btn--small', type: 'button' }, ['Got it']);
    on(ok, 'click', () => { store.dismissSummerRecap(); rerender(); });
    // One track so far: the free fall track is the natural next step.
    const actions: Node[] = [];
    if (Object.keys(s.tracks).length < freeTrackLimit(s)) {
      const add = el('button', { class: 'btn btn--small', type: 'button' }, ['Add a fall track']);
      on(add, 'click', () => { store.dismissSummerRecap(); onMarketplace(); });
      actions.push(add);
    }
    if (onRecap) {
      const see = el('button', { class: 'btn btn--link btn--small', type: 'button' }, ['See the whole summer']);
      on(see, 'click', onRecap);
      actions.push(see);
    }
    actions.push(ok);
    screen.append(el('div', { class: 'mod', role: 'status' }, [
      el('div', { class: 'head' }, ['☀️ Welcome back']),
      el('div', { style: 'font-weight:800;margin-bottom:var(--s-1)' }, [`Your summer is here, ${s.playerName}!`]),
      el('div', { class: 'muted' }, [bits.join(' · ')]),
      el('p', { style: 'margin:var(--s-2) 0' }, ['SummerStreak is now Beat the Slide: same game, now all year. You get a second track free — try Back to School or Math Facts.']),
      el('div', { class: 'row' }, actions),
    ]));
  }

  // Kid switcher. Only shown for a family with more than one kid — a
  // single-kid family gains nothing from a menu of one, and the daily screen
  // is the kid's own surface, so it stays as plain as possible.
  //
  // "Add a kid" must NOT live only in here: gating the sole way to create a
  // second kid behind already having one makes it unreachable. It has its own
  // entry among the parent actions below.
  if (store.all.length > 1) {
    const who = el('button', {
      class: 'switcher', type: 'button', 'aria-expanded': String(kidMenuOpen),
    }, [
      el('span', { class: 'row' }, [
        el('span', { style: 'font-size:19px' }, [s.playerAvatar || '🙂']),
        el('span', {}, [s.playerName || 'This kid']),
      ]),
      el('span', { class: 'muted', style: 'font-weight:700' }, [kidMenuOpen ? '▲ Switch kid' : '▼ Switch kid']),
    ]);
    on(who, 'click', () => {
      kidMenuOpen = !kidMenuOpen;
      rerender();
    });
    screen.append(who);

    if (kidMenuOpen) {
      const kids = el('div', { class: 'menu' });
      for (const p of store.all) {
        const active = p.id === s.profileId;
        const tracks = Object.keys(p.state.tracks).length;
        const b = el('button', { type: 'button', 'aria-current': String(active) }, [
          el('span', {}, [p.state.playerAvatar || '🙂']),
          el('span', {}, [p.state.playerName || 'Unnamed']),
          el('span', { class: 'meta' }, [tracks === 1 ? '1 track' : `${tracks} tracks`]),
        ]);
        on(b, 'click', () => {
          kidMenuOpen = false;
          if (p.id === s.profileId) { rerender(); return; }
          store.switchProfile(p.id);
          // Close the track menu too: it was showing the previous kid's tracks.
          menuOpen = false;
          dayOffset = 0;
          rerender();
          toast(`Switched to ${p.state.playerName || 'this kid'}`);
        });
        kids.append(b);
      }
      // Onboarding is the only thing that creates a profile, so adding a kid
      // means running it again. It appends rather than replaces, so the first
      // kid's data is untouched.
      if (onAddKid) {
        const add = el('button', { type: 'button', style: 'color:var(--purple);font-weight:800' },
          [el('span', {}, ['＋']), el('span', {}, ['Add a kid'])]);
        on(add, 'click', () => { kidMenuOpen = false; onAddKid(); });
        kids.append(add);
      }
      screen.append(kids);
    }
  }

  // track switcher (FR3)
  const sw = el('button', { class: 'switcher', type: 'button', 'aria-expanded': String(menuOpen) }, [
    el('span', { class: 'row' }, [
      el('span', { style: 'font-size:19px' }, [def.icon]),
      el('span', {}, [def.name]),
    ]),
    el('span', { class: 'muted', style: 'font-weight:700' }, [menuOpen ? '▲ Switch' : '▼ Switch']),
  ]);
  on(sw, 'click', () => { menuOpen = !menuOpen; rerender(); });
  screen.append(sw);

  if (menuOpen) {
    const menu = el('div', { class: 'menu' });
    for (const id of Object.keys(s.tracks)) {
      const d = getTrack(id);
      const st = s.tracks[id]!;
      const active = id === String(s.activeTrackId);
      const b = el('button', { type: 'button', 'aria-current': String(active) }, [
        el('span', {}, [d.icon]), el('span', {}, [d.name]),
        el('span', { class: 'meta' }, [`${computeStats(d, st, ladderFor(d, st)).currentStreak}d streak`]),
      ]);
      on(b, 'click', () => {
        store.setActiveTrack(id); menuOpen = false; dayOffset = 0;
        rerender(); toast(`Switched to ${d.name}`);
      });
      menu.append(b);
    }
    const add = el('button', { type: 'button', style: 'color:var(--purple);font-weight:800' },
      [el('span', {}, ['＋']), el('span', {}, ['Add a track'])]);
    on(add, 'click', onMarketplace);
    menu.append(add);
    screen.append(menu);
  }

  // hero: streak + rank progress
  const pct = stats.nextRank
    ? Math.round(((stats.points - stats.rank.min) / (stats.nextRank.min - stats.rank.min)) * 100)
    : 100;
  screen.append(el('div', { class: 'hero' }, [
    el('div', { class: 'row row--between' }, [
      el('div', {}, [
        el('div', { class: 'streak-num' }, [String(stats.currentStreak)]),
        el('div', { class: 'muted', style: 'font-weight:600' }, ['day streak']),
      ]),
      el('span', { class: 'chip chip--alive' },
        [stats.currentStreak > 0 ? '🔥 Still alive' : '🌱 Start today']),
    ]),
    el('div', { class: 'row row--between', style: 'margin-top:10px;font-size:var(--t-caption);font-weight:700' }, [
      el('span', { class: 'muted' }, [`${stats.points} pts`]),
      el('span', { class: 'muted' }, [stats.nextRank ? `${stats.pointsToNext} to ${stats.nextRank.name}` : 'Max rank']),
    ]),
    el('div', { class: 'bar' }, [el('i', { style: `width:${Math.max(0, Math.min(100, pct))}%` })]),
  ]));

  // Theme (FR23). The kid's own choice, changeable any time; points and rank
  // level carry over because every ladder shares the same thresholds.
  const th = themeInfo(t.theme);
  const themeBtn = el('button', { class: 'chip chip--theme', type: 'button', 'aria-expanded': String(themeMenuOpen) },
    [`${th.icon} ${th.label} theme · change`]);
  on(themeBtn, 'click', () => { themeMenuOpen = !themeMenuOpen; rerender(); });
  const chipRow = el('div', { class: 'row', style: 'justify-content:flex-end;flex-wrap:wrap;gap:var(--s-2);margin:0 0 var(--s-2)' }, [themeBtn]);
  screen.append(chipRow);
  if (themeMenuOpen) {
    const grid = el('div', { class: 'grid3', style: 'margin-bottom:var(--s-3)' });
    for (const opt of THEMES.filter((x) => def.themes.includes(x.id))) {
      const b = el('button', { class: 'opt opt--theme', type: 'button', 'aria-pressed': String(opt.id === t.theme) },
        [el('span', { class: 'ico' }, [opt.icon]), el('span', { class: 't' }, [opt.label])]);
      on(b, 'click', () => {
        themeMenuOpen = false;
        store.setTheme(String(t.trackId), opt.id);
        rerender();
        toast(`${opt.label} theme — same points, new rank names`);
      });
      grid.append(b);
    }
    screen.append(grid);
  }

  // Instrument (or any track's variant). Words only, so switching is free. A
  // kid enrolled before instruments existed, or from the track list, has none
  // yet — the picker stays open until they choose.
  if (def.variants) {
    const vs = def.variants;
    const cur = variantFor(def, t.variant);
    const open = variantMenuOpen || !cur;
    const vBtn = el('button', { class: 'chip chip--theme', type: 'button', 'aria-expanded': String(open) },
      [cur ? `${cur.icon} ${cur.label} · change` : `🎵 Pick your ${vs.noun}`]);
    on(vBtn, 'click', () => { variantMenuOpen = !variantMenuOpen; rerender(); });
    chipRow.prepend(vBtn);
    if (open) {
      if (!cur) screen.append(el('p', { class: 'muted', style: 'margin:0 0 var(--s-2)' }, [vs.prompt]));
      const grid = el('div', { class: 'grid3', style: 'margin-bottom:var(--s-3)' });
      for (const opt of vs.options) {
        const b = el('button', { class: 'opt opt--theme', type: 'button', 'aria-pressed': String(opt.id === cur?.id) },
          [el('span', { class: 'ico' }, [opt.icon]), el('span', { class: 't' }, [opt.label])]);
        on(b, 'click', () => {
          variantMenuOpen = false;
          store.setVariant(String(t.trackId), opt.id);
          rerender();
          toast(`${opt.label} — same points, new practice ideas`);
        });
        grid.append(b);
      }
      screen.append(grid);
    }
  }

  // Which day is being logged. A kid who forgot can go back up to a week
  // (never before they started); the streak, weekly and challenge points all
  // recompute from the dated entries, so a filled-in day counts where it falls.
  const offsetOf = (k: string) => Math.round(
    (Date.parse(`${today}T12:00:00`) - Date.parse(`${k}T12:00:00`)) / 86_400_000);
  const prev = el('button', { class: 'daynav-btn', type: 'button', 'aria-label': 'Previous day' }, ['‹']);
  const next = el('button', { class: 'daynav-btn', type: 'button', 'aria-label': 'Next day' }, ['›']);
  prev.disabled = day <= earliest;
  next.disabled = isToday;
  on(prev, 'click', () => { dayOffset = offsetOf(day) + 1; rerender(); });
  on(next, 'click', () => { dayOffset = offsetOf(day) - 1; rerender(); });
  const center = el('div', { class: 'daynav-label' }, [el('strong', {}, [dayLabel(day, today)])]);
  if (!isToday) {
    const back = el('button', { class: 'btn btn--link btn--small', type: 'button' }, ['Back to today']);
    on(back, 'click', () => { dayOffset = 0; rerender(); });
    center.append(el('span', { class: 'muted' }, ['Logging a day you missed']), back);
  }
  screen.append(el('div', { class: isToday ? 'daynav' : 'daynav daynav--past' }, [prev, center, next]));

  // activities — straight from the (effective) definition
  const plan = routinePlan(def, t.baseline);
  const bonus = perfectDayBonus(def);
  const acts = el('div', { class: 'acts' });
  for (const a of def.activities) {
    const ticked = !!entry.completed[a.id];
    const waiting = ticked && !activityScores(a, entry);
    const b = el('button', { class: 'act', type: 'button', 'aria-pressed': String(ticked) }, [
      el('span', { class: 'ico' }, [a.icon]),
      el('span', { class: 'label' }, [a.label]),
      // What a tap is worth, on the tile itself, so the kid never has to guess.
      el('span', { class: 'pts' }, [`+${a.points} ${a.points === 1 ? 'pt' : 'pts'}`]),
      ...(a.minutes ? [el('span', { class: 'mins' }, [`${a.minutes} min`])] : []),
      ...(ticked
        ? [el('span', { class: waiting ? 'done done--wait' : 'done' }, [waiting ? '⏳ Grown-up checks' : '✓ Done'])]
        : []),
    ]);
    on(b, 'click', () => {
      const wasPerfect = entry.comboClaimed;
      store.toggle(String(a.id), day);
      rerender();
      const nowPerfect = store.activeTrack?.entries[day]?.comboClaimed ?? false;
      if (nowPerfect && !wasPerfect) toast(`🌟 Perfect day! +${bonus} bonus points`);
      else if (!isToday && !ticked) toast(`Logged for ${dayLabel(day, today)}`);
    });
    acts.append(b);
  }
  screen.append(acts);

  // Perfect day (v1's combo, back): every activity done earns a bonus. Shown
  // as a goal with progress, so the kid can see it before they've earned it.
  const scoredCount = def.activities.filter((a) => activityScores(a, entry)).length;
  const tickedCount = def.activities.filter((a) => entry.completed[a.id]).length;
  const total = def.activities.length;
  if (bonus > 0 && total > 0) {
    const all = total === 3 ? 'all three' : `all ${total}`;
    const text = entry.comboClaimed
      ? `Perfect day! +${bonus} bonus points`
      : tickedCount === total
        ? `All done — +${bonus} bonus once a grown-up checks`
        : `Perfect day bonus: do ${all} for +${bonus} more`;
    screen.append(el('div', { class: entry.comboClaimed ? 'perfect perfect--won' : 'perfect' }, [
      el('span', { class: 'perfect-star' }, ['🌟']),
      el('span', { class: 'grow' }, [text]),
      el('span', { class: 'perfect-count' }, [`${scoredCount}/${total}`]),
    ]));
  }

  const earned = pointsForEntry(def, entry);
  const waitingCount = def.activities.filter((a) => entry.completed[a.id] && !activityScores(a, entry)).length;
  screen.append(el('p', { class: 'muted', style: 'text-align:center' }, [
    `${dayLabel(day, today)}: ${earned} of ${maxPointsPerDay(def)} points`
      + (waitingCount ? ` · ${waitingCount} waiting for a grown-up` : ''),
  ]));

  // Today's plan + theme ideas (FR22, FR24). The focus names a skill, never a
  // score — the kid sees the nudge, not the number.
  const ideasBox = el('div', { class: 'mod' }, [el('div', { class: 'head' }, [`Today's ideas · ${th.label}`])]);
  let anyIdea = false;
  for (const a of def.activities) {
    const lines: string[] = [];
    // The book range is derived from the Lexile, so it stays on the parent
    // screen: showing it here would give the score away (FR21).
    if (plan.level?.activityId === a.id) lines.push('Pick a just-right book — not too easy, not too hard.');
    if (plan.focus?.activityId === a.id) lines.push(plan.focus.tip);
    const ideas = ideasFor(def, String(a.id), t.theme, today);
    if (!lines.length && !ideas.length) continue;
    anyIdea = true;
    const row = el('div', { class: 'idea' }, [el('div', { class: 'idea-h' }, [`${a.icon} ${a.label}`])]);
    for (const l of lines) row.append(el('div', { class: 'idea-focus' }, [l]));
    for (const i of ideas) row.append(el('div', { class: 'idea-t' }, [`• ${i}`]));
    ideasBox.append(row);
  }
  // Ideas are for doing today, not for filling in a day already gone.
  if (anyIdea && isToday) screen.append(ideasBox);

  // Weekly bonus activity (FR26) — optional extra points, never the streak.
  const wk = weekNumber(def, t.startDate, today);
  const ch = challengeForWeek(def, wk);
  if (ch) {
    const bonusDone = !!t.bonusCompleted?.[wk];
    const per = def.weeklyBonusPoints ?? 0;
    const mark = el('button', { class: bonusDone ? 'btn btn--ghost' : 'btn', type: 'button', style: 'margin-top:var(--s-3)' },
      [bonusDone ? '✓ Done — tap to undo' : `I did it! +${per} pts`]);
    on(mark, 'click', () => {
      store.toggleBonus(wk);
      rerender();
      if (!bonusDone) toast(`Bonus done! +${per} points`);
    });
    screen.append(el('div', { class: 'mod' }, [
      el('div', { class: 'head' }, [`Week ${wk} bonus · +${per} pts · optional`]),
      el('div', { class: 'row' }, [
        el('span', { style: 'font-size:22px' }, [ch.emoji]),
        el('div', {}, [
          el('div', { style: 'font-weight:800' }, [ch.name]),
          el('div', { class: 'muted' }, [ch.short]),
        ]),
      ]),
      ...(per > 0 ? [mark] : []),
    ]));
  }

  // Prizes (FR27–FR28). Unlock like ranks; cashing in never costs points.
  if (t.prizes.length) {
    const box = el('div', { class: 'mod' }, [el('div', { class: 'head' }, ['Prizes'])]);
    for (const pz of t.prizes) {
      const st = prizeStatus(pz, stats.points);
      const right: Node[] = [];
      if (st === 'locked') right.push(el('span', { class: 'muted' }, [`${pz.cost - stats.points} pts to go`]));
      else if (st === 'unlocked') {
        const ask = el('button', { class: 'btn btn--small', type: 'button' }, ['Cash in']);
        on(ask, 'click', () => { store.requestPrize(String(t.trackId), pz.id); rerender(); toast('Asked a grown-up — your points stay!'); });
        right.push(ask);
      } else if (st === 'requested') right.push(el('span', { class: 'chip' }, ['⏳ Asked']));
      else right.push(el('span', { class: 'chip chip--alive' }, ['🎉 Cashed in']));
      box.append(el('div', { class: `prize prize--${st}` }, [
        el('span', { class: 'prize-ico' }, [st === 'locked' ? '🔒' : pz.icon]),
        el('span', { class: 'grow' }, [
          el('div', { style: 'font-weight:800' }, [pz.name]),
          el('div', { class: 'muted' }, [`Unlocks at ${pz.cost} pts`]),
        ]),
        ...right,
      ]));
    }
    box.append(el('p', { class: 'muted', style: 'margin:var(--s-2) 0 0' },
      ['Cashing in never takes away your points or your rank.']));
    screen.append(box);
  }

  // Challenges this kid is in on this track (FR29, FR31).
  const mine = (s.joinedChallenges ?? []).filter((c) => c.trackId === String(t.trackId));
  for (const jc of mine) {
    const win = challengeWindow(asDateKey(jc.startDate), jc.lengthWeeks, today);
    const pts = pointsInWindow(def, t, asDateKey(jc.startDate), jc.lengthWeeks);
    const when = win.phase === 'upcoming' ? `Starts ${jc.startDate}`
      : win.phase === 'ended' ? 'Finished' : `Day ${win.day} of ${win.totalDays}`;
    const board = el('div', {}, []);
    screen.append(el('div', { class: 'mod' }, [
      el('div', { class: 'head' }, [`🎯 ${jc.name} · ${when}`]),
      el('p', { style: 'margin:0 0 var(--s-2)' }, [`You've earned ${pts} pts in this challenge.`]),
      board,
    ]));
    if (store.syncEnabled && store.user) {
      const me = leaderboardKey(store.user.uid, s.profileId);
      void store.loadGroup(jc.groupId).then((g) => {
        if (!g) return;
        clear(board);
        if (g.meta.mode === 'teams') {
          teamBoard(g).slice(0, 5).forEach((tm, i) => {
            const isMine = tm.teamId === jc.teamId;
            board.append(el('div', { class: 'row', style: `padding:4px 0${isMine ? ';font-weight:800' : ''}` }, [
              el('span', { class: 'muted', style: 'width:18px' }, [String(i + 1)]),
              el('span', { style: 'flex:1;min-width:0' }, [isMine ? `${tm.name} (your team)` : tm.name]),
              el('span', { class: 'muted' }, [`avg ${Math.round(tm.average)}`]),
            ]));
          });
        } else {
          memberBoard(g).slice(0, 5).forEach((m, i) => {
            const isMe = m.key === me;
            board.append(el('div', { class: 'row', style: `padding:4px 0${isMe ? ';font-weight:800' : ''}` }, [
              el('span', { class: 'muted', style: 'width:18px' }, [String(i + 1)]),
              el('span', { style: 'font-size:16px' }, [m.avatar]),
              el('span', { style: 'flex:1;min-width:0' }, [isMe ? `${m.name} (you)` : m.name]),
              el('span', { style: 'font-weight:800;color:var(--gold)' }, [String(m.points ?? 0)]),
            ]));
          });
        }
      });
    }
  }

  // stat columns — declared by the track
  const cols = el('div', { class: 'row', style: 'gap:var(--s-4)' });
  for (const c of def.statColumns) {
    cols.append(el('div', {}, [
      el('div', { style: 'font-weight:800;font-size:var(--t-h3);font-variant-numeric:tabular-nums' },
        [String(stats.stats[c.id] ?? 0)]),
      el('div', { class: 'muted' }, [c.label]),
    ]));
  }
  screen.append(el('div', { class: 'mod' }, [
    el('div', { class: 'head' }, [`${def.name} so far`]), cols,
  ]));

  // Live per-track leaderboard (FR5). Renders a loading state first, then real
  // rows — never a bare empty list that reads as "you have no friends".
  const lbBody = el('div', {}, [el('p', { class: 'muted' }, ['—'])]);
  screen.append(el('div', { class: 'mod' }, [
    el('div', { class: 'head' }, [`${def.name} leaderboard`]), lbBody,
  ]));

  if (store.syncEnabled && store.user) {
    const me = leaderboardKey(store.user.uid, s.profileId);
    unsubscribeLeaderboard?.();
    unsubscribeLeaderboard = store.watchLeaderboard(String(def.trackId), (rows: LeaderboardRow[]) => {
      clear(lbBody);
      if (!rows.length) {
        // No invite flow exists yet, so this must not promise one. It states
        // the real mechanism: the board fills from other families on this track.
        lbBody.append(el('p', { class: 'muted' }, [
          `No one else is on ${def.name} yet. As other families start this track, they'll show up here.`,
        ]));
        return;
      }
      rows.slice(0, 5).forEach((r, i) => {
        const mine = r.leaderboardKey === me;
        lbBody.append(el('div', {
          class: 'row', style: `padding:6px 0${mine ? ';font-weight:800' : ''}`,
        }, [
          el('span', { class: 'muted', style: 'width:18px' }, [String(i + 1)]),
          el('span', { style: 'font-size:16px' }, [r.avatar]),
          el('span', { style: 'flex:1;min-width:0' }, [mine ? `${r.name} (you)` : r.name]),
          el('span', { style: 'font-weight:800;color:var(--gold)' }, [String(r.points)]),
        ]));
      });
    });
  } else {
    clear(lbBody);
    lbBody.append(el('p', { class: 'muted' }, [
      store.syncEnabled
        ? 'Sign in to see how other families are doing on this track.'
        : 'Leaderboards need an internet connection.',
    ]));
  }

  // Prizes and approvals. Counts what is waiting so a parent sees it at a glance.
  if (onPrizes) {
    const waiting = t.prizes.filter((p) => p.requestedAt && !p.claimed).length
      + pendingConfirmations(getTrack(t.trackId), t).length;
    const pz = el('button', { class: 'btn btn--ghost', type: 'button', style: 'margin-bottom:var(--s-2)' },
      [`🎁 Prizes${def.activities.some((a) => a.needsParentConfirm) || def.customizableActivities ? ', chores' : ''} & approvals (for parents)${waiting ? ` · ${waiting} waiting` : ''}`]);
    on(pz, 'click', onPrizes);
    screen.append(pz);
  }

  // Scores, routine and the opt-in fall estimate — only where the track has them.
  if (onScores && def.outcomeModel) {
    const sc = el('button', { class: 'btn btn--ghost', type: 'button', style: 'margin-bottom:var(--s-2)' },
      ['📈 Test scores & fall estimate (for parents)']);
    on(sc, 'click', onScores);
    screen.append(sc);
  }

  // Parent entry point. Deliberately understated on the kid's screen.
  if (onDigest) {
    const pd = el('button', { class: 'btn btn--ghost', type: 'button', style: 'margin-bottom:var(--s-2)' },
      ["📋 This week's summary (for parents)"]);
    on(pd, 'click', onDigest);
    screen.append(pd);
  }

  // Cross-kid view (FR6). Pointless for a one-kid one-track family, so it only
  // appears once there is more than one thing to compare.
  if (onRollup && (store.all.length > 1 || Object.keys(s.tracks).length > 1)) {
    const fam = el('button', { class: 'btn btn--ghost', type: 'button', style: 'margin-bottom:var(--s-2)' },
      ['👨‍👩‍👧 Everyone at a glance (for parents)']);
    on(fam, 'click', onRollup);
    screen.append(fam);
  }

  // The invite mechanic: challenges this family runs, and the link to share.
  if (onGroups) {
    const gr = el('button', { class: 'btn btn--ghost', type: 'button', style: 'margin-bottom:var(--s-2)' },
      ['🎯 Challenges & invites (for parents)']);
    on(gr, 'click', onGroups);
    screen.append(gr);
  }

  // Reachable for every family, not just multi-kid ones — this is how a
  // family becomes multi-kid in the first place.
  if (onAddKid) {
    const addKid = el('button', { class: 'btn btn--ghost', type: 'button', style: 'margin-bottom:var(--s-2)' },
      ['＋ Add another kid (for parents)']);
    on(addKid, 'click', onAddKid);
    screen.append(addKid);
  }

  // The summer recap stays reachable after the welcome card is closed.
  if (onRecap && s.summer) {
    const rc = el('button', { class: 'btn btn--ghost', type: 'button', style: 'margin-bottom:var(--s-2)' },
      [`☀️ ${s.playerName || 'Your kid'}'s summer recap`]);
    on(rc, 'click', onRecap);
    screen.append(rc);
  }

  if (onSettings) {
    const st = el('button', { class: 'btn btn--ghost', type: 'button', style: 'margin-bottom:var(--s-2)' },
      ['⚙️ Settings & privacy (for parents)']);
    on(st, 'click', onSettings);
    screen.append(st);
  }

  if (onSetPin) {
    const pin = el('button', { class: 'btn btn--link', type: 'button' },
      [store.pinIsSet ? 'Change parent PIN' : 'Set a parent PIN']);
    on(pin, 'click', onSetPin);
    screen.append(pin);
  }

  // add-a-track affordance, gated by FR7
  const enrolled = Object.keys(s.tracks).length;
  const more = el('button', { class: 'btn btn--ghost', type: 'button' },
    [canEnrollNow(s.entitlement, enrolled, freeTrackLimit(s)) ? '＋ Add another track' : '🔒 Add another track']);
  on(more, 'click', onMarketplace);
  screen.append(more);

  root.append(screen);
}

export function renderMarketplace(root: HTMLElement, store: Store, back: () => void): void {
  const s = store.state;
  if (!s) return;
  clear(root);
  document.documentElement.dataset['surface'] = 'kid';
  const screen = el('div', { class: 'screen' });
  const enrolled = Object.keys(s.tracks);

  screen.append(el('h2', {}, ['Track marketplace']));
  screen.append(el('p', { class: 'muted' },
    [`${enrolled.length} active · ${s.playerName || 'your kid'}`]));

  for (const def of TRACKS) {
    const on_ = enrolled.includes(String(def.trackId));
    const allowed = on_ || canEnrollNow(s.entitlement, enrolled.length, freeTrackLimit(s));
    const card = el('div', { class: 'mod' }, [
      el('div', { class: 'row' }, [
        el('span', { style: 'font-size:24px' }, [def.icon]),
        el('div', {}, [
          el('div', { style: 'font-weight:800' }, [def.name]),
          el('div', { class: 'muted' }, [def.description]),
          el('div', { class: 'muted' }, [`Ages ${def.recommendedAge} · ~${def.dailyMinutes} min/day`]),
        ]),
      ]),
    ]);
    if (on_) {
      card.append(el('div', { class: 'chip chip--alive', style: 'margin-top:8px' }, ['✓ Enrolled']));
    } else if (allowed) {
      const b = el('button', { class: 'btn', type: 'button', style: 'margin-top:10px' },
        [`Enroll ${s.playerName || ''}`.trim()]);
      // Carry the kid's current theme into the new track, so it feels like theirs.
      const cur = store.activeTrack?.theme;
      on(b, 'click', () => { store.enroll(String(def.trackId), cur && def.themes.includes(cur) ? cur : (def.themes[0] ?? 'chess')); back(); });
      card.append(b);
    } else {
      // Reached only when billing is enabled; the copy names no price, because
      // pricing is not decided (PRD §5.3 and its open Instructor-tier question).
      card.append(el('p', { class: 'muted', style: 'margin-top:8px' },
        [freeTrackLimit(s) > 1 ? '🔒 Two tracks on the free plan — one extra for SummerStreak families.' : '🔒 One track at a time on the free plan.']));
    }
    screen.append(card);
  }

  const bk = el('button', { class: 'btn btn--link', type: 'button' }, ['← Back']);
  on(bk, 'click', back);
  screen.append(bk);
  root.append(screen);
}
