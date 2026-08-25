/**
 * Zustand portal auth store — separate from tenant auth.
 *
 * Stores the platform JWT token and user info for the portal control plane.
 * Uses a different storage key so it doesn't conflict with tenant auth.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface PortalAuthStore {
  token: string | null;
  userId: string | null;
  name: string | null;
  email: string | null;
  _hydrated: boolean;
  setAuth: (token: string, userId: string, name: string | null, email: string | null) => void;
  clearAuth: () => void;
  setHydrated: () => void;
}

const storage =
  Platform.OS === "web" && typeof localStorage !== "undefined"
    ? localStorage
    : AsyncStorage;

export const usePortalAuthStore = create<PortalAuthStore>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      name: null,
      email: null,
      _hydrated: false,
      setAuth: (token, userId, name, email) =>
        set({ token, userId, name, email }),
      clearAuth: () => set({ token: null, userId: null, name: null, email: null }),
      setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: "portal-auth",
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        token: state.token,
        userId: state.userId,
        name: state.name,
        email: state.email,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
