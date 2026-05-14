/**
 * TanStack Query hooks for Contacts.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "../client";
import type { Contact, EffectivePrimaryContact } from "../types";

const KEYS = {
  forSite: (siteId: string) => ["contacts", "site", siteId] as const,
  forJob: (jobId: string) => ["contacts", "job", jobId] as const,
  effectivePrimary: (jobId: string) => ["contacts", "effective-primary", jobId] as const,
};

// ── Job site contacts ─────────────────────────────────────────────────────────

export function useJobSiteContacts(siteId: string) {
  return useQuery({
    queryKey: KEYS.forSite(siteId),
    queryFn: () =>
      apiClient
        .get<Contact[]>(`/api/v1/job-sites/${siteId}/contacts`)
        .then((r) => r.data),
    enabled: !!siteId,
  });
}

export function useAddContactToJobSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      siteId,
      ...data
    }: {
      siteId: string;
      name: string;
      phone?: string;
      email?: string;
      mailing_address?: string;
      notes?: string;
    }) =>
      apiClient
        .post<Contact>(`/api/v1/job-sites/${siteId}/contacts`, data)
        .then((r) => r.data),
    onSuccess: (_, { siteId }) => {
      qc.invalidateQueries({ queryKey: KEYS.forSite(siteId) });
      // Job contacts inherit from site, so invalidate job contact lists too
      qc.invalidateQueries({ queryKey: ["contacts", "job"] });
      qc.invalidateQueries({ queryKey: ["contacts", "effective-primary"] });
    },
  });
}

export function useRemoveContactFromJobSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, contactId }: { siteId: string; contactId: string }) =>
      apiClient.delete(`/api/v1/job-sites/${siteId}/contacts/${contactId}`),
    onSuccess: (_, { siteId }) => {
      qc.invalidateQueries({ queryKey: KEYS.forSite(siteId) });
      // Job contacts inherit from site, so invalidate job contact lists too
      qc.invalidateQueries({ queryKey: ["contacts", "job"] });
      qc.invalidateQueries({ queryKey: ["contacts", "effective-primary"] });
    },
  });
}

export function useSetPrimaryForJobSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ siteId, contactId }: { siteId: string; contactId: string }) =>
      apiClient.post(`/api/v1/job-sites/${siteId}/contacts/${contactId}/set-primary`),
    onSuccess: (_, { siteId }) => {
      qc.invalidateQueries({ queryKey: KEYS.forSite(siteId) });
      // Primary contact inheritance affects jobs
      qc.invalidateQueries({ queryKey: ["contacts", "effective-primary"] });
    },
  });
}

// ── Job contacts ──────────────────────────────────────────────────────────────

export function useJobContacts(jobId: string) {
  return useQuery({
    queryKey: KEYS.forJob(jobId),
    queryFn: () =>
      apiClient
        .get<Contact[]>(`/api/v1/jobs/${jobId}/contacts`)
        .then((r) => r.data),
    enabled: !!jobId,
  });
}

export function useEffectivePrimaryContact(jobId: string) {
  return useQuery({
    queryKey: KEYS.effectivePrimary(jobId),
    queryFn: () =>
      apiClient
        .get<EffectivePrimaryContact>(
          `/api/v1/jobs/${jobId}/contacts/effective-primary`
        )
        .then((r) => r.data),
    enabled: !!jobId,
  });
}

export function useAddContactToJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      jobId,
      ...data
    }: {
      jobId: string;
      name: string;
      phone?: string;
      email?: string;
      mailing_address?: string;
      notes?: string;
    }) =>
      apiClient
        .post<Contact>(`/api/v1/jobs/${jobId}/contacts`, data)
        .then((r) => r.data),
    onSuccess: (_, { jobId }) => {
      qc.invalidateQueries({ queryKey: KEYS.forJob(jobId) });
      qc.invalidateQueries({ queryKey: KEYS.effectivePrimary(jobId) });
    },
  });
}

export function useRemoveContactFromJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, contactId }: { jobId: string; contactId: string }) =>
      apiClient.delete(`/api/v1/jobs/${jobId}/contacts/${contactId}`),
    onSuccess: (_, { jobId }) => {
      qc.invalidateQueries({ queryKey: KEYS.forJob(jobId) });
      qc.invalidateQueries({ queryKey: KEYS.effectivePrimary(jobId) });
    },
  });
}

export function useSetPrimaryForJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, contactId }: { jobId: string; contactId: string }) =>
      apiClient.post(`/api/v1/jobs/${jobId}/contacts/${contactId}/set-primary`),
    onSuccess: (_, { jobId }) => {
      qc.invalidateQueries({ queryKey: KEYS.forJob(jobId) });
      qc.invalidateQueries({ queryKey: KEYS.effectivePrimary(jobId) });
    },
  });
}

// ── Contact update ────────────────────────────────────────────────────────────

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      contactId,
      ...data
    }: {
      contactId: string;
      name?: string;
      phone?: string;
      email?: string;
      mailing_address?: string;
      notes?: string;
    }) =>
      apiClient
        .patch<Contact>(`/api/v1/contacts/${contactId}`, data)
        .then((r) => r.data),
    onSuccess: () => {
      // Invalidate all contact queries — the contact may appear in multiple lists
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
