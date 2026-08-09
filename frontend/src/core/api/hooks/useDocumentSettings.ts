/**
 * TanStack Query hooks for document field settings (tenant-level).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../client";

export type FieldVisibility = "always_show" | "additional" | "disabled";

export interface DocumentFieldSetting {
  key: string;
  label: string;
  visibility: FieldVisibility;
  pdf_visible: boolean;
}

const KEYS = {
  forType: (docType: string) => ["document-field-settings", docType] as const,
};

export function useDocumentFieldSettings(documentType: "estimate" | "invoice") {
  return useQuery({
    queryKey: KEYS.forType(documentType),
    queryFn: () =>
      apiClient
        .get<DocumentFieldSetting[]>(`/api/v1/settings/document-fields/${documentType}`)
        .then((r) => r.data),
  });
}

export function useUpdateDocumentFieldSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentType,
      fields,
    }: {
      documentType: "estimate" | "invoice";
      fields: { key: string; visibility: FieldVisibility; pdf_visible: boolean }[];
    }) =>
      apiClient
        .put<DocumentFieldSetting[]>(`/api/v1/settings/document-fields/${documentType}`, { fields })
        .then((r) => r.data),
    onSuccess: (data, { documentType }) => {
      qc.setQueryData(KEYS.forType(documentType), data);
    },
  });
}
