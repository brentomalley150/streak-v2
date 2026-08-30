/**
 * One-off: remove `ownerEmail` from published leaderboard rows.
 *
 * WHY THIS EXISTS
 * v2.0 published the parent's Google account email onto
 * v2/tracks/${trackId}/leaderboard/${key}, a node any signed-in user can read.
 * The app stopped writing it in streak-v2 e5e1426, but rows written before that
 * still carry the field. A code fix stops new leaks; it does not retract
 * published ones.
 *
 * WHAT IT DOES
 * Reads every leaderboard row, and for each one that has an ownerEmail, writes
 * null to *that single field*. It never touches points, streaks or anything
 * else, and it never deletes a row.
 *
 * SAFETY
 * - Dry run by default. It changes nothing without --apply.
 * - Prints exactly what it would change, and a per-track count.
 * - Also checks v2/tracks/*\/weeklyHistory, which publish() writes separately.
 * - Idempotent: running it twice is harmless.
 *
 * PERMISSIONS
 * The rules allow writing a leaderboard key only when it starts with your own
 * uid, OR when your uid is listed under /admins. Cleaning other families' rows
 * therefore requires signing in as an account that is in /admins. Add it in the
 * Firebase console first (that node is not client-writable, by design).
 *
 * USAGE
 *   node scripts/strip-owner-email.mjs                 # dry run
 *   node scripts/strip-owner-email.mjs --apply         # perform the writes
 *
 * Reads config from .env.local, the same values the app uses.
 */
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getDatabase, ref, get, update } from 'firebase/database';

const APPLY = process.argv.includes('--apply');

function env() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const e = Object.fromEntries(
    raw.split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
       .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
  return {
    apiKey: e['VITE_FB_API_KEY'], authDomain: e['VITE_FB_AUTH_DOMAIN'],
    databaseURL: e['VITE_FB_DATABASE_URL'], projectId: e['VITE_FB_PROJECT_ID'],
    appId: e['VITE_FB_APP_ID'],
  };
}

const ADMIN_EMAIL = process.env['BTS_ADMIN_EMAIL'];
const ADMIN_PASSWORD = process.env['BTS_ADMIN_PASSWORD'];

const app = initializeApp(env());
const db = getDatabase(app);

if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  await signInWithEmailAndPassword(getAuth(app), ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log(`signed in as ${ADMIN_EMAIL}`);
} else {
  console.log('No BTS_ADMIN_EMAIL / BTS_ADMIN_PASSWORD set — reading anonymously.');
  console.log('A dry run may still work if rules allow it; --apply will not.\n');
}

let snap;
try {
  snap = await get(ref(db, 'v2/tracks'));
} catch (err) {
  if (String(err?.message ?? err).includes('Permission denied')) {
    console.error('\nPermission denied reading v2/tracks.');
    console.error('Every node here requires auth != null, so even a dry run must sign in.');
    console.error('Set credentials for an account listed under /admins:\n');
    console.error('  BTS_ADMIN_EMAIL=you@example.com \\');
    console.error('  BTS_ADMIN_PASSWORD=... \\');
    console.error('  node scripts/strip-owner-email.mjs\n');
    console.error('Add the uid to /admins in the Firebase console first — that');
    console.error('node is deliberately not client-writable.');
    process.exit(1);
  }
  throw err;
}
const tracks = snap.val() ?? {};

let found = 0;
const updates = {};

for (const [trackId, node] of Object.entries(tracks)) {
  let perTrack = 0;
  for (const [key, row] of Object.entries(node?.leaderboard ?? {})) {
    if (row && typeof row === 'object' && 'ownerEmail' in row) {
      updates[`v2/tracks/${trackId}/leaderboard/${key}/ownerEmail`] = null;
      perTrack++; found++;
    }
  }
  // publish() writes weeklyHistory separately; check it rather than assume.
  for (const [week, rows] of Object.entries(node?.weeklyHistory ?? {})) {
    for (const [key, row] of Object.entries(rows ?? {})) {
      if (row && typeof row === 'object' && 'ownerEmail' in row) {
        updates[`v2/tracks/${trackId}/weeklyHistory/${week}/${key}/ownerEmail`] = null;
        perTrack++; found++;
      }
    }
  }
  if (perTrack) console.log(`  ${trackId}: ${perTrack} field(s) carrying an email`);
}

if (!found) {
  console.log('\nNothing to clean — no row carries ownerEmail.');
  process.exit(0);
}

console.log(`\n${found} field(s) to clear across ${Object.keys(tracks).length} track(s).`);

if (!APPLY) {
  console.log('DRY RUN — nothing written. Re-run with --apply to perform it.');
  process.exit(0);
}

await update(ref(db), updates);
console.log(`Cleared ${found} field(s).`);

const after = await get(ref(db, 'v2/tracks'));
const remaining = JSON.stringify(after.val() ?? {}).split('"ownerEmail"').length - 1;
console.log(remaining === 0 ? 'Verified: no ownerEmail remains.' : `WARNING: ${remaining} still present.`);
process.exit(0);
