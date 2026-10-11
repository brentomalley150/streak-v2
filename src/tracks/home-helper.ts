/**
 * Home Helper — daily chores (FR30).
 *
 * Two things make this track different, and both are data, not engine code:
 *   - needsParentConfirm: chores happen off-screen, so a parent confirms each
 *     one before it scores. The kid's tap still keeps the streak alive.
 *   - customizableActivities: these are only the starting chores. A parent can
 *     replace the list and the points from the parent screens.
 */
import type { TrackDefinition } from '../core/types.js';
import { asTrackId, asActivityId } from '../core/types.js';
import { ALL_THEME_IDS } from './ladders.js';

const CH = (week: number, emoji: string, name: string, short: string) =>
  ({ week, emoji, name, short, full: short });

export const HOME_HELPER: TrackDefinition = {
  trackId: asTrackId('home-helper'),
  version: 1,
  name: 'Home Helper',
  description: 'Daily chores around the house — a grown-up checks them off.',
  icon: '🧹',
  recommendedAge: '5–11',
  dailyMinutes: 15,
  lengthWeeks: 12,
  ladder: 'animals',
  themes: ALL_THEME_IDS,
  weeklyBonusPoints: 5,
  customizableActivities: true,
  activities: [
    { id: asActivityId('bed'), label: 'Make the bed', icon: '🛏️', points: 2, needsParentConfirm: true, fields: [] },
    { id: asActivityId('tidy'), label: 'Tidy up', icon: '🧸', points: 2, needsParentConfirm: true, fields: [] },
    { id: asActivityId('help'), label: 'Help out', icon: '🍽️', points: 3, needsParentConfirm: true, fields: [] },
  ],
  statColumns: [
    { id: 'beds', label: 'Beds made', from: 'count:bed' },
    { id: 'helps', label: 'Times helped', from: 'count:help' },
  ],
  ideas: {
    help: { '*': [
      'Set the table for dinner.',
      'Feed a pet or water a plant.',
      'Help carry in the groceries.',
      'Sort the laundry by color.',
      'Clear your plate and one other.',
    ] },
    tidy: {
      gaming: ['Speed-run your room: tidy it before a 5-minute timer ends.'],
      sports: ['Basketball cleanup: shoot every sock into the hamper.'],
      animals: ['Give every toy a home — like animals back in their dens.'],
      music: ['Tidy up to two of your favorite songs.'],
      dance: ['Dance-clean: freeze when the music stops, then keep going.'],
      chess: ['Put everything back where it belongs, like setting up the board.'],
      '*': ['Pick up 10 things that are out of place.'],
    },
  },
  weeklyChallenges: [
    CH(1, '🧺', 'Laundry Helper', 'Fold and put away one load of laundry.'),
    CH(2, '🥗', 'Kitchen Crew', 'Help make one meal from start to finish.'),
    CH(3, '🚗', 'Car Check', 'Clean out the inside of the car.'),
    CH(4, '🌱', 'Green Thumb', 'Water the plants every day this week.'),
    CH(5, '🧽', 'Sparkle', 'Wipe down the bathroom sink and mirror.'),
    CH(6, '📦', 'Declutter', 'Fill a box with things to donate.'),
    CH(7, '🐾', 'Pet Pal', 'Take care of a pet — or help a neighbor with theirs.'),
    CH(8, '🍳', 'Breakfast Chef', 'Make breakfast for someone in your family.'),
    CH(9, '🍂', 'Outdoor Helper', 'Sweep, rake or weed for 15 minutes.'),
    CH(10, '🗂️', 'Drawer Reset', 'Organize one drawer or shelf.'),
    CH(11, '💌', 'Surprise Helper', 'Do one chore nobody asked you to do.'),
    CH(12, '🏆', 'Helper Hero', 'Pick the chore you are best at and teach it to someone.'),
  ],
  outcomeModel: null,
};
