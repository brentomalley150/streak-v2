import { defineConfig } from 'vitest/config';

/**
 * Vitest owns src/**; Playwright owns e2e/**. Without this, vitest tries to run
 * the Playwright specs and fails on an import it cannot resolve.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
