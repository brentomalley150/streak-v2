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
    bed: {
      '*': [
        'Pull the sheet and blanket up to the pillow and smooth them flat.',
        'Fluff your pillow and put it back at the top.',
        'Make your bed before you leave your room.',
        'Line up your stuffed animals neatly on the bed.',
        'Race a timer: can you make your bed in under 2 minutes?',
        'Shake out the blanket so there are no lumps.',
        'Fold the top of the sheet over the blanket, like a hotel.',
        'Tuck the blanket in at the bottom of the bed.',
        'Put your pajamas under your pillow or in a drawer.',
        'Ask a grown-up to show you one bed-making trick.',
        "Check under the bed for anything that doesn't belong there.",
        'Open the curtains once your bed is made.',
        'Make your bed so neat a grown-up wants a picture.',
        "Help make someone else's bed too.",
      ],
    },
    tidy: {
      '*': [
        'Pick up 10 things that are out of place.',
        'Put all your shoes in pairs by the door.',
        'Clear off your desk or table top.',
        'Put dirty clothes in the hamper.',
        'Put books back on the shelf.',
        'Tidy one drawer — just one.',
        'Put every toy back in its bin or box.',
        'Pick up everything on your floor, then look again.',
        'Hang up your jacket and backpack.',
        'Tidy the spot where you play the most.',
        "Find three things you don't use and ask about giving them away.",
        'Put art supplies away with their caps on.',
        'Straighten the couch cushions and fold a blanket.',
        'Tidy for 5 minutes, then show a grown-up the before and after.',
      ],
      chess: [
        'Put everything back where it belongs, like setting up the board.',
        'Plan your moves: which corner will you clear first?',
        'Sort things into groups, like the pieces on each side.',
        'Clear the floor one square at a time.',
      ],
      sports: [
        'Basketball cleanup: shoot every sock into the hamper.',
        'Make it a relay: carry one thing at a time to where it goes.',
        "Count everything you put away — beat yesterday's score.",
        'Warm up with 10 quick pick-ups, then do the rest.',
      ],
      gaming: [
        'Speed-run your room: tidy it before a 5-minute timer ends.',
        'Every thing put away is a coin — collect 20.',
        'Save the biggest mess for last, like a boss battle.',
        'Unlock a bonus level by tidying under the bed.',
      ],
      music: [
        'Tidy up to two of your favorite songs.',
        'Tidy until one song ends — can you beat it?',
        'Make up a tidy-up song and sing it while you work.',
        'Every time the chorus comes, put away 3 things.',
      ],
      animals: [
        'Give every toy a home — like animals back in their dens.',
        'Be a squirrel: gather everything into the right piles.',
        'Tidy like a beaver building a neat home.',
        'Make your stuffed animals a tidy home on a shelf.',
      ],
      dance: [
        'Dance-clean: freeze when the music stops, then keep going.',
        'Do a dance move every time you put something away.',
        'Moonwalk each toy back to its bin.',
        'Dance-clean to one fast song, then one slow song.',
      ],
    },
    help: {
      '*': [
        'Set the table for dinner.',
        'Feed a pet or water a plant.',
        'Help carry in the groceries.',
        'Sort the laundry by color.',
        'Clear your plate and one other.',
        'Match up socks from the clean laundry.',
        'Put away the clean spoons and forks.',
        'Wipe the table after a meal with a damp cloth.',
        'Take out the recycling with a grown-up.',
        'Bring in the mail.',
        'Fold the towels from the laundry.',
        'Help a younger brother or sister get ready.',
        'Ask a grown-up "What can I help with?" and do it.',
        'Sweep the kitchen floor or the front step.',
      ],
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
