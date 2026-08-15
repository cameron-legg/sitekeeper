/**
 * Documentation screenshot capture script.
 *
 * Captures mobile-phone-sized screenshots of the app with real seeded data
 * for use in the landing page documentation section.
 *
 * Run from e2e/ directory:
 *   npx playwright test --config=playwright.screenshots.config.ts
 */

import { test } from "@playwright/test";
import { loginAsDemo } from "./helpers/auth";
import * as path from "path";

const OUTPUT_DIR = path.resolve(__dirname, "../frontend/assets/landing/docs");

test("capture documentation screenshots", async ({ page }) => {
  test.setTimeout(180000);

  console.log("Logging in...");
  await loginAsDemo(page);
  await page.waitForTimeout(1500);

  // ─── Home Screen (Job Sites List) ─────────────────────────────────────
  // Shows all 7 seeded job sites with job counts
  console.log("📸 Home screen (job sites)...");
  await page.screenshot({ path: `${OUTPUT_DIR}/home-job-sites.png`, fullPage: false });

  // ─── Job Site Detail ──────────────────────────────────────────────────
  // Homeowner Residence — 3 jobs visible
  console.log("📸 Job site detail...");
  await page.getByText("Homeowner Residence").click();
  await page.waitForSelector("text=Master Bathroom Remodel", { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUTPUT_DIR}/job-site-detail.png`, fullPage: false });

  // ─── Job Detail — Notes Tab ───────────────────────────────────────────
  // Master Bathroom Remodel has detailed markdown notes
  console.log("📸 Job detail (notes)...");
  await page.getByText("Master Bathroom Remodel").click();
  await page.waitForTimeout(2000);
  const notesTab = page.getByText("Notes", { exact: true });
  if (await notesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await notesTab.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${OUTPUT_DIR}/job-detail-notes.png`, fullPage: false });

  // ─── Contacts Tab ─────────────────────────────────────────────────────
  // Homeowner Residence has Bob Homeowner as primary + subcontractors
  console.log("📸 Contacts tab...");
  const contactsTab = page.getByText("Contacts", { exact: true });
  if (await contactsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await contactsTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUTPUT_DIR}/contacts-tab.png`, fullPage: false });
  }

  // ─── Estimates Tab ────────────────────────────────────────────────────
  // Master Bathroom Remodel has a detailed estimate with 4 line items
  console.log("📸 Estimates tab...");
  const estimatesTab = page.getByText("Estimates", { exact: true });
  if (await estimatesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await estimatesTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUTPUT_DIR}/estimates-tab.png`, fullPage: false });
  }

  // ─── Estimate Editor ──────────────────────────────────────────────────
  // Navigate to the estimate editor via URL by fetching the estimate ID from the API
  console.log("📸 Estimate editor...");
  try {
    // Get auth token from localStorage (zustand persist key)
    const token = await page.evaluate(() => {
      const raw = localStorage.getItem("sitekeeper-auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.state?.token || null;
      }
      return null;
    });

    if (token) {
      // Fetch the job sites to find Homeowner Residence -> Master Bathroom job -> estimate
      const sitesResp = await page.request.get("http://localhost:5000/api/v1/job-sites", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sites = await sitesResp.json();
      const homeownerSite = sites.find((s: any) => s.name === "Homeowner Residence");

      if (homeownerSite) {
        const jobsResp = await page.request.get(
          `http://localhost:5000/api/v1/job-sites/${homeownerSite.id}/jobs`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const jobs = await jobsResp.json();
        const bathJob = jobs.find((j: any) => j.name === "Master Bathroom Remodel");

        if (bathJob) {
          const estResp = await page.request.get(
            `http://localhost:5000/api/v1/jobs/${bathJob.id}/estimates`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const estimates = await estResp.json();
          if (estimates.length > 0) {
            const estimateId = estimates[0].id;
            // Navigate directly to the estimate editor
            await page.goto(`http://localhost:8081/estimates/${estimateId}`);
            await page.waitForTimeout(3000);
            await page.screenshot({ path: `${OUTPUT_DIR}/estimate-editor.png`, fullPage: false });

            // Scroll down to show line items & totals
            await page.evaluate(() => window.scrollBy(0, 500));
            await page.waitForTimeout(800);
            await page.screenshot({ path: `${OUTPUT_DIR}/estimate-editor-items.png`, fullPage: false });
          }
        }
      }
    }
  } catch (e) {
    console.log("  (skipped estimate editor:", (e as Error).message, ")");
  }

  // ─── Invoices Tab ─────────────────────────────────────────────────────
  // Navigate to a job that has invoices — Kitchen Sink Leak (paid invoice)
  console.log("📸 Invoices tab...");
  await page.goto("http://localhost:8081/");
  await page.waitForSelector("text=JobSyte", { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.getByText("Homeowner Residence").click();
  await page.waitForSelector("text=Fix Kitchen Sink Leak", { timeout: 10000 });
  await page.getByText("Fix Kitchen Sink Leak").click();
  await page.waitForTimeout(2000);
  const invoicesTab2 = page.getByText("Invoices", { exact: true });
  if (await invoicesTab2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await invoicesTab2.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUTPUT_DIR}/invoices-tab.png`, fullPage: false });
  }

  // ─── Invoice Editor ───────────────────────────────────────────────────
  // Navigate directly to an invoice editor via URL
  console.log("📸 Invoice editor...");
  try {
    const token = await page.evaluate(() => {
      const raw = localStorage.getItem("sitekeeper-auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.state?.token || null;
      }
      return null;
    });

    if (token) {
      const invoicesResp = await page.request.get("http://localhost:5000/api/v1/invoices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const invoices = await invoicesResp.json();
      // Pick the Gas Line Rough-In invoice (has a good amount of content)
      const gasInvoice = invoices.find((i: any) => i.title === "Gas Line Rough-In");
      if (gasInvoice) {
        await page.goto(`http://localhost:8081/invoices/${gasInvoice.id}`);
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${OUTPUT_DIR}/invoice-editor.png`, fullPage: false });
      }
    }
  } catch (e) {
    console.log("  (skipped invoice editor:", (e as Error).message, ")");
  }

  // ─── Media Tab (Photos) ───────────────────────────────────────────────
  // Go to Master Bathroom Remodel for the media tab
  console.log("📸 Media tab (photos)...");
  await page.goto("http://localhost:8081/");
  await page.waitForSelector("text=JobSyte", { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.getByText("Homeowner Residence").click();
  await page.waitForSelector("text=Master Bathroom Remodel", { timeout: 10000 });
  await page.getByText("Master Bathroom Remodel").click();
  await page.waitForTimeout(2000);
  const mediaTab = page.getByText("Media", { exact: true });
  if (await mediaTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await mediaTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUTPUT_DIR}/media-tab.png`, fullPage: false });
  }

  // ─── Time Tracking ────────────────────────────────────────────────────
  // Master Bathroom Remodel has multiple time entries from two users
  console.log("📸 Time tracking...");
  const timeTab = page.getByText("Time", { exact: true });
  if (await timeTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await timeTab.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${OUTPUT_DIR}/time-tracking.png`, fullPage: false });

  // ─── Invoice Management Dashboard ─────────────────────────────────────
  // Shows 4 invoices across all jobs in different statuses
  console.log("📸 Invoice management dashboard...");
  await page.goto("http://localhost:8081/invoices/manage");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUTPUT_DIR}/invoice-management.png`, fullPage: false });

  // Scroll down to show more invoices and summary
  await page.evaluate(() => window.scrollBy(0, 350));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUTPUT_DIR}/invoice-management-list.png`, fullPage: false });

  // ─── Saved Items (Item Library) ───────────────────────────────────────
  // Shows 6 saved items with their entries
  console.log("📸 Item Library (saved items)...");
  await page.goto("http://localhost:8081/saved-items");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUTPUT_DIR}/saved-items.png`, fullPage: false });

  // ─── Settings Screen ──────────────────────────────────────────────────
  console.log("📸 Settings...");
  await page.goto("http://localhost:8081/settings");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUTPUT_DIR}/settings.png`, fullPage: false });

  // ─── AI Assistant ─────────────────────────────────────────────────────
  console.log("📸 AI assistant...");
  await page.goto("http://localhost:8081/");
  await page.waitForSelector("text=JobSyte", { timeout: 10000 });
  await page.waitForTimeout(1500);
  try {
    const aiBubble = page.locator('[data-testid="ai-bubble"]');
    if (await aiBubble.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiBubble.click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUTPUT_DIR}/ai-assistant.png`, fullPage: false });
    } else {
      const aiButton = page.locator("text=AI").first();
      if (await aiButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await aiButton.click();
        await page.waitForTimeout(1200);
      }
      await page.screenshot({ path: `${OUTPUT_DIR}/ai-assistant.png`, fullPage: false });
    }
  } catch {
    await page.screenshot({ path: `${OUTPUT_DIR}/ai-assistant.png`, fullPage: false });
  }

  console.log("\n✅ All screenshots captured in frontend/assets/landing/docs/");
});
