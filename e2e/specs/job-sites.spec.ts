/**
 * Job Sites & Jobs E2E tests — navigation, list display.
 *
 * Run only this spec:
 *   npx playwright test job-sites.spec.ts
 */

import { test, expect } from "@playwright/test";
import { loginAsDemo } from "../helpers/auth";

test.describe("Job Sites List", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test("home screen shows seeded job sites", async ({ page }) => {
    await expect(page.getByText("Homeowner Residence")).toBeVisible();
    await expect(page.getByText("Kitchenson Kitchen Renovation")).toBeVisible();
    await expect(page.getByText("FakeCorp Office Building")).toBeVisible();
    await expect(page.getByText("Landlord Rental Properties")).toBeVisible();
    await expect(page.getByText("Fictional Heights Condos")).toBeVisible();
  });

  test("job site shows job count", async ({ page }) => {
    await expect(page.getByText("3 jobs").first()).toBeVisible();
  });

  test("clicking a job site navigates to detail screen", async ({ page }) => {
    await page.getByText("Homeowner Residence").click();
    await expect(page.getByText("Master Bathroom Remodel")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Fix Kitchen Sink Leak")).toBeVisible();
    await expect(page.getByText("Water Heater Replacement")).toBeVisible();
  });
});

test.describe("Job Detail Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test("clicking a job navigates to job detail with heading", async ({ page }) => {
    await page.getByText("Homeowner Residence").click();
    await page.waitForSelector("text=Master Bathroom Remodel");
    await page.getByText("Master Bathroom Remodel").click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole("heading", { name: "Master Bathroom Remodel" })).toBeVisible({ timeout: 5000 });
  });

  test("job shows correct status", async ({ page }) => {
    await page.getByText("Homeowner Residence").click();
    await page.waitForTimeout(1000);
    await expect(page.getByText(/in.progress/i).first()).toBeVisible({ timeout: 5000 });
  });
});
