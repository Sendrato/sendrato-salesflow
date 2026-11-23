import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import express from "express";
import type { Server } from "http";

const mockCreateContactMoment = vi.fn();
const mockCreatePerson = vi.fn();
const mockUpdatePerson = vi.fn();
const mockSendMail = vi.fn();
const mockFindPersonByEmail = vi.fn();
const mockFindByExternalId = vi.fn();
const mockInsertRequest = vi.fn();
const mockUpdateRequest = vi.fn();
const mockGetWebsiteApiSettings = vi.fn();

vi.mock("./db", () => ({
  createContactMoment: (...args: unknown[]) => mockCreateContactMoment(...args),
}));

vi.mock("./personsDb", () => ({
  createPerson: (...args: unknown[]) => mockCreatePerson(...args),
  updatePerson: (...args: unknown[]) => mockUpdatePerson(...args),
}));

vi.mock("./mailer", () => ({
  sendMail: (...args: unknown[]) => mockSendMail(...args),
}));

vi.mock("./settingsDb", () => ({
  DEFAULT_WEBSITE_NOTIFY_EMAIL: "info@sendrato.com",
  getWebsiteApiSettings: (...args: unknown[]) =>
    mockGetWebsiteApiSettings(...args),
}));

vi.mock("./websiteRequestsDb", () => ({
  findPersonByEmailInsensitive: (...args: unknown[]) =>
    mockFindPersonByEmail(...args),
  findWebsiteRequestByExternalId: (...args: unknown[]) =>
    mockFindByExternalId(...args),
  insertWebsiteRequest: (...args: unknown[]) => mockInsertRequest(...args),
  updateWebsiteRequest: (...args: unknown[]) => mockUpdateRequest(...args),
}));

const {
  bearerTokenMatches,
  buildNotificationEmail,
  contactMomentTypeFor,
  normalizePayloadKeys,
  parseSubmittedAt,
  processWebsiteRequest,
  rateLimitExceeded,
  registerWebsiteRequestRoutes,
  websiteRequestSchema,
} = await import("./websiteRequests");

// The first row of the sample export from the website.
const SAMPLE_PAYLOAD = {
  id: "9e99b456-d44e-4c66-8b38-e30d3e763990",
  name: "Anita Anand",
  email: "Premanita.anand@gmail.com",
  company: "",
  event_type: "festival",
  message: "Hello,\nI am consulting for a new yoga and wellness festival",
  request_type: "demo",
  honeypot: "",
  created_at: "2026-11-14 09:21:54.049883+00",
};

function parseSample(overrides: Record<string, unknown> = {}) {
  const parsed = websiteRequestSchema.safeParse(
    normalizePayloadKeys({ ...SAMPLE_PAYLOAD, ...overrides })
  );
  if (!parsed.success) throw new Error("sample payload failed to parse");
  return parsed.data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindByExternalId.mockResolvedValue(null);
  mockFindPersonByEmail.mockResolvedValue(null);
  mockInsertRequest.mockResolvedValue(77);
  mockUpdateRequest.mockResolvedValue(undefined);
  mockCreatePerson.mockResolvedValue(42);
  mockUpdatePerson.mockResolvedValue(undefined);
  mockCreateContactMoment.mockResolvedValue({ id: 123 });
  mockSendMail.mockResolvedValue({ messageId: "<abc@test>" });
  mockGetWebsiteApiSettings.mockResolvedValue({
    apiToken: "srq_test_token",
    notifyEmail: "info@sendrato.com",
  });
});

describe("bearerTokenMatches", () => {
  it("accepts the configured token", () => {
    expect(bearerTokenMatches("Bearer srq_secret", "srq_secret")).toBe(true);
    expect(bearerTokenMatches("bearer srq_secret", "srq_secret")).toBe(true);
    expect(bearerTokenMatches("  Bearer   srq_secret  ", "srq_secret")).toBe(
      true
    );
  });

  it("rejects wrong, malformed, and missing tokens", () => {
    expect(bearerTokenMatches("Bearer nope", "srq_secret")).toBe(false);
    expect(bearerTokenMatches("Basic srq_secret", "srq_secret")).toBe(false);
    expect(bearerTokenMatches("srq_secret", "srq_secret")).toBe(false);
    expect(bearerTokenMatches(undefined, "srq_secret")).toBe(false);
  });

  it("rejects everything when no token is configured", () => {
    expect(bearerTokenMatches("Bearer anything", "")).toBe(false);
  });
});

