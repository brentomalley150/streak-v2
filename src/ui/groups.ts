/**
 * Groups UI — create a challenge, share it, and join one (FR13–FR18).
 *
 * The creator screens are the PARENT surface; joining is too, because the
 * person consenting is a parent, not the kid.
 */
import type { Store } from '../core/store.js';
import type { Group } from '../core/groups.js';
import { joinLink, disclosureFor, groupLeaderboard } from '../core/groups.js';
import { getTrack, TRACKS } from '../tracks/index.js';
import { el, clear, on } from './dom.js';

function toast(msg: string): void {
  document.querySelector('.toast')?.remove();
  const t = el('div', { class: 'toast', role: 'status' }, [msg]);
  document.body.append(t);
  setTimeout(() => t.remove(), 2400);
}

/** Create a challenge, then show the link to share. */
export function renderCreateGroup(root: HTMLElement, store: Store, back: () => void): void {
  clear(root);
  document.documentElement.dataset['surface'] = 'parent';
  const screen = el('div', { class: 'screen' });

  const s = store.state;
  const enrolled = s ? Object.keys(s.tracks) : [];
  const name = el('input', { class: 'input', type: 'text', placeholder: "e.g. Ms. Rivera's drum crew", maxlength: '40' }) as HTMLInputElement;

  let trackId = enrolled[0] ?? String(TRACKS[0]!.trackId);
  const picker = el('div', { class: 'menu' });
  const drawPicker = () => {
    clear(picker);
    for (const id of enrolled.length ? enrolled : TRACKS.map((t) => String(t.trackId))) {
      const d = getTrack(id);
      const b = el('button', { type: 'button', 'aria-current': String(id === trackId) },
        [el('span', {}, [d.icon]), el('span', {}, [d.name])]);
      on(b, 'click', () => { trackId = id; drawPicker(); });
      picker.append(b);
    }
  };
  drawPicker();

  const err = el('p', { class: 'muted', style: 'margin:0 0 var(--s-2);min-height:1.2em' }, ['']);
  const create = el('button', { class: 'btn', type: 'button' }, ['Create & get the link']);

  /**
   * A challenge needs an owner, so this is unusable signed out. Say so up front
   * and offer the sign-in here — onboarding used to be the app's only sign-in,
   * so telling someone to "sign in first" pointed at nothing they could do.
   */
  const signedOutNotice = (): HTMLElement | null => {
    if (!store.syncEnabled) {
      return el('p', { class: 'muted' }, ['Creating a challenge needs an internet connection.']);
    }
    if (store.user) return null;
    const wrap = el('div', { class: 'mod' }, [
      el('div', { class: 'head' }, ['Sign in to continue']),
      el('p', { style: 'margin:0 0 var(--s-2)' }, ['A challenge belongs to your account, so other families know who invited them.']),
    ]);
    const go = el('button', { class: 'btn', type: 'button' }, ['Sign in with Google']);
    on(go, 'click', () => {
      go.disabled = true;
      go.textContent = 'Signing in…';
      void store.signIn()
        .then(() => renderCreateGroup(root, store, back))
        .catch(() => {
          go.disabled = false;
          go.textContent = 'Sign in with Google';
          err.textContent = "Couldn't sign in. Try again, or check your connection.";
        });
    });
    wrap.append(go);
    return wrap;
  };

  on(create, 'click', () => {
    if (!name.value.trim()) { err.textContent = 'Give it a name so kids know what they joined.'; return; }
    create.disabled = true;
    create.textContent = 'Creating…';
    void store.createGroup(name.value, trackId).then((g) => {
      if (!g) {
        create.disabled = false;
        create.textContent = 'Create & get the link';
        // A group has to belong to an account; say so rather than failing mutely.
        err.textContent = store.syncEnabled
          ? 'Sign in first — a challenge needs an account to belong to.'
          : 'Creating a challenge needs an internet connection.';
        return;
      }
      renderGroupCreated(root, store, g, back);
    });
  });

  const cancel = el('button', { class: 'btn btn--link', type: 'button' }, ['← Back']);
  on(cancel, 'click', () => { document.documentElement.dataset['surface'] = 'kid'; back(); });

  const blocked = signedOutNotice();

  screen.append(
    el('div', { class: 'eyebrow' }, ['For parents & teachers']),
    el('h2', {}, ['Start a challenge']),
    el('p', {}, ['Kids you invite share one leaderboard for this track. Nothing else is shared.']),
  );

  if (blocked) {
    // Don't make someone fill in a form that cannot succeed.
    screen.append(blocked, err, cancel);
  } else {
    screen.append(
      el('label', { class: 'field' }, [el('span', {}, ['Name it']), name]),
      el('label', { class: 'field' }, [el('span', {}, ['Which track'])]), picker,
      err, create, cancel,
    );
  }
  root.append(screen);
  if (!blocked) name.focus();
}

