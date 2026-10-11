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
      '*': [
        'Smell the flower, blow out the candle — five times.',
        'Balloon belly: hands on your tummy, fill it up, let it out slowly.',
        'Square breathing: in for 4, hold for 4, out for 4, hold for 4.',
        'Trace your hand: breathe in up each finger, out on the way down.',
        'Hot cocoa breath: smell the cocoa, then blow to cool it.',
        'Breathe in through your nose and out through your mouth, five times.',
        'Count ten slow breaths; if you lose count, start again.',
        'Lie down with a stuffed animal on your tummy and rock it with your breath.',
        'Make each breath out a little longer than the breath in.',
        'Big breath in, then a loud happy sigh — three times.',
        'Breathe in like smelling a cookie, out like blowing a bubble.',
        'Close your eyes and just listen to your breathing for a minute.',
        'Lift your shoulders as you breathe in, drop them as you breathe out.',
        'Blow out slowly to keep a pretend pinwheel spinning.',
      ],
      chess: [
        'Breathe in for 4, hold for 4 — like thinking before a move.',
        'Take three slow breaths before a big choice today.',
        'Sit as still as a king on its square for ten breaths.',
        'Breathe in for 4, out for 4, like two players taking turns.',
      ],
      sports: [
        'Breathe like an athlete before a free throw: slow in, slow out.',
        'Breathe like a runner cooling down: slow, slower, slowest.',
        'Raise your arms as you breathe in, like you scored; lower them as you breathe out.',
        'On a slow walk, breathe in for 3 steps and out for 3 steps.',
      ],
      gaming: [
        'Power-up breath: in for 4, out for 6, five times.',
        'Refill your health bar: each slow breath fills one heart. Fill five.',
        'Press pause: freeze and take three slow breaths.',
        'Level up: make each breath a little slower than the last.',
      ],
      music: [
        'Breathe in time with a slow song.',
        'Hum as you breathe out and feel the buzz.',
        'Breathe in for 4 beats and out for 4 beats.',
        'Breathe out like one long, quiet note on a flute.',
      ],
      animals: [
        'Bunny breaths: three quick sniffs in, one long breath out.',
        'Snake breath: breathe in, then hiss it out slowly.',
        'Lion breath: breathe in, then open wide and roar it out.',
        'Sleepy cat: curl up and breathe slowly like a cat napping.',
      ],
      dance: [
        'Stretch up tall as you breathe in, flop down as you breathe out.',
        'Sway side to side with each slow breath.',
        'Reach left as you breathe in, right as you breathe out.',
        'Float your arms up like a ballerina as you breathe in, down as you breathe out.',
      ],
      art: [
        'Draw a slow wave in the air: breathe in going up, out going down.',
        'Imagine a color filling you up as you breathe in, fading as you breathe out.',
        'Draw a slow spiral while you breathe out.',
        'Look at a picture and breathe slowly while you find five details.',
      ],
      space: [
        'Rocket breath: breathe in through the countdown, blast out at liftoff.',
        'Float like an astronaut: slow breath in, slower breath out.',
        'Breathe in while you picture a star, breathe out while it twinkles.',
        'Moon breath: in for 4, out for 4, as slow as the moon moves.',
      ],
      fantasy: [
        'Dragon breath: breathe in slowly, then breathe out fire, long and slow.',
        'Wizard breath: breathe in the magic for 4, hold, breathe it out for 6.',
        'Breathe slowly like a sleeping dragon guarding its gold.',
        'Stand tall like a castle tower and take five slow breaths.',
      ],
    },
    gratitude: {
      '*': [
        'Say one thing that made you smile today.',
        'Think of someone who helped you and why.',
        'Name something you are looking forward to.',
        "Think of something you can do now that you couldn't last year.",
        "Name a food you're glad you ate today.",
        'Think of a place where you feel safe and cozy.',
        'Notice one nice thing outside — a tree, the sky, a bird.',
        'Think of a friend and one thing you like about them.',
        'Say thank you to someone at home, just because.',
        'Name something you own that you really like using.',
        'Remember a time today you laughed.',
        'Think of something your body did for you today — run, jump, hug.',
        'Name a sound you love hearing.',
        'Think of one good thing about yourself.',
      ],
    },
    checkin: {
      '*': [
        'Notice how your body feels from head to toe.',
        "Pick a word for your day — you don't have to tell anyone.",
        'Tell a grown-up about your day, if you want to.',
        'Pick a weather for how you feel: sunny, cloudy, stormy? Just for you.',
        'Notice if any part of you feels tight, and let it soften.',
        'Ask yourself: am I hungry, thirsty, or tired?',
        "Pick a color for your day — you don't have to tell anyone.",
        'Put a hand on your heart and feel it beat.',
        'Notice one feeling, then tell yourself "that\'s okay."',
        'Ask yourself: what would help me feel a little better right now?',
        'Is your energy like a full battery or an empty one?',
        'Wiggle your toes and notice how they feel.',
        "If something's bothering you, think of a grown-up you could tell.",
        'Give yourself a hug and notice how it feels.',
      ],
    },
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
