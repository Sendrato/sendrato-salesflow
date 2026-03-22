import { eq, or, desc, and, sql } from "drizzle-orm";
import { getDb } from "./db";
import { brainstorms, brainstormDocuments } from "../drizzle/schema";
import type {
  InsertBrainstorm,
  InsertBrainstormDocument,
} from "../drizzle/schema";

export async function getBrainstorms(opts: {
  search?: string;
  leadId?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const { search, leadId, limit = 50, offset = 0 } = opts;

  const conditions = [];
  if (search) {
    const term = `%${search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${brainstorms.title}) LIKE ${term}`,
        sql`LOWER(${brainstorms.content}) LIKE ${term}`
      )
    );
  }
  if (leadId) {
    conditions.push(eq(brainstorms.leadId, leadId));
  }

  return db
    .select({
      id: brainstorms.id,
      title: brainstorms.title,
      content: brainstorms.content,
      leadId: brainstorms.leadId,
      enrichedAt: brainstorms.enrichedAt,
      tags: brainstorms.tags,
      createdBy: brainstorms.createdBy,
      createdAt: brainstorms.createdAt,
      updatedAt: brainstorms.updatedAt,
      leadName: sql<
        string | null
      >`(SELECT "companyName" FROM leads WHERE leads.id = ${brainstorms.leadId})`.as(
        "leadName"
      ),
    })
    .from(brainstorms)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(brainstorms.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function getBrainstormsCount(opts: {
  search?: string;
  leadId?: number;
}) {
  const db = await getDb();
  if (!db) return 0;
  const conditions = [];
  if (opts.search) {
    const term = `%${opts.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${brainstorms.title}) LIKE ${term}`,
        sql`LOWER(${brainstorms.content}) LIKE ${term}`
      )
    );
  }
  if (opts.leadId) {
    conditions.push(eq(brainstorms.leadId, opts.leadId));
  }
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(brainstorms)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return Number(row?.count ?? 0);
}

export async function getBrainstormById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(brainstorms)
    .where(eq(brainstorms.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createBrainstorm(data: InsertBrainstorm) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db
    .insert(brainstorms)
    .values(data)
    .returning({ id: brainstorms.id });
  return result.id;
}

export async function updateBrainstorm(
  id: number,
  data: Partial<InsertBrainstorm>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(brainstorms)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(brainstorms.id, id));
  return getBrainstormById(id);
}

export async function deleteBrainstorm(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .delete(brainstormDocuments)
    .where(eq(brainstormDocuments.brainstormId, id));
  await db.delete(brainstorms).where(eq(brainstorms.id, id));
}

// ─── Brainstorm Documents ─────────────────────────────────────────────────────

export async function getBrainstormDocuments(brainstormId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(brainstormDocuments)
    .where(eq(brainstormDocuments.brainstormId, brainstormId))
    .orderBy(desc(brainstormDocuments.createdAt));
}

export async function createBrainstormDocument(data: InsertBrainstormDocument) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db
    .insert(brainstormDocuments)
    .values(data)
    .returning();
  return result;
}

export async function deleteBrainstormDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(brainstormDocuments).where(eq(brainstormDocuments.id, id));
}
