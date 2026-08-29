/**
 * Rank ladders. A track names one; the engine never picks.
 * The chess ladder is v1's, thresholds unchanged so migrated kids keep their rank.
 */
import type { Rank } from '../core/types.js';

export const LADDERS: Record<string, readonly Rank[]> = {
  chess: [
    { name: 'Pawn',        piece: '♙',  min: 0,   motto: 'Just Starting' },
    { name: 'Knight',      piece: '♘',  min: 20,  motto: 'On the Move' },
    { name: 'Bishop',      piece: '♗',  min: 50,  motto: 'Smart Thinker' },
    { name: 'Rook',        piece: '♖',  min: 90,  motto: 'Power Player' },
    { name: 'Queen',       piece: '♕',  min: 140, motto: 'Super Strong' },
    { name: 'King',        piece: '♔',  min: 200, motto: 'Champion' },
    { name: 'Grandmaster', piece: '👑', min: 270, motto: 'Legend' },
  ],
  gaming: [
    { name: 'Level 1', piece: '⚡', min: 0,   motto: 'Booting Up' },
    { name: 'Level 2', piece: '⚡', min: 20,  motto: 'Warmed Up' },
    { name: 'Level 3', piece: '⚡', min: 50,  motto: 'On a Run' },
    { name: 'Level 4', piece: '🔥', min: 90,  motto: 'Unstoppable' },
    { name: 'Boss',    piece: '👾', min: 140, motto: 'Boss Level' },
    { name: 'Legend',  piece: '🏆', min: 220, motto: 'Legend' },
  ],
  music: [
    { name: 'Beginner', piece: '🎵', min: 0,   motto: 'First Notes' },
    { name: 'Player',   piece: '🎶', min: 20,  motto: 'Finding Rhythm' },
    { name: 'Soloist',  piece: '🎼', min: 50,  motto: 'Centre Stage' },
    { name: 'Virtuoso', piece: '🎹', min: 90,  motto: 'Serious Skill' },
    { name: 'Maestro',  piece: '🏆', min: 160, motto: 'Maestro' },
  ],
  sports: [
    { name: 'Rookie',    piece: '🥉', min: 0,   motto: 'Getting Started' },
    { name: 'Starter',   piece: '🥈', min: 20,  motto: 'In the Game' },
    { name: 'All-Star',  piece: '🥇', min: 50,  motto: 'Standing Out' },
    { name: 'Captain',   piece: '🎽', min: 90,  motto: 'Leading' },
    { name: 'MVP',       piece: '🏆', min: 160, motto: 'MVP' },
  ],
};
