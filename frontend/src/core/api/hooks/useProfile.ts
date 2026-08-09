/**
 * Profile query and mutation hooks.
 *
 * GET  /api/v1/profile  — fetch current user's profile
 * PUT  /api/v1/profile  — update profile fields
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../client";
import type { UserProfile } from "../types";

export function useProfile() {
  return useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: () => apiClient.get<UserProfile>("/api/v1/profile").then((r) => r.data),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Omit<UserProfile, "id" | "email">>) =>
      apiClient.put<UserProfile>("/api/v1/profile", data).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(["profile"], data);
    },
  });
}
