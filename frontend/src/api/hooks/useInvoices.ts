/**
 * TanStack Query hooks for Invoices, LineItems, and LineItemEntries (v2).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../client";
import type { Invoice, InvoiceWithContext, LineItem, LineItemEntry } from "../types";

const KEYS = {
  all: ["invoices", "all"] as const,
  forJob: (jobId: string) => ["invoices", "job", jobId] as const,
  detail: (id: string) => ["invoices", id] as const,
  lineItems: (id: string) => ["invoices", id, "line-items"] as const,
};

/** Fetch all invoices across all jobs/sites (for Invoice Management screen). */
export function useAllInvoices() {
  return useQuery({
    queryKey: KEYS.all,
    queryFn: () =>
      apiClient.get<InvoiceWithContext[]>("/api/v1/invoices").then((r) => r.data),
  });
}

export function useInvoices(jobId: string) {
  return useQuery({
    queryKey: KEYS.forJob(jobId),
    queryFn: () =>
      apiClient.get<Invoice[]>(`/api/v1/jobs/${jobId}/invoices`).then((r) => r.data),
    enabled: !!jobId,
  });
}

export function useInvoice(invoiceId: string) {
  return useQuery({
    queryKey: KEYS.detail(invoiceId),
    queryFn: () =>
      apiClient.get<Invoice>(`/api/v1/invoices/${invoiceId}`).then((r) => r.data),
    enabled: !!invoiceId,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, title, tax_rate }: { jobId: string; title: string; tax_rate?: string }) =>
      apiClient.post<Invoice>(`/api/v1/jobs/${jobId}/invoices`, { title, tax_rate }).then((r) => r.data),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: KEYS.forJob(inv.job_id) });
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, ...data }: { invoiceId: string; [key: string]: any }) =>
      apiClient.patch<Invoice>(`/api/v1/invoices/${invoiceId}`, data).then((r) => r.data),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(inv.id) });
      qc.invalidateQueries({ queryKey: KEYS.forJob(inv.job_id) });
      qc.invalidateQueries({ queryKey: KEYS.all });
      // Invoice status counts are also surfaced on jobs and job-sites
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, jobId }: { invoiceId: string; jobId: string }) =>
      apiClient.delete(`/api/v1/invoices/${invoiceId}`),
    onSuccess: (_, { jobId }) => {
      qc.invalidateQueries({ queryKey: KEYS.forJob(jobId) });
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job-sites"] });
    },
  });
}

export function usePopulateInvoiceDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId }: { invoiceId: string }) =>
      apiClient.post<Invoice>(`/api/v1/invoices/${invoiceId}/populate-defaults`).then((r) => r.data),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(inv.id) });
      qc.invalidateQueries({ queryKey: KEYS.forJob(inv.job_id) });
    },
  });
}

export function useInvoiceLineItems(invoiceId: string) {
  return useQuery({
    queryKey: KEYS.lineItems(invoiceId),
    queryFn: () =>
      apiClient.get<LineItem[]>(`/api/v1/invoices/${invoiceId}/line-items`).then((r) => r.data),
    enabled: !!invoiceId,
  });
}

export function useAddInvoiceLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, ...data }: { invoiceId: string; name: string; notes?: string; hourly_rate?: string; sort_order?: number }) =>
      apiClient.post<LineItem>(`/api/v1/invoices/${invoiceId}/line-items`, data).then((r) => r.data),
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: KEYS.lineItems(invoiceId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(invoiceId) });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useUpdateInvoiceLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, itemId, ...data }: { invoiceId: string; itemId: string; name?: string; notes?: string; hourly_rate?: string }) =>
      apiClient.put<LineItem>(`/api/v1/invoices/${invoiceId}/line-items/${itemId}`, data).then((r) => r.data),
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: KEYS.lineItems(invoiceId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(invoiceId) });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useDeleteInvoiceLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, itemId }: { invoiceId: string; itemId: string }) =>
      apiClient.delete(`/api/v1/invoices/${invoiceId}/line-items/${itemId}`),
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: KEYS.lineItems(invoiceId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(invoiceId) });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useAddInvoiceEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, itemId, ...data }: {
      invoiceId: string; itemId: string; entry_type: "material" | "hours";
      name: string; notes?: string; url?: string;
      unit_price?: string; quantity?: string; hours?: string; sort_order?: number;
    }) =>
      apiClient.post<LineItemEntry>(`/api/v1/invoices/${invoiceId}/line-items/${itemId}/entries`, data).then((r) => r.data),
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: KEYS.lineItems(invoiceId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(invoiceId) });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useUpdateInvoiceEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, itemId, entryId, ...data }: {
      invoiceId: string; itemId: string; entryId: string;
      name?: string; notes?: string; url?: string;
      unit_price?: string; quantity?: string; hours?: string;
    }) =>
      apiClient.put<LineItemEntry>(`/api/v1/invoices/${invoiceId}/line-items/${itemId}/entries/${entryId}`, data).then((r) => r.data),
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: KEYS.lineItems(invoiceId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(invoiceId) });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useDeleteInvoiceEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, itemId, entryId }: { invoiceId: string; itemId: string; entryId: string }) =>
      apiClient.delete(`/api/v1/invoices/${invoiceId}/line-items/${itemId}/entries/${entryId}`),
    onSuccess: (_, { invoiceId }) => {
      qc.invalidateQueries({ queryKey: KEYS.lineItems(invoiceId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(invoiceId) });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

/** Copy a line item (and its entries) into the saved items library. */
export function useSaveInvoiceLineItemToLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, itemId }: { invoiceId: string; itemId: string }) =>
      apiClient
        .post(`/api/v1/invoices/${invoiceId}/line-items/${itemId}/save-to-library`)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-items"] }),
  });
}