/** The share screen — the link is the whole point, so it dominates. */
export function renderGroupCreated(root: HTMLElement, _store: Store, g: Group, back: () => void): void {
  clear(root);
  document.documentElement.dataset['surface'] = 'parent';
  const screen = el('div', { class: 'screen' });
  const link = joinLink(g.id, location.origin, location.pathname);

  const box = el('div', { class: 'mod' }, [
    el('div', { class: 'head' }, ['Share this link']),
    el('div', { style: 'font-family:ui-monospace,monospace;font-size:var(--t-caption);word-break:break-all;margin-bottom:var(--s-2)' }, [link]),
  ]);

  const copy = el('button', { class: 'btn', type: 'button' }, ['Copy link']);
  on(copy, 'click', () => {
    void navigator.clipboard?.writeText(link)
      .then(() => toast('Link copied'))
      // Clipboard access can be denied; the link is on screen either way.
      .catch(() => toast('Copy it from above'));
  });

  const done = el('button', { class: 'btn btn--link', type: 'button' }, ['Done']);
  on(done, 'click', () => { document.documentElement.dataset['surface'] = 'kid'; back(); });

  screen.append(
    el('div', { class: 'eyebrow' }, ['Ready']),
    el('h2', {}, [`"${g.meta.name}" is live`]),
    el('p', {}, [`Send this to the other parents. They open it on their own phone and pick which kid joins.`]),
    box, copy,
    el('p', { class: 'muted' }, [`Code: ${g.id}`]),
    done,
  );
  root.append(screen);
}

/**
 * The join confirmation (FR14/FR15). Shows who is inviting and exactly what
 * joining discloses, BEFORE anything is written — and asks per kid.
 */
