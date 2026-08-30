import { describe, it, expect } from 'vitest';
import {
  generateJoinCode, normalizeJoinCode, isValidJoinCode, joinLink,
  readJoinCodeFromUrl, newGroup, isOwner, isMember, groupLeaderboard, disclosureFor,
} from './groups.js';
import type { LeaderboardRow } from './sync.js';

function row(key: string, name: string, points: number, trackId = 'math-facts'): LeaderboardRow {
  return {
    uid: key.split('_')[0]!, profileId: 'p_x', leaderboardKey: key,
    name, avatar: '👑', trackId, theme: 'chess', points, weeklyPoints: 0,
    weekStartKey: '2026-08-24', rank: 'Pawn', rankPiece: '♙', stats: {},
    currentStreak: 0, lastSeen: 0,
  };
}

const g = () => newGroup('ABCD2345', "Ms. Rivera's drums", 'music-practice', 'u_teach', 'Ms. Rivera', 1000);

describe('join codes', () => {
  it('avoids characters that get misread aloud or from a photo', () => {
    const code = generateJoinCode(() => 0.999999);
    expect(code).not.toMatch(/[O0I1L]/);
  });

  it('is long enough that guessing a group is not a threat', () => {
    // 8 chars from a 31-letter alphabet ≈ 40 bits.
    expect(generateJoinCode().length).toBe(8);
    expect(31 ** 8).toBeGreaterThan(8e11);
  });

  it('is forgiving of how a person actually types it', () => {
    expect(normalizeJoinCode('abcd 2345')).toBe('ABCD2345');
    expect(normalizeJoinCode('ABCD-2345')).toBe('ABCD2345');
  });

  it('rejects malformed codes rather than querying for them', () => {
    expect(isValidJoinCode('ABCD2345')).toBe(true);
    expect(isValidJoinCode('ABC')).toBe(false);
    expect(isValidJoinCode('ABCD234O')).toBe(false);  // O is not in the alphabet
    expect(isValidJoinCode('')).toBe(false);
  });

  it('generates codes that validate', () => {
    for (let i = 0; i < 50; i++) expect(isValidJoinCode(generateJoinCode())).toBe(true);
  });
});

describe('the invite link', () => {
  it('carries the code where the app will look for it', () => {
    expect(joinLink('ABCD2345', 'https://beattheslide.com'))
      .toBe('https://beattheslide.com/app/?join=ABCD2345');
  });

  it('reads the code back out', () => {
    expect(readJoinCodeFromUrl('?join=ABCD2345')).toBe('ABCD2345');
    expect(readJoinCodeFromUrl('?join=abcd2345')).toBe('ABCD2345');
  });

  it('returns null rather than throwing on anything unexpected', () => {
    // The app has never read the URL; a bad link must not break the boot path.
    expect(readJoinCodeFromUrl('')).toBeNull();
    expect(readJoinCodeFromUrl('?join=')).toBeNull();
    expect(readJoinCodeFromUrl('?join=nope')).toBeNull();
    expect(readJoinCodeFromUrl('?other=1')).toBeNull();
    expect(readJoinCodeFromUrl('?join=<script>')).toBeNull();
  });
});

describe('a group holds references, never copies', () => {
  it('starts with no members and no progress data of its own', () => {
    const group = g();
    expect(group.members).toEqual({});
    expect(JSON.stringify(group)).not.toContain('entries');
    expect(JSON.stringify(group)).not.toContain('baseline');
  });

  it('discloses only the owner’s first name', () => {
    expect(JSON.stringify(g())).not.toContain('@');
  });

  it('knows its owner', () => {
    expect(isOwner(g(), 'u_teach')).toBe(true);
    expect(isOwner(g(), 'u_someone')).toBe(false);
    expect(isOwner(g(), null)).toBe(false);
  });
});

describe('the group leaderboard is a filter, not a second source of truth', () => {
  const group = { ...g(), members: {
    'u_a_p_x': { name: 'Declan', avatar: '👑', joinedAt: 1 },
    'u_b_p_x': { name: 'Sebastian', avatar: '⚽', joinedAt: 2 },
  } };

  it('shows members and hides everyone else', () => {
    const rows = [row('u_a_p_x', 'Declan', 30), row('u_z_p_x', 'Stranger', 999), row('u_b_p_x', 'Sebastian', 20)];
    expect(groupLeaderboard(group, rows).map((r) => r.name)).toEqual(['Declan', 'Sebastian']);
  });

  it('ranks by the same points as the global board, so the two cannot disagree', () => {
    const rows = [row('u_a_p_x', 'Declan', 10), row('u_b_p_x', 'Sebastian', 40)];
    expect(groupLeaderboard(group, rows).map((r) => r.points)).toEqual([40, 10]);
  });

  it('is empty, not broken, when no member has published yet', () => {
    expect(groupLeaderboard(group, [])).toEqual([]);
  });

  it('never invents a member from a row alone', () => {
    // Being on the track is not being in the group.
    expect(groupLeaderboard(group, [row('u_z_p_x', 'Stranger', 5)])).toEqual([]);
    expect(isMember(group, 'u_z_p_x')).toBe(false);
  });
});

describe('what a join discloses (FR14)', () => {
  it('names the track and no other, matching the consent promise', () => {
    const lines = disclosureFor(g(), 'Music Practice').join(' ');
    expect(lines).toContain('Music Practice');
    expect(lines).toContain('nothing from any other track');
    expect(lines).toContain('first name');
  });

  it('never promises more than a first name, avatar and score', () => {
    const lines = disclosureFor(g(), 'Music Practice').join(' ').toLowerCase();
    for (const forbidden of ['last name', 'email', 'photo', 'location', 'address']) {
      expect(lines).not.toContain(forbidden);
    }
  });
});
