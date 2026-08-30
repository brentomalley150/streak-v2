/**
 * The parent's cross-kid dashboard (FR6 / US-3): every kid, every track, one
 * screen.
 *
 * LIGHT surface, like the digest — this is the adult-facing side.
 *
 * Local-first: the local profiles render immediately, since they need no
 * network, and the family rollup merges over them when it resolves. A parent
 * offline still sees their kids; they simply do not see a sibling's progress
 * from another phone.
 */
import type { Store } from '../core/store.js';
import type { RollupKidRow } from '../core/rollup.js';
import { buildFamilyRollup, relativeTime } from '../core/rollup.js';
import { el, clear, on } from './dom.js';

function trackRow(
  kid: RollupKidRow, t: RollupKidRow['tracks'][number], store: Store, open: () => void,
): HTMLElement {
  const when = relativeTime(t.lastSeen, Date.now());
  const meta = t.remoteOnly
    // Not on this device, so there is nothing here to open.
    ? `on another device${when ? ` · ${when}` : ''}`
    : when ?? 'on this device';

  const row = el('button', {
    class: 'kidrow', type: 'button',
    ...(t.remoteOnly ? { disabled: 'true' } : {}),
  }, [
    el('span', { style: 'font-size:18px' }, [t.icon]),
    el('span', { class: 'grow' }, [
      el('div', { style: 'font-weight:700' }, [t.trackName]),
      el('div', { class: 'muted', style: 'font-size:var(--t-caption)' }, [meta]),
    ]),
    el('span', { style: 'text-align:right' }, [
      el('div', { style: 'font-weight:800' }, [`${t.currentStreak}d`]),
      el('div', { class: 'muted', style: 'font-size:var(--t-caption)' }, [t.rank]),
    ]),
  ]);

  if (!t.remoteOnly) {
    // US-3: click a row to land in that kid + track.
    on(row, 'click', () => {
      store.switchProfile(kid.profileId);
      store.setActiveTrack(t.trackId);
      open();
    });
  }
  return row;
}

export function renderRollup(root: HTMLElement, store: Store, back: () => void): void {
  clear(root);
  document.documentElement.dataset['surface'] = 'parent';
  const screen = el('div', { class: 'screen' });

  screen.append(el('div', { class: 'eyebrow' }, ['Family']));
  screen.append(el('h2', {}, ['Everyone at a glance']));

  const body = el('div', {});
  screen.append(body);

  const draw = (kids: RollupKidRow[]) => {
    clear(body);
    for (const kid of kids) {
      const mod = el('div', { class: 'mod' });
      mod.append(el('div', { class: 'head' }, [`${kid.avatar} ${kid.name}`]));
      if (!kid.tracks.length) {
        // A kid with no track is a real state — say so rather than showing a
        // zero, which would read as "no activity".
        mod.append(el('p', { class: 'muted', style: 'margin:0' }, ['No track yet.']));
      } else {
        for (const t of kid.tracks) mod.append(trackRow(kid, t, store, back));
      }
      body.append(mod);
    }
  };

  // Local first — no spinner on a screen that is mostly local data.
  draw(buildFamilyRollup(store.all, {}));

  if (store.syncEnabled && store.user) {
    void store.loadRollup().then((remote) => {
      // The parent may have navigated away before this resolved.
      if (document.documentElement.dataset['surface'] !== 'parent') return;
      draw(buildFamilyRollup(store.all, remote));
    });
  }

  const bk = el('button', { class: 'btn btn--link', type: 'button' }, ['← Back to the app']);
  on(bk, 'click', () => { document.documentElement.dataset['surface'] = 'kid'; back(); });
  screen.append(bk);

  root.append(screen);
}
