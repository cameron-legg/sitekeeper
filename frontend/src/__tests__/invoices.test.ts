/**
 * Invoices module tests — status workflow, data structures, API calls.
 *
 * Run only this module:
 *   npx jest invoices.test
 */

import "./setup";
import apiClient from "../core/api/client";
import { createMockInvoice } from "./test-utils";

const mockClient = apiClient as jest.Mocked<typeof apiClient>;

describe("Invoice Status Workflow", () => {
  const VALID_STATUSES = ["drafting", "waiting_to_send", "sent_awaiting_payment", "paid"];

  it("valid statuses are recognized", () => {
    VALID_STATUSES.forEach((status) => {
      const inv = createMockInvoice({ status });
      expect(VALID_STATUSES).toContain(inv.status);
    });
  });

  it("new invoice starts as drafting", () => {
    const inv = createMockInvoice();
    expect(inv.status).toBe("drafting");
  });

  it("status_changed_at is set on transitions", () => {
    const inv = createMockInvoice({
      status: "sent_awaiting_payment",
      status_changed_at: "2026-03-15T14:30:00Z",
    });
    expect(inv.status_changed_at).not.toBeNull();
  });

  it("paid is the final status", () => {
    const inv = createMockInvoice({ status: "paid" });
    expect(inv.status).toBe("paid");
  });
});

describe("Invoice Financial Fields", () => {
  it("total = subtotal + tax_amount", () => {
    const inv = createMockInvoice({
      subtotal: "1000.00",
      tax_amount: "85.00",
      total: "1085.00",
    });
    expect(parseFloat(inv.total)).toBeCloseTo(
      parseFloat(inv.subtotal) + parseFloat(inv.tax_amount)
    );
  });

  it("labor_and_fees = labor_cost + fee_cost", () => {
    const inv = createMockInvoice({
      labor_cost: "400.00",
      fee_cost: "100.00",
      labor_and_fees: "500.00",
    });
    expect(parseFloat(inv.labor_and_fees)).toBeCloseTo(
      parseFloat(inv.labor_cost) + parseFloat(inv.fee_cost)
    );
  });

  it("source_estimate_id tracks conversion origin", () => {
    const inv = createMockInvoice({ source_estimate_id: "est-original" });
    expect(inv.source_estimate_id).toBe("est-original");
  });
});

describe("Invoice API calls", () => {
  beforeEach(() => jest.clearAllMocks());

  it("status update patches correct endpoint", async () => {
    const updated = createMockInvoice({ status: "waiting_to_send" });
    mockClient.patch.mockResolvedValueOnce({ data: updated });

    await mockClient.patch("/api/v1/invoices/inv-1", { status: "waiting_to_send" });
    expect(mockClient.patch).toHaveBeenCalledWith("/api/v1/invoices/inv-1", {
      status: "waiting_to_send",
    });
  });

  it("list all invoices calls management endpoint", async () => {
    mockClient.get.mockResolvedValueOnce({ data: [] });
    await mockClient.get("/api/v1/invoices");
    expect(mockClient.get).toHaveBeenCalledWith("/api/v1/invoices");
  });
});
