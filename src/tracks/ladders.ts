/**
 * Rank ladders — one per theme (FR23). The kid picks the theme; the ladder
 * follows it. The engine never picks.
 *
 * Every ladder shares the SAME seven thresholds — v1's chess thresholds,
 * unchanged — so:
 *   - a migrated v1 kid keeps exactly the rank level they had, and
 *   - switching theme renames the rank but never moves the kid up or down.
 */
import type { Rank, TrackDefinition, TrackState } from '../core/types.js';

/** v1's chess thresholds. Changing these changes every kid's rank. */
export const RANK_THRESHOLDS = [0, 20, 50, 90, 140, 200, 270] as const;

type Rung = readonly [name: string, piece: string, motto: string];

function ladder(rungs: readonly Rung[]): readonly Rank[] {
  if (rungs.length !== RANK_THRESHOLDS.length) {
    throw new Error('every ladder needs one rung per threshold');
  }
  return rungs.map(([name, piece, motto], i) => ({ name, piece, motto, min: RANK_THRESHOLDS[i]! }));
}

export const LADDERS: Record<string, readonly Rank[]> = {
  chess: ladder([
    ['Pawn', '♙', 'Just Starting'],
    ['Knight', '♘', 'On the Move'],
    ['Bishop', '♗', 'Smart Thinker'],
    ['Rook', '♖', 'Power Player'],
    ['Queen', '♕', 'Super Strong'],
    ['King', '♔', 'Champion'],
    ['Grandmaster', '👑', 'Legend'],
  ]),
  sports: ladder([
    ['Rookie', '🥉', 'Getting Started'],
    ['Starter', '🥈', 'In the Game'],
    ['All-Star', '🥇', 'Standing Out'],
    ['Captain', '🎽', 'Leading the Team'],
    ['MVP', '🏅', 'Most Valuable'],
    ['Champion', '🏆', 'Title Winner'],
    ['Hall of Famer', '🌟', 'Legend'],
  ]),
  gaming: ladder([
    ['Level 1', '⚡', 'Booting Up'],
    ['Level 2', '⚡', 'Warmed Up'],
    ['Level 3', '⚡', 'On a Run'],
    ['Level 4', '🔥', 'Unstoppable'],
    ['Boss', '👾', 'Boss Level'],
    ['Legend', '🏆', 'Legend'],
    ['Final Boss', '👑', 'Game Complete'],
  ]),
  music: ladder([
    ['Beginner', '🎵', 'First Notes'],
    ['Player', '🎶', 'Finding Rhythm'],
    ['Soloist', '🎼', 'Center Stage'],
    ['Bandleader', '🥁', 'Setting the Beat'],
    ['Virtuoso', '🎹', 'Serious Skill'],
    ['Headliner', '🎤', 'Top of the Bill'],
    ['Maestro', '🏆', 'Maestro'],
  ]),
  animals: ladder([
    ['Hatchling', '🐣', 'Just Hatched'],
    ['Cub', '🐻', 'Exploring'],
    ['Fox', '🦊', 'Quick Thinker'],
    ['Wolf', '🐺', 'Pack Leader'],
    ['Eagle', '🦅', 'Soaring'],
    ['Lion', '🦁', 'King of the Jungle'],
    ['Dragon', '🐉', 'Legend'],
  ]),
  dance: ladder([
    ['First Step', '👟', 'Just Starting'],
    ['Groover', '🕺', 'Finding the Beat'],
    ['Spinner', '💫', 'Turning Heads'],
    ['Soloist', '💃', 'In the Spotlight'],
    ['Lead Dancer', '⭐', 'Leading the Line'],
    ['Choreographer', '🎬', 'Making the Moves'],
    ['Dance Legend', '👑', 'Legend'],
  ]),
};

/** The six themes a kid can choose (FR23), in display order. */
export const THEMES: ReadonlyArray<{ id: string; label: string; icon: string }> = [
  { id: 'chess', label: 'Chess', icon: '♟️' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'gaming', label: 'Gaming', icon: '🎮' },
  { id: 'music', label: 'Music', icon: '🎸' },
  { id: 'animals', label: 'Animals', icon: '🦁' },
  { id: 'dance', label: 'Dance', icon: '💃' },
];

export const ALL_THEME_IDS: readonly string[] = THEMES.map((t) => t.id);

export function themeInfo(id: string): { id: string; label: string; icon: string } {
  return THEMES.find((t) => t.id === id) ?? { id, label: id.charAt(0).toUpperCase() + id.slice(1), icon: '⭐' };
}

/**
 * The ladder a kid climbs on a track: their chosen theme's, falling back to
 * the track's default for a theme with no ladder.
 */
export function ladderFor(def: TrackDefinition, state: TrackState | null | undefined): readonly Rank[] {
  return (state && LADDERS[state.theme]) ?? LADDERS[def.ladder] ?? LADDERS['chess']!;
}
