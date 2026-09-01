/**
 * Version store — tracks whether a newer frontend build has been deployed.
 *
 * Set by useVersionCheck when the served /version.json differs from the
 * version baked into this running bundle. The UpdateBanner subscribes to it.
 *
 * Client-only, not persisted.
 */

import { create } from "zustand";

interface VersionStore {
  /** True once a newer deployed version has been detected. */
  updateAvailable: boolean;
  /** The version string the server is now serving (for display/debug). */
  latestVersion: string | null;
  markUpdateAvailable: (latestVersion: string) => void;
}

export const useVersionStore = create<VersionStore>((set) => ({
  updateAvailable: false,
  latestVersion: null,
  markUpdateAvailable: (latestVersion) =>
    set({ updateAvailable: true, latestVersion }),
}));
