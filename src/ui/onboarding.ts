/**
 * Onboarding. Seven steps, one optional, one driven by the kid.
 * Step 5 (consent) is BLOCKING — the PRD makes verifiable parental consent a
 * launch requirement, so the button stays disabled until both boxes are ticked.
 * Step 7 is the handoff: the app is a shared device, and nothing said so.
 */
import type { Store } from '../core/store.js';
import { TRACKS } from '../tracks/index.js';
import { THEMES } from '../tracks/ladders.js';
import { hasProjection } from '../core/projection.js';
import { el, clear, on } from './dom.js';
import type { V1Kid } from '../core/sync.js';
import type { ProfileBackup } from '../core/backup.js';

type Draft = { name: string; trackId: string | null; variant: string | null; theme: string | null;
               guardian: boolean; data: boolean; projection: boolean };

export function renderOnboarding(
  root: HTMLElement, store: Store, done: () => void, onSetPin?: () => void,
): void {
  const draft: Draft = { name: '', trackId: null, variant: null, theme: null, guardian: false, data: false, projection: false };
  let step = 1;
  /** More than one kid came in at once (SummerStreak import). */
  let many = false;
  /** The kids came from SummerStreak: the handoff mentions their free fall track. */
  let fromSummer = false;
  const TOTAL = 7;

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
    const canSync = store.syncEnabled;
    const btn = el('button', { class: 'btn', type: 'button' },
      [canSync ? 'Sign in with Google' : 'Get started']);
    const err = el('p', { class: 'muted', style: 'color:var(--red);margin-top:10px' }, []);

    on(btn, 'click', () => {
      if (!canSync) { step = 2; step2(); return; }
      btn.disabled = true;
      btn.textContent = 'Signing in…';
      void store.signIn()
        .then(() => afterSignIn())
        .catch(() => {
          // Sign-in is for syncing across devices, not for playing. If it fails
          // the family continues on this device rather than being stuck.
          btn.disabled = false;
          btn.textContent = 'Sign in with Google';
          err.textContent = "Couldn't sign in. You can continue without it — progress saves on this device.";
          const skip = el('button', { class: 'btn btn--link', type: 'button' },
            ['Continue without signing in']);
          on(skip, 'click', () => { step = 2; step2(); });
          err.after(skip);
        });
    });
    screen([
      dots(),
      el('div', { style: 'text-align:center' }, [
        el('div', { style: 'font-size:44px;margin-bottom:12px' }, ['📚']),
        el('h1', {}, ['Beat the Slide']),
        el('p', {}, ['Build a daily habit your kid actually wants to keep — reading, math, music, whatever matters this season.']),
      ]),
      btn,
      err,
      el('p', { class: 'muted', style: 'text-align:center;margin-top:12px' },
        [canSync
          ? 'A parent signs in. Your kid never needs an account.'
          : 'Progress saves on this device. Your kid never needs an account.']),
    ], true);
  }

  /** Signed in: a SummerStreak family gets their kids back before anything else. */
  async function afterSignIn(): Promise<void> {
    const saved = await store.findRestorableKids();
    if (saved.length) { restoreStep(saved); return; }
    await afterRestore(false);
  }

  /** After any restore: SummerStreak kids next, else the handoff (or a fresh start). */
  async function afterRestore(restored: boolean): Promise<void> {
    const kids = await store.findSummerKids();
    if (kids.length) { summerStep(kids); return; }
    if (restored) { step = 7; step7(); return; }
    step = 2; step2();
  }

  /**
   * A new device on a family's account: bring their kids back with their
   * progress, prizes and settings. Consent was given when each kid was set
   * up, and comes back with them.
   */
  function restoreStep(saved: ProfileBackup[]): void {
    const chosen = new Set(saved.map((k) => k.state.profileId));
    const go = el('button', { class: 'btn', type: 'button' }, ['Restore']);
    const sync = () => { go.disabled = chosen.size === 0; };
    const list = el('div', { class: 'stack', style: 'margin-bottom:var(--s-4)' });
    for (const k of saved) {
      const id = k.state.profileId;
      const tracks = Object.keys(k.state.tracks).map((t) => TRACKS.find((d) => String(d.trackId) === t)?.name ?? t);
      const b = el('button', { class: 'opt', type: 'button', 'aria-pressed': 'true' }, [
        el('span', { class: 'ico' }, [k.state.playerAvatar || '🙂']),
        el('span', {}, [
          el('span', { class: 't' }, [k.state.playerName]),
          el('span', { class: 'd' }, [tracks.length ? tracks.join(' · ') : 'No tracks yet']),
        ]),
      ]);
      on(b, 'click', () => {
        if (chosen.has(id)) chosen.delete(id); else chosen.add(id);
        b.setAttribute('aria-pressed', String(chosen.has(id)));
        sync();
      });
      list.append(b);
    }
    on(go, 'click', () => {
      const picked = saved.filter((k) => chosen.has(k.state.profileId));
      store.restoreKids(picked);
      draft.name = picked.map((k) => k.state.playerName).join(' and ');
      many = picked.length > 1;
      void afterRestore(true);
    });
    const fresh = el('button', { class: 'btn btn--link', type: 'button' }, ['Start fresh instead']);
    on(fresh, 'click', () => { void afterRestore(false); });
    sync();
    screen([
      dots(),
      el('div', { class: 'eyebrow' }, ['Welcome back']),
      el('h2', {}, [saved.length === 1 ? `Restore ${saved[0]!.state.playerName}?` : 'Restore your kids?']),
      el('p', {}, ['Their progress, prizes and settings are saved to this Google account. Test scores stay on the device they were entered on, and you\'ll set a new parent PIN here.']),
      list, go, fresh,
    ]);
  }

  /**
   * Welcome back from SummerStreak. Brings each chosen kid in with their name,
   * avatar, theme and lifetime points; the parent still gives consent here,
   * exactly as step 5 asks a new family.
   */
  function summerStep(kids: V1Kid[]): void {
    const chosen = new Set(kids.map((k) => k.profileId));
    let guardian = false, data = false;
    const go = el('button', { class: 'btn', type: 'button' }, ['Bring them in']);
    const sync = () => { go.disabled = !(guardian && data && chosen.size > 0); };

    const list = el('div', { class: 'stack', style: 'margin-bottom:var(--s-4)' });
    for (const k of kids) {
      const b = el('button', { class: 'opt', type: 'button', 'aria-pressed': 'true' }, [
        el('span', { class: 'ico' }, [k.avatar]),
        el('span', {}, [
          el('span', { class: 't' }, [k.name]),
          el('span', { class: 'd' }, [[
            `${k.points} pts`, k.rank, k.booksFinished ? `${k.booksFinished} ${k.booksFinished === 1 ? 'book' : 'books'}` : '',
          ].filter(Boolean).join(' · ')]),
        ]),
      ]);
      on(b, 'click', () => {
        if (chosen.has(k.profileId)) chosen.delete(k.profileId); else chosen.add(k.profileId);
        b.setAttribute('aria-pressed', String(chosen.has(k.profileId)));
        sync();
      });
      list.append(b);
    }

    const box = (label: Array<Node | string>, toggle: () => boolean) => {
      const c = el('button', { class: 'check', type: 'button', role: 'checkbox', 'aria-checked': 'false' }, ['✓']);
      on(c, 'click', () => { c.setAttribute('aria-checked', String(toggle())); sync(); });
      return el('div', { class: 'line' }, [c, el('span', { class: 'txt' }, label)]);
    };
    const consent = el('div', { class: 'consent' }, [
      box(["I'm their ", el('strong', {}, ['parent or guardian']), ", and I'm bringing their summer progress into Beat the Slide."],
        () => (guardian = !guardian)),
      box(['I agree we store their ', el('strong', {}, ['first name and daily activity']), ' only. No ads, never sold. ',
        el('strong', {}, ['Delete anytime']), ' in settings.'], () => (data = !data)),
    ]);

    on(go, 'click', () => {
      const picked = kids.filter((k) => chosen.has(k.profileId));
      store.importSummerKids(picked, { guardian, data });
      fromSummer = true;
      draft.name = picked.map((k) => k.name).join(' and ');
      many = picked.length > 1;
      step = 7; step7();
    });
    const fresh = el('button', { class: 'btn btn--link', type: 'button' }, ['Start fresh instead']);
    on(fresh, 'click', () => { step = 2; step2(); });
    sync();

    screen([
      dots(),
      el('div', { class: 'eyebrow' }, ['SummerStreak is now Beat the Slide']),
      el('h2', {}, ['Your summer is still here']),
      el('p', {}, ['Same game — streaks, points and ranks — now all year, with tracks for math, music, chores and more.']),
      el('p', {}, [`We found ${kids.length === 1 ? 'your kid' : `${kids.length} kids`} from SummerStreak on this Google account. Their points and rank come with them, streaks start fresh this fall, and ${kids.length === 1 ? 'they get' : 'each gets'} a second track free.`]),
      list, consent,
      el('p', { class: 'muted' }, ["Other families on the same track can see your kid's first name, avatar and progress, like points and minutes read. Never a last name, photo, or location."]),
      go, fresh,
    ]);
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
    const picked = TRACKS.find((t) => String(t.trackId) === draft.trackId);
    const btn = el('button', { class: 'btn', type: 'button' }, ['Continue']);
    // A track with variants (Music's instrument) needs one picked to continue.
    btn.disabled = !draft.trackId || (!!picked?.variants && !draft.variant);
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
      on(b, 'click', () => {
        if (draft.trackId !== String(t.trackId)) draft.variant = null;
        draft.trackId = String(t.trackId);
        step3();
      });
      list.append(b);
    }
    const variantPicker: Node[] = [];
    if (picked?.variants) {
      const grid = el('div', { class: 'grid3' });
      for (const v of picked.variants.options) {
        const b = el('button', {
          class: 'opt opt--theme', type: 'button',
          'aria-pressed': String(draft.variant === v.id),
        }, [el('span', { class: 'ico' }, [v.icon]), el('span', { class: 't' }, [v.label])]);
        on(b, 'click', () => { draft.variant = v.id; step3(); });
        grid.append(b);
      }
      variantPicker.push(el('div', { style: 'font-weight:800;margin:var(--s-4) 0 var(--s-2)' }, [picked.variants.prompt]), grid);
    }
    on(btn, 'click', () => { step = 4; step4(); });
    screen([
      dots(),
      el('div', { class: 'eyebrow' }, [`Step 3 of ${TOTAL}`]),
      el('h2', {}, ['Pick a track']),
      el('p', {}, [`A daily routine — 12 weeks to start. ${draft.name || 'Your kid'} can add more later; one is plenty to start.`]),
      list, ...variantPicker, el('div', { style: 'height:12px' }), btn,
    ]);
  }

  function step4(): void {
    const allowed = draft.trackId
      ? (TRACKS.find((t) => String(t.trackId) === draft.trackId)?.themes ?? [])
      : [];
    const grid = el('div', { class: 'grid3' });
    for (const th of THEMES.filter((x) => allowed.includes(x.id))) {
      const b = el('button', {
        class: 'opt opt--theme', type: 'button',
        'aria-pressed': String(draft.theme === th.id),
      }, [
        el('span', { class: 'ico' }, [th.icon]),
        el('span', { class: 't' }, [th.label]),
      ]);
      on(b, 'click', () => { draft.theme = th.id; step4(); });
      grid.append(b);
    }
    const btn = el('button', { class: 'btn', type: 'button' }, ['Continue']);
    btn.disabled = !draft.theme;
    on(btn, 'click', () => { step = 5; step5(); });
    screen([
      dots(),
      el('div', { class: 'eyebrow' }, [`Step 4 of ${TOTAL}`]),
      el('h2', {}, [`Let ${draft.name || 'them'} pick a theme`]),
      el('p', {}, ['This sets the rank names and the daily ideas. They can change it any time and keep their points. Hand them the phone for this one.']),
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
      el('p', { class: 'muted' }, ["Other families on the same track can see your kid's first name, avatar and progress, like points and minutes read. Never a last name, photo, or location."]),
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
        placeholder: f.placeholder ? `e.g. ${f.placeholder}` : '' });
      inputs.set(f.id, i as HTMLInputElement);
      list.append(el('label', { class: 'field' }, [el('span', {}, [f.label]), i]));
    }
    const finish = () => {
      store.addProfile(draft.name.trim());
      store.recordConsent(draft.guardian, draft.data);
      if (draft.trackId) {
        store.enroll(draft.trackId, draft.theme ?? 'chess', draft.variant ?? undefined);
        const vals: Record<string, number | null> = {};
        for (const [k, i] of inputs) vals[k] = i.value ? Number(i.value) : null;
        if (Object.keys(vals).length) store.setBaseline(draft.trackId, vals);
        // Only if the parent ticked it AND entered the score it runs on.
        const pf = def?.outcomeModel?.projectionField;
        if (draft.projection && pf && vals[pf] !== null && vals[pf] !== undefined) {
          store.setProjection(draft.trackId, true);
        }
      }
      // The profile exists from here on, so step 7 can set a PIN against it.
      step = 7;
      step7();
    };
    const save = el('button', { class: 'btn', type: 'button' }, ['Save & start']);
    const skip = el('button', { class: 'btn btn--link', type: 'button' }, ["Skip — I don't have these"]);
    on(save, 'click', finish);
    on(skip, 'click', finish);

    // A track with outcomeModel: null has nothing to ask — skip the step entirely.
    if (!fields.length) { finish(); return; }

    // The fall estimate is opt-in (FR25): unticked by default.
    const extras: Node[] = [];
    if (def && hasProjection(def)) {
      const box = el('button', { class: 'check', type: 'button', role: 'checkbox', 'aria-checked': String(draft.projection) }, ['✓']);
      on(box, 'click', () => {
        draft.projection = !draft.projection;
        box.setAttribute('aria-checked', String(draft.projection));
      });
      extras.push(el('div', { class: 'consent' }, [el('div', { class: 'line' }, [
        box,
        el('span', { class: 'txt' }, [
          'Also show me a ', el('strong', {}, ['fall estimate']),
          ' from the MAP score — a range, just for parents. You can turn it off any time.',
        ]),
      ])]));
    }

    screen([
      dots(),
      el('div', { class: 'eyebrow' }, [`Step 6 of ${TOTAL} · Optional`]),
      el('h2', {}, ['Spring test scores?']),
      el('p', {}, [`If you have them, ${draft.name ? `${draft.name}'s` : 'their'} daily routine will suggest a book level and one thing to focus on. Scores stay with you — never on a leaderboard. Skip it and everything else works the same.`]),
      list, ...extras, save, skip,
    ]);
  }

  /**
   * The handoff. Onboarding used to end by dropping the parent into the kid's
   * daily screen with no explanation, which left the most common question —
   * "how do I give this to my kid?" — unanswered. The app is a shared device;
   * this is where that gets said out loud.
   */
  function step7(): void {
    const name = draft.name.trim() || 'your kid';

    const point = (icon: string, text: Array<Node | string>) =>
      el('div', { class: 'row', style: 'gap:var(--s-3);align-items:flex-start;margin-bottom:var(--s-3)' }, [
        el('span', { style: 'font-size:19px;line-height:1.3' }, [icon]),
        el('span', { class: 'grow' }, text),
      ]);

    const points = el('div', {}, [
      ...(fromSummer ? [point('🎁', [
        'As a SummerStreak family, ', el('strong', {}, [many ? 'each kid gets a second track free' : 'your kid gets a second track free']),
        '. Back to School and Math Facts are good fall picks.',
      ])] : []),
      point('📱', [
        'This lives on ', el('strong', {}, ['this phone']),
        `. Hand it to ${name} when it's their turn.`,
      ]),
      point('☁️', [
        // syncEnabled only means Firebase is configured; a parent who skipped
        // or failed sign-in has no account to sync to. Promising sync here
        // would be a claim the code cannot keep.
        store.syncEnabled && store.user
          ? 'Their progress syncs to your account, so a new phone can pick up where they left off.'
          : "Their progress is saved on this device. Sign in later and it'll sync to your account.",
      ]),
      point('🔒', [
        'A parent PIN keeps them out of the screens where plans and progress live.',
      ]),
    ]);

    const go = el('button', { class: 'btn', type: 'button' }, ['Set a parent PIN']);
    on(go, 'click', () => { if (onSetPin) onSetPin(); else done(); });

    const later = el('button', { class: 'btn btn--link', type: 'button' },
      [`Not now — start with ${name}`]);
    on(later, 'click', done);

    screen([
      dots(),
      el('div', { class: 'eyebrow' }, [`Step ${TOTAL} of ${TOTAL}`]),
      el('h2', {}, [`${name} ${many ? 'are' : 'is'} all set`]),
      el('p', {}, ['One thing before you go.']),
      points,
      // The PIN is optional. Skipping it is a supported path, not a lesser one.
      ...(onSetPin ? [go] : []),
      later,
    ]);
  }

  step1();
  // Already signed in (adding a kid): check for SummerStreak kids straight away.
  if (store.user) {
    void store.findRestorableKids().then(async (saved) => {
      if (step !== 1) return;
      if (saved.length) { restoreStep(saved); return; }
      const kids = await store.findSummerKids();
      if (kids.length && step === 1) summerStep(kids);
    });
  }
}
