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
    homework: {
      '*': [
        'Start with the hardest assignment first.',
        'Set a timer for 10 minutes and just begin.',
        'Find a quiet spot and clear the table first.',
        'Have a snack first so your brain has fuel.',
        'Read the directions out loud before you begin.',
        'List everything you have to do, then cross things off.',
        'Get your pencil, eraser and paper ready before you sit down.',
        'Do the first problem with a grown-up, then try the rest alone.',
        'Put screens away until your homework is started.',
        'Break a big assignment into three small steps.',
        "Circle any words in the directions you don't know, and ask.",
        'Sit in the same spot every day so it feels like homework time.',
        'Tell a grown-up what you have to do tonight before you start.',
        'Stuck? Skip it, finish the rest, then come back.',
      ],
    },
    practice: {
      '*': [
        'Practice spelling words, math facts or reading.',
        'Practice the thing your teacher said to work on.',
        'Read a book at your level for the whole 20 minutes.',
        'Write each spelling word three times.',
        'Do 10 minutes of reading and 10 of math facts.',
        'Use flash cards for math facts, then switch to reading.',
        'Practice your handwriting by copying a short poem.',
        'Spell your words out loud while a grown-up checks.',
        'Read a page out loud, then tell what it was about.',
        "Make up sentences using this week's spelling words.",
        'Practice counting money or telling time.',
        'Play a learning game with a grown-up, like a spelling bee.',
        'Write a short journal entry about your school day.',
        'Practice the subject you feel least sure about.',
      ],
      chess: [
        'Practice like a chess player: one thing at a time, slowly.',
        'Plan your 20 minutes before you start, like planning a move.',
        'Study one hard thing slowly, the way chess players study a position.',
        "When you finish, think of one thing you'd do differently next time.",
      ],
      sports: [
        'Practice like an athlete: warm up, drill, cool down.',
        'Practice in four 5-minute quarters with short breaks between.',
        'Keep score: one point for every word or fact you get right.',
        'Try to beat your score from yesterday.',
      ],
      gaming: [
        'Treat it like a level: 20 minutes to beat it.',
        'Earn 1 XP for every right answer — can you reach 20?',
        'Save the hardest problem for the end, like a boss battle.',
        'Every 5 minutes is a level; take a one-minute break between.',
      ],
      music: [
        'Practice spelling words to a beat.',
        'Sing your math facts to a tune you know.',
        'Clap the syllables of each spelling word.',
        'Practice with calm music playing quietly.',
      ],
      animals: [
        'Read out loud to a pet or stuffed animal.',
        'Read about an animal for your reading practice.',
        'Add three animal names to your spelling words.',
        "Pretend you're teaching your pet what you just learned.",
      ],
      dance: [
        'Do a 30-second dance break halfway through.',
        'Do one dance move for each spelling word you get right.',
        'Stand up and stretch every 5 minutes.',
        'Spell a word out loud with a move for each letter.',
      ],
      art: [
        'Make flash cards with a little drawing on each one.',
        'Draw a picture for each spelling word.',
        'Circle the tricky parts of words with colored pencils.',
        'Draw a quick sketch as a reward after every 5 minutes.',
      ],
      space: [
        'Count down from 10 before you start, like a launch.',
        'Each subject is a planet — visit two before you finish.',
        'Practice in 5-minute missions with a short break between.',
        'Draw a star next to each task you finish.',
      ],
      fantasy: [
        'Each task is a quest — finish three to save the kingdom.',
        'Turn spelling words into magic spells and say them out loud.',
        'Train like a knight: warm up, practice, then a final test.',
        'Earn a gem for every right answer and count your treasure.',
      ],
    },
    bag: {
      '*': [
        "Check tomorrow's schedule — gym clothes? Library book?",
        'Put signed papers back in the folder.',
        'Leave the bag by the door.',
        'Put your homework in its folder, then the folder in your bag.',
        'Fill your water bottle and set it by your bag.',
        'Look for notes from your teacher and give them to a grown-up.',
        'Make sure your lunch is ready, or ask a grown-up about it.',
        'Plug in anything for school that needs charging.',
        "Lay out tomorrow's clothes next to your bag.",
        'Clear old papers and wrappers out of your bag.',
        'Check you have a pencil and an eraser.',
        "Put a library book in your bag the night before it's due.",
        "Check tomorrow's weather — jacket? Umbrella?",
        'Zip every pocket so nothing falls out.',
      ],
    },
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
