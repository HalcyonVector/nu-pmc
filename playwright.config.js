// playwright.config.js — config for the end-to-end browser tests in tests/e2e/.
// Run with: npm run test:e2e   (requires a running app + seeded DB)
//
// The e2e specs drive a real browser against a live server, so they need:
//   1. A MySQL DB loaded with schema + seed (including the e2e test users —
//      see tests/e2e/helpers.js / seed-test-users.sql).
//   2. The app running and reachable at E2E_BASE_URL.
// Set E2E_BASE_URL to point at a staging server, or let the webServer block
// below boot a local instance (uncomment it once the DB is seeded locally).

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : 'line',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  // Uncomment to have Playwright boot the app itself for local e2e runs.
  // Requires the DB to be seeded first (npm start reads .env for DB config).
  // webServer: {
  //   command: 'npm start',
  //   url: process.env.E2E_BASE_URL || 'http://localhost:3100',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 60_000,
  // },
});
