/**
 * Auth E2E tests — login, logout, registration, error handling.
 *
 * Run only this spec:
 *   npx playwright test auth.spec.ts
 */

import { test, expect } from "@playwright/test";
import { DEMO_USER, loginAsDemo, logout } from "../helpers/auth";

test.describe("Login", () => {
  test("successful login navigates to Home screen", async ({ page }) => {
    await loginAsDemo(page);
    // Should see the JobSyte header and job sites
    await expect(page.getByText("JobSyte")).toBeVisible();
    await expect(page.getByText("Homeowner Residence")).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill(DEMO_USER.email);
    await page.getByPlaceholder("Password").fill("wrongpassword");
    await page.locator("text=Login").click();

    // Should show an error message and stay on login
    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible({ timeout: 5000 });
  });

  test("nonexistent email shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill("nobody@example.com");
    await page.getByPlaceholder("Password").fill("password123");
    await page.locator("text=Login").click();

    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Logout", () => {
  test("logout returns to login screen", async ({ page }) => {
    await loginAsDemo(page);
    await logout(page);
    // Should be back on login screen
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
  });
});

test.describe("Protected Routes", () => {
  test("visiting home without login redirects to login", async ({ page }) => {
    await page.goto("/");
    // Should show login form since there's no token
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible({ timeout: 5000 });
  });
});
