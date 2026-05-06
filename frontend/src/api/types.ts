/**
 * Shared API response types matching the Flask backend serializers (v2).
 */

export interface JobSite {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  address: string | null;
  primary_contact_id: string | null;
  job_count: number;
  active_job_count: number;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  job_site_id: string;
  name: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  description: string | null;
  primary_contact_id: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  mailing_address: string | null;
  notes: string | null;
  created_at: string;
}

export interface EffectivePrimaryContact {
  contact: Contact | null;
  source: "direct" | "inherited" | null;
}

export interface Note {
  id: string;
  job_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

/** A sub-item under a LineItem — either a material or hours entry. */
export interface LineItemEntry {
  id: string;
  line_item_id: string;
  entry_type: "material" | "hours";
  name: string;
  notes: string | null;
  url: string | null;
  /** Material only */
  unit_price: string | null;
  quantity: string | null;
  /** Hours only */
  hours: string | null;
  sort_order: number;
}

/** A named group (e.g. "Toilet Replacement") with sub-entries. */
export interface LineItem {
  id: string;
  parent_id: string;
  parent_type: "estimate" | "invoice";
  name: string;
  notes: string | null;
  hourly_rate: string | null;
  sort_order: number;
  /** Derived: sum of all entry costs */
  total_cost: string;
  /** Derived: sum of all hours entries */
  total_hours: string;
  entries: LineItemEntry[];
}

export interface Estimate {
  id: string;
  job_id: string;
  title: string;
  delivered: boolean;
  /** Tax rate as a percentage string, e.g. "8.5" = 8.5%. Null = no tax. */
  tax_rate: string | null;
  /** Pre-tax total of all line items */
  subtotal: string;
  /** Tax amount (applied to material entries only) */
  tax_amount: string;
  /** subtotal + tax_amount */
  total: string;
  created_at: string;
  updated_at: string;
  /** Computed PDF status: "none" if never generated, "current" if up-to-date, "stale" if document changed since last generation */
  pdf_status: "none" | "current" | "stale";
}

export interface Invoice {
  id: string;
  job_id: string;
  title: string;
  delivered: boolean;
  source_estimate_id: string | null;
  /** Tax rate as a percentage string, e.g. "8.5" = 8.5%. Null = no tax. */
  tax_rate: string | null;
  /** Pre-tax total of all line items */
  subtotal: string;
  /** Tax amount (applied to material entries only) */
  tax_amount: string;
  /** subtotal + tax_amount */
  total: string;
  created_at: string;
  updated_at: string;
  /** Computed PDF status: "none" if never generated, "current" if up-to-date, "stale" if document changed since last generation */
  pdf_status: "none" | "current" | "stale";
}

/** A sub-entry under a SavedItem. */
export interface SavedItemEntry {
  id: string;
  saved_item_id: string;
  entry_type: "material" | "hours";
  name: string;
  notes: string | null;
  url: string | null;
  unit_price: string | null;
  quantity: string | null;
  hours: string | null;
  sort_order: number;
}

export interface SavedItem {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  hourly_rate: string | null;
  entries: SavedItemEntry[];
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  state: string | null;
  company_name: string | null;
  phone: string | null;
  payment_method: string | null;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    field?: string;
  };
}

export interface TenantUser {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "member";
  is_approved: boolean;
  created_at: string;
}
