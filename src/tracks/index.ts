/**
 * The track registry. Adding a track = adding a file and one line here.
 * Nothing else in the codebase should need to change.
 */
import type { TrackDefinition, TrackId } from '../core/types.js';
import { READING_SLIDE } from './reading-slide.js';
import { MATH_FACTS } from './math-facts.js';
import { MUSIC_PRACTICE } from './music-practice.js';
import { HOME_HELPER } from './home-helper.js';
import { BACK_TO_SCHOOL } from './back-to-school.js';
import { MINDFUL_KID } from './mindful-kid.js';

export const TRACKS: readonly TrackDefinition[] = [
  READING_SLIDE,
  MATH_FACTS,
  MUSIC_PRACTICE,
  BACK_TO_SCHOOL,
  HOME_HELPER,
  MINDFUL_KID,
];

const BY_ID = new Map(TRACKS.map((t) => [String(t.trackId), t]));

export function getTrack(id: TrackId | string): TrackDefinition {
  const t = BY_ID.get(String(id));
  if (!t) throw new Error(`unknown track "${id}"`);
  return t;
}

export function trackExists(id: string): boolean {
  return BY_ID.has(id);
}

export { READING_SLIDE, MATH_FACTS, MUSIC_PRACTICE, BACK_TO_SCHOOL, HOME_HELPER, MINDFUL_KID };
