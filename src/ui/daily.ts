/**
 * The daily screen: v1's game with the v2 track switcher on top.
 * Everything rendered here comes from the TrackDefinition — no track is named.
 */
import type { Store } from '../core/store.js';
import type { TrackState } from '../core/types.js';
import { getTrack, TRACKS } from '../tracks/index.js';
import { LADDERS } from '../tracks/ladders.js';
import { computeStats, todayKey, getEntry, weekNumber, challengeForWeek, maxPointsPerDay, canEnroll } from '../core/engine.js';
import { el, clear, on } from './dom.js';

let menuOpen = false;

function toast(msg: string): void {
  document.querySelector('.toast')?.remove();
  const t = el('div', { class: 'toast', role: 'status' }, [msg]);
  document.body.append(t);
  setTimeout(() => t.remove(), 2400);
}

export function renderDaily(root: HTMLElement, store: Store, onMarketplace: () => void): void {
  const s = store.state;
  const t: TrackState | null = store.activeTrack;
  if (!s || !t) { onMarketplace(); return; }

  const def = getTrack(t.trackId);
  const ladder = LADDERS[def.ladder] ?? LADDERS['chess']!;
  const stats = computeStats(def, t, ladder);
  const today = todayKey();
  const entry = getEntry(t, def, today);

  clear(root);
  document.documentElement.dataset['surface'] = 'kid';
  const screen = el('div', { class: 'screen' });

  // header
  screen.append(el('div', { class: 'row row--between', style: 'margin-bottom:12px' }, [
    el('div', { style: 'font-weight:700;color:var(--soft)' }, [`Hey ${s.playerName || 'there'} 👋`]),
    el('span', { class: 'chip chip--rank' }, [`${stats.rank.piece} ${stats.rank.name}`]),
  ]));

  // track switcher (FR3)
  const sw = el('button', { class: 'switcher', type: 'button', 'aria-expanded': String(menuOpen) }, [
    el('span', { class: 'row' }, [
      el('span', { style: 'font-size:19px' }, [def.icon]),
      el('span', {}, [def.name]),
    ]),
    el('span', { class: 'muted', style: 'font-weight:700' }, [menuOpen ? '▲ Switch' : '▼ Switch']),
  ]);
  on(sw, 'click', () => { menuOpen = !menuOpen; renderDaily(root, store, onMarketplace); });
  screen.append(sw);

  if (menuOpen) {
    const menu = el('div', { class: 'menu' });
    for (const id of Object.keys(s.tracks)) {
      const d = getTrack(id);
      const st = s.tracks[id]!;
      const active = id === String(s.activeTrackId);
      const b = el('button', { type: 'button', 'aria-current': String(active) }, [
        el('span', {}, [d.icon]), el('span', {}, [d.name]),
        el('span', { class: 'meta' }, [`${computeStats(d, st, LADDERS[d.ladder] ?? ladder).currentStreak}d streak`]),
      ]);
      on(b, 'click', () => {
        store.setActiveTrack(id); menuOpen = false;
        renderDaily(root, store, onMarketplace); toast(`Switched to ${d.name}`);
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

  // activities — straight from the definition
  const acts = el('div', { class: 'acts' });
  for (const a of def.activities) {
    const doneNow = !!entry.completed[a.id];
    const b = el('button', { class: 'act', type: 'button', 'aria-pressed': String(doneNow) }, [
      el('span', { class: 'ico' }, [a.icon]),
      el('span', { class: 'label' }, [a.label]),
      ...(doneNow ? [el('span', { class: 'done' }, ['✓ Done'])] : []),
    ]);
    on(b, 'click', () => { store.toggle(String(a.id)); renderDaily(root, store, onMarketplace); });
    acts.append(b);
  }
  screen.append(acts);

  const earned = def.activities.reduce((n, a) => (entry.completed[a.id] ? n + a.points : n), 0);
  screen.append(el('p', { class: 'muted', style: 'text-align:center' }, [
    `Today: ${earned} of ${maxPointsPerDay(def)} points`,
  ]));

  // weekly challenge
  const wk = weekNumber(def, t.startDate, today);
  const ch = challengeForWeek(def, wk);
  if (ch) {
    screen.append(el('div', { class: 'mod' }, [
      el('div', { class: 'head' }, [`Week ${wk} challenge`]),
      el('div', { class: 'row' }, [
        el('span', { style: 'font-size:22px' }, [ch.emoji]),
        el('div', {}, [
          el('div', { style: 'font-weight:800' }, [ch.name]),
          el('div', { class: 'muted' }, [ch.short]),
        ]),
      ]),
    ]));
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

  // add-a-track affordance, gated by FR7
  const enrolled = Object.keys(s.tracks).length;
  const more = el('button', { class: 'btn btn--ghost', type: 'button' },
    [canEnroll(s.entitlement, enrolled) ? '＋ Add another track' : '🔒 Add another track (Family plan)']);
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
    const allowed = on_ || canEnroll(s.entitlement, enrolled.length);
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
      on(b, 'click', () => { store.enroll(String(def.trackId), def.themes[0] ?? 'chess'); back(); });
      card.append(b);
    } else {
      card.append(el('p', { class: 'muted', style: 'margin-top:8px' },
        ['🔒 Free plan includes 1 track. Add more with Family.']));
      const b = el('button', { class: 'btn btn--ghost', type: 'button' }, ['See Family plan']);
      on(b, 'click', () => toast('Family plan — $4.99/mo'));
      card.append(b);
    }
    screen.append(card);
  }

  const bk = el('button', { class: 'btn btn--link', type: 'button' }, ['← Back']);
  on(bk, 'click', back);
  screen.append(bk);
  root.append(screen);
}
