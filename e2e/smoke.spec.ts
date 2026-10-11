import { test, expect, type Page } from '@playwright/test';

/**
 * Each test here maps to a real defect that reached production, or to a path
 * that would strand a user if it broke. Nothing is asserted about styling —
 * only that the app is reachable and its promises are actionable.
 */

/** Put the app in a known state via the dev-only hook in main.ts. */
async function seed(page: Page, fn: string) {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).bts?.store);
  await page.evaluate(fn);
  await page.waitForFunction(() => (window as any).bts?.store);
}

const ONE_KID = `
  const s = window.bts.store;
  s.resetV2(); localStorage.clear();
  s.addProfile('Declan'); s.enroll('math-facts','sports');
`;

test.describe('onboarding', () => {
  test('a brand-new visitor lands somewhere usable, not a blank page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload();
    await expect(page.locator('#app')).not.toBeEmpty();
    await expect(page.getByText('Beat the Slide')).toBeVisible();
  });
});

test.describe('the daily screen', () => {
  test.beforeEach(async ({ page }) => { await seed(page, ONE_KID); await page.reload(); });

  test('greets the kid and shows their track', async ({ page }) => {
    await expect(page.getByText('Hey Declan')).toBeVisible();
    await expect(page.getByText('Math Facts').first()).toBeVisible();
  });

  test('completing an activity is one tap and sticks', async ({ page }) => {
    await page.locator('.act').first().click();
    // The daily total is the visible proof the tap registered.
    await expect(page.getByText(/Today: [1-9]/)).toBeVisible();
  });
});

test.describe('parent affordances are reachable', () => {
  test.beforeEach(async ({ page }) => { await seed(page, ONE_KID); await page.reload(); });

  /**
   * REGRESSION: "Add a kid" originally lived only inside the kid switcher,
   * which is hidden until a family has 2+ kids — so the only route to a second
   * kid required already having one. Unreachable for every family in
   * production. Found by a human on the live site.
   */
  test('a ONE-kid family can reach "Add another kid"', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add another kid/ })).toBeVisible();
  });

  test('the challenges entry point is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Challenges & invites/ })).toBeVisible();
  });

  test('the kid switcher is hidden for a one-kid family', async ({ page }) => {
    // Deliberate: a menu of one is noise. Asserted so it is not "fixed" later.
    await expect(page.getByRole('button', { name: /Switch kid/ })).toHaveCount(0);
  });
});

