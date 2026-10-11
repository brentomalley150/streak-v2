/**
 * Math Facts — a NEW track, added without touching the engine.
 * Different activities, a different ladder, different stat columns.
 * If adding this file required an engine change, PRD Assumption 1 was wrong.
 */
import type { TrackDefinition } from '../core/types.js';
import { asTrackId, asActivityId } from '../core/types.js';
import { ALL_THEME_IDS } from './ladders.js';

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
  themes: ALL_THEME_IDS,
  weeklyBonusPoints: 5,
  activities: [
    { id: asActivityId('drill'), label: 'Drill', icon: '⚡', points: 3, minutes: 5, fields: [
      { id: 'factsCorrect', type: 'number', label: 'Facts correct', placeholder: '20' },
      { id: 'seconds', type: 'number', label: 'Seconds', placeholder: '60' },
    ] },
    { id: asActivityId('review'), label: 'Review', icon: '🔁', points: 2, minutes: 3, fields: [
      { id: 'tableReviewed', type: 'text', label: 'Table', placeholder: '7s' },
    ] },
    { id: asActivityId('challenge'), label: 'Challenge', icon: '🏁', points: 3, minutes: 2, fields: [] },
  ],
  statColumns: [
    { id: 'factsMastered', label: 'Facts', from: 'sum:factsCorrect' },
    { id: 'drillDays', label: 'Drill days', from: 'count:drill' },
  ],
  ideas: {
    drill: {
      '*': [
        'Race the clock: how many facts in one minute?',
        'Drill the table you find hardest first.',
        'Say each answer out loud as fast as you can.',
        'Drill one table forward, then backward.',
        'Drill the tricky three: 6 × 7, 6 × 8 and 7 × 8.',
        'Use flash cards and make a pile of the ones you miss.',
        'Drill your 9s with the finger trick.',
        'Skip-count by one table as fast as you can, up to 12 times.',
        'Have a grown-up call out facts while you answer.',
        'Drill a mixed set: one fact from every table.',
        "Try to beat yesterday's facts-in-a-minute.",
        'Drill your 3s, then your 6s — each 6 is double a 3.',
        'Drill your 4s by doubling your 2s.',
        'Do 20 facts with no timer, getting every one right.',
      ],
    },
    review: {
      '*': [
        'Pick one table and write it out from memory.',
        'Find the three facts you missed most and repeat them.',
        'Quiz a grown-up on a table — then let them quiz you.',
        'Write the facts you missed today on a sticky note.',
        'Spot the pattern in your 5s: every answer ends in 5 or 0.',
        'Flip a fact: if 6 × 8 = 48, what is 8 × 6?',
        'Draw one tricky fact as rows of dots, then count them.',
        'Say the square numbers: 1, 4, 9, 16, 25… all the way to 144.',
        "Use a fact you know for one you don't: 5 × 7 = 35, so 6 × 7 is 7 more.",
        'Cover one row of a times-table chart and say it from memory.',
        "Ask yourself yesterday's three hardest facts.",
        'Spot the pattern in your 11s, from 11 × 1 to 11 × 9.',
        'Say one table out loud in your silliest voice.',
        'Teach a grown-up a fact you just got right.',
      ],
    },
    challenge: {
      '*': [
        'Make up a word problem for a grown-up to solve.',
        'Eggs come in boxes of 12. How many eggs in 4 boxes?',
        'A week has 7 days. How many days in 8 weeks?',
        'Cookies sit on a tray in 4 rows of 6. How many cookies?',
        'Which is bigger: 7 × 8 or 9 × 6?',
        'Find the missing number: ? × 7 = 63.',
        'A bike has 2 wheels. How many wheels on 11 bikes?',
        'Pencils come in packs of 10. How many in 7 packs?',
        'A box holds 9 crayons. How many in 9 boxes?',
        'Find two different facts that both make 24.',
        "What's 12 × 12? Check it with 10 × 12 plus 2 × 12.",
        'Find something at home in rows and columns, and multiply them.',
        'Roll two dice, multiply, and do it three times.',
        'How many fingers on 6 people? Count both hands.',
      ],
      chess: [
        'Multiply the squares: a chessboard is 8 × 8. How many squares?',
        'Count the pieces on both sides, then multiply by your favorite number.',
        'Each player has 8 pawns. How many pawns do 6 players have?',
        'A rook moves 7 squares, 5 times. How many squares in all?',
        'A chess club has 9 tables, 2 players each. How many players?',
      ],
      sports: [
        'A team scores 7 points 6 times. What is the score?',
        'Work out your shots × points for a pretend game.',
        'A basketball player makes 8 three-pointers. How many points?',
        'A soccer team has 11 players. How many on 4 teams?',
        'You run 6 laps a day for 7 days. How many laps?',
      ],
      gaming: [
        'Each level has 9 coins. How many after 7 levels?',
        'Beat your best time on 10 mixed facts.',
        'Each life gives 3 hearts. How many hearts in 9 lives?',
        'A game has 12 worlds with 6 levels each. How many levels?',
        'You earn 8 gems a round for 7 rounds. How many gems?',
      ],
      music: [
        'A song has 4 beats a measure and 12 measures. How many beats?',
        'Clap a times table to a beat.',
        'A guitar has 6 strings. How many strings on 8 guitars?',
        'A piano has 12 notes in each octave. How many in 7 octaves?',
        'A choir stands in 5 rows of 9. How many singers?',
      ],
      animals: [
        'A spider has 8 legs. How many legs on 6 spiders?',
        'Count legs on 5 dogs and 3 birds.',
        'An octopus has 8 arms. How many arms on 7 octopuses?',
        'A cow has 4 legs. How many legs in a herd of 12?',
        'A starfish has 5 arms. How many arms on 9 starfish?',
      ],
      dance: [
        'A routine has 8 counts, done 6 times. How many counts?',
        'Do one dance move for every answer you get right.',
        'A dance team stands in 4 rows of 7. How many dancers?',
        'You clap 3 times on each of 11 moves. How many claps?',
        'A class meets twice a week for 12 weeks. How many classes?',
      ],
      art: [
        'A box has 8 crayons. How many crayons in 6 boxes?',
        'You draw 4 pictures a day for 7 days. How many pictures?',
        'A sticker sheet has 3 rows of 9. How many stickers?',
        'Each painting uses 5 colors. How many colors for 6 paintings?',
        'A gallery wall has 4 rows of 6 frames. How many frames?',
      ],
      space: [
        'A rocket has 3 stages. How many stages on 8 rockets?',
        'An astronaut does 9 experiments a day for 6 days. How many experiments?',
        'A space station has 7 arms with 4 solar panels each. How many panels?',
        'Mars has 2 moons. How many moons would 12 planets like Mars have?',
        'A star chart has 8 rows of 8 stars. How many stars?',
      ],
      fantasy: [
        'A dragon guards 9 chests with 7 gold coins each. How many coins?',
        'A wizard brews 6 potions a day for 4 days. How many potions?',
        'A castle has 4 towers with 8 windows each. How many windows?',
        'Each knight carries 3 swords. How many swords for 9 knights?',
        'A spell takes 5 magic words. How many words for 11 spells?',
      ],
    },
  },
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
