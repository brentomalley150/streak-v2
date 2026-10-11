/**
 * Parent screens for the PRD v2 features. All PIN-gated from main.ts.
 *
 *   renderPrizes — family prize levels (FR27), cash-in requests (FR28),
 *                  chore confirmations and the chore list (FR30).
 *   renderScores — spring scores (FR20–FR21), the routine they produce
 *                  (FR22), and the opt-in fall estimate (FR25, PRD §3.6).
 */
import type { Store } from '../core/store.js';
import type { Activity } from '../core/types.js';
import { asActivityId } from '../core/types.js';
import { getTrack } from '../tracks/index.js';
import { ladderFor } from '../tracks/ladders.js';
import {
  computeStats, effectiveDef, pendingConfirmations, prizeStatus, routinePlan,
} from '../core/engine.js';
import { projectionFor, hasProjection } from '../core/projection.js';
import { el, clear, on } from './dom.js';

function toast(msg: string): void {
  document.querySelector('.toast')?.remove();
  const t = el('div', { class: 'toast', role: 'status' }, [msg]);
  document.body.append(t);
  setTimeout(() => t.remove(), 2400);
}

function backButton(back: () => void): HTMLElement {
  const bk = el('button', { class: 'btn btn--link', type: 'button' }, ['← Back to the app']);
  on(bk, 'click', () => { document.documentElement.dataset['surface'] = 'kid'; back(); });
  return bk;
}

const PRIZE_ICONS = ['🎁', '🎬', '🍦', '🍕', '🎮', '📚', '🏞️', '🛝', '🎨', '⭐'];
const CHORE_ICONS = ['🛏️', '🧸', '🍽️', '🧺', '🌱', '🐾', '🗑️', '🧽', '🚗', '⭐'];

/* ─────────────────────────── Prizes & approvals ─────────────────────────── */

