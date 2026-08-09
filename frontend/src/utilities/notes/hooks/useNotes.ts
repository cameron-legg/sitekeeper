/**
 * TanStack Query hooks for Notes.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../../../core/api/client";
import type { Note } from "../../../core/api/types";

const KEYS = {
  forJob: (jobId: string) => ["notes", jobId] as const,
};

export function useNotes(jobId: string) {
  return useQuery({
    queryKey: KEYS.forJob(jobId),
    queryFn: () =>
      apiClient
        .get<Note[]>(`/api/v1/jobs/${jobId}/notes`)
        .then((r) => r.data),
    enabled: !!jobId,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, body }: { jobId: string; body: string }) =>
      apiClient
        .post<Note>(`/api/v1/jobs/${jobId}/notes`, { body })
        .then((r) => r.data),
    onSuccess: (_, { jobId }) =>
      qc.invalidateQueries({ queryKey: KEYS.forJob(jobId) }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      jobId,
      noteId,
      body,
    }: {
      jobId: string;
      noteId: string;
      body: string;
    }) =>
      apiClient
        .put<Note>(`/api/v1/jobs/${jobId}/notes/${noteId}`, { body })
        .then((r) => r.data),
    onSuccess: (_, { jobId }) =>
      qc.invalidateQueries({ queryKey: KEYS.forJob(jobId) }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, noteId }: { jobId: string; noteId: string }) =>
      apiClient.delete(`/api/v1/jobs/${jobId}/notes/${noteId}`),
    onSuccess: (_, { jobId }) =>
      qc.invalidateQueries({ queryKey: KEYS.forJob(jobId) }),
  });
}