describe("payload parsing", () => {
  it("accepts snake_case keys from the website", () => {
    const payload = parseSample();
    expect(payload.eventType).toBe("festival");
    expect(payload.requestType).toBe("demo");
    expect(payload.createdAt).toBe("2026-11-14 09:21:54.049883+00");
    // Empty strings collapse to undefined so they never overwrite CRM data.
    expect(payload.company).toBeUndefined();
    expect(payload.honeypot).toBeUndefined();
  });

  it("accepts camelCase keys too", () => {
    const parsed = websiteRequestSchema.safeParse(
      normalizePayloadKeys({
        name: "Ashley Bernard",
        email: "ashley.bernard@vulcansmachinery.com",
        company: "VULCAN MACHINERY CORP.",
        requestType: "demo",
      })
    );
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.requestType).toBe("demo");
  });

  it("coerces non-string scalars and trims whitespace", () => {
    const parsed = websiteRequestSchema.safeParse(
      normalizePayloadKeys({ id: 1234, name: "  Spaced  ", honeypot: null })
    );
    expect(parsed.success && parsed.data.id).toBe("1234");
    expect(parsed.success && parsed.data.name).toBe("Spaced");
    expect(parsed.success && parsed.data.honeypot).toBeUndefined();
  });

  it("parses the website's timestamp format", () => {
    expect(
      parseSubmittedAt("2026-11-14 09:21:54.049883+00").toISOString()
    ).toBe("2026-11-14T09:21:54.049Z");
    expect(
      parseSubmittedAt("2026-11-11 08:56:38.183794+00").toISOString()
    ).toBe("2026-11-11T08:56:38.183Z");
  });

  it("falls back to now for a missing or unusable timestamp", () => {
    const before = Date.now();
    expect(parseSubmittedAt(undefined).getTime()).toBeGreaterThanOrEqual(
      before
    );
    expect(parseSubmittedAt("not a date").getTime()).toBeGreaterThanOrEqual(
      before
    );
  });

  it("maps request_type onto a contact moment type", () => {
    expect(contactMomentTypeFor("demo")).toBe("demo");
    expect(contactMomentTypeFor("Demo")).toBe("demo");
    expect(contactMomentTypeFor("quote")).toBe("other");
    expect(contactMomentTypeFor(undefined)).toBe("other");
  });
});

