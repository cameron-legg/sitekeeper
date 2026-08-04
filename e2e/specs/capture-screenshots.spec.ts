/**
 * Playwright script to capture professional screenshots of the app
 * for the public landing page.
 *
 * Usage:
 *   cd e2e && npx playwright test capture-screenshots.spec.ts --reporter=line
 *
 * Output: frontend/assets/landing/
 */

import { test } from "@playwright/test";
import path from "path";

const OUTPUT_DIR = path.resolve(__dirname, "../../frontend/assets/landing");

// Mobile viewport for a clean mobile-first look
const VIEWPORT = { width: 390, height: 844 };

/**
 * Ensure we're logged in — either already authenticated or log in fresh.
 */
async function ensureLoggedIn(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForTimeout(3000);

  // Check if we're on the login screen (has the login button + email field)
  const hasLoginButton = await page.locator("text=Login").first().isVisible({ timeout: 2000 }).catch(() => false);
  const hasEmailField = await page.getByPlaceholder("you@example.com").isVisible({ timeout: 1000 }).catch(() => false);

  if (hasLoginButton && hasEmailField) {
    // We're on login — fill in credentials
    await page.getByPlaceholder("you@example.com").fill("demo@sitekeeper.com");
    await page.getByPlaceholder("Password").fill("demo1234");
    await page.locator("text=Login").click();
    await page.waitForTimeout(3000);
  }

  // Wait for the home screen to be ready (look for the New Job Site button or filter)
  await page.waitForSelector("text=Active Jobs", { timeout: 15000 });
}

test.describe("Landing Page Screenshots", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await ensureLoggedIn(page);
  });

  test("01 - Home screen with job sites", async ({ page }) => {
    await page.waitForSelector("text=Johnson Residence", { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "home-job-sites.png"),
      fullPage: false,
    });
  });

  test("02 - Job site detail with jobs list", async ({ page }) => {
    await page.getByText("Johnson Residence").click();
    await page.waitForSelector("text=Master Bathroom Remodel", { timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "job-site-detail.png"),
      fullPage: false,
    });
  });

  test("03 - Job detail with notes", async ({ page }) => {
    await page.getByText("Johnson Residence").click();
    await page.waitForSelector("text=Master Bathroom Remodel", { timeout: 10000 });
    await page.getByText("Master Bathroom Remodel").click();
    await page.waitForTimeout(2000);
    // Notes tab should be default
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "job-detail-notes.png"),
      fullPage: false,
    });
  });

  test("04 - Estimates tab", async ({ page }) => {
    await page.getByText("Johnson Residence").click();
    await page.waitForSelector("text=Master Bathroom Remodel", { timeout: 10000 });
    await page.getByText("Master Bathroom Remodel").click();
    await page.waitForTimeout(2000);
    // Click the Estimates tab
    const estTab = page.locator("text=Estimates").first();
    await estTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "estimates-tab.png"),
      fullPage: false,
    });
  });

  test("05 - Estimate editor with line items", async ({ page }) => {
    await page.getByText("Johnson Residence").click();
    await page.waitForSelector("text=Master Bathroom Remodel", { timeout: 10000 });
    await page.getByText("Master Bathroom Remodel").click();
    await page.waitForTimeout(2000);
    // Click Estimates tab
    const estTab = page.locator("text=Estimates").first();
    await estTab.click();
    await page.waitForTimeout(1500);
    // Click on the estimate title to open editor
    const estLink = page.locator("text=Master Bathroom Remodel").last();
    await estLink.click();
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "estimate-editor.png"),
      fullPage: false,
    });
  });

  test("06 - Invoices tab", async ({ page }) => {
    await page.getByText("Johnson Residence").click();
    await page.waitForSelector("text=Master Bathroom Remodel", { timeout: 10000 });
    await page.getByText("Master Bathroom Remodel").click();
    await page.waitForTimeout(2000);
    // Click the Invoices tab (use exact match to avoid "Invoices: 1 paid" text)
    const invTab = page.locator("div").filter({ hasText: /^Invoices$/ }).first();
    await invTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "invoices-tab.png"),
      fullPage: false,
    });
  });

  test("07 - Invoice management screen", async ({ page }) => {
    await page.getByText("☰").click();
    await page.waitForTimeout(500);
    const invoiceMgmt = page.locator("text=Invoice Management").first();
    await invoiceMgmt.click();
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "invoice-management.png"),
      fullPage: false,
    });
  });

  test("08 - Contacts tab", async ({ page }) => {
    await page.getByText("Johnson Residence").click();
    await page.waitForSelector("text=Master Bathroom Remodel", { timeout: 10000 });
    await page.getByText("Master Bathroom Remodel").click();
    await page.waitForTimeout(2000);
    const contactsTab = page.locator("text=Contacts").first();
    await contactsTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "contacts-tab.png"),
      fullPage: false,
    });
  });

  test("09 - Media tab", async ({ page }) => {
    await page.getByText("Johnson Residence").click();
    await page.waitForSelector("text=Master Bathroom Remodel", { timeout: 10000 });
    await page.getByText("Master Bathroom Remodel").click();
    await page.waitForTimeout(2000);
    const mediaTab = page.locator("text=Media").first();
    await mediaTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "media-tab.png"),
      fullPage: false,
    });
  });
});
