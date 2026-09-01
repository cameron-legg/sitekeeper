/**
 * useVersionCheck — lightweight stale-frontend detection.
 *
 * Compares the version baked into this running bundle (APP_VERSION) against the
 * currently deployed /version.json. When they differ, it flags the version
 * store so the UpdateBanner can prompt the user to reload.
 *
 * Deliberately cheap:
 * - No polling interval. The check runs once on mount and again whenever the
 *   app regains focus/visibility (web: `visibilitychange`; native: AppState).
 *   This catches the "tab left open across a deploy" case the moment the user
 *   returns, without a background timer hammering the server.
 * - No-ops in local dev, where APP_VERSION is empty (nothing to compare).
 * - Fetches with cache: "no-store" so it always sees the freshly deployed
 *   value (nginx also serves version.json as no-cache).
 *
 * Mount this once, near the app root.
 */

import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { APP_VERSION } from "../config/app";
import { useVersionStore } from "../store/versionStore";

export function useVersionCheck() {
  const markUpdateAvailable = useVersionStore((s) => s.markUpdateAvailable);
  // Avoid overlapping fetches if focus events fire in quick succession.
  const inFlight = useRef(false);

  useEffect(() => {
    // Disabled when there's no baked version (local dev).
    if (!APP_VERSION) return;

    let cancelled = false;

    async function check() {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        // Relative URL → same origin (works for every tenant subdomain on web).
        const res = await fetch("/version.json", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        const latest = data?.version;
        if (!cancelled && latest && latest !== APP_VERSION) {
          markUpdateAvailable(latest);
        }
      } catch {
        // Network hiccup — ignore; we'll try again on the next focus.
      } finally {
        inFlight.current = false;
      }
    }

    // Initial check on mount.
    check();

    if (Platform.OS === "web") {
      const onVisible = () => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          check();
        }
      };
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVisible);
      }
      window.addEventListener?.("focus", onVisible);
      return () => {
        cancelled = true;
        if (typeof document !== "undefined") {
          document.removeEventListener("visibilitychange", onVisible);
        }
        window.removeEventListener?.("focus", onVisible);
      };
    }

    // Native: re-check when the app returns to the foreground.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [markUpdateAvailable]);
}
