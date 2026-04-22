/**
 * TanStack Query hooks for Jobs.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../client";
import type { Job } from "../types";

const KEYS = {
  forSite: (siteId: string) => ["jobs", "site", siteId] as const,
  detail: (jobId: string) => ["jobs", jobId] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useJobs(siteId: string) {
  return useQuery({
    queryKey: KEYS.forSite(siteId),
    queryFn: () =>
      apiClient
        .get<Job[]>(`/api/v1/job-sites/${siteId}/jobs`)
        .then((r) => r.data),
    enabled: !!siteId,
  });
}

export function useJob(jobId: string) {
  return useQuery({
    queryKey: KEYS.detail(jobId),
    queryFn: () =>
      apiClient.get<Job>(`/api/v1/jobs/${jobId}`).then((r) => r.data),
    enabled: !!jobId,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      siteId,
      ...data
    }: {
      siteId: string;
      name: string;
      status?: string;
      description?: string;
    }) =>
      apiClient
        .post<Job>(`/api/v1/job-sites/${siteId}/jobs`, data)
        .then((r) => r.data),
    onSuccess: (_, { siteId }) => {
      qc.invalidateQueries({ queryKey: KEYS.forSite(siteId) });
      // Also refresh site list so job_count updates
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      jobId,
      ...data
    }: {
      jobId: string;
      name?: string;
      status?: string;
      description?: string;
      finished_at?: string | null;
    }) =>
      apiClient.patch<Job>(`/api/v1/jobs/${jobId}`, data).then((r) => r.data),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(job.id) });
      qc.invalidateQueries({ queryKey: KEYS.forSite(job.job_site_id) });
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, siteId }: { jobId: string; siteId: string }) =>
      apiClient.delete(`/api/v1/jobs/${jobId}`),
    onSuccess: (_, { siteId }) => {
      qc.invalidateQueries({ queryKey: KEYS.forSite(siteId) });
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
  });
}
