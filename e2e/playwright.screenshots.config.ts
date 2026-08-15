import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the documentation screenshot capture script.
 *
 * Run:
 *   cd e2e && npx playwright test --config=playwright.screenshots.config.ts
 */
export default defineConfig({
  testDir: ".",
  testMatch: "take-doc-screenshots.spec.ts",
  timeout: 180000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8081",
    headless: true,
    // iPhone 14 Pro viewport — proper mobile phone dimensions
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