test.describe('creating a challenge', () => {
  test.beforeEach(async ({ page }) => { await seed(page, ONE_KID); await page.reload(); });

  /**
   * REGRESSION: this screen used to accept a name and a track, then fail on
   * submit with "Sign in first" — pointing at a sign-in that existed nowhere
   * outside onboarding. A dead end. Found by a human on the live site.
   */
  test('says sign-in is needed BEFORE the form, and offers it', async ({ page }) => {
    await page.getByRole('button', { name: /Challenges & invites/ }).click();
    await page.getByRole('button', { name: /Start a challenge/ }).click();

    await expect(page.getByText(/Sign in to continue/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in with Google/ })).toBeVisible();
    // The form must not be offered when it cannot succeed.
    await expect(page.locator('.input')).toHaveCount(0);
  });

  test('the challenges list renders its empty state, not a blank panel', async ({ page }) => {
    await page.getByRole('button', { name: /Challenges & invites/ }).click();
    await expect(page.getByText(/haven't started one yet/i)).toBeVisible();
  });
});

test.describe('invite links', () => {
  test('an unknown code explains itself and recovers', async ({ page }) => {
    await seed(page, ONE_KID);
    await page.goto('/?join=ABCD2345');

    await expect(page.getByText(/didn't work/i)).toBeVisible();
    // The code must not linger in the URL, or a refresh re-prompts.
    await expect(page).toHaveURL(/^[^?]*$/);

    await page.getByRole('button', { name: /Continue to the app/ }).click();
    await expect(page.getByText('Hey Declan')).toBeVisible();
  });

  test('a malformed code never breaks the boot path', async ({ page }) => {
    await seed(page, ONE_KID);
    // The app read nothing from the URL until invites shipped; garbage in the
    // query string must be ignored, not thrown on.
    await page.goto('/?join=<script>alert(1)</script>');
    await expect(page.getByText('Hey Declan')).toBeVisible();
  });
});

test.describe('nothing asks for money while we are still building', () => {
  test.beforeEach(async ({ page }) => { await seed(page, ONE_KID); await page.reload(); });

  test('no paid copy anywhere on the daily screen or the marketplace', async ({ page }) => {
    const paid = /Family plan|\$4\.99|Premium|Upgrade|paid plan/i;
    expect(await page.locator('body').innerText()).not.toMatch(paid);

    await page.getByRole('button', { name: /Add another track/ }).click();
    expect(await page.locator('body').innerText()).not.toMatch(paid);
  });

  test('a second track can actually be enrolled', async ({ page }) => {
    // FR7's one-track limit is switched off, not merely hidden — a lock with no
    // way past it would be worse than the paywall it replaced.
    await page.getByRole('button', { name: /Add another track/ }).click();
    await page.getByRole('button', { name: /^Enroll/ }).first().click();
    await expect(page.getByRole('button', { name: /Switch/ }).first()).toBeVisible();
    const tracks = await page.evaluate(() => Object.keys((window as any).bts.store.state.tracks));
    expect(tracks.length).toBe(2);
  });
});

const READER = `
  const s = window.bts.store;
  s.resetV2(); localStorage.clear();
  s.addProfile('Declan'); s.enroll('reading-slide','chess');
  s.setBaseline('reading-slide', { mapRit: 185, lexile: 375, writtenExpression: 17 });
  s.addPrize('reading-slide', 'Movie night', '🎬', 3);
  s.setParentPin('2468');
`;

async function enterPin(page: Page) {
  await page.getByLabel('Parent PIN').fill('2468');
  await page.getByRole('button', { name: 'Continue' }).click();
}

const pts = (page: Page) => page.evaluate(() => {
  const st = (window as any).bts.store.activeTrack;
  return Object.values(st.entries).length + Object.keys(st.bonusCompleted ?? {}).length; // cheap change detector
});

test.describe('PRD v2 features are reachable and keep their promises', () => {
  test.beforeEach(async ({ page }) => { await seed(page, READER); await page.reload(); });

  test('Reading is read, write and wrap-up — no Math', async ({ page }) => {
    await expect(page.locator('.act')).toHaveCount(3);
    await expect(page.locator('.act', { hasText: 'Math' })).toHaveCount(0);
  });

  test('the kid can change theme without losing points', async ({ page }) => {
    await page.locator('.act', { hasText: 'Read' }).click();
    const before = await page.getByText(/\d+ pts/).first().innerText();
    await page.getByRole('button', { name: /theme · change/ }).click();
    await page.getByRole('button', { name: /Dance/ }).click();
    await expect(page.getByRole('button', { name: /Dance theme · change/ })).toBeVisible();
    await expect(page.getByText(/\d+ pts/).first()).toHaveText(before);
  });

  test('the routine shows a focus tip but never a score', async ({ page }) => {
    await expect(page.getByText(/Focus: write at least three/)).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/\b185\b|\b17%/);
  });

  test('the weekly bonus is one tap and can be undone', async ({ page }) => {
    const n0 = await pts(page);
    await page.getByRole('button', { name: /I did it/ }).click();
    expect(await pts(page)).toBe(n0 + 1);
    await page.getByRole('button', { name: /tap to undo/ }).click();
    expect(await pts(page)).toBe(n0);
  });

  test('cashing in reaches the parent, who marks it given', async ({ page }) => {
    await page.locator('.act', { hasText: 'Read' }).click();
    await page.getByRole('button', { name: /^Cash in/ }).click();
    await page.getByRole('button', { name: /Prizes.*approvals.*1 waiting/ }).click();
    await enterPin(page);
    await page.getByRole('button', { name: /Mark as given/ }).click();
    await page.getByRole('button', { name: /Back to the app/ }).click();
    await expect(page.getByText(/Cashed in/)).toBeVisible();
  });

  test('the fall estimate is off until a parent turns it on', async ({ page }) => {
    await page.getByRole('button', { name: /Test scores & fall estimate/ }).click();
    await enterPin(page);
    await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText(/Keep this pace/)).toHaveCount(0);
    await page.getByRole('switch').click();
    // Nothing logged yet today, so it says when it starts rather than guessing.
    await expect(page.getByText(/starts once Declan logs the first day/)).toBeVisible();
  });

  test('without a PIN, scores ask a parent to set one first', async ({ page }) => {
    await page.evaluate(() => (window as any).bts.store.clearParentPin('2468'));
    await page.reload();
    await page.getByRole('button', { name: /Test scores & fall estimate/ }).click();
    await expect(page.getByText(/Set a PIN first, so test scores stay with parents/)).toBeVisible();
    await expect(page.getByText(/MAP Reading RIT/)).toHaveCount(0);
  });

  test("the kid's screen never shows the Lexile or the book range", async ({ page }) => {
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/375|275|425L/);
    await expect(page.getByText(/just-right book/)).toBeVisible();
  });
});
