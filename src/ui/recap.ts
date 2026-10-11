/**
 * A SummerStreak kid's summer, on one page: the welcome-back card's totals
 * made into something a family can screenshot, share or print. Built only
 * from what SummerStreak synced (state.summer); the day-by-day log never
 * left the device v1 ran on, so the page doesn't pretend to know days.
 */
import type { Store } from '../core/store.js';
import { getTrack } from '../tracks/index.js';
import { LADDERS } from '../tracks/ladders.js';
import { el, clear, on } from './dom.js';

function rankPiece(rank: string): string {
  for (const rungs of Object.values(LADDERS)) {
    const r = rungs.find((x) => x.name === rank);
    if (r) return r.piece;
  }
  return '🏅';
}

export function renderSummerRecap(root: HTMLElement, store: Store, back: () => void): void {
  const s = store.state;
  const r = s?.summer;
  if (!s || !r) { back(); return; }

  clear(root);
  document.documentElement.dataset['surface'] = 'parent';
  const screen = el('div', { class: 'screen recap' });
  const name = s.playerName || 'Your kid';
  const seen = r.lastSeen ? new Date(r.lastSeen) : null;
  const year = seen ? seen.getFullYear() : new Date().getFullYear();

  const stat = (value: string, label: string) =>
    el('div', { class: 'recap-stat' }, [
      el('div', { class: 'recap-num' }, [value]),
      el('div', { class: 'recap-lbl' }, [label]),
    ]);
  const stats = el('div', { class: 'recap-stats' }, [
    stat(r.points.toLocaleString('en-US'), 'points'),
    ...(r.rank ? [stat(`${rankPiece(r.rank)} ${r.rank}`, 'rank reached')] : []),
    ...(r.booksFinished ? [stat(String(r.booksFinished), r.booksFinished === 1 ? 'book finished' : 'books finished')] : []),
    ...(r.totalMinutes ? [stat(r.totalMinutes.toLocaleString('en-US'), 'minutes read')] : []),
    ...(r.totalWords ? [stat(r.totalWords.toLocaleString('en-US'), 'words written')] : []),
  ]);

  const tracks = Object.keys(s.tracks).map((id) => getTrack(id));
  const print = el('button', { class: 'btn', type: 'button' }, ['Print or save as PDF']);
  on(print, 'click', () => window.print());
  const bk = el('button', { class: 'btn btn--link', type: 'button' }, ['← Back to the app']);
  on(bk, 'click', () => { document.documentElement.dataset['surface'] = 'kid'; back(); });

  screen.append(
    el('div', { class: 'eyebrow' }, [`SummerStreak · Summer ${year}`]),
    el('div', { class: 'recap-hero' }, [
      el('span', { class: 'recap-avatar', 'aria-hidden': 'true' }, [s.playerAvatar || '🙂']),
      el('h1', {}, [`${name}'s summer`]),
    ]),
    stats,
    el('p', {}, [
      tracks.length
        ? `Now on Beat the Slide: ${tracks.map((t) => `${t.icon} ${t.name}`).join(' · ')}.`
        : 'Now on Beat the Slide.',
      ...(seen ? [` Last active in SummerStreak on ${seen.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`] : []),
    ]),
    el('p', { class: 'muted' }, ['From SummerStreak’s summer totals. The day-by-day log stayed on the device SummerStreak ran on.']),
    el('div', { class: 'recap-actions' }, [print, bk]),
  );
  root.append(screen);
}
