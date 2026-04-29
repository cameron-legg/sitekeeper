/**
 * TanStack Query hooks and helpers for PDF generation and download.
 *
 * Works on both web (arraybuffer + blob URL + anchor click) and native
 * (expo-file-system File API + expo-sharing share sheet).
 */

import { Platform } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../client";
import { useAuthStore } from "../../store/authStore";

// ── Generate mutations ────────────────────────────────────────────────────────

export function useGenerateEstimatePdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId }: { estimateId: string }) =>
      apiClient.post(`/api/v1/estimates/${estimateId}/pdf`).then((r) => r.data),
    onSuccess: (_, { estimateId }) =>
      qc.invalidateQueries({ queryKey: ["estimates", estimateId] }),
  });
}

export function useGenerateInvoicePdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId }: { invoiceId: string }) =>
      apiClient.post(`/api/v1/invoices/${invoiceId}/pdf`).then((r) => r.data),
    onSuccess: (_, { invoiceId }) =>
      qc.invalidateQueries({ queryKey: ["invoices", invoiceId] }),
  });
}

// ── Download helpers ──────────────────────────────────────────────────────────

function extractFilename(
  contentDisposition: string | undefined,
  fallback: string
): string {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
  return match ? match[1] : fallback;
}

function getFullUrl(path: string): string {
  const baseURL = apiClient.defaults.baseURL ?? "http://localhost:5000";
  return `${baseURL}${path}`;
}

// ── Web download ──────────────────────────────────────────────────────────────

async function downloadPdfWeb(url: string, fallbackFilename: string): Promise<void> {
  const response = await apiClient.get(url, {
    responseType: "arraybuffer",
  });

  const filename = extractFilename(
    response.headers["content-disposition"],
    fallbackFilename
  );

  const blob = new Blob([response.data], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(blobUrl);
  }, 100);
}

// ── Native download (Android / iOS) — SDK 54 File API ────────────────────────

async function downloadPdfNative(apiPath: string, fallbackFilename: string): Promise<void> {
  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");

  const token = useAuthStore.getState().token;
  const fullUrl = getFullUrl(apiPath);

  // Use expo/fetch to download the PDF with auth headers
  const response = await fetch(fullUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  // Read the response as an ArrayBuffer, then write to a File
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const file = new File(Paths.cache, fallbackFilename);
  file.write(bytes);

  // Open the native share sheet
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
    });
  } else {
    throw new Error("Sharing is not available on this device.");
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function downloadEstimatePdf(estimateId: string): Promise<void> {
  const apiPath = `/api/v1/estimates/${estimateId}/pdf`;
  const fallback = `estimate-${estimateId}.pdf`;

  if (Platform.OS === "web") {
    await downloadPdfWeb(apiPath, fallback);
  } else {
    await downloadPdfNative(apiPath, fallback);
  }
}

export async function downloadInvoicePdf(invoiceId: string): Promise<void> {
  const apiPath = `/api/v1/invoices/${invoiceId}/pdf`;
  const fallback = `invoice-${invoiceId}.pdf`;

  if (Platform.OS === "web") {
    await downloadPdfWeb(apiPath, fallback);
  } else {
    await downloadPdfNative(apiPath, fallback);
  }
}
