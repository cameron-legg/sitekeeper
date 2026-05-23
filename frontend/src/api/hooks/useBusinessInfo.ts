/**
 * Business info query and mutation hooks.
 *
 * GET  /api/v1/business-info        — fetch tenant business info
 * PUT  /api/v1/business-info        — update business info fields
 * GET  /api/v1/business-info/users  — list approved users for owner picker
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../client";
import type { BusinessInfo, BusinessInfoUser } from "../types";

export function useBusinessInfo() {
  return useQuery<BusinessInfo>({
    queryKey: ["business-info"],
    queryFn: () => apiClient.get<BusinessInfo>("/api/v1/business-info").then((r) => r.data),
  });
}

export function useUpdateBusinessInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Omit<BusinessInfo, "id" | "owner_name">>) =>
      apiClient.put<BusinessInfo>("/api/v1/business-info", data).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(["business-info"], data);
    },
  });
}

export function useBusinessInfoUsers() {
  return useQuery<BusinessInfoUser[]>({
    queryKey: ["business-info", "users"],
    queryFn: () => apiClient.get<BusinessInfoUser[]>("/api/v1/business-info/users").then((r) => r.data),
  });
}
