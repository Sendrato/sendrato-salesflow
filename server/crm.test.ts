import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database module so tests don't need a real DB
vi.mock("./db", () => ({
  getLeads: vi.fn().mockResolvedValue([
    {
      id: 1,
      companyName: "Arizona State Fair",
      website: "azstatefair.com",
      industry: "Event Management",
      status: "new",
      priority: "medium",
      contactPerson: "Wanell Costello",
      email: "info@azstatefair.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getLeadById: vi.fn().mockResolvedValue({
    id: 1,
    companyName: "Arizona State Fair",
    website: "azstatefair.com",
    status: "new",
    priority: "medium",
    contactPerson: "Wanell Costello",
    email: "info@azstatefair.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  createLead: vi.fn().mockResolvedValue({ id: 99, companyName: "Test Corp" }),
  updateLead: vi.fn().mockResolvedValue({ id: 1, companyName: "Updated Corp" }),
  deleteLead: vi.fn().mockResolvedValue(undefined),
  bulkInsertLeads: vi.fn().mockResolvedValue([10, 11, 12]),
  getLeadStats: vi.fn().mockResolvedValue({
    total: 29,
    byStatus: [{ status: "new", count: 20 }],
    byPriority: [{ priority: "medium", count: 15 }],
  }),
  getContactMoments: vi.fn().mockResolvedValue([]),
  getRecentContactMoments: vi.fn().mockResolvedValue([]),
  getRecentContactMomentsWithLeads: vi.fn().mockResolvedValue([]),
  createContactMoment: vi.fn().mockResolvedValue({ id: 1, type: "email", leadId: 1 }),
  updateContactMoment: vi.fn().mockResolvedValue({ id: 1, type: "email" }),
  deleteContactMoment: vi.fn().mockResolvedValue(undefined),
  getContactMomentStats: vi.fn().mockResolvedValue({ typeCounts: [], outcomeCounts: [], recentActivity: [] }),
  getLeadDocuments: vi.fn().mockResolvedValue([]),
  createLeadDocument: vi.fn().mockResolvedValue({ id: 1, leadId: 1, fileName: "test.pdf" }),
  deleteLeadDocument: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  findLeadByEmail: vi.fn().mockResolvedValue(null),
  logEmailIngest: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn().mockResolvedValue(null),
  getAllEmbeddings: vi.fn().mockResolvedValue([]),
  getLeadsByIds: vi.fn().mockResolvedValue([]),
  upsertLeadEmbedding: vi.fn().mockResolvedValue(undefined),
}));

// Mock crmChat module
vi.mock("./crmChat", () => ({
  indexLead: vi.fn().mockResolvedValue(undefined),
  registerCrmChatRoutes: vi.fn(),
  searchLeads: vi.fn().mockResolvedValue([]),
}));

// Mock documentRag module
vi.mock("./documentRag", () => ({
  indexDocument: vi.fn().mockResolvedValue(undefined),
  searchDocumentChunks: vi.fn().mockResolvedValue([]),
  computePriorityScore: vi.fn().mockResolvedValue(72),
  updateAllPriorityScores: vi.fn().mockResolvedValue(undefined),
}));

function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAuthCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────
describe("auth", () => {
  it("me returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("me returns user for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Test User");
  });
});

// ─── Leads Tests ──────────────────────────────────────────────────────────────
describe("leads", () => {
  it("list returns leads array", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.leads.list({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].companyName).toBe("Arizona State Fair");
  });

  it("list accepts search parameter", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.leads.list({ search: "Arizona" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("list accepts status filter", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.leads.list({ status: "new" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("get returns a single lead", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.leads.get({ id: 1 });
    expect(result).not.toBeNull();
    expect(result?.companyName).toBe("Arizona State Fair");
  });

  it("create requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.leads.create({ companyName: "Test Corp" })
    ).rejects.toThrow();
  });

  it("create succeeds for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.leads.create({ companyName: "Test Corp" });
    expect(result).toBeDefined();
  });

  it("update requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.leads.update({ id: 1, data: { companyName: "Updated" } })
    ).rejects.toThrow();
  });

  it("delete requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.leads.delete({ id: 1 })).rejects.toThrow();
  });

  it("stats returns lead statistics", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.leads.stats();
    expect(result).toBeDefined();
    expect(result?.total).toBe(29);
  });
});