export function renderPrizes(root: HTMLElement, store: Store, back: () => void): void {
  const s = store.state;
  const t = store.activeTrack;
  if (!s || !t) { back(); return; }
  const trackId = String(t.trackId);
  const base = getTrack(t.trackId);
  const def = effectiveDef(base, t);
  const points = computeStats(def, t, ladderFor(def, t)).points;
  const redraw = () => renderPrizes(root, store, back);

  clear(root);
  document.documentElement.dataset['surface'] = 'parent';
  const screen = el('div', { class: 'screen' });
  const kid = s.playerName || 'your kid';

  screen.append(
    el('div', { class: 'eyebrow' }, [`For parents · ${def.icon} ${def.name}`]),
    el('h2', {}, ['Prizes & approvals']),
    el('p', {}, [`${kid} has ${points} points. Prizes unlock at the levels you set — like ranks. Cashing one in never takes points away.`]),
  );

  // Waiting for you: cash-in requests and chores to confirm.
  const requests = t.prizes.filter((p) => p.requestedAt && !p.claimed);
  const chores = pendingConfirmations(base, t);
  const wait = el('div', { class: 'mod' }, [el('div', { class: 'head' }, ['Waiting for you'])]);
  if (!requests.length && !chores.length) {
    wait.append(el('p', { class: 'muted', style: 'margin:0' }, ['Nothing right now.']));
  }
  for (const p of requests) {
    const give = el('button', { class: 'btn btn--small', type: 'button' }, ['Mark as given']);
    on(give, 'click', () => { store.givePrize(trackId, p.id); toast(`${p.name} — given`); redraw(); });
    wait.append(el('div', { class: 'prize' }, [
      el('span', { class: 'prize-ico' }, [p.icon]),
      el('span', { class: 'grow' }, [el('div', { style: 'font-weight:700' }, [p.name]), el('div', { class: 'muted' }, [`${kid} asked to cash this in`])]),
      give,
    ]));
  }
  for (const c of chores) {
    const ok = el('button', { class: 'btn btn--small', type: 'button' }, ['Confirm']);
    on(ok, 'click', () => { store.confirmChore(c.date, String(c.activity.id), trackId); toast(`+${c.activity.points} for ${kid}`); redraw(); });
    wait.append(el('div', { class: 'prize' }, [
      el('span', { class: 'prize-ico' }, [c.activity.icon]),
      el('span', { class: 'grow' }, [el('div', { style: 'font-weight:700' }, [c.activity.label]), el('div', { class: 'muted' }, [`${c.date} · +${c.activity.points} once confirmed`])]),
      ok,
    ]));
  }
  screen.append(wait);

  // Prize levels.
  const list = el('div', { class: 'mod' }, [el('div', { class: 'head' }, ['Your prizes'])]);
  if (!t.prizes.length) list.append(el('p', { class: 'muted', style: 'margin:0 0 var(--s-2)' }, ['No prizes yet. Add one below — small and frequent works best early on.']));
  for (const p of t.prizes) {
    const st = prizeStatus(p, points);
    const label = st === 'locked' ? `Unlocks at ${p.cost}` : st === 'unlocked' ? 'Unlocked' : st === 'requested' ? 'Asked to cash in' : 'Given';
    const rm = el('button', { class: 'btn btn--link btn--small', type: 'button', 'aria-label': `Remove ${p.name}` }, ['Remove']);
    on(rm, 'click', () => { store.removePrize(trackId, p.id); redraw(); });
    list.append(el('div', { class: 'prize' }, [
      el('span', { class: 'prize-ico' }, [p.icon]),
      el('span', { class: 'grow' }, [el('div', { style: 'font-weight:700' }, [p.name]), el('div', { class: 'muted' }, [`${p.cost} pts · ${label}`])]),
      rm,
    ]));
  }
  screen.append(list);

  // Add a prize.
  let icon = PRIZE_ICONS[0]!;
  const icons = el('div', { class: 'iconpick' });
  const drawIcons = () => {
    clear(icons);
    for (const i of PRIZE_ICONS) {
      const b = el('button', { type: 'button', 'aria-pressed': String(i === icon), 'aria-label': `Icon ${i}` }, [i]);
      on(b, 'click', () => { icon = i; drawIcons(); });
      icons.append(b);
    }
  };
  drawIcons();
  const name = el('input', { class: 'input', type: 'text', maxlength: '40', placeholder: 'e.g. Pick the family movie' }) as HTMLInputElement;
  const pts = el('input', { class: 'input', type: 'number', inputmode: 'numeric', min: '1', placeholder: `e.g. ${Math.max(20, points + 20)}` }) as HTMLInputElement;
  const err = el('p', { class: 'muted', style: 'color:var(--red);min-height:1.2em;margin:0' }, ['']);
  const add = el('button', { class: 'btn', type: 'button' }, ['Add prize']);
  on(add, 'click', () => {
    const n = Number(pts.value);
    if (!name.value.trim()) { err.textContent = 'Give the prize a name.'; return; }
    if (!Number.isFinite(n) || n < 1) { err.textContent = 'Set the points it unlocks at (1 or more).'; return; }
    store.addPrize(trackId, name.value, icon, n);
    toast('Prize added');
    redraw();
  });
  screen.append(el('div', { class: 'mod' }, [
    el('div', { class: 'head' }, ['Add a prize']),
    el('label', { class: 'field' }, [el('span', {}, ['Prize']), name]),
    el('label', { class: 'field' }, [el('span', {}, ['Unlocks at (points)']), pts]),
    el('div', { class: 'field' }, [el('span', {}, ['Icon']), icons]),
    err, add,
  ]));

  if (base.customizableActivities) screen.append(choreEditor(store, trackId, def.activities, redraw));

  screen.append(backButton(back));
  root.append(screen);
}

