/**
 * Global error store — holds the most recent user-facing error notification.
 *
 * The Axios response interceptor (in api/client.ts) pushes errors here, and a
 * single <ErrorToast /> mounted at the app root renders them. This keeps error
 * surfacing out of individual screens.
 *
 * Client-only state — not persisted.
 */

import { create } from "zustand";

export interface AppErrorNotice {
  /** User-facing message. */
  message: string;
  /** Machine code from the backend envelope (e.g. "SERVER_ERROR"). */
  code?: string;
  /** Correlation id returned on 5xx responses — shown so users can quote it. */
  requestId?: string;
  /** Detailed fields, present only for tenants with debug_errors enabled. */
  type?: string;
  detail?: string;
  stackTrace?: string;
  /** HTTP status, when known. */
  status?: number;
}

interface ErrorStore {
  current: AppErrorNotice | null;
  /** Show an error notification. Replaces any currently shown one. */
  showError: (notice: AppErrorNotice) => void;
  /** Dismiss the current notification. */
  clearError: () => void;
}

export const useErrorStore = create<ErrorStore>((set) => ({
  current: null,
  showError: (notice) => set({ current: notice }),
  clearError: () => set({ current: null }),
}));

/**
 * Imperative helper for non-React callers (e.g. the Axios interceptor).
 */
export function showError(notice: AppErrorNotice) {
  useErrorStore.getState().showError(notice);
}
