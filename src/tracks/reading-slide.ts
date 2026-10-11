/**
 * Reading Slide — v1's track, ported, then reshaped to the PRD routine:
 * 15 min read + 10 min write + 5 min wrap-up. This is the only file that
 * changes when Reading Slide changes; the engine stays untouched.
 *
 * Math moved to its own track (Math Facts). Its old activity is listed under
 * retiredActivities so every point a family earned with it still counts.
 *
 * Challenge copy and chess thresholds are v1's real content, so a migrated
 * family sees the same weekly bonuses and keeps the same rank.
 */
import type { TrackDefinition } from '../core/types.js';
import { asTrackId, asActivityId } from '../core/types.js';
import { ALL_THEME_IDS } from './ladders.js';

export const READING_SLIDE: TrackDefinition = {
  trackId: asTrackId('reading-slide'),
  version: 2,
  name: 'Reading Slide',
  description: 'Read 15, write 10, wrap up 5 — every day.',
  icon: '📚',
  recommendedAge: '5–11',
  dailyMinutes: 30,
  lengthWeeks: 12,
  ladder: 'chess',
  themes: ALL_THEME_IDS,
  weeklyBonusPoints: 5,
  activities: [
    { id: asActivityId('read'), label: 'Read', icon: '📖', points: 3, minutes: 15, fields: [
      { id: 'minutes', type: 'number', label: 'Minutes', placeholder: '15' },
      { id: 'book', type: 'text', label: 'Book', placeholder: 'What are you reading?' },
    ] },
    { id: asActivityId('write'), label: 'Write', icon: '✏️', points: 3, minutes: 10, fields: [
      { id: 'writingTopic', type: 'text', label: 'About', placeholder: 'What did you write about?' },
      { id: 'words', type: 'number', label: 'Words', placeholder: '40' },
    ] },
    { id: asActivityId('closeout'), label: 'Wrap-up', icon: '🌙', points: 1, minutes: 5, fields: [] },
  ],
  // Math became its own track. Kept here so history keeps its points.
  retiredActivities: [
    { id: asActivityId('math'), label: 'Math', icon: '🔢', points: 2, fields: [] },
  ],
  statColumns: [
    { id: 'totalMinutes', label: 'Minutes', from: 'sum:minutes' },
    { id: 'totalWords', label: 'Words', from: 'sum:words' },
    { id: 'daysRead', label: 'Days read', from: 'count:read' },
  ],
  ideas: {
    read: {
      chess: [
        'Read a mystery — can you solve it a few moves ahead?',
        'Find a book with a clever hero who outsmarts everyone.',
        'Read about a game, puzzle or strategy you like.',
      ],
      sports: [
        'Read a sports story or a book about an athlete.',
        'Read a sports article in a magazine or newspaper.',
        'Find a book where a team has to come back from behind.',
      ],
      gaming: [
        'Read a book that would make a great video game.',
        'Read a choose-your-own-adventure book.',
        'Read a graphic novel with an epic quest.',
      ],
      music: [
        'Read song lyrics out loud like a poem.',
        'Read about a musician or band you like.',
        'Find a book about kids who start a band.',
      ],
      animals: [
        'Read a true book about an animal you love.',
        'Read a story told by an animal.',
        'Find a book set in the wild — jungle, ocean or forest.',
      ],
      dance: [
        'Read a story about a dancer or performer.',
        'Read about where a dance style came from.',
        'Find a book where someone has to perform on stage.',
      ],
    },
    write: {
      chess: [
        'Write about your best chess move ever — what made it smart?',
        'Invent a new chess piece. How does it move?',
        'Write a story where a pawn becomes a queen.',
      ],
      sports: [
        'Write a sports report about a game you watched or played.',
        'Pick your dream team and say why each player made it.',
        'Write a pep talk for your team before the big game.',
      ],
      gaming: [
        'Design a new game level — describe what players see.',
        'Write the instructions for a game you invent.',
        'Write a story where a game character ends up in the real world.',
      ],
      music: [
        'Write new words to a song you know.',
        'Describe how your favorite song makes you feel.',
        "Write a story about a band's first concert.",
      ],
      animals: [
        'Write a day in the life of your pet or favorite animal.',
        'Invent a new animal — what does it eat, and where does it live?',
        'Write a letter from a zoo animal to its keeper.',
      ],
      dance: [
        'Describe a dance move step by step so someone could learn it.',
        "Write about the dance you'd do at a talent show.",
        'Write a story about a dancer who is nervous before the big show.',
      ],
    },
    closeout: {
      '*': [
        "Tell someone your favorite part of today's reading.",
        "Give today's book a rating from 1 to 5 stars.",
        "Pick tomorrow's book and put it by your bed.",
        'Read your writing out loud to someone.',
      ],
    },
  },
  weeklyChallenges: [
  { week: 1, emoji: '🏰', name: 'Reading Fort',
    short: 'Build a reading fort and read inside for 15+ minutes.',
    full: 'Build a reading fort and read inside for 15+ minutes.' },
  { week: 2, emoji: '🗺️', name: 'Story Architect',
    short: 'Draw a story map for a book you read this week.',
    full: 'Draw a story map for a book you read this week.' },
  { week: 3, emoji: '🎤', name: 'Read Aloud Star',
    short: 'Read a book out loud to a sibling, pet, or stuffed animal — 5+ pages.',
    full: 'Read a book out loud to a sibling, pet, or stuffed animal — 5+ pages.' },
  { week: 4, emoji: '✏️', name: 'Comic Book Creator',
    short: 'Turn a scene from a book into a 4-panel comic strip.',
    full: 'Turn a scene from a book into a 4-panel comic strip.' },
  { week: 5, emoji: '🕵️', name: 'Word Detective',
    short: 'Find 8+ words an author used instead of "said."',
    full: 'Find 8+ words an author used instead of "said."' },
  { week: 6, emoji: '⭐', name: 'Book Critic',
    short: 'Give a book a star rating (1-5) and write 3 sentences why.',
    full: 'Give a book a star rating (1-5) and write 3 sentences why.' },
  { week: 7, emoji: '🔖', name: 'Bookmark Maker',
    short: 'Design and make your own bookmark for a book you\'re reading.',
    full: 'Design and make your own bookmark for a book you\'re reading.' },
  { week: 8, emoji: '🎨', name: 'Character Designer',
    short: 'Invent a new character who could join one of your books.',
    full: 'Invent a new character who could join one of your books.' },
  { week: 9, emoji: '🎬', name: 'Book Trailer',
    short: 'Write the first 30 seconds of a movie trailer for a book.',
    full: 'Write the first 30 seconds of a movie trailer for a book.' },
  { week: 10, emoji: '📖', name: 'First Line Hunt',
    short: 'Read the first sentence of 5 different books. Pick your favorite.',
    full: 'Read the first sentence of 5 different books. Pick your favorite.' },
  { week: 11, emoji: '🏃', name: 'Chapter Champion',
    short: 'Read TWO full chapters in one sitting without stopping.',
    full: 'Read TWO full chapters in one sitting without stopping.' },
  { week: 12, emoji: '🏆', name: 'Challenge Wrap-Up',
    short: 'Pick your top 3 books from this challenge and explain why.',
    full: 'Pick your top 3 books from this challenge and explain why.' },
  ],
  outcomeModel: {
    // Every field is optional. CMAS subscores are the percent of points earned,
    // as they appear on the family's score report.
    baselineFields: [
      { id: 'grade', type: 'number', label: 'Grade this spring (0 for K)', placeholder: '4' },
      { id: 'mapRit', type: 'number', label: 'MAP Reading RIT', placeholder: '185' },
      { id: 'lexile', type: 'number', label: 'Lexile', placeholder: '375' },
      { id: 'cmasReadingLit', type: 'number', label: 'CMAS Reading Literature %', placeholder: '40' },
      { id: 'cmasReadingInfo', type: 'number', label: 'CMAS Reading Informational Text %', placeholder: '40' },
      { id: 'cmasVocab', type: 'number', label: 'CMAS Vocabulary %', placeholder: '80' },
      // Kept as v1's field id, so a migrated family's score carries over.
      { id: 'writtenExpression', type: 'number', label: 'CMAS Written Expression %', placeholder: '17' },
      { id: 'cmasConventions', type: 'number', label: 'CMAS Language Conventions %', placeholder: '50' },
    ],
    projection: 'reading-v1',
    projectionField: 'mapRit',
    routine: {
      levelField: 'lexile',
      levelBand: [-100, 50],
      levelActivityId: 'read',
      levelUnit: 'L',
      // The lowest subscore entered picks the one focus. Tips name the skill,
      // never the score — the kid sees the nudge, not the number (FR21).
      focus: [
        { fieldId: 'cmasReadingLit', activityId: 'read', tip: 'Focus: a story book — then tell someone what happened.' },
        { fieldId: 'cmasReadingInfo', activityId: 'read', tip: 'Focus: a true book — animals, sports, how things work.' },
        { fieldId: 'cmasVocab', activityId: 'read', tip: 'Focus: hunt for one new word and write it down.' },
        { fieldId: 'writtenExpression', activityId: 'write', tip: 'Focus: write at least three full sentences.' },
        { fieldId: 'cmasConventions', activityId: 'write', tip: 'Focus: check your capitals and periods before you finish.' },
      ],
    },
  },
};