describe("processWebsiteRequest", () => {
  it("creates a person, a contact moment, and emails the request", async () => {
    const result = await processWebsiteRequest(parseSample(), {
      rawPayload: JSON.stringify(SAMPLE_PAYLOAD),
    });

    expect(result).toMatchObject({
      status: "created",
      requestId: 77,
      personId: 42,
      personCreated: true,
      notified: true,
    });

    const person = mockCreatePerson.mock.calls[0][0];
    expect(person).toMatchObject({
      name: "Anita Anand",
      email: "Premanita.anand@gmail.com",
      personType: "prospect",
      source: "website",
    });
    expect(person.tags).toContain("website");
    expect(person.tags).toContain("request:demo");
    expect(person.notes).toContain("yoga and wellness festival");

    const moment = mockCreateContactMoment.mock.calls[0][0];
    expect(moment).toMatchObject({
      leadId: 0,
      personId: 42,
      type: "demo",
      direction: "inbound",
      source: "website",
    });
    // Follow-up one day after submission.
    expect(moment.followUpAt.toISOString()).toBe("2026-11-15T09:21:54.049Z");

    const mail = mockSendMail.mock.calls[0][0];
    expect(mail.to).toBe("info@sendrato.com");
    expect(mail.replyTo).toBe("Premanita.anand@gmail.com");
    expect(mail.text).toContain("yoga and wellness festival");

    expect(mockUpdateRequest).toHaveBeenCalledWith(77, {
      personId: 42,
      contactMomentId: 123,
    });
  });

  it("updates an existing person instead of duplicating them", async () => {
    mockFindPersonByEmail.mockResolvedValue({
      id: 9,
      name: "Anita A.",
      email: "premanita.anand@gmail.com",
      company: "Yoga Fest BV",
      notes: "Met at trade show",
      tags: ["vip"],
      source: "manual",
    });

    const result = await processWebsiteRequest(
      parseSample({ company: "Other Co" }),
      { rawPayload: "{}" }
    );

    expect(result.personCreated).toBe(false);
    expect(result.personId).toBe(9);
    expect(mockCreatePerson).not.toHaveBeenCalled();

    const update = mockUpdatePerson.mock.calls[0];
    expect(update[0]).toBe(9);
    // Curated values are preserved; the new message is appended.
    expect(update[1].name).toBe("Anita A.");
    expect(update[1].company).toBe("Yoga Fest BV");
    expect(update[1].source).toBe("manual");
    expect(update[1].notes).toContain("Met at trade show");
    expect(update[1].notes).toContain("yoga and wellness festival");
    expect(update[1].tags).toEqual(
      expect.arrayContaining(["vip", "website", "request:demo"])
    );
  });

  it("records a filled honeypot as spam without touching the CRM", async () => {
    const result = await processWebsiteRequest(
      parseSample({ honeypot: "http://spam.example" }),
      { rawPayload: "{}" }
    );

    expect(result.status).toBe("spam");
    expect(mockInsertRequest.mock.calls[0][0].status).toBe("spam");
    expect(mockCreatePerson).not.toHaveBeenCalled();
    expect(mockCreateContactMoment).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("treats a known submission id as a duplicate", async () => {
    mockFindByExternalId.mockResolvedValue({
      id: 5,
      personId: 42,
      notifiedAt: new Date(),
    });

    const result = await processWebsiteRequest(parseSample(), {
      rawPayload: "{}",
    });

    expect(result).toMatchObject({
      status: "duplicate",
      requestId: 5,
      personId: 42,
      notified: true,
    });
    expect(mockInsertRequest).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("resolves a concurrent redelivery that lost the unique index", async () => {
    mockInsertRequest.mockRejectedValue(
      new Error("duplicate key value violates unique constraint")
    );
    mockFindByExternalId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 8, personId: 42, notifiedAt: null });

    const result = await processWebsiteRequest(parseSample(), {
      rawPayload: "{}",
    });

    expect(result).toMatchObject({
      status: "duplicate",
      requestId: 8,
      personId: 42,
      notified: false,
    });
    expect(mockCreatePerson).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("propagates an insert failure that is not a duplicate", async () => {
    mockInsertRequest.mockRejectedValue(new Error("DB not available"));
    await expect(
      processWebsiteRequest(parseSample(), { rawPayload: "{}" })
    ).rejects.toThrow("DB not available");
  });

  it("keeps the request when the notification email fails", async () => {
    mockSendMail.mockRejectedValue(new Error("SMTP is not configured"));

    const result = await processWebsiteRequest(parseSample(), {
      rawPayload: "{}",
    });

    expect(result.status).toBe("created");
    expect(result.personId).toBe(42);
    expect(result.notified).toBe(false);
    expect(mockUpdateRequest).toHaveBeenCalledWith(77, {
      notifyError: "SMTP is not configured",
    });
  });

  it("still emails the request when the CRM write fails", async () => {
    mockCreatePerson.mockRejectedValue(new Error("DB not available"));

    const result = await processWebsiteRequest(parseSample(), {
      rawPayload: "{}",
    });

    expect(result.personId).toBeNull();
    expect(result.notified).toBe(true);
    expect(mockUpdateRequest).toHaveBeenCalledWith(77, {
      status: "error",
      processError: "DB not available",
    });
  });
});

describe("buildNotificationEmail", () => {
  it("summarises the request and escapes HTML", () => {
    const mail = buildNotificationEmail({
      payload: parseSample({
        company: "Yoga Fest",
        message: "<script>x</script>",
      }),
      submittedAt: new Date("2026-11-14T09:21:54.049Z"),
      personId: 42,
      personCreated: true,
      appUrl: "https://crm.sendrato.com",
    });

    expect(mail.subject).toBe("Website demo request — Anita Anand (Yoga Fest)");
    expect(mail.text).toContain("Email: Premanita.anand@gmail.com");
    expect(mail.text).toContain("https://crm.sendrato.com/persons/42");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});

describe("rateLimitExceeded", () => {
  it("allows a burst then blocks, and recovers after the window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 60; i++) {
      expect(rateLimitExceeded("1.2.3.4", now)).toBe(false);
    }
    expect(rateLimitExceeded("1.2.3.4", now)).toBe(true);
    // A different caller is unaffected.
    expect(rateLimitExceeded("5.6.7.8", now)).toBe(false);
    // Window rolls over.
    expect(rateLimitExceeded("1.2.3.4", now + 61_000)).toBe(false);
  });
});

describe("POST /api/website-request", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerWebsiteRequestRoutes(app);
    await new Promise<void>(resolve => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  function post(body: unknown, token?: string) {
    return fetch(`${baseUrl}/api/website-request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  it("accepts a submission with a valid bearer token", async () => {
    const res = await post(SAMPLE_PAYLOAD, "Bearer srq_test_token");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      accepted: 1,
      rejected: 0,
      results: [
        {
          id: SAMPLE_PAYLOAD.id,
          status: "created",
          personId: 42,
          personCreated: true,
          notified: true,
        },
      ],
    });
  });

  it("rejects a missing or wrong token without touching the CRM", async () => {
    for (const header of [undefined, "Bearer wrong", "Basic srq_test_token"]) {
      const res = await post(SAMPLE_PAYLOAD, header);
      expect(res.status).toBe(401);
    }
    expect(mockInsertRequest).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("returns 503 while no token is configured", async () => {
    mockGetWebsiteApiSettings.mockResolvedValue({
      apiToken: "",
      notifyEmail: "info@sendrato.com",
    });
    const res = await post(SAMPLE_PAYLOAD, "Bearer srq_test_token");
    expect(res.status).toBe(503);
  });

  it("processes a batch and reports per-item errors", async () => {
    mockInsertRequest.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const res = await post(
      {
        requests: [
          SAMPLE_PAYLOAD,
          { name: "No Email", message: "hi" },
          {
            id: "bc3978b9-7ca8-4e6e-b581-56d8eea7243b",
            name: "Ashley Bernard",
            email: "ashley.bernard@vulcansmachinery.com",
            company: "VULCAN MACHINERY CORP.",
            event_type: "",
            message: "I am reaching out to express our interest",
            request_type: "demo",
            honeypot: "",
            created_at: "2026-11-11 08:56:38.183794+00",
          },
        ],
      },
      "Bearer srq_test_token"
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      accepted: number;
      rejected: number;
      errors: { index: number; error: string }[];
    };
    expect(body.accepted).toBe(2);
    expect(body.rejected).toBe(1);
    expect(body.errors[0]).toMatchObject({ index: 1 });
    expect(body.errors[0].error).toMatch(/email/i);
  });

  it("rejects a batch larger than the limit", async () => {
    const res = await post(
      { requests: new Array(51).fill(SAMPLE_PAYLOAD) },
      "Bearer srq_test_token"
    );
    expect(res.status).toBe(400);
    expect(mockInsertRequest).not.toHaveBeenCalled();
  });

  it("returns 400 when nothing in the body is usable", async () => {
    const res = await post({ foo: "bar" }, "Bearer srq_test_token");
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      accepted: 0,
    });
  });
});
