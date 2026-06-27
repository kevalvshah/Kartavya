import { defineConfig, devices } from '@playwright/test';

/**
 * E2E test configuration for Kartavaya web app.
 *
 * In CI: set PLAYWRIGHT_BASE_URL to the deployed Vercel URL.
 * Locally: runs against the Vite dev server on port 3000.
 *
 * The webServer block is skipped in CI (reuseExistingServer: true +
 * the CI sets PLAYWRIGHT_BASE_URL to an already-deployed app).
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: CI ? 1 : 0,
  workers: CI ? 1 : 2,
  reporter: CI ? 'github' : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Only start the dev server when running locally (no PLAYWRIGHT_BASE_URL)
  ...(!CI && !process.env.PLAYWRIGHT_BASE_URL
    ? {
        webServer: {
          command: 'cd frontend && yarn start',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }
    : {}),
});
