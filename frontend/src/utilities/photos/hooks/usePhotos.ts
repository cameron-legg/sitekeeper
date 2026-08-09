/**
 * TanStack Query hooks for Job Photos (media uploads).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import apiClient from "../../../core/api/client";
import type { JobPhoto } from "../../../core/api/types";

const KEYS = {
  forJob: (jobId: string) => ["photos", "job", jobId] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useJobPhotos(jobId: string) {
  return useQuery<JobPhoto[]>({
    queryKey: KEYS.forJob(jobId),
    queryFn: () =>
      apiClient
        .get<JobPhoto[]>(`/api/v1/jobs/${jobId}/photos`)
        .then((r) => r.data),
    enabled: !!jobId,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      uri,
      filename,
      mimeType,
    }: {
      jobId: string;
      uri: string;
      filename: string;
      mimeType: string;
    }) => {
      const formData = new FormData();

      if (Platform.OS === "web") {
        // On web, uri is a blob URL or data URL — fetch it as a blob
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append("file", blob, filename);
      } else {
        // On native (iOS/Android), append the file URI directly
        // React Native's FormData handles file URIs natively
        formData.append("file", {
          uri,
          name: filename,
          type: mimeType,
        } as any);
      }

      const res = await apiClient.post<JobPhoto>(
        `/api/v1/jobs/${jobId}/photos`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return res.data;
    },
    onSuccess: (photo) => {
      qc.invalidateQueries({ queryKey: KEYS.forJob(photo.job_id) });
    },
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId }: { photoId: string; jobId: string }) =>
      apiClient.delete(`/api/v1/photos/${photoId}`),
    onSuccess: (_, { jobId }) => {
      qc.invalidateQueries({ queryKey: KEYS.forJob(jobId) });
    },
  });
}

/**
 * Build the URL for downloading/displaying a photo.
 * Includes the auth token as a query parameter since <Image> components
 * cannot reliably send Authorization headers on all platforms.
 */
export function getPhotoUrl(photoId: string, token: string | null): string {
  const baseURL = apiClient.defaults.baseURL || "";
  const url = `${baseURL}/api/v1/photos/${photoId}`;
  if (token) {
    return `${url}?token=${encodeURIComponent(token)}`;
  }
  return url;
}

// ── Document photo attachments (estimate/invoice) ─────────────────────────────

export function useDocumentPhotos(documentId: string, documentType: "estimate" | "invoice") {
  const path = documentType === "estimate" ? "estimates" : "invoices";
  return useQuery<JobPhoto[]>({
    queryKey: ["document-photos", documentType, documentId] as const,
    queryFn: () =>
      apiClient
        .get<JobPhoto[]>(`/api/v1/${path}/${documentId}/photos`)
        .then((r) => r.data),
    enabled: !!documentId,
  });
}

export function useSetDocumentPhotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentId,
      documentType,
      photoIds,
    }: {
      documentId: string;
      documentType: "estimate" | "invoice";
      photoIds: string[];
    }) => {
      const path = documentType === "estimate" ? "estimates" : "invoices";
      return apiClient
        .put<JobPhoto[]>(`/api/v1/${path}/${documentId}/photos`, { photo_ids: photoIds })
        .then((r) => r.data);
    },
    onSuccess: (_, { documentId, documentType }) => {
      qc.invalidateQueries({ queryKey: ["document-photos", documentType, documentId] });
      // Mark PDF as stale
      if (documentType === "estimate") {
        qc.invalidateQueries({ queryKey: ["estimates"] });
      } else {
        qc.invalidateQueries({ queryKey: ["invoices"] });
      }
    },
  });
}
