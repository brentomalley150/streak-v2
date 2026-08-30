import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke-level E2E. Deliberately small.
 *
 * These exist because every user-visible bug shipped so far lived in src/ui/,
 * which 146 unit tests do not touch — both were "the button isn't there" or
 * "the button leads nowhere", which is precisely what a smoke test catches and
 * a unit test cannot. They are not a comprehensive suite and should not grow
 * into one; the core logic is already covered by vitest.
 *
 * Signed-out paths only. Google sign-in cannot be automated without a test-auth
 * path, so the signed-in flows stay manual for now (see e2e/README.md).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'list' : [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