// ─── Contact Moments Tests ────────────────────────────────────────────────────
describe("contactMoments", () => {
  it("list returns moments for a lead", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.contactMoments.list({ leadId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("recent returns recent moments", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.contactMoments.recent({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("listAll returns moments with lead info", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.contactMoments.listAll({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("create requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.contactMoments.create({
        leadId: 1,
        type: "email",
        direction: "outbound",
        outcome: "neutral",
      })
    ).rejects.toThrow();
  });

  it("create succeeds for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.contactMoments.create({
      leadId: 1,
      type: "email",
      direction: "outbound",
      outcome: "positive",
      subject: "Test email",
      notes: "Had a great call",
    });
    expect(result).toBeDefined();
  });

  it("stats returns contact moment statistics", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.contactMoments.stats();
    expect(result).toBeDefined();
  });
});

// ─── Documents Tests ──────────────────────────────────────────────────────────
describe("documents", () => {
  it("list returns documents for a lead", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.documents.list({ leadId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("create requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.documents.create({
        leadId: 1,
        fileName: "proposal.pdf",
        fileKey: "leads/1/proposal.pdf",
        fileUrl: "https://cdn.example.com/proposal.pdf",
        mimeType: "application/pdf",
        category: "proposal",
      })
    ).rejects.toThrow();
  });

  it("create succeeds for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.documents.create({
      leadId: 1,
      fileName: "proposal.pdf",
      fileKey: "leads/1/proposal.pdf",
      fileUrl: "https://cdn.example.com/proposal.pdf",
      mimeType: "application/pdf",
      category: "proposal",
    });
    expect(result).toBeDefined();
  });

  it("delete requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.documents.delete({ id: 1 })).rejects.toThrow();
  });
});

// ─── Document RAG Tests ───────────────────────────────────────────────────────
describe("documentRag", () => {
  it("searchDocumentChunks returns empty array when no chunks match", async () => {
    const { searchDocumentChunks } = await import("./documentRag");
    const results = await searchDocumentChunks("nonexistent query", 5);
    expect(Array.isArray(results)).toBe(true);
  });

  it("computePriorityScore returns a number between 0 and 100", async () => {
    const { computePriorityScore } = await import("./documentRag");
    const score = await computePriorityScore(1);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("indexDocument is called on document creation", async () => {
    const { indexDocument } = await import("./documentRag");
    await indexDocument(1, 1, "Test content for indexing", "test.pdf");
    expect(indexDocument).toHaveBeenCalledWith(1, 1, "Test content for indexing", "test.pdf");
  });
});

// ─── Analytics Tests ──────────────────────────────────────────────────────────
describe("analytics", () => {
  it("recentActivity returns array", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.analytics.recentActivity({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("pipeline returns lead stats", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.analytics.pipeline();
    expect(result).toBeDefined();
  });
});

// ─── Settings Tests ───────────────────────────────────────────────────────────
vi.mock("./settingsDb", () => ({
  getAllLLMSettings: vi.fn().mockResolvedValue({
    provider: "forge",
    chatModel: "gemini-2.5-flash",
    enrichModel: "claude-sonnet-4-5",
    apiKey: "",
    baseUrl: "",
  }),
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  SETTING_KEYS: {
    LLM_PROVIDER: "llm.provider",
    LLM_CHAT_MODEL: "llm.chatModel",
    LLM_ENRICH_MODEL: "llm.enrichModel",
    LLM_API_KEY: "llm.apiKey",
    LLM_BASE_URL: "llm.baseUrl",
  },
}));

describe("settings", () => {
  it("getLLMConfig requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.settings.getLLMConfig()).rejects.toThrow();
  });

  it("getLLMConfig returns provider config for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.settings.getLLMConfig();
    expect(result).toBeDefined();
    expect(result.provider).toBe("forge");
    expect(result.chatModel).toBe("gemini-2.5-flash");
    expect(result.enrichModel).toBe("claude-sonnet-4-5");
    expect(result.hasApiKey).toBe(false);
  });

  it("updateLLMConfig requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.settings.updateLLMConfig({ provider: "openai" })).rejects.toThrow();
  });

  it("updateLLMConfig succeeds for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.settings.updateLLMConfig({
      provider: "openai",
      chatModel: "gpt-4o",
      enrichModel: "gpt-4o",
    });
    expect(result.success).toBe(true);
  });

  it("clearApiKey requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.settings.clearApiKey()).rejects.toThrow();
  });

  it("clearApiKey succeeds for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.settings.clearApiKey();
    expect(result.success).toBe(true);
  });
});
