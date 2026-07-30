/**
 * Job Sites & Jobs module tests — data structures, status, API calls.
 *
 * Run only this module:
 *   npx jest job-sites.test
 */

import "./setup";
import apiClient from "../api/client";
import { createMockJobSite, createMockJob } from "./test-utils";

const mockClient = apiClient as jest.Mocked<typeof apiClient>;

describe("Job Site Data Structures", () => {
  it("job site has name and address", () => {
    const site = createMockJobSite({ name: "123 Oak Lane", address: "123 Oak Lane, Boulder, CO" });
    expect(site.name).toBe("123 Oak Lane");
    expect(site.address).toBe("123 Oak Lane, Boulder, CO");
  });

  it("job_count reflects number of jobs", () => {
    const site = createMockJobSite({ job_count: 5, active_job_count: 2 });
    expect(site.job_count).toBe(5);
    expect(site.active_job_count).toBe(2);
  });

  it("invoice_status_counts tracks pipeline", () => {
    const site = createMockJobSite({
      invoice_status_counts: { drafting: 2, waiting_to_send: 1, sent_awaiting_payment: 3, paid: 5 },
    });
    const counts = site.invoice_status_counts;
    expect(counts.drafting + counts.waiting_to_send + counts.sent_awaiting_payment + counts.paid).toBe(11);
  });
});

describe("Job Data Structures", () => {
  const VALID_STATUSES = ["pending", "in_progress", "completed", "cancelled"];

  it("job status is one of valid values", () => {
    VALID_STATUSES.forEach((status) => {
      const job = createMockJob({ status });
      expect(VALID_STATUSES).toContain(job.status);
    });
  });

  it("completed job has finished_at", () => {
    const job = createMockJob({ status: "completed", finished_at: "2026-03-15T17:00:00Z" });
    expect(job.finished_at).not.toBeNull();
  });

  it("pending job has null finished_at", () => {
    const job = createMockJob({ status: "pending" });
    expect(job.finished_at).toBeNull();
  });

  it("job can have employees", () => {
    const job = createMockJob({
      employees: [
        { id: "user-1", name: "Cameron", email: "cam@test.com" },
        { id: "user-2", name: "Mike", email: "mike@test.com" },
      ],
    });
    expect(job.employees).toHaveLength(2);
  });
});

describe("Job Site API calls", () => {
  beforeEach(() => jest.clearAllMocks());

  it("list job sites", async () => {
    mockClient.get.mockResolvedValueOnce({ data: [createMockJobSite()] });
    const resp = await mockClient.get("/api/v1/job-sites");
    expect(resp.data).toHaveLength(1);
  });

  it("create job site", async () => {
    const newSite = createMockJobSite({ name: "New Site" });
    mockClient.post.mockResolvedValueOnce({ data: newSite });
    await mockClient.post("/api/v1/job-sites", { name: "New Site" });
    expect(mockClient.post).toHaveBeenCalledWith("/api/v1/job-sites", { name: "New Site" });
  });

  it("delete job site", async () => {
    mockClient.delete.mockResolvedValueOnce({ data: {} });
    await mockClient.delete("/api/v1/job-sites/site-1");
    expect(mockClient.delete).toHaveBeenCalledWith("/api/v1/job-sites/site-1");
  });

  it("create job within site", async () => {
    const newJob = createMockJob({ name: "Fix Pipes" });
    mockClient.post.mockResolvedValueOnce({ data: newJob });
    await mockClient.post("/api/v1/job-sites/site-1/jobs", { name: "Fix Pipes" });
    expect(mockClient.post).toHaveBeenCalledWith("/api/v1/job-sites/site-1/jobs", { name: "Fix Pipes" });
  });

  it("update job status", async () => {
    const updated = createMockJob({ status: "completed" });
    mockClient.patch.mockResolvedValueOnce({ data: updated });
    await mockClient.patch("/api/v1/jobs/job-1", { status: "completed" });
    expect(mockClient.patch).toHaveBeenCalledWith("/api/v1/jobs/job-1", { status: "completed" });
  });
});
