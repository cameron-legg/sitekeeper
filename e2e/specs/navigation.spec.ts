/**
 * Navigation E2E tests — screen transitions, back button, menu.
 *
 * Run only this spec:
 *   npx playwright test navigation.spec.ts
 */

import { test, expect } from "@playwright/test";
import { loginAsDemo } from "../helpers/auth";

test.describe("Screen Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test("Home → Job Site → back to Home", async ({ page }) => {
    await page.getByText("Garcia Kitchen Renovation").click();
    await expect(page.getByText("Kitchen Plumbing Rough-In")).toBeVisible({ timeout: 5000 });

    await page.goBack();
    await expect(page.getByText("Johnson Residence")).toBeVisible({ timeout: 5000 });
  });

  test("Home → Job Site → Job Detail → back to site", async ({ page }) => {
    await page.getByText("Johnson Residence").click();
    await page.waitForSelector("text=Master Bathroom Remodel");
    await page.getByText("Master Bathroom Remodel").click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole("heading", { name: "Master Bathroom Remodel" })).toBeVisible({ timeout: 5000 });

    // Go back to site detail
    await page.goBack();
    await expect(page.getByText("Fix Kitchen Sink Leak")).toBeVisible({ timeout: 5000 });
  });

  test("menu opens and shows Invoice Management", async ({ page }) => {
    await page.getByText("☰").click();
    await expect(page.getByText("Invoice Management")).toBeVisible({ timeout: 3000 });
  });
});
