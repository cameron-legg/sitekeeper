/**
 * Zustand auth store with AsyncStorage / localStorage persistence.
 *
 * Stores the JWT token and userId so sessions survive app restarts.
 * On web, uses localStorage directly (synchronous, no hydration delay).
 * On native, uses AsyncStorage.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface AuthStore {
  token: string | null;
  userId: string | null;
  // True once the store has finished rehydrating from storage.
  // Use this to gate rendering until the token state is known.
  _hydrated: boolean;
  setAuth: (token: string, userId: string) => void;
  clearAuth: () => void;
  setHydrated: () => void;
}

// On web, use localStorage directly to avoid AsyncStorage hydration delays
// that can cause a blank screen before the navigator renders.
const storage =
  Platform.OS === "web" && typeof localStorage !== "undefined"
    ? localStorage
    : AsyncStorage;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      _hydrated: false,
      setAuth: (token, userId) => set({ token, userId }),
      clearAuth: () => set({ token: null, userId: null }),
      setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: "sitekeeper-auth",
      storage: createJSONStorage(() => storage),
      // Only persist the auth fields, not internal state
      partialize: (state) => ({ token: state.token, userId: state.userId }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);
