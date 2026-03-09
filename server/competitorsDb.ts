import { eq, or, desc, and, sql, gte, lte } from "drizzle-orm";
import { getDb, getRawPool } from "./db";
import {
  competitors,
  competitorLeadLinks,
  competitorDocuments,
  leads,
} from "../drizzle/schema";
import type {
  InsertCompetitor,
  InsertCompetitorLeadLink,
  InsertCompetitorDocument,
} from "../drizzle/schema";

// ─── Competitors CRUD ────────────────────────────────────────────────────────

export async function getCompetitors(opts: {
  search?: string;
  threatLevel?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const { search, threatLevel, limit = 50, offset = 0 } = opts;

  const conditions = [];
  if (search) {
    const term = `%${search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${competitors.name}) LIKE ${term}`,
        sql`LOWER(${competitors.website}) LIKE ${term}`,
        sql`LOWER(${competitors.products}) LIKE ${term}`,
        sql`LOWER(${competitors.regions}) LIKE ${term}`
      )
    );
  }
  if (threatLevel) {
    conditions.push(eq(competitors.threatLevel, threatLevel as any));
  }

  return db
    .select()
    .from(competitors)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(competitors.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function getCompetitorsCount(opts: {
  search?: string;
  threatLevel?: string;
}) {
  const db = await getDb();
  if (!db) return 0;
  const { search, threatLevel } = opts;
  const conditions = [];
  if (search) {
    const term = `%${search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${competitors.name}) LIKE ${term}`,
        sql`LOWER(${competitors.website}) LIKE ${term}`,
        sql`LOWER(${competitors.products}) LIKE ${term}`,
        sql`LOWER(${competitors.regions}) LIKE ${term}`
      )
    );
  }
  if (threatLevel) {
    conditions.push(eq(competitors.threatLevel, threatLevel as any));
  }
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(competitors)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return Number(row?.count ?? 0);
}

export async function getCompetitorById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(competitors)
    .where(eq(competitors.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createCompetitor(data: InsertCompetitor) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db
    .insert(competitors)
    .values(data)
    .returning({ id: competitors.id });
  return result.id;
}

export async function updateCompetitor(
  id: number,
  data: Partial<InsertCompetitor>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(competitors)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(competitors.id, id));
  return getCompetitorById(id);
}

export async function deleteCompetitor(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Cascade: delete web links
  const { deleteWebLinksByCompetitor } = await import("./webLinksDb");
  await deleteWebLinksByCompetitor(id);
  // Cascade: delete lead links
  await db
    .delete(competitorLeadLinks)
    .where(eq(competitorLeadLinks.competitorId, id));
  // Cascade: delete document chunks via raw SQL
  const pool = await getRawPool();
  if (pool) {
    await pool.query(
      'DELETE FROM document_chunks WHERE "competitorId" = $1',
      [id]
    );
  }
  // Cascade: delete documents
  await db
    .delete(competitorDocuments)
    .where(eq(competitorDocuments.competitorId, id));
  // Delete competitor
  await db.delete(competitors).where(eq(competitors.id, id));
}

// ─── Competitor ↔ Lead Links ─────────────────────────────────────────────────

export async function getCompetitorLeadLinks(competitorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      link: competitorLeadLinks,
      lead: {
        id: leads.id,
        companyName: leads.companyName,
        status: leads.status,
        industry: leads.industry,
        location: leads.location,
      },
    })
    .from(competitorLeadLinks)
    .innerJoin(leads, eq(competitorLeadLinks.leadId, leads.id))
    .where(eq(competitorLeadLinks.competitorId, competitorId))
    .orderBy(desc(competitorLeadLinks.updatedAt));
}

export async function getLeadCompetitorLinks(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      link: competitorLeadLinks,
      competitor: {
        id: competitors.id,
        name: competitors.name,
        threatLevel: competitors.threatLevel,
        website: competitors.website,
      },
    })
    .from(competitorLeadLinks)
    .innerJoin(
      competitors,
      eq(competitorLeadLinks.competitorId, competitors.id)
    )
    .where(eq(competitorLeadLinks.leadId, leadId))
    .orderBy(desc(competitorLeadLinks.updatedAt));
}

export async function linkCompetitorToLead(data: InsertCompetitorLeadLink) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db
    .select()
    .from(competitorLeadLinks)
    .where(
      and(
        eq(competitorLeadLinks.competitorId, data.competitorId),
        eq(competitorLeadLinks.leadId, data.leadId)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    const { competitorId: _, leadId: __, ...updateFields } = data;
    await db
      .update(competitorLeadLinks)
      .set({ ...updateFields, updatedAt: new Date() })
      .where(eq(competitorLeadLinks.id, existing[0].id));
    return existing[0].id;
  }
  const [result] = await db
    .insert(competitorLeadLinks)
    .values(data)
    .returning({ id: competitorLeadLinks.id });
  return result.id;
}

export async function updateCompetitorLeadLink(
  id: number,
  data: Partial<InsertCompetitorLeadLink>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(competitorLeadLinks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(competitorLeadLinks.id, id));
  const rows = await db
    .select()
    .from(competitorLeadLinks)
    .where(eq(competitorLeadLinks.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function unlinkCompetitorFromLead(
  competitorId: number,
  leadId: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .delete(competitorLeadLinks)
    .where(
      and(
        eq(competitorLeadLinks.competitorId, competitorId),
        eq(competitorLeadLinks.leadId, leadId)
      )
    );
}

// ─── Competitor Documents ────────────────────────────────────────────────────

export async function getCompetitorDocuments(competitorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(competitorDocuments)
    .where(eq(competitorDocuments.competitorId, competitorId))
    .orderBy(desc(competitorDocuments.createdAt));
}

export async function createCompetitorDocument(
  data: InsertCompetitorDocument
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db
    .insert(competitorDocuments)
    .values(data)
    .returning();
  return inserted;
}

export async function deleteCompetitorDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const pool = await getRawPool();
  if (pool) {
    await pool.query(
      'DELETE FROM document_chunks WHERE "competitorDocumentId" = $1',
      [id]
    );
  }
  await db
    .delete(competitorDocuments)
    .where(eq(competitorDocuments.id, id));
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getCompetitorStats() {
  const db = await getDb();
  if (!db)
    return { total: 0, threatCounts: [], upcomingContractEnds: 0 };

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(competitors);

  const threatCounts = await db
    .select({
      threatLevel: competitors.threatLevel,
      count: sql<number>`count(*)`,
    })
    .from(competitors)
    .groupBy(competitors.threatLevel);

  const now = new Date();
  const ninetyDays = new Date(
    now.getTime() + 90 * 24 * 60 * 60 * 1000
  );
  const [contractRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(competitorLeadLinks)
    .where(
      and(
        sql`${competitorLeadLinks.contractEndDate} IS NOT NULL`,
        gte(competitorLeadLinks.contractEndDate, now),
        lte(competitorLeadLinks.contractEndDate, ninetyDays)
      )
    );

  return {
    total: Number(totalRow?.count ?? 0),
    threatCounts,
    upcomingContractEnds: Number(contractRow?.count ?? 0),
  };
}
