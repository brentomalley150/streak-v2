/**
 * The weekly digest screen — the parent surface.
 *
 * LIGHT surface (design system §2): this is the calm, credible, adult-facing
 * side, not the kid's game.
 *
 * Guardrail 6 is structural here, not a promise: renderDigest() never mutates
 * anything. A proposal is applied only inside the confirm button's handler.
 */
import type { Store } from '../core/store.js';
import type { Digest, Proposal } from '../core/digest.js';
import { buildDigest } from '../core/digest.js';
import { getTrack } from '../tracks/index.js';
import { el, clear, on } from './dom.js';

function evidenceList(d: Digest): HTMLElement {
  const ul = el('ul', { class: 'evidence' });
  for (const e of d.insight.evidence) ul.append(el('li', {}, [e]));
  return ul;
}

function proposalCard(
  p: Proposal, onConfirm: () => void, onDismiss: () => void,
): HTMLElement {
  const card = el('div', { class: 'proposal' }, [
    el('div', { class: 'proposal-head' }, ['Suggested next step']),
    el('div', { class: 'proposal-label' }, [p.label]),
    el('div', { class: 'nudge' }, [
      el('span', { class: 'nudge-tag' }, ['Draft message']),
      el('p', {}, [`“${p.nudge}”`]),
    ]),
  ]);

  const row = el('div', { class: 'row', style: 'gap:var(--s-2);margin-top:var(--s-3)' });
  const yes = el('button', { class: 'btn', type: 'button' }, ['Apply this']);
  const no = el('button', { class: 'btn btn--ghost', type: 'button' }, ['Not now']);
  on(yes, 'click', onConfirm);
  on(no, 'click', onDismiss);
  row.append(yes, no);
  card.append(row);

  card.append(el('p', { class: 'muted', style: 'margin-top:var(--s-2)' }, [
    'Nothing changes in the app until you apply it.',
  ]));
  return card;
}

export function renderDigest(root: HTMLElement, store: Store, back: () => void): void {
  const s = store.state;
  const t = store.activeTrack;
  if (!s || !t) { back(); return; }
  const def = getTrack(t.trackId);
  const d = buildDigest({ def, state: t, kidName: s.playerName || 'your kid' });

  clear(root);
  document.documentElement.dataset['surface'] = 'parent';
  const screen = el('div', { class: 'screen' });

  screen.append(el('div', { class: 'eyebrow' }, [`Week of ${d.weekStart} · ${d.trackName}`]));
  screen.append(el('h2', {}, [d.insight.headline]));
  screen.append(el('p', {}, [d.insight.detail]));

  screen.append(el('div', { class: `sev sev--${d.insight.severity}` }, [
    el('span', {}, [
      d.insight.severity === 'celebrate' ? '🎉 Going well'
        : d.insight.severity === 'attention' ? '👀 Worth a look'
        : '💡 One small change',
    ]),
  ]));

  screen.append(el('div', { class: 'mod' }, [
    el('div', { class: 'head' }, ['What this is based on']),
    evidenceList(d),
  ]));

  if (d.projection) {
    screen.append(el('div', { class: 'mod projection' }, [
      el('div', { class: 'head' }, ['Fall estimate']),
      el('p', { class: 'muted', style: 'margin:0' }, [d.projection]),
    ]));
  }

  if (d.insight.proposal) {
    const p = d.insight.proposal;
    screen.append(proposalCard(p,
      () => {
        // The ONLY place a proposal takes effect (guardrail 6).
        store.applyProposal(p.apply.note, p.apply.activityId);
        renderDigest(root, store, back);
      },
      () => {
        store.dismissProposal();
        renderDigest(root, store, back);
      }));
  } else if (t.weekFocus) {
    screen.append(el('div', { class: 'mod' }, [
      el('div', { class: 'head' }, ['This week’s focus']),
      el('p', { style: 'margin:0' }, [t.weekFocus]),
    ]));
  }

  const bk = el('button', { class: 'btn btn--link', type: 'button' }, ['← Back to the app']);
  on(bk, 'click', () => { document.documentElement.dataset['surface'] = 'kid'; back(); });
  screen.append(bk);

  root.append(screen);
}
