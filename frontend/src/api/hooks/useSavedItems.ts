/**
 * TanStack Query hooks for Saved Items and their entries (v2).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../client";
import type { SavedItem, SavedItemEntry } from "../types";

const KEYS = {
  all: ["saved-items"] as const,
  detail: (id: string) => ["saved-items", id] as const,
};

export function useSavedItems() {
  return useQuery({
    queryKey: KEYS.all,
    queryFn: () => apiClient.get<SavedItem[]>("/api/v1/saved-items").then((r) => r.data),
  });
}

export function useAllSavedEntries() {
  return useQuery({
    queryKey: ["saved-entries"] as const,
    queryFn: () => apiClient.get<SavedItemEntry[]>("/api/v1/saved-items/entries").then((r) => r.data),
  });
}

export function useSavedItem(itemId: string) {
  return useQuery({
    queryKey: KEYS.detail(itemId),
    queryFn: () => apiClient.get<SavedItem>(`/api/v1/saved-items/${itemId}`).then((r) => r.data),
    enabled: !!itemId,
  });
}

export function useCreateSavedItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; notes?: string; hourly_rate?: string }) =>
      apiClient.post<SavedItem>("/api/v1/saved-items", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdateSavedItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...data }: { itemId: string; name: string; notes?: string; hourly_rate?: string }) =>
      apiClient.put<SavedItem>(`/api/v1/saved-items/${itemId}`, data).then((r) => r.data),
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.detail(item.id) });
    },
  });
}

export function useDeleteSavedItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => apiClient.delete(`/api/v1/saved-items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useAddSavedItemEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...data }: {
      itemId: string; entry_type: "material" | "hours"; name: string;
      notes?: string; url?: string; unit_price?: string; quantity?: string;
      hours?: string; sort_order?: number;
    }) =>
      apiClient.post<SavedItemEntry>(`/api/v1/saved-items/${itemId}/entries`, data).then((r) => r.data),
    onSuccess: (_, { itemId }) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.detail(itemId) });
      qc.invalidateQueries({ queryKey: ["saved-entries"] });
    },
  });
}

export function useUpdateSavedItemEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, entryId, ...data }: {
      itemId: string; entryId: string; name?: string; notes?: string; url?: string;
      unit_price?: string; quantity?: string; hours?: string;
    }) =>
      apiClient.put<SavedItemEntry>(`/api/v1/saved-items/${itemId}/entries/${entryId}`, data).then((r) => r.data),
    onSuccess: (_, { itemId }) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.detail(itemId) });
      qc.invalidateQueries({ queryKey: ["saved-entries"] });
    },
  });
}

export function useDeleteSavedItemEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, entryId }: { itemId: string; entryId: string }) =>
      apiClient.delete(`/api/v1/saved-items/${itemId}/entries/${entryId}`),
    onSuccess: (_, { itemId }) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.detail(itemId) });
      qc.invalidateQueries({ queryKey: ["saved-entries"] });
    },
  });
}

/** Copy a saved item into a new LineItem on an estimate or invoice. */
export function usePopulateSavedItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, parentId, parentType }: {
      itemId: string;
      parentId: string;
      parentType: "estimate" | "invoice";
    }) =>
      apiClient
        .post(`/api/v1/saved-items/${itemId}/populate`, { parent_id: parentId, parent_type: parentType })
        .then((r) => r.data),
    onSuccess: (_, { parentId, parentType }) => {
      if (parentType === "estimate") {
        qc.invalidateQueries({ queryKey: ["estimates", parentId, "line-items"] });
        qc.invalidateQueries({ queryKey: ["estimates", parentId] });
        qc.invalidateQueries({ queryKey: ["estimates"] });
      } else {
        qc.invalidateQueries({ queryKey: ["invoices", parentId, "line-items"] });
        qc.invalidateQueries({ queryKey: ["invoices", parentId] });
        qc.invalidateQueries({ queryKey: ["invoices"] });
      }
    },
  });
}

/** Save a single entry (material or hours) to the library as a new SavedItem. */
export function useSaveEntryToLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      entry_type: "material" | "hours";
      name: string;
      notes?: string;
      url?: string;
      unit_price?: string;
      quantity?: string;
      hours?: string;
    }) =>
      apiClient.post<SavedItem>("/api/v1/saved-items/save-entry", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ["saved-entries"] });
    },
  });
}

/** Copy a single saved item entry into an existing line item. */
export function usePopulateSavedEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, lineItemId, parentId, parentType }: {
      entryId: string;
      lineItemId: string;
      parentId: string;
      parentType: "estimate" | "invoice";
    }) =>
      apiClient
        .post(`/api/v1/saved-items/entries/${entryId}/populate`, {
          line_item_id: lineItemId,
          parent_id: parentId,
          parent_type: parentType,
        })
        .then((r) => r.data),
    onSuccess: (_, { parentId, parentType }) => {
      if (parentType === "estimate") {
        qc.invalidateQueries({ queryKey: ["estimates", parentId, "line-items"] });
        qc.invalidateQueries({ queryKey: ["estimates", parentId] });
        qc.invalidateQueries({ queryKey: ["estimates"] });
      } else {
        qc.invalidateQueries({ queryKey: ["invoices", parentId, "line-items"] });
        qc.invalidateQueries({ queryKey: ["invoices", parentId] });
        qc.invalidateQueries({ queryKey: ["invoices"] });
      }
    },
  });
}
