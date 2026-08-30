/**
 * Entry point. Boots the store (running the v1 migration if needed),
 * then routes between onboarding, the daily screen and the marketplace.
 */
import './styles/app.css';
import { Store } from './core/store.js';
import { createBackend } from './core/firebase.js';
import { renderOnboarding } from './ui/onboarding.js';
import { renderDaily, renderMarketplace } from './ui/daily.js';
import { renderDigest } from './ui/digest.js';
import { renderRollup } from './ui/rollup.js';

const root = document.getElementById('app');
if (!root) throw new Error('#app not found');

const store = new Store(window.localStorage);
// Attach before init so a signed-in family syncs as soon as auth resolves.
// With no config this is a no-op backend and the app runs entirely offline.
// The backend loads asynchronously (the SDK is code-split), so the first paint
// happens before it is ready. Re-render once it attaches, otherwise onboarding
// keeps showing the offline copy on a device that can actually sync.
void createBackend().then((b) => {
  store.attachBackend(b);
  if (current === 'onboarding') show('onboarding');
});
const { migrated } = store.init();

type View = 'onboarding' | 'daily' | 'marketplace' | 'digest' | 'addKid' | 'rollup';

let current: View = 'onboarding';

function show(view: View): void {
  current = view;
  // 'addKid' is onboarding run again for an additional child. addProfile
  // appends and switches, so the existing kids' data is untouched.
  if (view === 'onboarding' || view === 'addKid') {
    renderOnboarding(root!, store, () => show('daily'));
  } else if (view === 'marketplace') renderMarketplace(root!, store, () => show('daily'));
  else if (view === 'digest') renderDigest(root!, store, () => show('daily'));
  else if (view === 'rollup') renderRollup(root!, store, () => show('daily'));
  else {
    renderDaily(root!, store, () => show('marketplace'), () => show('digest'),
      () => show('addKid'), () => show('rollup'));
  }
}

// A migrated v1 family lands straight in the game with their data intact.
if (migrated > 0) {
  console.info(`[beat-the-slide] migrated ${migrated} profile(s) from v1`);
}

show(store.hasProfile && store.activeTrack ? 'daily' : 'onboarding');

// Dev helpers, available in the console during development only.
if (import.meta.env.DEV) {
  Object.assign(window as unknown as Record<string, unknown>, {
    bts: {
      store,
      reset: () => { store.resetV2(); location.reload(); },
      demo: () => { store.resetV2(); store.seedDemo(); location.reload(); },
    },
  });
}
