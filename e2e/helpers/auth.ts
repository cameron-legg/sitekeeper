/**
 * Shared auth helpers for E2E tests.
 * Logs in with the seeded demo account and stores state.
 */

import { Page } from "@playwright/test";

export const DEMO_USER = {
  email: "demo@jobsyte.app",
  password: "demo1234",
};

/**
 * Log in as the demo user via the login form.
 * After this, the page should be on the Home screen.
 */
export async function loginAsDemo(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(DEMO_USER.email);
  await page.getByPlaceholder("Password").fill(DEMO_USER.password);
  await page.locator("text=Login").click();
  // Wait for Home screen to load (job sites list)
  await page.waitForSelector("text=JobSyte", { timeout: 10000 });
}

/**
 * Log out from the app (via the menu).
 */
export async function logout(page: Page) {
  // Open the hamburger/menu
  await page.getByText("☰").click();
  await page.getByText("Sign Out").click();
  // Confirm the logout dialog
  await page.locator("text=Log out").last().click();
  await page.waitForSelector('[placeholder="you@example.com"]', { timeout: 5000 });
}
