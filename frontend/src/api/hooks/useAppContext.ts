/**
 * Hook to fetch the app mode (tenant vs landing) on boot.
 *
 * Called once before the navigator decides which stack to render.
 * Supports EXPO_PUBLIC_FORCE_MODE override for local landing page development.
 */

import { useQuery } from "@tanstack/react-query";
import apiClient from "../client";
import type { AppContextResponse } from "../types";

/**
 * If EXPO_PUBLIC_FORCE_MODE is set to "landing", skip the API call
 * and return a mock landing response so you can develop the landing
 * page without changing backend config.
 */
const FORCE_MODE = process.env.EXPO_PUBLIC_FORCE_MODE ?? "";

export function useAppContext() {
  return useQuery<AppContextResponse>({
    queryKey: ["app-context"],
    queryFn: async () => {
      // Dev override: skip API call and force a mode
      if (FORCE_MODE === "landing") {
        return {
          mode: "landing",
        } satisfies AppContextResponse;
      }

      const { data } = await apiClient.get<AppContextResponse>("/api/v1/context");
      return data;
    },
    staleTime: Infinity, // Mode doesn't change during a session
    retry: 2,
  });
}
