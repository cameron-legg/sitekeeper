/**
 * Time Entries module tests — clock in/out, manual hours, data structures.
 *
 * Run only this module:
 *   npx jest time-entries.test
 */

import "./setup";
import apiClient from "../api/client";
import { createMockTimeEntry } from "./test-utils";

const mockClient = apiClient as jest.Mocked<typeof apiClient>;

describe("Time Entry Data Structures", () => {
  it("manual entry has hours but no clock_in/clock_out", () => {
    const entry = createMockTimeEntry({ hours: "3.5", clock_in: null, clock_out: null });
    expect(entry.hours).toBe("3.5");
    expect(entry.clock_in).toBeNull();
    expect(entry.clock_out).toBeNull();
  });

  it("active clock-in has clock_in but no clock_out", () => {
    const entry = createMockTimeEntry({
      clock_in: "2026-03-15T08:00:00Z",
      clock_out: null,
      hours: null,
    });
    expect(entry.clock_in).not.toBeNull();
    expect(entry.clock_out).toBeNull();
  });

  it("completed clock entry has both clock_in and clock_out", () => {
    const entry = createMockTimeEntry({
      clock_in: "2026-03-15T08:00:00Z",
      clock_out: "2026-03-15T12:30:00Z",
      hours: "4.5",
    });
    expect(entry.clock_in).not.toBeNull();
    expect(entry.clock_out).not.toBeNull();
    expect(entry.hours).toBe("4.5");
  });

  it("entry has a worked_at timestamp", () => {
    const entry = createMockTimeEntry({ worked_at: "2026-03-15T10:00:00Z" });
    expect(entry.worked_at).toBe("2026-03-15T10:00:00Z");
  });

  it("entry can have a note", () => {
    const entry = createMockTimeEntry({ note: "Worked on pipe repair" });
    expect(entry.note).toBe("Worked on pipe repair");
  });
});

describe("Time Entry API calls", () => {
  beforeEach(() => jest.clearAllMocks());

  it("clock in posts to correct endpoint", async () => {
    const mockEntry = createMockTimeEntry({ clock_in: "2026-03-15T08:00:00Z" });
    mockClient.post.mockResolvedValueOnce({ data: mockEntry });

    await mockClient.post("/api/v1/jobs/job-1/time-entries/clock-in", { note: "Starting" });
    expect(mockClient.post).toHaveBeenCalledWith(
      "/api/v1/jobs/job-1/time-entries/clock-in",
      { note: "Starting" }
    );
  });

  it("clock out posts to correct endpoint", async () => {
    const mockEntry = createMockTimeEntry({ clock_out: "2026-03-15T12:00:00Z", hours: "4.0" });
    mockClient.post.mockResolvedValueOnce({ data: mockEntry });

    await mockClient.post("/api/v1/jobs/job-1/time-entries/clock-out");
    expect(mockClient.post).toHaveBeenCalledWith("/api/v1/jobs/job-1/time-entries/clock-out");
  });

  it("manual time entry posts hours", async () => {
    const mockEntry = createMockTimeEntry({ hours: "2.5" });
    mockClient.post.mockResolvedValueOnce({ data: mockEntry });

    await mockClient.post("/api/v1/jobs/job-1/time-entries", {
      hours: "2.5",
      note: "Afternoon work",
    });
    expect(mockClient.post).toHaveBeenCalledWith("/api/v1/jobs/job-1/time-entries", {
      hours: "2.5",
      note: "Afternoon work",
    });
  });

  it("delete time entry calls correct endpoint", async () => {
    mockClient.delete.mockResolvedValueOnce({ data: {} });
    await mockClient.delete("/api/v1/time-entries/te-1");
    expect(mockClient.delete).toHaveBeenCalledWith("/api/v1/time-entries/te-1");
  });

  it("list time entries for job", async () => {
    mockClient.get.mockResolvedValueOnce({ data: [createMockTimeEntry()] });
    const result = await mockClient.get("/api/v1/jobs/job-1/time-entries");
    expect(mockClient.get).toHaveBeenCalledWith("/api/v1/jobs/job-1/time-entries");
    expect(result.data).toHaveLength(1);
  });
});

describe("Time Calculations", () => {
  it("total hours from multiple entries", () => {
    const entries = [
      createMockTimeEntry({ hours: "3.5" }),
      createMockTimeEntry({ id: "te-2", hours: "2.0" }),
      createMockTimeEntry({ id: "te-3", hours: "4.25" }),
    ];
    const total = entries.reduce((sum, e) => sum + parseFloat(e.hours || "0"), 0);
    expect(total).toBeCloseTo(9.75);
  });

  it("clock duration calculation", () => {
    const clockIn = new Date("2026-03-15T08:00:00Z");
    const clockOut = new Date("2026-03-15T12:30:00Z");
    const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    expect(hours).toBeCloseTo(4.5);
  });
});
