/**
 * App branding constants.
 *
 * Change these values to rebrand the entire user-facing application.
 * Infrastructure identifiers (DB names, bucket names, bundle IDs) are
 * intentionally NOT derived from these — they are stable identity anchors.
 *
 * NOTE: app.config.js also reads APP_NAME — keep them in sync or change
 * this file to the single source and ensure app.config.js can require it.
 */

export const APP_NAME = "JobSyte";
export const AI_NAME = `${APP_NAME} AI`;

/**
 * Build version, baked in at build time via EXPO_PUBLIC_APP_VERSION
 * (set by deploy.sh to the git short SHA). Used to detect when the deployed
 * frontend is newer than the running tab (see useVersionCheck). Empty in local
 * dev, where the version check is effectively disabled.
 */
export const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION ?? "";

/**
 * Brand colors — derived from the JobSyte logo.
 * "Job" is rendered in dark navy, "Syte" in orange.
 */
export const BRAND_COLORS = {
  /** Dark navy used for "Job" text */
  dark: "#1a2530",
  /** Orange accent used for "Syte" text and primary actions */
  accent: "#FC7E1F",
  /** Slightly darker orange for pressed/hover states */
  accentDark: "#e06a10",
} as const;
