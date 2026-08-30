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
import { renderPinGate, renderPinSetup } from './ui/pin.js';

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

type View = 'onboarding' | 'daily' | 'marketplace' | 'digest' | 'addKid' | 'rollup'
  | 'setPin';

/**
 * Screens a kid should not wander into. The daily screen is deliberately absent
 * — the kid's own track must open with no friction.
 *
 * Each says why it is asking, so the prompt never reads as an arbitrary wall.
 */
const GATED: Partial<Record<View, string>> = {
  marketplace: 'Adding a track can change your plan.',
  addKid: 'Setting up another kid is a parent job.',
  rollup: "This shows every kid's progress.",
  digest: 'This is your weekly summary.',
};

let current: View = 'onboarding';

/** Renders a view, having already cleared any gate. */
function draw(view: View): void {
  current = view;
  // 'addKid' is onboarding run again for an additional child. addProfile
  // appends and switches, so the existing kids' data is untouched.
  if (view === 'onboarding' || view === 'addKid') {
    // The handoff step can route straight into PIN setup. setPin returns to
    // the daily screen either way, so onboarding is never re-entered.
    renderOnboarding(root!, store, () => show('daily'), () => show('setPin'));
  } else if (view === 'marketplace') renderMarketplace(root!, store, () => show('daily'));
  else if (view === 'digest') renderDigest(root!, store, () => show('daily'));
  else if (view === 'rollup') renderRollup(root!, store, () => show('daily'));
  else if (view === 'setPin') {
    renderPinSetup(root!, store, () => show('daily'), () => show('daily'));
  } else {
    renderDaily(root!, store, () => show('marketplace'), () => show('digest'),
      () => show('addKid'), () => show('rollup'), () => show('setPin'));
  }
}

function show(view: View): void {
  const why = GATED[view];
  // Only gate once a parent has actually set a PIN. A family that never set
  // one keeps today's behaviour exactly.
  if (why && store.pinIsSet) {
    current = view;
    renderPinGate(root!, store, why, () => draw(view), () => show('daily'));
    return;
  }
  draw(view);
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
