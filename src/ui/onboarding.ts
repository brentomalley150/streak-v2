/**
 * Onboarding. Six steps, one optional, one driven by the kid.
 * Step 5 (consent) is BLOCKING — the PRD makes verifiable parental consent a
 * launch requirement, so the button stays disabled until both boxes are ticked.
 */
import type { Store } from '../core/store.js';
import { TRACKS } from '../tracks/index.js';
import { el, clear, on } from './dom.js';

type Draft = { name: string; trackId: string | null; theme: string | null;
               guardian: boolean; data: boolean };

export function renderOnboarding(
  root: HTMLElement, store: Store, done: () => void,
): void {
  const draft: Draft = { name: '', trackId: null, theme: null, guardian: false, data: false };
  let step = 1;
  const TOTAL = 6;

  const dots = () => {
    const d = el('div', { class: 'dots' });
    for (let i = 1; i <= TOTAL; i += 1) d.append(el('i', i <= step ? { class: 'on' } : {}));
    return d;
  };

  const screen = (children: Array<Node | string>, center = false) => {
    clear(root);
    document.documentElement.dataset['surface'] = 'kid';
    const s = el('div', { class: center ? 'screen screen--center' : 'screen' }, children);
    root.append(s);
  };

  function step1(): void {
    const btn = el('button', { class: 'btn', type: 'button' }, ['Sign in with Google']);
    on(btn, 'click', () => { step = 2; step2(); });
    screen([
      dots(),
      el('div', { style: 'text-align:center' }, [
        el('div', { style: 'font-size:44px;margin-bottom:12px' }, ['📚']),
        el('h1', {}, ['Beat the Slide']),
        el('p', {}, ['Build a daily habit your kid actually wants to keep — reading, math, music, whatever matters this season.']),
      ]),
      btn,
      el('p', { class: 'muted', style: 'text-align:center;margin-top:12px' },
        ['A parent signs in. Your kid never needs an account.']),
    ], true);
  }

  function step2(): void {
    const input = el('input', { class: 'input', id: 'kidname', placeholder: 'e.g. Declan',
      value: draft.name, autocomplete: 'off' });
    const btn = el('button', { class: 'btn', type: 'button' }, ['Continue']);
    btn.disabled = !draft.name.trim();
    on(input, 'input', () => {
      draft.name = (input as HTMLInputElement).value;
      btn.disabled = !draft.name.trim();
    });
    on(btn, 'click', () => { step = 3; step3(); });
    screen([
      dots(),
      el('div', { class: 'eyebrow' }, [`Step 2 of ${TOTAL}`]),
      el('h2', {}, ["Who's this for?"]),
      el('p', {}, ["Just a first name — it's what they'll see on their screen and the leaderboard."]),
      el('label', { class: 'field', for: 'kidname' }, [el('span', {}, ["Kid's first name"]), input]),
      btn,
    ]);
  }

  function step3(): void {
    const btn = el('button', { class: 'btn', type: 'button' }, ['Continue']);
    btn.disabled = !draft.trackId;
    const list = el('div', { class: 'stack' });
    for (const t of TRACKS) {
      const b = el('button', {
        class: 'opt', type: 'button',
        'aria-pressed': String(draft.trackId === String(t.trackId)),
      }, [
        el('span', { class: 'ico' }, [t.icon]),
        el('span', {}, [
          el('span', { class: 't' }, [t.name]),
          el('span', { class: 'd' }, [`${t.description} · Ages ${t.recommendedAge} · ~${t.dailyMinutes} min/day`]),
        ]),
      ]);
      on(b, 'click', () => { draft.trackId = String(t.trackId); step3(); });
      list.append(b);
    }
    on(btn, 'click', () => { step = 4; step4(); });
    screen([
      dots(),
      el('div', { class: 'eyebrow' }, [`Step 3 of ${TOTAL}`]),
      el('h2', {}, ['Pick a track']),
      el('p', {}, [`A 12-week program. ${draft.name || 'Your kid'} can add more later — one is plenty to start.`]),
      list, el('div', { style: 'height:12px' }), btn,
    ]);
  }

  function step4(): void {
    const themes = draft.trackId
      ? (TRACKS.find((t) => String(t.trackId) === draft.trackId)?.themes ?? [])
      : [];
    const ICONS: Record<string, string> = { chess: '♟️', sports: '⚽', music: '🎸', gaming: '🎮' };
    const grid = el('div', { class: 'grid2' });
    for (const th of themes) {
      const b = el('button', {
        class: 'opt', type: 'button', style: 'flex-direction:column;align-items:center;text-align:center',
        'aria-pressed': String(draft.theme === th),
      }, [
        el('span', { class: 'ico' }, [ICONS[th] ?? '⭐']),
        el('span', { class: 't' }, [th.charAt(0).toUpperCase() + th.slice(1)]),
      ]);
      on(b, 'click', () => { draft.theme = th; step4(); });
      grid.append(b);
    }
    const btn = el('button', { class: 'btn', type: 'button' }, ['Continue']);
    btn.disabled = !draft.theme;
    on(btn, 'click', () => { step = 5; step5(); });
    screen([
      dots(),
      el('div', { class: 'eyebrow' }, [`Step 4 of ${TOTAL}`]),
      el('h2', {}, [`Let ${draft.name || 'them'} pick a theme`]),
      el('p', {}, ['This sets the rank names and the daily ideas. Hand them the phone for this one.']),
      grid, el('div', { style: 'height:12px' }), btn,
    ]);
  }

  function step5(): void {
    const btn = el('button', { class: 'btn', type: 'button' }, ['Agree & continue']);
    const sync = () => { btn.disabled = !(draft.guardian && draft.data); };

    const box = (checked: boolean, toggle: () => void) => {
      const b = el('button', { class: 'check', type: 'button',
        role: 'checkbox', 'aria-checked': String(checked) }, ['✓']);
      on(b, 'click', () => { toggle(); step5(); });
      return b;
    };

    const c = el('div', { class: 'consent' }, [
      el('div', { class: 'line' }, [
        box(draft.guardian, () => { draft.guardian = !draft.guardian; }),
        el('span', { class: 'txt' }, [
          `I'm ${draft.name || 'this child'}'s `,
          el('strong', {}, ['parent or guardian']),
          ", and I'm creating this account for them.",
        ]),
      ]),
      el('div', { class: 'line' }, [
        box(draft.data, () => { draft.data = !draft.data; }),
        el('span', { class: 'txt' }, [
          'I agree we store their ',
          el('strong', {}, ['first name and daily activity']),
          ' only. No ads, never sold. ',
          el('strong', {}, ['Delete anytime']),
          ' in settings.',
        ]),
      ]),
    ]);
    sync();
    on(btn, 'click', () => { step = 6; step6(); });
    screen([
      dots(),
      el('div', { class: 'eyebrow' }, [`Step 5 of ${TOTAL} · Required`]),
      el('h2', {}, ['Your permission']),
      el('p', {}, [`${draft.name || 'Your kid'} is under 13, so we need a parent to agree before anything is saved.`]),
      c,
      el('p', { class: 'muted' }, ['Friends see only a first name and a score. Never a last name, photo, or location.']),
      btn,
    ]);
  }

  function step6(): void {
    const def = TRACKS.find((t) => String(t.trackId) === draft.trackId);
    const fields = def?.outcomeModel?.baselineFields ?? [];
    const inputs = new Map<string, HTMLInputElement>();
    const list = el('div', {});
    for (const f of fields) {
      const i = el('input', { class: 'input', type: 'number', inputmode: 'numeric',
        placeholder: f.placeholder ?? '' });
      inputs.set(f.id, i as HTMLInputElement);
      list.append(el('label', { class: 'field' }, [el('span', {}, [f.label]), i]));
    }
    const finish = () => {
      store.addProfile(draft.name.trim());
      store.recordConsent(draft.guardian, draft.data);
      if (draft.trackId) {
        store.enroll(draft.trackId, draft.theme ?? 'chess');
        const vals: Record<string, number | null> = {};
        for (const [k, i] of inputs) vals[k] = i.value ? Number(i.value) : null;
        if (Object.keys(vals).length) store.setBaseline(draft.trackId, vals);
      }
      done();
    };
    const save = el('button', { class: 'btn', type: 'button' }, ['Save & start']);
    const skip = el('button', { class: 'btn btn--link', type: 'button' }, ["Skip — I don't have these"]);
    on(save, 'click', finish);
    on(skip, 'click', finish);

    // A track with outcomeModel: null has nothing to ask — skip the step entirely.
    if (!fields.length) { finish(); return; }

    screen([
      dots(),
      el('div', { class: 'eyebrow' }, [`Step 6 of ${TOTAL} · Optional`]),
      el('h2', {}, ['Spring test scores?']),
      el('p', {}, [`If you have them, we'll project where ${draft.name || 'they'} could land in the fall. Skip it — everything else works the same.`]),
      list, save, skip,
    ]);
  }

  step1();
}
