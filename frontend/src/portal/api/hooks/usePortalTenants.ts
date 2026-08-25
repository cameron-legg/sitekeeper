/**
 * Portal tenant hooks — CRUD operations for tenant management.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Platform } from "react-native";
import { usePortalAuthStore } from "../../store/portalAuthStore";

// Portal API client — same base URL logic as the main client, but uses portal token
function getBaseURL(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
  if (Platform.OS !== "web") return envUrl || "http://localhost:5000";
  if (typeof window !== "undefined" && window.location?.hostname === "localhost") {
    return envUrl || "http://localhost:5000";
  }
  return "";
}

const portalClient = axios.create({
  baseURL: getBaseURL(),
  headers: { "Content-Type": "application/json" },
});

portalClient.interceptors.request.use((config) => {
  const token = usePortalAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

portalClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      usePortalAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  }
);

// Types
export interface PortalTenant {
  id: string;
  slug: string;
  name: string;
  status: string;
  domain: string;
  plan: string;
  created_at: string | null;
}

export interface TenantMetrics {
  users_count: number;
  logins_30d: number;
  job_sites_count: number;
  jobs_count: number;
  storage_bytes: number;
  recorded_at: string | null;
}

// Hooks
export function usePortalTenants() {
  return useQuery<PortalTenant[]>({
    queryKey: ["portal-tenants"],
    queryFn: () =>
      portalClient.get<PortalTenant[]>("/api/v1/portal/tenants").then((r) => r.data),
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { slug: string; name: string }) =>
      portalClient
        .post<PortalTenant>("/api/v1/portal/tenants", payload)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-tenants"] });
    },
  });
}

export function useDeleteTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) =>
      portalClient.delete(`/api/v1/portal/tenants/${slug}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-tenants"] });
    },
  });
}

export function useTenantMetrics(slug: string) {
  return useQuery<TenantMetrics>({
    queryKey: ["portal-tenants", slug, "metrics"],
    queryFn: () =>
      portalClient
        .get<TenantMetrics>(`/api/v1/portal/tenants/${slug}/metrics`)
        .then((r) => r.data),
    enabled: !!slug,
  });
}
