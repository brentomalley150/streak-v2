/**
 * Music Practice — the track with NO measurable outcome.
 * outcomeModel: null is the structural answer to PRD open question 7:
 * no projection panel renders, and nothing else in the engine changes.
 */
import type { TrackDefinition } from '../core/types.js';
import { asTrackId, asActivityId } from '../core/types.js';
import { ALL_THEME_IDS } from './ladders.js';

const CH = (week: number, emoji: string, name: string, short: string) =>
  ({ week, emoji, name, short, full: short });

export const MUSIC_PRACTICE: TrackDefinition = {
  trackId: asTrackId('music-practice'),
  version: 1,
  name: 'Music Practice',
  description: 'Practice, listen, and learn a piece — every day.',
  icon: '🎵',
  recommendedAge: '6–14',
  dailyMinutes: 25,
  lengthWeeks: 12,
  ladder: 'music',
  themes: ALL_THEME_IDS,
  weeklyBonusPoints: 5,
  activities: [
    { id: asActivityId('practice'), label: 'Practice', icon: '🎹', points: 3, minutes: 15, fields: [
      { id: 'minutes', type: 'number', label: 'Minutes', placeholder: '25' },
      { id: 'piece', type: 'text', label: 'Piece', placeholder: 'What did you play?' },
    ] },
    { id: asActivityId('listen'), label: 'Listen', icon: '🎧', points: 1, minutes: 5, fields: [] },
    { id: asActivityId('learn'), label: 'Learn', icon: '🎼', points: 3, minutes: 5, fields: [
      { id: 'newSkill', type: 'text', label: 'New bit', placeholder: 'Scale, chord, bar…' },
    ] },
  ],
  statColumns: [
    { id: 'totalMinutes', label: 'Minutes', from: 'sum:minutes' },
    { id: 'practiceDays', label: 'Days', from: 'count:practice' },
  ],
  ideas: {
    practice: { '*': [
      'Start with the hardest bar, not the easiest.',
      'Play it once slowly, once at full speed.',
      'Warm up with a scale before your piece.',
    ] },
    listen: {
      chess: ['Listen to calm music while you set up a chess puzzle.'],
      sports: ['Listen to a song a team plays at its stadium.'],
      gaming: ['Listen to the music from a video game you like.'],
      music: ['Listen to a recording of the piece you are learning.'],
      animals: ['Find a piece of music that sounds like an animal.'],
      dance: ['Listen to a song and count the beats out loud.'],
      '*': ['Listen to something new and say one thing you noticed.'],
    },
    learn: { '*': [
      'Learn one new bar today.',
      'Learn a new chord or note.',
      'Learn the name of a musical sign in your piece.',
    ] },
  },
  weeklyChallenges: [
    CH(1, '🎵', 'Warm Up', 'Play every day this week, even for five minutes.'),
    CH(2, '🎧', 'Listen Close', 'Listen to a piece you are learning, played by a pro.'),
    CH(3, '🐢', 'Slow It Down', 'Play your hardest bar at half speed, ten times.'),
    CH(4, '🎬', 'Record Yourself', 'Record one minute. Listen back. Note one thing.'),
    CH(5, '👥', 'Play for Someone', 'Perform one piece for a person, not a wall.'),
    CH(6, '🎼', 'Sight Read', 'Try something you have never played before.'),
    CH(7, '🥁', 'Keep Time', 'Practise with a metronome three days running.'),
    CH(8, '🎨', 'Make It Yours', 'Change the dynamics of a piece you know well.'),
    CH(9, '🔁', 'Memorise', 'Learn eight bars by heart.'),
    CH(10, '🎤', 'Duet', 'Play along with a recording or another person.'),
    CH(11, '✍️', 'Write One', 'Make up a four-bar tune of your own.'),
    CH(12, '🏆', 'Recital', 'Play your best piece for whoever will listen.'),
  ],
  outcomeModel: null,
};
