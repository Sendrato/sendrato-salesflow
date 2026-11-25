import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mockGetDb = vi.fn();

vi.mock("./db", () => ({
  getDb: (...a: unknown[]) => mockGetDb(...a),
  getRawPool: vi.fn(),
  getLeadStats: vi.fn(),
  getContactMomentStats: vi.fn(),
  getRecentContactMoments: vi.fn(),
  getUnmatchedEmails: vi.fn(),
  matchIngestEmail: vi.fn(),
  dismissIngestEmail: vi.fn(),
}));

const { analyticsRouter } = await import("./routers/analytics");

function ctx(
  user: { id: number; role?: string; allowedCountries?: string[] } | null
): TrpcContext {
  return {
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: user ? ({ ...user, role: user.role ?? "user" } as never) : null,
  };
}

/** Minimal stand-in for the Drizzle update/select builders we chain on. */
function fakeDb(clearedIds: { id: number }[]) {
  const set = vi.fn();
  const where = vi.fn();
  const db = {
    update: vi.fn(() => ({
      set: (values: unknown) => {
        set(values);
        return {
          where: (condition: unknown) => {
            where(condition);
            return { returning: () => Promise.resolve(clearedIds) };
          },
        };
      },
    })),
    select: vi.fn(() => ({
      from: () => ({ where: () => "lead-subquery" }),
    })),
  };
  return { db, set, where };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analytics.clearOverdueFollowUps", () => {
  it("marks the overdue follow-ups done and reports how many", async () => {
    const { db, set } = fakeDb([{ id: 1 }, { id: 2 }, { id: 3 }]);
    mockGetDb.mockResolvedValue(db);

    const result = await analyticsRouter
      .createCaller(ctx({ id: 1, role: "admin" }))
      .clearOverdueFollowUps();

    expect(result).toEqual({ cleared: 3 });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ followUpDone: true })
    );
  });

  it("does not scope admins by country", async () => {
    const { db } = fakeDb([]);
    mockGetDb.mockResolvedValue(db);

    await analyticsRouter
      .createCaller(ctx({ id: 1, role: "admin", allowedCountries: ["NL"] }))
      .clearOverdueFollowUps();

    expect(db.select).not.toHaveBeenCalled();
  });

  it("scopes a country-restricted user to their own leads", async () => {
    const { db } = fakeDb([]);
    mockGetDb.mockResolvedValue(db);

    await analyticsRouter
      .createCaller(ctx({ id: 2, allowedCountries: ["NL", "BE"] }))
      .clearOverdueFollowUps();

    expect(db.select).toHaveBeenCalled();
  });

  it("is a no-op without a database", async () => {
    mockGetDb.mockResolvedValue(null);
    const result = await analyticsRouter
      .createCaller(ctx({ id: 1, role: "admin" }))
      .clearOverdueFollowUps();
    expect(result).toEqual({ cleared: 0 });
  });

  it("requires an authenticated user", async () => {
    const { db } = fakeDb([]);
    mockGetDb.mockResolvedValue(db);
    await expect(
      analyticsRouter.createCaller(ctx(null)).clearOverdueFollowUps()
    ).rejects.toThrow();
    expect(db.update).not.toHaveBeenCalled();
  });
});