export function renderJoinGroup(
  root: HTMLElement, store: Store, code: string, done: () => void,
): void {
  clear(root);
  document.documentElement.dataset['surface'] = 'parent';
  const screen = el('div', { class: 'screen' });
  screen.append(el('p', { class: 'muted' }, ['Looking up that invite…']));
  root.append(screen);

  void store.loadGroup(code).then((g) => {
    clear(screen);

    if (!g) {
      // An unknown or expired code explains itself rather than dead-ending.
      screen.append(
        el('div', { class: 'eyebrow' }, ['Invite']),
        el('h2', {}, ["That link didn't work"]),
        el('p', {}, ['The code may be mistyped, or the challenge may have been removed. Ask whoever sent it for a fresh link.']),
      );
      const ok = el('button', { class: 'btn', type: 'button' }, ['Continue to the app']);
      on(ok, 'click', () => { document.documentElement.dataset['surface'] = 'kid'; done(); });
      screen.append(ok);
      return;
    }

    const def = getTrack(g.meta.trackId);
    const kids = store.all;

    const lines = el('ul', { class: 'evidence' });
    for (const d of disclosureFor(g, def.name)) lines.append(el('li', {}, [d]));

    screen.append(
      el('div', { class: 'eyebrow' }, ['Invite']),
      el('h2', {}, [`Join "${g.meta.name}"?`]),
      el('p', {}, [`${g.meta.ownerName} invited you to a ${def.name} challenge.`]),
      el('div', { class: 'mod' }, [el('div', { class: 'head' }, ['What joining shares']), lines]),
    );

    if (!store.user) {
      // Joining writes under this family's own key, so it needs their account.
      // Offer the sign-in here: onboarding is otherwise the app's only one, and
      // an invited parent arrives long after they finished it.
      screen.append(el('p', { class: 'muted' }, ['Sign in so this challenge is linked to your family.']));
      const go = el('button', { class: 'btn', type: 'button' }, ['Sign in with Google']);
      on(go, 'click', () => {
        go.disabled = true;
        go.textContent = 'Signing in…';
        void store.signIn()
          .then(() => renderJoinGroup(root, store, code, done))
          .catch(() => { go.disabled = false; go.textContent = 'Sign in with Google'; toast("Couldn't sign in"); });
      });
      screen.append(go);
    } else if (!kids.length) {
      screen.append(el('p', { class: 'muted' }, ['Set your kid up first, then open this link again.']));
    } else {
      screen.append(el('p', { class: 'muted' }, ['Choose who joins — one at a time, never everyone at once.']));
      const menu = el('div', { class: 'menu' });
      for (const p of kids) {
        const b = el('button', { type: 'button' }, [
          el('span', {}, [p.state.playerAvatar || '🙂']),
          el('span', {}, [p.state.playerName || 'Unnamed']),
          el('span', { class: 'meta' }, ['Join']),
        ]);
        on(b, 'click', () => {
          b.disabled = true;
          void store.joinGroup(g, p.id).then((ok) => {
            if (!ok) { b.disabled = false; toast("Couldn't join — try again"); return; }
            toast(`${p.state.playerName} joined`);
            document.documentElement.dataset['surface'] = 'kid';
            done();
          });
        });
        menu.append(b);
      }
      screen.append(menu);
    }

    const no = el('button', { class: 'btn btn--link', type: 'button' }, ['No thanks']);
    on(no, 'click', () => { document.documentElement.dataset['surface'] = 'kid'; done(); });
    screen.append(no);
  });
}

/** A creator's challenges, with each roster (FR19). */
export function renderMyGroups(root: HTMLElement, store: Store, back: () => void): void {
  clear(root);
  document.documentElement.dataset['surface'] = 'parent';
  const screen = el('div', { class: 'screen' });
  screen.append(el('div', { class: 'eyebrow' }, ['For parents & teachers']), el('h2', {}, ['Your challenges']));

  const body = el('div', {}, [el('p', { class: 'muted' }, ['—'])]);
  screen.append(body);

  const make = el('button', { class: 'btn btn--ghost', type: 'button' }, ['＋ Start a challenge']);
  on(make, 'click', () => renderCreateGroup(root, store, back));

  const bk = el('button', { class: 'btn btn--link', type: 'button' }, ['← Back to the app']);
  on(bk, 'click', () => { document.documentElement.dataset['surface'] = 'kid'; back(); });
  screen.append(make, bk);
  root.append(screen);

  void store.myGroups().then((groups) => {
    clear(body);
    if (!groups.length) {
      body.append(el('p', { class: 'muted' }, ["You haven't started one yet. Kids you invite share a leaderboard for one track."]));
      return;
    }
    for (const g of groups) {
      const def = getTrack(g.meta.trackId);
      const members = Object.entries(g.members ?? {});
      const mod = el('div', { class: 'mod' }, [
        el('div', { class: 'head' }, [`${def.icon} ${g.meta.name}`]),
      ]);
      if (!members.length) {
        mod.append(el('p', { class: 'muted', style: 'margin:0 0 var(--s-2)' }, ['Nobody has joined yet.']));
      } else {
        for (const [, m] of members) {
          mod.append(el('div', { class: 'kidrow' }, [
            el('span', { style: 'font-size:18px' }, [m.avatar]),
            el('span', { class: 'grow' }, [m.name]),
          ]));
        }
      }
      const share = el('button', { class: 'btn btn--ghost', type: 'button' }, ['Share the link']);
      on(share, 'click', () => renderGroupCreated(root, store, g, back));
      mod.append(share);
      body.append(mod);
    }
  });
}

export { groupLeaderboard };
