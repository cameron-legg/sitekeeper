/**
 * TanStack Query hooks for Time Entries (clock in/out + manual hours).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../client";
import type { TimeEntry, ClockStatus } from "../types";

const KEYS = {
  forJob: (jobId: string) => ["time-entries", "job", jobId] as const,
  status: (jobId: string) => ["time-entries", "status", jobId] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useTimeEntries(jobId: string) {
  return useQuery<TimeEntry[]>({
    queryKey: KEYS.forJob(jobId),
    queryFn: () =>
      apiClient
        .get<TimeEntry[]>(`/api/v1/jobs/${jobId}/time-entries`)
        .then((r) => r.data),
    enabled: !!jobId,
  });
}

export function useClockStatus(jobId: string) {
  return useQuery<ClockStatus>({
    queryKey: KEYS.status(jobId),
    queryFn: () =>
      apiClient
        .get<ClockStatus>(`/api/v1/jobs/${jobId}/time-entries/status`)
        .then((r) => r.data),
    enabled: !!jobId,
    refetchInterval: 60000, // refresh every minute to keep timer accurate
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, note }: { jobId: string; note?: string }) =>
      apiClient
        .post<TimeEntry>(`/api/v1/jobs/${jobId}/time-entries/clock-in`, { note })
        .then((r) => r.data),
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: KEYS.forJob(entry.job_id) });
      qc.invalidateQueries({ queryKey: KEYS.status(entry.job_id) });
    },
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId }: { jobId: string }) =>
      apiClient
        .post<TimeEntry>(`/api/v1/jobs/${jobId}/time-entries/clock-out`)
        .then((r) => r.data),
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: KEYS.forJob(entry.job_id) });
      qc.invalidateQueries({ queryKey: KEYS.status(entry.job_id) });
    },
  });
}

export function useAddManualTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      jobId,
      hours,
      note,
      worked_at,
    }: {
      jobId: string;
      hours: string;
      note?: string;
      worked_at?: string;
    }) =>
      apiClient
        .post<TimeEntry>(`/api/v1/jobs/${jobId}/time-entries`, { hours, note, worked_at })
        .then((r) => r.data),
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: KEYS.forJob(entry.job_id) });
      qc.invalidateQueries({ queryKey: KEYS.status(entry.job_id) });
    },
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, jobId }: { entryId: string; jobId: string }) =>
      apiClient.delete(`/api/v1/time-entries/${entryId}`),
    onSuccess: (_, { jobId }) => {
      qc.invalidateQueries({ queryKey: KEYS.forJob(jobId) });
      qc.invalidateQueries({ queryKey: KEYS.status(jobId) });
    },
  });
}
