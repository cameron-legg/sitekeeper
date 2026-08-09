/**
 * Admin hooks — manage tenant users.
 *
 * GET   /api/v1/admin/users       — list all users in the tenant
 * PATCH /api/v1/admin/users/:id   — update user approval/role
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../client";
import type { TenantUser } from "../types";

export function useAdminUsers() {
  return useQuery<TenantUser[]>({
    queryKey: ["admin", "users"],
    queryFn: () =>
      apiClient.get<TenantUser[]>("/api/v1/admin/users").then((r) => r.data),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: { is_approved?: boolean; role?: string };
    }) =>
      apiClient
        .patch<TenantUser>(`/api/v1/admin/users/${userId}`, data)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}
