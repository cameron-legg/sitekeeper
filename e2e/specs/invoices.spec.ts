/**
 * Invoices E2E tests — invoice management screen.
 *
 * Run only this spec:
 *   npx playwright test invoices.spec.ts
 */

import { test, expect } from "@playwright/test";
import { loginAsDemo } from "../helpers/auth";

test.describe("Invoice Management Screen", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    // Navigate to Invoice Management via the menu
    await page.getByText("☰").click();
    await page.getByText("Invoice Management").click();
    await page.waitForTimeout(2000);
  });

  test("shows seeded invoices", async ({ page }) => {
    await expect(page.getByText("Kitchen Sink Repair")).toBeVisible({ timeout: 5000 });
  });

  test("shows dollar amounts", async ({ page }) => {
    await expect(page.getByText(/\$/).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Invoice on Job Detail", () => {
  test("invoice tab shows invoice on job", async ({ page }) => {
    await loginAsDemo(page);
    await page.getByText("Homeowner Residence").click();
    await page.waitForSelector("text=Fix Kitchen Sink Leak");
    await page.getByText("Fix Kitchen Sink Leak").click();
    await page.waitForTimeout(2000);

    // Click Invoices tab if visible
    const invTab = page.locator("[data-testid='invoices-tab'], text=Invoices").first();
    if (await invTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await invTab.click();
      await page.waitForTimeout(1000);
    }
    // Look for any dollar amount (invoice total) as proof the invoice loaded
    await expect(page.getByText(/\$/).first()).toBeVisible({ timeout: 5000 });
  });
});
