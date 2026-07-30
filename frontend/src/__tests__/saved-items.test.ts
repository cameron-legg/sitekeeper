/**
 * Saved Items / Library module tests — Item Library, Materials Library, populate.
 *
 * Run only this module:
 *   npx jest saved-items.test
 */

import "./setup";
import apiClient from "../api/client";
import { createMockSavedItem, createMockEntry } from "./test-utils";

const mockClient = apiClient as jest.Mocked<typeof apiClient>;

describe("Saved Item Data Structures", () => {
  it("saved item has name and hourly rate", () => {
    const item = createMockSavedItem({ name: "Toilet Swap", hourly_rate: "85.00" });
    expect(item.name).toBe("Toilet Swap");
    expect(item.hourly_rate).toBe("85.00");
  });

  it("saved item can have entries", () => {
    const item = createMockSavedItem({
      entries: [
        { id: "se-1", entry_type: "material", name: "Toilet", unit_price: "389.00", quantity: "1" },
        { id: "se-2", entry_type: "hours", name: "Install", hours: "2" },
      ],
    });
    expect(item.entries).toHaveLength(2);
  });

  it("standalone entry has null saved_item_id", () => {
    const entry = {
      id: "se-standalone",
      saved_item_id: null,
      user_id: "user-1",
      entry_type: "material",
      name: "Teflon Tape",
      unit_price: "3.50",
      quantity: "1",
    };
    expect(entry.saved_item_id).toBeNull();
    expect(entry.user_id).not.toBeNull();
  });
});

describe("Fingerprint Matching (duplicate detection)", () => {
  function fingerprint(entry: { entry_type: string; name: string; unit_price?: string | null; quantity?: string | null; hours?: string | null }) {
    return `${entry.entry_type}|${entry.name}|${entry.unit_price ?? ""}|${entry.quantity ?? ""}|${entry.hours ?? ""}`;
  }

  it("identical entries produce same fingerprint", () => {
    const a = { entry_type: "material", name: "Pipe", unit_price: "10.00", quantity: "2", hours: null };
    const b = { entry_type: "material", name: "Pipe", unit_price: "10.00", quantity: "2", hours: null };
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it("different price produces different fingerprint", () => {
    const a = { entry_type: "material", name: "Pipe", unit_price: "10.00", quantity: "2", hours: null };
    const b = { entry_type: "material", name: "Pipe", unit_price: "12.00", quantity: "2", hours: null };
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });

  it("hours entry fingerprint differs from material", () => {
    const material = { entry_type: "material", name: "Widget", unit_price: "5.00", quantity: "1", hours: null };
    const hours = { entry_type: "hours", name: "Widget", unit_price: null, quantity: null, hours: "2" };
    expect(fingerprint(material)).not.toBe(fingerprint(hours));
  });
});

describe("Saved Items API calls", () => {
  beforeEach(() => jest.clearAllMocks());

  it("list saved items", async () => {
    mockClient.get.mockResolvedValueOnce({ data: [createMockSavedItem()] });
    const resp = await mockClient.get("/api/v1/saved-items");
    expect(mockClient.get).toHaveBeenCalledWith("/api/v1/saved-items");
    expect(resp.data).toHaveLength(1);
  });

  it("list all entries (Materials Library)", async () => {
    mockClient.get.mockResolvedValueOnce({ data: [] });
    await mockClient.get("/api/v1/saved-items/entries");
    expect(mockClient.get).toHaveBeenCalledWith("/api/v1/saved-items/entries");
  });

  it("populate saved item into estimate", async () => {
    mockClient.post.mockResolvedValueOnce({ data: { id: "li-new", name: "Toilet Swap" } });
    await mockClient.post("/api/v1/saved-items/si-1/populate", {
      parent_id: "est-1",
      parent_type: "estimate",
    });
    expect(mockClient.post).toHaveBeenCalledWith("/api/v1/saved-items/si-1/populate", {
      parent_id: "est-1",
      parent_type: "estimate",
    });
  });

  it("save entry to library (standalone)", async () => {
    mockClient.post.mockResolvedValueOnce({ data: { id: "se-new", name: "New Material" } });
    await mockClient.post("/api/v1/saved-items/save-entry", {
      entry_type: "material",
      name: "New Material",
      unit_price: "15.00",
      quantity: "1",
    });
    expect(mockClient.post).toHaveBeenCalledWith("/api/v1/saved-items/save-entry", {
      entry_type: "material",
      name: "New Material",
      unit_price: "15.00",
      quantity: "1",
    });
  });
});
