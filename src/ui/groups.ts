/**
 * Groups UI — create a challenge, share it, and join one (FR13–FR18), with a
 * start date and length (FR29) and classroom-vs-classroom teams (FR31).
 *
 * The creator screens are the PARENT surface; joining is too, because the
 * person consenting is a parent, not the kid.
 */
import type { Store } from '../core/store.js';
import type { Group } from '../core/groups.js';
import {
  joinLink, disclosureFor, groupLeaderboard, groupWindow, memberBoard, teamBoard,
  teamsOwnedBy, isOwner, LENGTH_CHOICES, DEFAULT_LENGTH_WEEKS,
} from '../core/groups.js';
import { challengeWindow, todayKey } from '../core/engine.js';
import { asDateKey } from '../core/types.js';
import { getTrack, TRACKS } from '../tracks/index.js';
import { el, clear, on } from './dom.js';

function toast(msg: string): void {
  document.querySelector('.toast')?.remove();
  const t = el('div', { class: 'toast', role: 'status' }, [msg]);
  document.body.append(t);
  setTimeout(() => t.remove(), 2400);
}

/** "Oct 13 – Nov 9 · 4 weeks", plus where today sits in it. */
function windowText(g: Group): string {
  const { startDate, lengthWeeks } = groupWindow(g);
  const w = challengeWindow(asDateKey(startDate), lengthWeeks, todayKey());
  const fmt = (k: string) => {
    const [y, m, d] = k.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const span = `${fmt(startDate)} – ${fmt(w.endDate)} · ${lengthWeeks} week${lengthWeeks === 1 ? '' : 's'}`;
  const phase = w.phase === 'upcoming' ? 'starts soon' : w.phase === 'ended' ? 'finished' : `day ${w.day} of ${w.totalDays}`;
  return `${span} · ${phase}`;
}

function copyButton(label: string, link: string): HTMLElement {
  const b = el('button', { class: 'btn', type: 'button' }, [label]);
  on(b, 'click', () => {
    void navigator.clipboard?.writeText(link)
      .then(() => toast('Link copied'))
      // Clipboard access can be denied; the link is on screen either way.
      .catch(() => toast('Copy it from above'));
  });
  return b;
}

function linkBox(head: string, link: string): HTMLElement {
  return el('div', { class: 'mod' }, [
    el('div', { class: 'head' }, [head]),
    el('div', { style: 'font-family:ui-monospace,monospace;font-size:var(--t-caption);word-break:break-all;margin-bottom:var(--s-2)' }, [link]),
    copyButton('Copy link', link),
  ]);
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

  // When and how long (FR29).
  const start = el('input', { class: 'input', type: 'date', value: todayKey() }) as HTMLInputElement;
  let weeks: number = DEFAULT_LENGTH_WEEKS;
  const lengths = el('div', { class: 'seg' });
  const drawLengths = () => {
    clear(lengths);
    for (const n of LENGTH_CHOICES) {
      const b = el('button', { type: 'button', 'aria-pressed': String(n === weeks) }, [`${n} wk`]);
      on(b, 'click', () => { weeks = n; drawLengths(); });
      lengths.append(b);
    }
  };
  drawLengths();

  // Kids compete, or classes do (FR31).
  let mode: 'kids' | 'teams' = 'kids';
  const team = el('input', { class: 'input', type: 'text', maxlength: '40', placeholder: 'e.g. Room 12' }) as HTMLInputElement;
  const teamField = el('label', { class: 'field' }, [el('span', {}, ['Your class or team name']), team]);
  const modes = el('div', { class: 'seg' });
  const drawModes = () => {
    clear(modes);
    for (const [m, label] of [['kids', 'Kids compete'], ['teams', 'Class vs. class']] as const) {
      const b = el('button', { type: 'button', 'aria-pressed': String(m === mode) }, [label]);
      on(b, 'click', () => { mode = m; drawModes(); });
      modes.append(b);
    }
    teamField.style.display = mode === 'teams' ? '' : 'none';
    modeHint.textContent = mode === 'teams'
      ? 'Each class is a team. Teams rank by average points per kid, so class size never decides the winner.'
      : 'Every kid you invite shares one leaderboard.';
  };
  const modeHint = el('p', { class: 'muted', style: 'margin:var(--s-1) 0 var(--s-3)' }, ['']);
  drawModes();

  const err = el('p', { class: 'muted', style: 'margin:0 0 var(--s-2);min-height:1.2em' }, ['']);
  const create = el('button', { class: 'btn', type: 'button' }, ['Create & get the link']);

  /**
   * A challenge needs an owner, so this is unusable signed out. Say so up front
   * and offer the sign-in here.
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start.value)) { err.textContent = 'Pick a start date.'; return; }
    if (mode === 'teams' && !team.value.trim()) { err.textContent = 'Name your class so other teachers can tell the teams apart.'; return; }
    create.disabled = true;
    create.textContent = 'Creating…';
    void store.createGroup(name.value, trackId, {
      startDate: start.value, lengthWeeks: weeks, mode, teamName: team.value,
    }).then((g) => {
      if (!g) {
        create.disabled = false;
        create.textContent = 'Create & get the link';
        err.textContent = store.syncEnabled
          ? "Couldn't create it. Check you're signed in and online, then try again."
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
    el('p', {}, ['Kids you invite compete on one track for a set time. Nothing else is shared.']),
  );

  if (blocked) {
    screen.append(blocked, err, cancel);
  } else {
    screen.append(
      el('label', { class: 'field' }, [el('span', {}, ['Name it']), name]),
      el('div', { class: 'field' }, [el('span', {}, ['Which track'])]), picker,
      el('label', { class: 'field', style: 'margin-top:var(--s-3)' }, [el('span', {}, ['Starts']), start]),
      el('div', { class: 'field' }, [el('span', {}, ['How long']), lengths]),
      el('div', { class: 'field' }, [el('span', {}, ['Who competes']), modes]),
      modeHint, teamField,
      err, create, cancel,
    );
  }
  root.append(screen);
  if (!blocked) name.focus();
}

/** The share screen — the link is the whole point, so it dominates. */
export function renderGroupCreated(root: HTMLElement, store: Store, g: Group, back: () => void): void {
  clear(root);
  document.documentElement.dataset['surface'] = 'parent';
  const screen = el('div', { class: 'screen' });
  const uid = store.user?.uid ?? null;

  screen.append(
    el('div', { class: 'eyebrow' }, ['Ready']),
    el('h2', {}, [`"${g.meta.name}" is live`]),
    el('p', { class: 'muted' }, [windowText(g)]),
  );

  if (g.meta.mode === 'teams') {
    // One link per team you run, for that class's parents; and one for other
    // teachers, which lets them add their own class.
    for (const tid of teamsOwnedBy(g, uid)) {
      const tm = g.teams![tid]!;
      screen.append(linkBox(`For ${tm.name} parents`, joinLink(g.id, location.origin, location.pathname, tid)));
    }
    screen.append(linkBox('For other teachers — they add their own class', joinLink(g.id, location.origin, location.pathname)));
    screen.append(el('p', { class: 'muted' }, ['Parents open the link on their own phone and pick which kid joins. Teachers can never add a student themselves.']));
  } else {
    screen.append(
      el('p', {}, ['Send this to the other parents. They open it on their own phone and pick which kid joins.']),
      linkBox('Share this link', joinLink(g.id, location.origin, location.pathname)),
    );
  }

  const done = el('button', { class: 'btn btn--link', type: 'button' }, ['Done']);
  on(done, 'click', () => { document.documentElement.dataset['surface'] = 'kid'; back(); });
  screen.append(el('p', { class: 'muted' }, [`Code: ${g.id}`]), done);
  root.append(screen);
}

/**
 * The join confirmation (FR14/FR15). Shows who is inviting and exactly what
 * joining discloses, BEFORE anything is written — and asks per kid. In a team
 * challenge the link names the team; without one, a teacher can add a class.
 */
export function renderJoinGroup(
  root: HTMLElement, store: Store, code: string, teamId: string | null, done: () => void,
): void {
  clear(root);
  document.documentElement.dataset['surface'] = 'parent';
  const screen = el('div', { class: 'screen' });
  screen.append(el('p', { class: 'muted' }, ['Looking up that invite…']));
  root.append(screen);
  const finish = () => { document.documentElement.dataset['surface'] = 'kid'; done(); };

  void store.loadGroup(code).then((g) => {
    clear(screen);

    if (!g) {
      screen.append(
        el('div', { class: 'eyebrow' }, ['Invite']),
        el('h2', {}, ["That link didn't work"]),
        el('p', {}, ['The code may be mistyped, or the challenge may have been removed. Ask whoever sent it for a fresh link.']),
      );
      const ok = el('button', { class: 'btn', type: 'button' }, ['Continue to the app']);
      on(ok, 'click', finish);
      screen.append(ok);
      return;
    }

    const def = getTrack(g.meta.trackId);
    const isTeams = g.meta.mode === 'teams';
    const team = teamId ? g.teams?.[teamId] : undefined;

    screen.append(
      el('div', { class: 'eyebrow' }, ['Invite']),
      el('h2', {}, [team ? `Join ${team.name} in "${g.meta.name}"?` : `Join "${g.meta.name}"?`]),
      el('p', {}, [`${g.meta.ownerName} invited you to a ${def.name} challenge${isTeams ? ' — class vs. class' : ''}.`]),
      el('p', { class: 'muted' }, [windowText(g)]),
    );

    if (!store.user) {
      screen.append(el('p', { class: 'muted' }, ['Sign in so this challenge is linked to your family.']));
      const go = el('button', { class: 'btn', type: 'button' }, ['Sign in with Google']);
      on(go, 'click', () => {
        go.disabled = true;
        go.textContent = 'Signing in…';
        void store.signIn()
          .then(() => renderJoinGroup(root, store, code, teamId, done))
          .catch(() => { go.disabled = false; go.textContent = 'Sign in with Google'; toast("Couldn't sign in"); });
      });
      screen.append(go);
    } else if (isTeams && !team) {
      // A team challenge reached without a team: a teacher adding their class.
      screen.append(el('div', { class: 'mod' }, [
        el('div', { class: 'head' }, ['Teams so far']),
        ...Object.values(g.teams ?? {}).map((tm) => el('div', { class: 'kidrow' }, [el('span', { class: 'grow' }, [tm.name])])),
      ]));
      screen.append(el('p', {}, ["Are you a teacher? Add your class as a team, then share your class's link with its parents. Parents: ask your teacher for your class's link."]));
      const tname = el('input', { class: 'input', type: 'text', maxlength: '40', placeholder: 'e.g. Room 14' }) as HTMLInputElement;
      const add = el('button', { class: 'btn', type: 'button' }, ['Add my class']);
      on(add, 'click', () => {
        if (!tname.value.trim()) { toast('Name your class first'); return; }
        add.disabled = true;
        void store.addTeam(g, tname.value).then((id) => {
          if (!id) { add.disabled = false; toast("Couldn't add your class — try again"); return; }
          renderGroupCreated(root, store, g, finish);
        });
      });
      screen.append(el('label', { class: 'field' }, [el('span', {}, ['Your class name']), tname]), add);
    } else {
      const lines = el('ul', { class: 'evidence' });
      for (const d of disclosureFor(g, def.name, team?.name)) lines.append(el('li', {}, [d]));
      screen.append(el('div', { class: 'mod' }, [el('div', { class: 'head' }, ['What joining shares']), lines]));

      const kids = store.all;
      if (!kids.length) {
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
            void store.joinGroup(g, p.id, team ? teamId! : undefined).then((ok) => {
              if (!ok) { b.disabled = false; toast("Couldn't join — try again"); return; }
              toast(`${p.state.playerName} joined`);
              finish();
            });
          });
          menu.append(b);
        }
        screen.append(menu);
      }
    }

    const no = el('button', { class: 'btn btn--link', type: 'button' }, ['No thanks']);
    on(no, 'click', finish);
    screen.append(no);
  });
}

