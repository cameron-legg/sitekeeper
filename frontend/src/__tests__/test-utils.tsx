/**
 * Shared test utilities — wrappers, factories, mock helpers.
 *
 * Use `renderWithProviders` to render components that need QueryClient.
 * Use `createMockXxx` factories to generate typed test data.
 */

import React from "react";
import { render, RenderOptions } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Fresh QueryClient per test — no retries, no caching for determinism
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Render a component wrapped with QueryClientProvider.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient };
}

// ---------------------------------------------------------------------------
// Data factories — generate typed mock objects for tests
// ---------------------------------------------------------------------------

export function createMockJobSite(overrides: Partial<any> = {}) {
  return {
    id: "site-1",
    user_id: "user-1",
    name: "Test Site",
    description: null,
    address: "123 Main St",
    default_hourly_rate: "85.00",
    primary_contact_id: null,
    job_count: 2,
    active_job_count: 1,
    invoice_status_counts: { drafting: 0, waiting_to_send: 0, sent_awaiting_payment: 0, paid: 0 },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createMockJob(overrides: Partial<any> = {}) {
  return {
    id: "job-1",
    job_site_id: "site-1",
    name: "Test Job",
    status: "pending",
    description: null,
    default_hourly_rate: "85.00",
    primary_contact_id: null,
    finished_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    invoice_status_counts: { drafting: 0, waiting_to_send: 0, sent_awaiting_payment: 0, paid: 0 },
    employees: [],
    ...overrides,
  };
}

export function createMockEstimate(overrides: Partial<any> = {}) {
  return {
    id: "est-1",
    job_id: "job-1",
    title: "Test Estimate",
    delivered: false,
    tax_rate: "8.5",
    subtotal: "500.00",
    tax_amount: "25.50",
    total: "525.50",
    materials_cost: "300.00",
    labor_cost: "200.00",
    labor_hours: "4.0",
    fee_cost: "0.00",
    labor_and_fees: "200.00",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    pdf_status: "none",
    document_number: "1001",
    document_date: "2026-01-01",
    bill_to: "John Doe",
    company_name: "Test Co",
    user_name: "Tester",
    user_phone: "555-0000",
    user_email: "test@test.com",
    payment_method: null,
    business_address: null,
    worksite_address: null,
    notes: null,
    show_document_number: true,
    show_document_date: true,
    show_bill_to: true,
    show_company_name: true,
    show_user_name: true,
    show_user_phone: true,
    show_user_email: true,
    show_payment_method: true,
    show_business_address: true,
    show_worksite_address: true,
    show_notes: true,
    ...overrides,
  };
}

export function createMockInvoice(overrides: Partial<any> = {}) {
  return {
    ...createMockEstimate(),
    id: "inv-1",
    status: "drafting" as const,
    status_changed_at: "2026-01-01T00:00:00Z",
    source_estimate_id: null,
    ...overrides,
  };
}

export function createMockLineItem(overrides: Partial<any> = {}) {
  return {
    id: "li-1",
    parent_id: "est-1",
    parent_type: "estimate",
    name: "Test Line Item",
    notes: null,
    hourly_rate: "85.00",
    sort_order: 0,
    total_cost: "250.00",
    total_hours: "2.0",
    entries: [],
    ...overrides,
  };
}

export function createMockEntry(overrides: Partial<any> = {}) {
  return {
    id: "entry-1",
    line_item_id: "li-1",
    entry_type: "material" as const,
    name: "Test Material",
    notes: null,
    url: null,
    unit_price: "25.00",
    quantity: "2",
    hours: null,
    sort_order: 0,
    ...overrides,
  };
}

export function createMockContact(overrides: Partial<any> = {}) {
  return {
    id: "contact-1",
    name: "John Doe",
    phone: "555-1234",
    email: "john@example.com",
    mailing_address: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createMockTimeEntry(overrides: Partial<any> = {}) {
  return {
    id: "te-1",
    job_id: "job-1",
    user_id: "user-1",
    user_name: "Test User",
    clock_in: null,
    clock_out: null,
    hours: "2.5",
    worked_at: "2026-01-15T10:00:00Z",
    note: "Test entry",
    created_at: "2026-01-15T10:00:00Z",
    ...overrides,
  };
}

export function createMockSavedItem(overrides: Partial<any> = {}) {
  return {
    id: "si-1",
    user_id: "user-1",
    name: "Saved Template",
    notes: null,
    hourly_rate: "75.00",
    entries: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}
