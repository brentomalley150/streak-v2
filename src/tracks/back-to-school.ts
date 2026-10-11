/**
 * Back to School — the fall routine reset: homework started, practice done,
 * bag packed. A habit track with no test-score outcome.
 */
import type { TrackDefinition } from '../core/types.js';
import { asTrackId, asActivityId } from '../core/types.js';
import { ALL_THEME_IDS } from './ladders.js';

const CH = (week: number, emoji: string, name: string, short: string) =>
  ({ week, emoji, name, short, full: short });

export const BACK_TO_SCHOOL: TrackDefinition = {
  trackId: asTrackId('back-to-school'),
  version: 1,
  name: 'Back to School',
  description: 'Homework started, 20 minutes of practice, bag packed for tomorrow.',
  icon: '🎒',
  recommendedAge: '5–11',
  dailyMinutes: 30,
  lengthWeeks: 12,
  ladder: 'sports',
  themes: ALL_THEME_IDS,
  weeklyBonusPoints: 5,
  activities: [
    { id: asActivityId('homework'), label: 'Homework started', icon: '📝', points: 3, fields: [
      { id: 'subject', type: 'text', label: 'Subject', placeholder: 'Math, spelling…' },
    ] },
    { id: asActivityId('practice'), label: '20-min practice', icon: '⏱️', points: 2, minutes: 20, fields: [
      { id: 'minutes', type: 'number', label: 'Minutes', placeholder: '20' },
    ] },
    { id: asActivityId('bag'), label: 'Bag packed', icon: '🎒', points: 1, fields: [] },
  ],
  statColumns: [
    { id: 'homeworkDays', label: 'Homework days', from: 'count:homework' },
    { id: 'totalMinutes', label: 'Practice minutes', from: 'sum:minutes' },
  ],
  ideas: {
    homework: { '*': [
      'Start with the hardest assignment first.',
      'Set a timer for 10 minutes and just begin.',
      'Find a quiet spot and clear the table first.',
    ] },
    practice: {
      chess: ['Practice like a chess player: one thing at a time, slowly.'],
      sports: ['Practice like an athlete: warm up, drill, cool down.'],
      gaming: ['Treat it like a level: 20 minutes to beat it.'],
      music: ['Practice spelling words to a beat.'],
      animals: ['Read out loud to a pet or stuffed animal.'],
      dance: ['Do a 30-second dance break halfway through.'],
      '*': ['Practice spelling words, math facts or reading.'],
    },
    bag: { '*': [
      'Check tomorrow\'s schedule — gym clothes? Library book?',
      'Put signed papers back in the folder.',
      'Leave the bag by the door.',
    ] },
  },
  weeklyChallenges: [
    CH(1, '🗓️', 'Plan the Week', 'Write down every test and due date this week.'),
    CH(2, '🧹', 'Desk Reset', 'Clean out your backpack and desk.'),
    CH(3, '⏰', 'Early Bird', 'Be ready to leave 5 minutes early three days in a row.'),
    CH(4, '📚', 'Library Run', 'Check out a book for fun, not for school.'),
    CH(5, '🙋', 'Ask a Question', 'Ask your teacher one question in class.'),
    CH(6, '🥪', 'Lunch Packer', 'Pack your own lunch twice this week.'),
    CH(7, '✏️', 'Supply Check', 'Make a list of supplies you are running low on.'),
    CH(8, '🤝', 'Study Buddy', 'Study with a friend or family member once.'),
    CH(9, '🌙', 'Bedtime Champ', 'Lights out on time every school night.'),
    CH(10, '📈', 'Best Work', 'Redo one assignment to make it your best work.'),
    CH(11, '💡', 'Teach Back', 'Explain something you learned to a grown-up.'),
    CH(12, '🏆', 'Routine Pro', 'Do every part of the routine all week.'),
  ],
  outcomeModel: null,
};
