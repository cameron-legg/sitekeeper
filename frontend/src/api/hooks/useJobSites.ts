/**
 * TanStack Query hooks for Job Sites.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../client";
import type { JobSite } from "../types";

const KEYS = {
  all: ["job-sites"] as const,
  detail: (id: string) => ["job-sites", id] as const,
};

// ── Queries ──────────────────────────────────────────────────────────────────

export function useJobSites() {
  return useQuery({
    queryKey: KEYS.all,
    queryFn: () =>
      apiClient.get<JobSite[]>("/api/v1/job-sites").then((r) => r.data),
  });
}

export function useJobSite(siteId: string) {
  return useQuery({
    queryKey: KEYS.detail(siteId),
    queryFn: () =>
      apiClient.get<JobSite>(`/api/v1/job-sites/${siteId}`).then((r) => r.data),
    enabled: !!siteId,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateJobSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiClient.post<JobSite>("/api/v1/job-sites", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdateJobSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      siteId,
      ...data
    }: {
      siteId: string;
      name?: string;
      description?: string;
    }) =>
      apiClient
        .put<JobSite>(`/api/v1/job-sites/${siteId}`, data)
        .then((r) => r.data),
    onSuccess: (_, { siteId }) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.detail(siteId) });
    },
  });
}

export function useDeleteJobSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (siteId: string) =>
      apiClient.delete(`/api/v1/job-sites/${siteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}
