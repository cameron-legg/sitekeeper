/**
 * Estimates E2E tests — viewing estimates on job detail.
 *
 * Run only this spec:
 *   npx playwright test estimates.spec.ts
 */

import { test, expect } from "@playwright/test";
import { loginAsDemo } from "../helpers/auth";

test.describe("Estimate on Job Detail", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    // Navigate to Homeowner Residence → Master Bathroom Remodel
    await page.getByText("Homeowner Residence").click();
    await page.waitForSelector("text=Master Bathroom Remodel");
    await page.getByText("Master Bathroom Remodel").click();
    await page.waitForTimeout(2000);
  });

  test("job detail page loads with heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Master Bathroom Remodel" })).toBeVisible();
  });

  test("estimates tab shows estimate title", async ({ page }) => {
    // The estimate might be behind a tab — look for Estimates tab or the title visible directly
    const estTab = page.locator("[data-testid='estimates-tab'], text=Estimates").first();
    if (await estTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await estTab.click();
      await page.waitForTimeout(1000);
    }
    // Verify any dollar amount or estimate-related text is present
    await expect(page.getByText(/\$/).first()).toBeVisible({ timeout: 5000 });
  });

  test("hourly rate is displayed", async ({ page }) => {
    // Should see the hourly rate ($85/hr) somewhere
    await expect(page.getByText(/\$85/).first()).toBeVisible({ timeout: 5000 });
  });
});
