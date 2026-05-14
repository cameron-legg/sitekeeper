/**
 * TanStack Query hooks for Estimates, LineItems, and LineItemEntries (v2).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../client";
import type { Estimate, LineItem, LineItemEntry } from "../types";

const KEYS = {
  forJob: (jobId: string) => ["estimates", "job", jobId] as const,
  detail: (id: string) => ["estimates", id] as const,
  lineItems: (id: string) => ["estimates", id, "line-items"] as const,
};

// ── Estimates ─────────────────────────────────────────────────────────────────

export function useEstimates(jobId: string) {
  return useQuery({
    queryKey: KEYS.forJob(jobId),
    queryFn: () =>
      apiClient.get<Estimate[]>(`/api/v1/jobs/${jobId}/estimates`).then((r) => r.data),
    enabled: !!jobId,
  });
}

export function useEstimate(estimateId: string) {
  return useQuery({
    queryKey: KEYS.detail(estimateId),
    queryFn: () =>
      apiClient.get<Estimate>(`/api/v1/estimates/${estimateId}`).then((r) => r.data),
    enabled: !!estimateId,
  });
}

export function useCreateEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, title, tax_rate }: { jobId: string; title: string; tax_rate?: string }) =>
      apiClient.post<Estimate>(`/api/v1/jobs/${jobId}/estimates`, { title, tax_rate }).then((r) => r.data),
    onSuccess: (est) => qc.invalidateQueries({ queryKey: KEYS.forJob(est.job_id) }),
  });
}

export function useUpdateEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, ...data }: { estimateId: string; [key: string]: any }) =>
      apiClient.patch<Estimate>(`/api/v1/estimates/${estimateId}`, data).then((r) => r.data),
    onSuccess: (est) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(est.id) });
      qc.invalidateQueries({ queryKey: KEYS.forJob(est.job_id) });
    },
  });
}

export function useDeleteEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, jobId }: { estimateId: string; jobId: string }) =>
      apiClient.delete(`/api/v1/estimates/${estimateId}`),
    onSuccess: (_, { jobId }) => qc.invalidateQueries({ queryKey: KEYS.forJob(jobId) }),
  });
}

// ── Line items ────────────────────────────────────────────────────────────────

export function useEstimateLineItems(estimateId: string) {
  return useQuery({
    queryKey: KEYS.lineItems(estimateId),
    queryFn: () =>
      apiClient.get<LineItem[]>(`/api/v1/estimates/${estimateId}/line-items`).then((r) => r.data),
    enabled: !!estimateId,
  });
}

export function useAddEstimateLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, ...data }: { estimateId: string; name: string; notes?: string; hourly_rate?: string; sort_order?: number }) =>
      apiClient.post<LineItem>(`/api/v1/estimates/${estimateId}/line-items`, data).then((r) => r.data),
    onSuccess: (_, { estimateId }) => {
      qc.invalidateQueries({ queryKey: KEYS.lineItems(estimateId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(estimateId) });
      qc.invalidateQueries({ queryKey: ["estimates"] });
    },
  });
}

export function useUpdateEstimateLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, itemId, ...data }: { estimateId: string; itemId: string; name?: string; notes?: string; hourly_rate?: string }) =>
      apiClient.put<LineItem>(`/api/v1/estimates/${estimateId}/line-items/${itemId}`, data).then((r) => r.data),
    onSuccess: (_, { estimateId }) => {
      qc.invalidateQueries({ queryKey: KEYS.lineItems(estimateId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(estimateId) });
      qc.invalidateQueries({ queryKey: ["estimates"] });
    },
  });
}

export function useDeleteEstimateLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, itemId }: { estimateId: string; itemId: string }) =>
      apiClient.delete(`/api/v1/estimates/${estimateId}/line-items/${itemId}`),
    onSuccess: (_, { estimateId }) => {
      qc.invalidateQueries({ queryKey: KEYS.lineItems(estimateId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(estimateId) });
      qc.invalidateQueries({ queryKey: ["estimates"] });
    },
  });
}

// ── Entries ───────────────────────────────────────────────────────────────────

export function useAddEstimateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, itemId, ...data }: {
      estimateId: string; itemId: string; entry_type: "material" | "hours";
      name: string; notes?: string; url?: string;
      unit_price?: string; quantity?: string; hours?: string; sort_order?: number;
    }) =>
      apiClient.post<LineItemEntry>(`/api/v1/estimates/${estimateId}/line-items/${itemId}/entries`, data).then((r) => r.data),
    onSuccess: (_, { estimateId }) => {
      qc.invalidateQueries({ queryKey: KEYS.lineItems(estimateId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(estimateId) });
      qc.invalidateQueries({ queryKey: ["estimates"] });
    },
  });
}

export function useUpdateEstimateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, itemId, entryId, ...data }: {
      estimateId: string; itemId: string; entryId: string;
      name?: string; notes?: string; url?: string;
      unit_price?: string; quantity?: string; hours?: string;
    }) =>
      apiClient.put<LineItemEntry>(`/api/v1/estimates/${estimateId}/line-items/${itemId}/entries/${entryId}`, data).then((r) => r.data),
    onSuccess: (_, { estimateId }) => {
      qc.invalidateQueries({ queryKey: KEYS.lineItems(estimateId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(estimateId) });
      qc.invalidateQueries({ queryKey: ["estimates"] });
    },
  });
}

export function useDeleteEstimateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, itemId, entryId }: { estimateId: string; itemId: string; entryId: string }) =>
      apiClient.delete(`/api/v1/estimates/${estimateId}/line-items/${itemId}/entries/${entryId}`),
    onSuccess: (_, { estimateId }) => {
      qc.invalidateQueries({ queryKey: KEYS.lineItems(estimateId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(estimateId) });
      qc.invalidateQueries({ queryKey: ["estimates"] });
    },
  });
}

/** Copy a line item (and its entries) into the saved items library. */
export function useSaveEstimateLineItemToLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, itemId }: { estimateId: string; itemId: string }) =>
      apiClient
        .post(`/api/v1/estimates/${estimateId}/line-items/${itemId}/save-to-library`)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-items"] }),
  });
}

// ── Conversion ────────────────────────────────────────────────────────────────

export function useConvertEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, jobId }: { estimateId: string; jobId: string }) =>
      apiClient.post(`/api/v1/estimates/${estimateId}/convert-to-invoice`).then((r) => r.data),
    onSuccess: (_, { jobId }) => qc.invalidateQueries({ queryKey: ["invoices", "job", jobId] }),
  });
}
