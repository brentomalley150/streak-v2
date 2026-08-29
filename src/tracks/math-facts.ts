/**
 * Math Facts — a NEW track, added without touching the engine.
 * Different activities, a different ladder, different stat columns.
 * If adding this file required an engine change, PRD Assumption 1 was wrong.
 */
import type { TrackDefinition } from '../core/types.js';
import { asTrackId, asActivityId } from '../core/types.js';

const CH = (week: number, emoji: string, name: string, short: string) =>
  ({ week, emoji, name, short, full: short });

export const MATH_FACTS: TrackDefinition = {
  trackId: asTrackId('math-facts'),
  version: 1,
  name: 'Math Facts',
  description: 'Times-table fluency, five minutes a day.',
  icon: '🔢',
  recommendedAge: '7–11',
  dailyMinutes: 10,
  lengthWeeks: 12,
  ladder: 'gaming',
  themes: ['gaming', 'sports', 'chess'],
  activities: [
    { id: asActivityId('drill'), label: 'Drill', icon: '⚡', points: 3, fields: [
      { id: 'factsCorrect', type: 'number', label: 'Facts correct', placeholder: '20' },
      { id: 'seconds', type: 'number', label: 'Seconds', placeholder: '60' },
    ] },
    { id: asActivityId('review'), label: 'Review', icon: '🔁', points: 2, fields: [
      { id: 'tableReviewed', type: 'text', label: 'Table', placeholder: '7s' },
    ] },
    { id: asActivityId('challenge'), label: 'Challenge', icon: '🏁', points: 3, fields: [] },
  ],
  statColumns: [
    { id: 'factsMastered', label: 'Facts', from: 'sum:factsCorrect' },
    { id: 'drillDays', label: 'Drill days', from: 'count:drill' },
  ],
  weeklyChallenges: [
    CH(1, '🎯', 'Twos and Fives', 'Master your 2s and 5s — beat your own time twice.'),
    CH(2, '🔟', 'Power of Ten', 'Nail the 10s, then try 9s using the finger trick.'),
    CH(3, '🎲', 'Dice Duel', 'Roll two dice, multiply, race a grown-up. Best of 10.'),
    CH(4, '🃏', 'Card Flip', 'Flip two cards, multiply. Get 20 right in a row.'),
    CH(5, '🏃', 'Beat the Clock', 'Do 20 facts in under 90 seconds.'),
    CH(6, '🧩', 'Missing Number', 'Solve 10 problems where the answer is given.'),
    CH(7, '🍕', 'Real World', 'Find 5 places multiplication shows up at home.'),
    CH(8, '👨‍🏫', 'Teach It', 'Teach one times table to someone else.'),
    CH(9, '📈', 'Personal Best', 'Beat your fastest time from any previous week.'),
    CH(10, '🔀', 'Mixed Up', 'All tables at once — 25 problems, any speed.'),
    CH(11, '🎪', 'Trick Shot', 'Learn one multiplication trick and show it off.'),
    CH(12, '🏆', 'Final Round', 'Full times-table run. However long it takes.'),
  ],
  outcomeModel: {
    baselineFields: [
      { id: 'factsPerMinute', type: 'number', label: 'Facts per minute', placeholder: '12' },
    ],
    projection: 'math-v1',
  },
};
