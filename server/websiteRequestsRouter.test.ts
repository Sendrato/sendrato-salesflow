import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mockPending = vi.fn();
const mockList = vi.fn();
const mockMarkHandled = vi.fn();
const mockMarkUnhandled = vi.fn();

vi.mock("./websiteRequestsDb", () => ({
  getPendingWebsiteRequests: (...a: unknown[]) => mockPending(...a),
  listWebsiteRequests: (...a: unknown[]) => mockList(...a),
  markWebsiteRequestHandled: (...a: unknown[]) => mockMarkHandled(...a),
  markWebsiteRequestUnhandled: (...a: unknown[]) => mockMarkUnhandled(...a),
}));

const { websiteRequestsRouter } = await import("./routers/websiteRequests");

function ctx(user: { id: number; role?: string } | null): TrpcContext {
  return {
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: user ? ({ ...user, role: user.role ?? "user" } as never) : null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPending.mockResolvedValue({ requests: [], count: 0 });
  mockList.mockResolvedValue({ requests: [], total: 0 });
  mockMarkHandled.mockResolvedValue({ success: true });
  mockMarkUnhandled.mockResolvedValue({ success: true });
});

describe("websiteRequests router", () => {
  it("returns the pending triage queue", async () => {
    mockPending.mockResolvedValue({
      requests: [{ id: 1, name: "Anita Anand", personId: 67 }],
      count: 1,
    });
    const result = await websiteRequestsRouter
      .createCaller(ctx({ id: 3 }))
      .pending({ limit: 20 });
    expect(result.count).toBe(1);
    expect(mockPending).toHaveBeenCalledWith(20);
  });

  it("defaults the queue limit", async () => {
    await websiteRequestsRouter.createCaller(ctx({ id: 3 })).pending({});
    expect(mockPending).toHaveBeenCalledWith(20);
  });

  it("records who handled a request", async () => {
    await websiteRequestsRouter
      .createCaller(ctx({ id: 7 }))
      .markHandled({ id: 42 });
    expect(mockMarkHandled).toHaveBeenCalledWith(42, 7);
  });

  it("supports undoing a handled request", async () => {
    await websiteRequestsRouter
      .createCaller(ctx({ id: 7 }))
      .markUnhandled({ id: 42 });
    expect(mockMarkUnhandled).toHaveBeenCalledWith(42);
  });

  it("excludes spam from the listing by default", async () => {
    await websiteRequestsRouter.createCaller(ctx({ id: 3 })).list({});
    expect(mockList).toHaveBeenCalledWith({
      limit: 25,
      offset: 0,
      includeSpam: false,
    });
  });

  it("requires an authenticated user", async () => {
    const caller = websiteRequestsRouter.createCaller(ctx(null));
    await expect(caller.pending({})).rejects.toThrow();
    await expect(caller.markHandled({ id: 1 })).rejects.toThrow();
    expect(mockPending).not.toHaveBeenCalled();
    expect(mockMarkHandled).not.toHaveBeenCalled();
  });
});
