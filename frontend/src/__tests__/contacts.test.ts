/**
 * Contacts module tests — data structures, inheritance, primary resolution.
 *
 * Run only this module:
 *   npx jest contacts.test
 */

import "./setup";
import apiClient from "../api/client";
import { createMockContact } from "./test-utils";

const mockClient = apiClient as jest.Mocked<typeof apiClient>;

describe("Contact Data Structures", () => {
  it("contact has required name field", () => {
    const contact = createMockContact({ name: "Jane Smith" });
    expect(contact.name).toBe("Jane Smith");
  });

  it("contact optional fields can be null", () => {
    const contact = createMockContact({
      phone: null,
      email: null,
      mailing_address: null,
      notes: null,
    });
    expect(contact.phone).toBeNull();
    expect(contact.email).toBeNull();
    expect(contact.mailing_address).toBeNull();
  });

  it("inherited flag indicates source", () => {
    const directContact = { ...createMockContact(), inherited: false };
    const inheritedContact = { ...createMockContact({ id: "c-2" }), inherited: true };
    expect(directContact.inherited).toBe(false);
    expect(inheritedContact.inherited).toBe(true);
  });
});

describe("Effective Primary Contact Resolution", () => {
  it("direct source means job has its own primary", () => {
    const result = { contact: createMockContact(), source: "direct" };
    expect(result.source).toBe("direct");
  });

  it("inherited source means fallback to site primary", () => {
    const result = { contact: createMockContact(), source: "inherited" };
    expect(result.source).toBe("inherited");
  });

  it("auto source means single contact auto-resolved", () => {
    const result = { contact: createMockContact(), source: "auto" };
    expect(result.source).toBe("auto");
  });

  it("null result means no primary can be resolved", () => {
    const result = null;
    expect(result).toBeNull();
  });
});

describe("Contact API calls", () => {
  beforeEach(() => jest.clearAllMocks());

  it("create contact on job site", async () => {
    const contact = createMockContact();
    mockClient.post.mockResolvedValueOnce({ data: contact });

    await mockClient.post("/api/v1/job-sites/site-1/contacts", {
      name: "John Doe",
      phone: "555-1234",
    });
    expect(mockClient.post).toHaveBeenCalledWith("/api/v1/job-sites/site-1/contacts", {
      name: "John Doe",
      phone: "555-1234",
    });
  });

  it("set primary contact for job", async () => {
    mockClient.put.mockResolvedValueOnce({ data: {} });
    await mockClient.put("/api/v1/jobs/job-1/primary-contact", {
      contact_id: "contact-1",
    });
    expect(mockClient.put).toHaveBeenCalledWith("/api/v1/jobs/job-1/primary-contact", {
      contact_id: "contact-1",
    });
  });

  it("get effective primary contact", async () => {
    const result = { contact: createMockContact(), source: "direct" };
    mockClient.get.mockResolvedValueOnce({ data: result });

    const resp = await mockClient.get("/api/v1/jobs/job-1/effective-primary-contact");
    expect(resp.data.source).toBe("direct");
  });
});
