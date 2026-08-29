/**
 * Reading Slide — v1's track, ported. This is the only file that changes
 * when Reading Slide changes; the engine stays untouched.
 *
 * Challenge copy and chess thresholds are v1's real content, so a migrated
 * family sees the same challenges and keeps the same rank.
 */
import type { TrackDefinition } from '../core/types.js';
import { asTrackId, asActivityId } from '../core/types.js';

export const READING_SLIDE: TrackDefinition = {
  trackId: asTrackId('reading-slide'),
  version: 1,
  name: 'Reading Slide',
  description: 'Read, write, and wrap up each day — beat the summer slide.',
  icon: '📚',
  recommendedAge: '5–11',
  dailyMinutes: 20,
  lengthWeeks: 12,
  ladder: 'chess',
  themes: ['chess', 'sports', 'music', 'gaming'],
  activities: [
    { id: asActivityId('read'), label: 'Read', icon: '📖', points: 3, fields: [
      { id: 'minutes', type: 'number', label: 'Minutes', placeholder: '20' },
      { id: 'book', type: 'text', label: 'Book', placeholder: 'What are you reading?' },
    ] },
    { id: asActivityId('write'), label: 'Write', icon: '✏️', points: 3, fields: [
      { id: 'writingTopic', type: 'text', label: 'About', placeholder: 'What did you write about?' },
      { id: 'words', type: 'number', label: 'Words', placeholder: '40' },
    ] },
    { id: asActivityId('math'), label: 'Math', icon: '🔢', points: 2, fields: [] },
    { id: asActivityId('closeout'), label: 'Wrap-up', icon: '🌙', points: 1, fields: [] },
  ],
  statColumns: [
    { id: 'totalMinutes', label: 'Minutes', from: 'sum:minutes' },
    { id: 'totalWords', label: 'Words', from: 'sum:words' },
    { id: 'daysRead', label: 'Days read', from: 'count:read' },
  ],
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
  { week: 12, emoji: '🏆', name: 'Summer Wrap-Up',
    short: 'Pick your top 3 books from the summer and explain why.',
    full: 'Pick your top 3 books from the summer and explain why.' },
  ],
  outcomeModel: {
    baselineFields: [
      { id: 'mapRit', type: 'number', label: 'MAP Reading RIT', placeholder: '185' },
      { id: 'lexile', type: 'number', label: 'Lexile', placeholder: '375' },
      { id: 'writtenExpression', type: 'number', label: 'Written Expression %', placeholder: '17' },
    ],
    projection: 'reading-v1',
  },
};