/** Home Helper's chore list. Every chore needs a parent's OK to score. */
function choreEditor(store: Store, trackId: string, current: readonly Activity[], redraw: () => void): HTMLElement {
  const box = el('div', { class: 'mod' }, [
    el('div', { class: 'head' }, ['Chore list']),
    el('p', { class: 'muted', style: 'margin:0 0 var(--s-2)' }, ['Your kid ticks these off; points land once you confirm.']),
  ]);
  for (const a of current) {
    const rm = el('button', { class: 'btn btn--link btn--small', type: 'button', 'aria-label': `Remove ${a.label}` }, ['Remove']);
    on(rm, 'click', () => {
      if (current.length <= 1) { toast('Keep at least one chore'); return; }
      store.setCustomActivities(trackId, current.filter((x) => x.id !== a.id).map((x) => ({ ...x })));
      redraw();
    });
    box.append(el('div', { class: 'prize' }, [
      el('span', { class: 'prize-ico' }, [a.icon]),
      el('span', { class: 'grow' }, [el('div', { style: 'font-weight:700' }, [a.label]), el('div', { class: 'muted' }, [`${a.points} pts`])]),
      rm,
    ]));
  }
  let icon = CHORE_ICONS[0]!;
  const icons = el('div', { class: 'iconpick' });
  const drawIcons = () => {
    clear(icons);
    for (const i of CHORE_ICONS) {
      const b = el('button', { type: 'button', 'aria-pressed': String(i === icon), 'aria-label': `Icon ${i}` }, [i]);
      on(b, 'click', () => { icon = i; drawIcons(); });
      icons.append(b);
    }
  };
  drawIcons();
  const name = el('input', { class: 'input', type: 'text', maxlength: '24', placeholder: 'e.g. Feed the dog' }) as HTMLInputElement;
  const pts = el('input', { class: 'input', type: 'number', inputmode: 'numeric', min: '1', max: '10', value: '2' }) as HTMLInputElement;
  const add = el('button', { class: 'btn btn--ghost', type: 'button' }, ['Add chore']);
  on(add, 'click', () => {
    const label = name.value.trim();
    const n = Math.round(Number(pts.value));
    if (!label || !Number.isFinite(n) || n < 1 || n > 10) { toast('Name it and give it 1–10 points'); return; }
    if (current.length >= 8) { toast('Up to 8 chores — keep it doable'); return; }
    const id = `c_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 16)}_${Date.now().toString(36)}`;
    store.setCustomActivities(trackId, [
      ...current.map((x) => ({ ...x })),
      { id: asActivityId(id), label, icon, points: n, needsParentConfirm: true, fields: [] },
    ]);
    redraw();
  });
  box.append(
    el('label', { class: 'field' }, [el('span', {}, ['New chore']), name]),
    el('label', { class: 'field' }, [el('span', {}, ['Points (1–10)']), pts]),
    el('div', { class: 'field' }, [el('span', {}, ['Icon']), icons]),
    add,
  );
  return box;
}

/* ─────────────────────────── Scores & fall estimate ─────────────────────── */

