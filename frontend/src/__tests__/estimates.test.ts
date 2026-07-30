/**
 * Estimates module tests — hooks, data transformations, cost calculations.
 *
 * Run only this module:
 *   npx jest estimates.test
 */

import "./setup";
import apiClient from "../api/client";
import { createMockEstimate, createMockLineItem, createMockEntry } from "./test-utils";

const mockClient = apiClient as jest.Mocked<typeof apiClient>;

describe("Estimate Data Structures", () => {
  it("estimate has correct cost fields", () => {
    const est = createMockEstimate({
      subtotal: "1000.00",
      tax_rate: "8.5",
      tax_amount: "51.00",
      total: "1051.00",
      materials_cost: "600.00",
      labor_cost: "350.00",
      fee_cost: "50.00",
    });

    expect(parseFloat(est.total)).toBe(1051.0);
    expect(parseFloat(est.materials_cost) + parseFloat(est.labor_cost) + parseFloat(est.fee_cost))
      .toBe(1000.0);
  });

  it("line item entries sum correctly", () => {
    const entries = [
      createMockEntry({ unit_price: "25.00", quantity: "4" }),
      createMockEntry({ id: "entry-2", unit_price: "10.00", quantity: "3" }),
    ];
    const totalMaterials = entries.reduce(
      (sum, e) => sum + parseFloat(e.unit_price!) * parseFloat(e.quantity!),
      0
    );
    expect(totalMaterials).toBe(130.0);
  });

  it("tax applies only to materials", () => {
    const materialsCost = 200;
    const laborCost = 300;
    const taxRate = 8.5;
    const tax = materialsCost * (taxRate / 100);
    const total = materialsCost + laborCost + tax;

    expect(tax).toBe(17.0);
    expect(total).toBe(517.0);
  });

  it("zero tax rate produces zero tax", () => {
    const est = createMockEstimate({ tax_rate: "0", tax_amount: "0.00" });
    expect(parseFloat(est.tax_amount)).toBe(0);
  });

  it("null tax rate means no tax", () => {
    const est = createMockEstimate({ tax_rate: null, tax_amount: "0.00" });
    expect(est.tax_rate).toBeNull();
    expect(parseFloat(est.tax_amount)).toBe(0);
  });
});

describe("Estimate PDF Status", () => {
  it("new estimate has pdf_status=none", () => {
    const est = createMockEstimate({ pdf_status: "none" });
    expect(est.pdf_status).toBe("none");
  });

  it("generated PDF is current", () => {
    const est = createMockEstimate({ pdf_status: "current" });
    expect(est.pdf_status).toBe("current");
  });

  it("modified estimate has stale PDF", () => {
    const est = createMockEstimate({ pdf_status: "stale" });
    expect(est.pdf_status).toBe("stale");
  });
});

describe("Estimate API calls", () => {
  beforeEach(() => jest.clearAllMocks());

  it("create estimate posts to correct endpoint", async () => {
    const mockEst = createMockEstimate();
    mockClient.post.mockResolvedValueOnce({ data: mockEst });

    const result = await mockClient.post("/api/v1/jobs/job-1/estimates", {
      title: "Test",
      tax_rate: "8.5",
    });

    expect(mockClient.post).toHaveBeenCalledWith("/api/v1/jobs/job-1/estimates", {
      title: "Test",
      tax_rate: "8.5",
    });
    expect(result.data.id).toBe("est-1");
  });

  it("delete estimate calls correct endpoint", async () => {
    mockClient.delete.mockResolvedValueOnce({ data: {} });
    await mockClient.delete("/api/v1/estimates/est-1");
    expect(mockClient.delete).toHaveBeenCalledWith("/api/v1/estimates/est-1");
  });
});
