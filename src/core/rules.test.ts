import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * v2 shares the summerstreak Firebase project with the LIVE v1 app, and
 * security rules are one document for the whole database. These tests exist so
 * that editing the rules can never silently strip v1's protection.
 *
 * The v1 block below is transcribed from declansummerlearning/BACKEND-SETUP.md,
 * which documents what is published today. If v1's rules legitimately change,
 * update BOTH that file and this test — deliberately, not by accident.
 */
const rules = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../firebase.rules.json', import.meta.url)), 'utf8'),
).rules as Record<string, any>;

const V1_LIVE = {
  leaderboard: {
    '.read': 'auth != null',
    $entry: { '.write': "auth != null && ($entry.beginsWith(auth.uid) || root.child('admins').child(auth.uid).val() === true)" },
  },
  weeklyHistory: {
    '.read': 'auth != null',
    $weekNum: { $entry: { '.write': "auth != null && ($entry.beginsWith(auth.uid) || root.child('admins').child(auth.uid).val() === true)" } },
  },
  weeklyWinners: {
    '.read': 'auth != null',
    $weekNum: { '.write': "auth != null && (!data.exists() || root.child('admins').child(auth.uid).val() === true)" },
  },
  admins: {
    '.read': "auth != null && root.child('admins').child(auth.uid).val() === true",
    '.write': false,
  },
} as const;

describe("v1's live rules must survive any v2 edit", () => {
  for (const [node, expected] of Object.entries(V1_LIVE)) {
    it(`/${node} is unchanged`, () => {
      expect(rules[node]).toEqual(expected);
    });
  }

  it('every v1 node is still present', () => {
    for (const node of Object.keys(V1_LIVE)) expect(rules).toHaveProperty(node);
  });
});

describe('v2 stays inside /v2', () => {
  it('adds no top-level node beyond v2', () => {
    const extra = Object.keys(rules).filter((k) => !(k in V1_LIVE) && k !== 'v2');
    expect(extra).toEqual([]);
  });

  it('scopes leaderboard writes to the caller’s own key', () => {
    const w = rules['v2'].tracks.$trackId.leaderboard.$key['.write'];
    expect(w).toContain("$key.beginsWith(auth.uid + '_')");
  });

  it('pins uid and trackId server-side', () => {
    const lb = rules['v2'].tracks.$trackId.leaderboard.$key;
    expect(lb.uid['.validate']).toContain('auth.uid');
    expect(lb.trackId['.validate']).toContain('$trackId');
  });

  it('caps the published name so a full name cannot be written', () => {
    expect(rules['v2'].tracks.$trackId.leaderboard.$key.name['.validate'])
      .toContain('length <= 24');
  });

  it('keeps weekly winners write-once', () => {
    expect(rules['v2'].tracks.$trackId.weeklyWinners.$week['.write'])
      .toContain('!data.exists()');
  });

  it('keeps the family rollup private to that family', () => {
    const f = rules['v2'].families.$uid;
    expect(f['.read']).toContain('auth.uid === $uid');
    expect(f['.write']).toContain('auth.uid === $uid');
  });
});
