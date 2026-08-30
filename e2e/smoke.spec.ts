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
