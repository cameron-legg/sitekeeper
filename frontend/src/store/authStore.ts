/**
 * Zustand auth store with AsyncStorage / localStorage persistence.
 *
 * Stores the JWT token and userId so sessions survive app restarts.
 * On mobile the token is persisted to AsyncStorage; on web it falls back
 * to localStorage via the same zustand/middleware persist layer.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface AuthStore {
  token: string | null;
  userId: string | null;
  setAuth: (token: string, userId: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      setAuth: (token, userId) => set({ token, userId }),
      clearAuth: () => set({ token: null, userId: null }),
    }),
    {
      name: "sitekeeper-auth",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
