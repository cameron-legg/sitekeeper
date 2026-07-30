import { defineConfig } from "@playwright/test";

/**
 * Playwright E2E test configuration for SiteKeeper.
 *
 * Prerequisites before running:
 *   1. Docker containers running (docker compose up -d)
 *   2. Dev DB seeded (./seed.sh)
 *   3. Backend running (cd backend && flask run)
 *   4. Frontend running (cd frontend && npx expo start --web)
 *
 * Run all:     npx playwright test
 * Run one:     npx playwright test auth.spec.ts
 * Headed:      npx playwright test --headed
 * Debug:       npx playwright test --debug
 */
export default defineConfig({
  testDir: "./specs",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false, // run sequentially since tests share a DB
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:8081",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