export function renderScores(root: HTMLElement, store: Store, back: () => void): void {
  const s = store.state;
  const t = store.activeTrack;
  if (!s || !t) { back(); return; }
  const trackId = String(t.trackId);
  const def = effectiveDef(getTrack(t.trackId), t);
  const om = def.outcomeModel;
  const kid = s.playerName || 'your kid';
  const redraw = () => renderScores(root, store, back);

  clear(root);
  document.documentElement.dataset['surface'] = 'parent';
  const screen = el('div', { class: 'screen' });
  screen.append(
    el('div', { class: 'eyebrow' }, [`For parents · ${def.icon} ${def.name}`]),
    el('h2', {}, ['Test scores & fall estimate']),
  );
  if (!om) {
    screen.append(el('p', {}, ['This track has no test scores.']), backButton(back));
    root.append(screen);
    return;
  }
  screen.append(el('p', {}, [
    `Every field is optional. Scores stay in your family — never on a leaderboard, never in a challenge, and never shown to ${kid}.`,
  ]));

  // Score form.
  const inputs = new Map<string, HTMLInputElement>();
  const form = el('div', { class: 'mod' }, [el('div', { class: 'head' }, ['Spring scores'])]);
  for (const f of om.baselineFields) {
    const v = t.baseline[f.id];
    const i = el('input', {
      class: 'input', type: 'number', inputmode: 'numeric',
      placeholder: f.placeholder ? `e.g. ${f.placeholder}` : '', value: typeof v === 'number' ? String(v) : '',
    }) as HTMLInputElement;
    inputs.set(f.id, i);
    form.append(el('label', { class: 'field' }, [el('span', {}, [f.label]), i]));
  }
  const save = el('button', { class: 'btn', type: 'button' }, ['Save scores']);
  on(save, 'click', () => {
    const vals: Record<string, number | null> = {};
    for (const [k, i] of inputs) {
      const n = i.value.trim() === '' ? null : Number(i.value);
      vals[k] = n !== null && Number.isFinite(n) ? n : null;
    }
    store.setBaseline(trackId, vals);
    toast('Scores saved');
    redraw();
  });
  const del = el('button', { class: 'btn btn--link', type: 'button' }, ['Delete all scores']);
  on(del, 'click', () => { store.clearBaseline(trackId); toast('Scores deleted'); redraw(); });
  form.append(save, del);
  screen.append(form);

  // What the routine does with them (FR22).
  const plan = routinePlan(def, t.baseline);
  const routine = el('div', { class: 'mod' }, [el('div', { class: 'head' }, [`${kid}'s daily routine`])]);
  routine.append(el('p', { style: 'margin:0 0 var(--s-2)' }, [
    def.activities.map((a) => `${a.label}${a.minutes ? ` ${a.minutes} min` : ''}`).join(' · '),
  ]));
  if (plan.level || plan.focus) {
    const ul = el('ul', { class: 'evidence' });
    if (plan.level) ul.append(el('li', {}, [`${plan.level.text} — for you, to help pick books`]));
    if (plan.focus) ul.append(el('li', {}, [`${plan.focus.tip} (from the lowest subscore you entered)`]));
    routine.append(ul);
    routine.append(el('p', { class: 'muted', style: 'margin:var(--s-2) 0 0' }, [`${kid} sees the focus tip and a "just-right book" nudge — never a score or the book range.`]));
  } else {
    routine.append(el('p', { class: 'muted', style: 'margin:0' }, ['Add a Lexile or CMAS subscores and the routine will suggest a book level and one thing to focus on.']));
  }
  screen.append(routine);

  // The opt-in fall estimate (FR25).
  if (hasProjection(def)) {
    const field = om.baselineFields.find((f) => f.id === om.projectionField);
    const has = typeof t.baseline[om.projectionField!] === 'number';
    const box = el('div', { class: 'mod projection' }, [el('div', { class: 'head' }, ['Fall estimate · optional'])]);
    const toggle = el('button', {
      class: 'toggle', type: 'button', role: 'switch', 'aria-checked': String(!!t.projectionOn),
      ...(has ? {} : { disabled: 'true' }),
    }, [el('span', { class: 'toggle-knob' }, []), el('span', {}, [t.projectionOn ? 'On' : 'Off'])]);
    on(toggle, 'click', () => { if (!has) return; store.setProjection(trackId, !t.projectionOn); redraw(); });
    box.append(el('div', { class: 'row row--between', style: 'margin-bottom:var(--s-2)' }, [
      el('span', {}, [`Show where ${kid} could land in the fall`]), toggle,
    ]));
    if (!has) {
      box.append(el('p', { class: 'muted', style: 'margin:0' }, [`Needs a ${field?.label ?? 'baseline'} score above.`]));
    } else if (!t.projectionOn) {
      box.append(el('p', { class: 'muted', style: 'margin:0' }, ['Off. Nothing about the fall is shown anywhere — here, in emails, or to your kid.']));
    } else {
      const p = projectionFor(def, t);
      if (p && p.daysElapsed === 0) {
        box.append(el('p', { class: 'muted', style: 'margin:0' }, [`The estimate starts once ${kid} logs the first day of the routine.`]));
      } else if (p) {
        box.append(
          el('div', { class: 'proj-range' }, [`${p.keepPace.low}–${p.keepPace.high}`]),
          el('p', { class: 'muted', style: 'margin:0 0 var(--s-2)' }, ['Keep this pace']),
          el('p', { style: 'margin:0 0 var(--s-2)' }, [
            `Complete every remaining day: ${p.finishStrong.low}–${p.finishStrong.high}. `,
            `${Math.round(p.pace * 100)}% of the routine done so far · day ${p.daysElapsed} of ${p.totalDays}.`,
          ]),
          el('p', { class: 'muted', style: 'margin:0 0 var(--s-2)' }, ['Estimate based on activity pace — not a test result.']),
          ...(p.daysElapsed < 7
            ? [el('p', { class: 'muted', style: 'margin:0 0 var(--s-2)' }, ['Early days: a few good days swing this a lot. It settles after the first week.'])]
            : []),
        );
        const how = el('details', {}, [el('summary', {}, ['How is this calculated?'])]);
        const ul = el('ul', { class: 'evidence' });
        for (const line of p.explanation) ul.append(el('li', {}, [line]));
        how.append(ul);
        box.append(how);
      }
    }
    screen.append(box);
  }

  screen.append(backButton(back));
  root.append(screen);
}