/** A creator's challenges, with each roster (FR19) and standings. */
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

  const uid = store.user?.uid ?? null;
  void store.myGroups().then((groups) => {
    clear(body);
    if (!groups.length) {
      body.append(el('p', { class: 'muted' }, ["You haven't started one yet. Kids you invite compete on one track for a set time."]));
      return;
    }
    for (const g of groups) {
      const def = getTrack(g.meta.trackId);
      const mod = el('div', { class: 'mod' }, [
        el('div', { class: 'head' }, [`${def.icon} ${g.meta.name}`]),
        el('p', { class: 'muted', style: 'margin:0 0 var(--s-2)' }, [windowText(g)]),
      ]);
      const owner = isOwner(g, uid);
      const mineTeams = new Set(teamsOwnedBy(g, uid));

      if (g.meta.mode === 'teams') {
        const standings = teamBoard(g);
        if (!standings.length) mod.append(el('p', { class: 'muted' }, ['No teams yet.']));
        standings.forEach((tm, i) => {
          const row = el('div', { class: 'kidrow' }, [
            el('span', { class: 'muted', style: 'width:18px' }, [String(i + 1)]),
            el('span', { class: 'grow' }, [`${tm.name}${mineTeams.has(tm.teamId) ? ' (yours)' : ''}`]),
            el('span', { class: 'muted' }, [`${tm.members} kid${tm.members === 1 ? '' : 's'} · avg ${Math.round(tm.average)}`]),
          ]);
          // The owner can remove a team someone else added (a mistake, or worse).
          if (owner && !mineTeams.has(tm.teamId)) {
            const rm = el('button', { class: 'btn btn--link btn--small', type: 'button', 'aria-label': `Remove ${tm.name}` }, ['Remove']);
            on(rm, 'click', () => {
              rm.disabled = true;
              void store.removeTeam(g, tm.teamId).then((ok) => {
                if (ok) { toast(`${tm.name} removed`); renderMyGroups(root, store, back); }
                else { rm.disabled = false; toast("Couldn't remove it — try again"); }
              });
            });
            row.append(rm);
          }
          mod.append(row);
        });
        // A teacher sees the roster of their own team only, unless they run the challenge.
        const visible = memberBoard(g).filter((m) => owner || (m.team !== undefined && mineTeams.has(m.team)));
        if (visible.length) {
          mod.append(el('div', { class: 'head', style: 'margin-top:var(--s-3)' }, [owner ? 'All kids' : 'Your class']));
          for (const m of visible) {
            mod.append(el('div', { class: 'kidrow' }, [
              el('span', { style: 'font-size:18px' }, [m.avatar]),
              el('span', { class: 'grow' }, [m.name]),
              el('span', { style: 'font-weight:800' }, [String(m.points ?? 0)]),
            ]));
          }
        }
      } else {
        const members = memberBoard(g);
        if (!members.length) {
          mod.append(el('p', { class: 'muted', style: 'margin:0 0 var(--s-2)' }, ['Nobody has joined yet.']));
        } else {
          for (const m of members) {
            mod.append(el('div', { class: 'kidrow' }, [
              el('span', { style: 'font-size:18px' }, [m.avatar]),
              el('span', { class: 'grow' }, [m.name]),
              el('span', { style: 'font-weight:800' }, [String(m.points ?? 0)]),
            ]));
          }
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
