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

/**
 * The published leaderboard row is world-readable to any signed-in user, so it
 * must carry only what the onboarding consent screen promises: "Friends see
 * only a first name and a score. Never a last name, photo, or location."
 *
 * v2.0 shipped `ownerEmail: user.email` on that row, which broke that promise —
 * a parent's real email, readable by every other user, for a person who never
 * appears on the leaderboard at all.
 */
describe('the published row discloses only what consent promised', () => {
  const lb = rules['v2'].tracks.$trackId.leaderboard;

  it('is readable by any signed-in user — so its contents are public', () => {
    expect(lb['.read']).toBe('auth != null');
  });

  it('rejects an email field outright', () => {
    const v = JSON.stringify(lb.$key);
    expect(v).toContain('ownerEmail');
    expect(lb.$key.ownerEmail['.validate']).toBe(false);
  });

  it('names every field it allows, so a new one cannot leak silently', () => {
    // hasChildren() is a MINIMUM check: extra fields pass. An explicit
    // allow-list is what stops the next ownerEmail.
    const allowed = lb.$key['.validate'];
    expect(allowed).toContain('newData.hasChildren');
    for (const f of ['uid', 'profileId', 'trackId', 'name', 'points']) {
      expect(allowed).toContain(f);
    }
    expect(lb.$key['$other']['.validate']).toBe(false);
  });
});

/**
 * firebase.rules.paste.json is what actually gets pasted into the Firebase
 * console — it is firebase.rules.json minus the _comment key, which Firebase
 * rejects. If they drift, a rules fix looks committed but never deploys. That
 * had already happened once.
 */
describe('the paste copy matches the source of truth', () => {
  it('differs only by the _comment key', () => {
    const paste = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../firebase.rules.paste.json', import.meta.url)), 'utf8'),
    );
    const source = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../firebase.rules.json', import.meta.url)), 'utf8'),
    );
    delete source['_comment'];
    expect(paste).toEqual(source);
  });
});
