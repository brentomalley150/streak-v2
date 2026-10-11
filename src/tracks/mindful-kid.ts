/**
 * Mindful Kid — five calm minutes a day. A habit track with no outcome model.
 *
 * Privacy: the check-in is a tap only. It records THAT the kid checked in,
 * never how they feel — mood is not data this app stores.
 */
import type { TrackDefinition } from '../core/types.js';
import { asTrackId, asActivityId } from '../core/types.js';
import { ALL_THEME_IDS } from './ladders.js';

const CH = (week: number, emoji: string, name: string, short: string) =>
  ({ week, emoji, name, short, full: short });

export const MINDFUL_KID: TrackDefinition = {
  trackId: asTrackId('mindful-kid'),
  version: 1,
  name: 'Mindful Kid',
  description: 'Breathe, notice something good, and check in — five calm minutes.',
  icon: '🧘',
  recommendedAge: '5–11',
  dailyMinutes: 5,
  lengthWeeks: 12,
  ladder: 'animals',
  themes: ALL_THEME_IDS,
  weeklyBonusPoints: 5,
  activities: [
    { id: asActivityId('breathe'), label: 'Breathe', icon: '🌬️', points: 2, minutes: 3, fields: [] },
    { id: asActivityId('gratitude'), label: 'Something good', icon: '🌟', points: 2, minutes: 1, fields: [] },
    { id: asActivityId('checkin'), label: 'Check in', icon: '💭', points: 1, minutes: 1, fields: [] },
  ],
  statColumns: [
    { id: 'breatheDays', label: 'Calm days', from: 'count:breathe' },
  ],
  ideas: {
    breathe: {
      chess: ['Breathe in for 4, hold for 4 — like thinking before a move.'],
      sports: ['Breathe like an athlete before a free throw: slow in, slow out.'],
      gaming: ['Power-up breath: in for 4, out for 6, five times.'],
      music: ['Breathe in time with a slow song.'],
      animals: ['Bunny breaths: three quick sniffs in, one long breath out.'],
      dance: ['Stretch up tall as you breathe in, flop down as you breathe out.'],
      '*': ['Smell the flower, blow out the candle — five times.'],
    },
    gratitude: { '*': [
      'Say one thing that made you smile today.',
      'Think of someone who helped you and why.',
      'Name something you are looking forward to.',
    ] },
    checkin: { '*': [
      'Notice how your body feels from head to toe.',
      'Pick a word for your day — you don\'t have to tell anyone.',
      'Tell a grown-up about your day, if you want to.',
    ] },
  },
  weeklyChallenges: [
    CH(1, '🌬️', 'Breath Explorer', 'Try three different kinds of breathing this week.'),
    CH(2, '🚶', 'Quiet Walk', 'Take a 5-minute walk and notice 5 sounds.'),
    CH(3, '💌', 'Kind Note', 'Write a kind note to someone.'),
    CH(4, '🌳', 'Outside Time', 'Spend 10 minutes outside without a screen.'),
    CH(5, '🎨', 'Calm Colors', 'Draw or color for 10 quiet minutes.'),
    CH(6, '🤗', 'Helping Hand', 'Do something kind without being asked.'),
    CH(7, '📵', 'Screen Break', 'Pick one hour with no screens.'),
    CH(8, '👂', 'Good Listener', 'Ask someone about their day and really listen.'),
    CH(9, '🌙', 'Wind Down', 'Do a calm activity right before bed three nights.'),
    CH(10, '🧩', 'Focus Time', 'Do a puzzle or build something for 15 minutes.'),
    CH(11, '📝', 'Three Good Things', 'Write three good things from your week.'),
    CH(12, '🏆', 'Calm Champion', 'Teach a breathing trick to someone in your family.'),
  ],
  outcomeModel: null,
};
