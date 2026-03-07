import { and, desc, eq, like, or, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  leads,
  contactMoments,
  leadDocuments,
  leadEmbeddings,
  emailIngestLog,
  type Lead,
  type InsertLead,
  type InsertContactMoment,
  type InsertLeadDocument,
  type InsertLeadEmbedding,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Leads ────────────────────────────────────────────────────────────────────
export async function getLeads(opts: {
  search?: string;
  status?: string;
  priority?: string;
  source?: string;
  assignedTo?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [];
  if (opts.search) {
    const term = `%${opts.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${leads.companyName}) LIKE ${term}`,
        sql`LOWER(${leads.contactPerson}) LIKE ${term}`,
        sql`LOWER(${leads.email}) LIKE ${term}`,
        sql`LOWER(${leads.notes}) LIKE ${term}`,
        sql`LOWER(${leads.industry}) LIKE ${term}`
      )
    );
  }
  if (opts.status) conditions.push(eq(leads.status, opts.status as Lead["status"]));
  if (opts.priority) conditions.push(eq(leads.priority, opts.priority as Lead["priority"]));
  if (opts.source) conditions.push(eq(leads.source, opts.source));
  if (opts.assignedTo) conditions.push(eq(leads.assignedTo, opts.assignedTo));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const [items, countResult] = await Promise.all([
    db.select().from(leads).where(where).orderBy(desc(leads.updatedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(leads).where(where),
  ]);

  return { items, total: Number(countResult[0]?.count ?? 0) };
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return result[0];
}

export async function createLead(data: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(leads).values(data);
  const insertId = (result[0] as { insertId: number }).insertId;
  return getLeadById(insertId);
}

export async function updateLead(id: number, data: Partial<InsertLead>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(leads).set(data).where(eq(leads.id, id));
  return getLeadById(id);
}

export async function deleteLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(leads).where(eq(leads.id, id));
}

export async function bulkInsertLeads(data: InsertLead[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return [];
  const results = [];
  for (const lead of data) {
    const r = await db.insert(leads).values(lead);
    results.push((r[0] as { insertId: number }).insertId);
  }
  return results;
}

export async function getLeadStats() {
  const db = await getDb();
  if (!db) return null;
  const [statusCounts, priorityCounts, totalCount] = await Promise.all([
    db.select({ status: leads.status, count: sql<number>`count(*)` }).from(leads).groupBy(leads.status),
    db.select({ priority: leads.priority, count: sql<number>`count(*)` }).from(leads).groupBy(leads.priority),
    db.select({ count: sql<number>`count(*)` }).from(leads),
  ]);
  return { statusCounts, priorityCounts, total: Number(totalCount[0]?.count ?? 0) };
}

// ─── Contact Moments ──────────────────────────────────────────────────────────
export async function getContactMoments(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contactMoments)
    .where(eq(contactMoments.leadId, leadId))
    .orderBy(desc(contactMoments.occurredAt));
}

export async function getRecentContactMoments(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      moment: contactMoments,
      lead: { id: leads.id, companyName: leads.companyName, contactPerson: leads.contactPerson },
    })
    .from(contactMoments)
    .leftJoin(leads, eq(contactMoments.leadId, leads.id))
    .orderBy(desc(contactMoments.occurredAt))
    .limit(limit);
}

export async function createContactMoment(data: InsertContactMoment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contactMoments).values(data);
  const insertId = (result[0] as { insertId: number }).insertId;
  // Update lastContactedAt on lead
  await db.update(leads).set({ lastContactedAt: data.occurredAt ?? new Date() }).where(eq(leads.id, data.leadId));
  const rows = await db.select().from(contactMoments).where(eq(contactMoments.id, insertId)).limit(1);
  return rows[0];
}

export async function updateContactMoment(id: number, data: Partial<InsertContactMoment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contactMoments).set(data).where(eq(contactMoments.id, id));
  const rows = await db.select().from(contactMoments).where(eq(contactMoments.id, id)).limit(1);
  return rows[0];
}

export async function deleteContactMoment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(contactMoments).where(eq(contactMoments.id, id));
}

export async function getRecentContactMomentsWithLeads(opts: {
  search?: string;
  type?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts.type) conditions.push(eq(contactMoments.type, opts.type as InsertContactMoment["type"]));
  if (opts.search) {
    const term = `%${opts.search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${contactMoments.notes}) LIKE ${term}`,
        sql`LOWER(${contactMoments.subject}) LIKE ${term}`,
        sql`LOWER(${leads.companyName}) LIKE ${term}`,
        sql`LOWER(${leads.contactPerson}) LIKE ${term}`
      )
    );
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db
    .select({
      moment: contactMoments,
      lead: { id: leads.id, companyName: leads.companyName, contactPerson: leads.contactPerson },
    })
    .from(contactMoments)
    .leftJoin(leads, eq(contactMoments.leadId, leads.id))
    .where(whereClause)
    .orderBy(desc(contactMoments.occurredAt))
    .limit(opts.limit ?? 50);
}

export async function getContactMomentStats() {
  const db = await getDb();
  if (!db) return null;
  const [typeCounts, outcomeCounts, recentActivity] = await Promise.all([
    db.select({ type: contactMoments.type, count: sql<number>`count(*)` }).from(contactMoments).groupBy(contactMoments.type),
    db.select({ outcome: contactMoments.outcome, count: sql<number>`count(*)` }).from(contactMoments).groupBy(contactMoments.outcome),
    db
      .select({
        date: sql<string>`DATE(${contactMoments.occurredAt})`,
        count: sql<number>`count(*)`,
      })
      .from(contactMoments)
      .where(sql`${contactMoments.occurredAt} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`)
      .groupBy(sql`DATE(${contactMoments.occurredAt})`)
      .orderBy(sql`DATE(${contactMoments.occurredAt})`),
  ]);
  return { typeCounts, outcomeCounts, recentActivity };
}

// ─── Documents ────────────────────────────────────────────────────────────────
export async function getLeadDocuments(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leadDocuments).where(eq(leadDocuments.leadId, leadId)).orderBy(desc(leadDocuments.createdAt));
}

export async function createLeadDocument(data: InsertLeadDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(leadDocuments).values(data);
  const insertId = (result[0] as { insertId: number }).insertId;
  const rows = await db.select().from(leadDocuments).where(eq(leadDocuments.id, insertId)).limit(1);
  return rows[0];
}

export async function deleteLeadDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(leadDocuments).where(eq(leadDocuments.id, id));
}

// ─── Embeddings ───────────────────────────────────────────────────────────────
export async function upsertLeadEmbedding(data: InsertLeadEmbedding) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(leadEmbeddings)
    .values(data)
    .onDuplicateKeyUpdate({ set: { embedding: data.embedding, textContent: data.textContent, updatedAt: new Date() } });
}

export async function getAllEmbeddings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leadEmbeddings);
}

export async function getLeadsByIds(ids: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (ids.length === 0) return [];
  return db.select().from(leads).where(inArray(leads.id, ids));
}

// ─── Email Ingest ─────────────────────────────────────────────────────────────
export async function logEmailIngest(data: {
  rawPayload: string;
  parsedFrom: string;
  parsedTo: string;
  parsedSubject: string;
  matchedLeadId?: number;
  status: "matched" | "unmatched" | "error";
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(emailIngestLog).values(data);
}

export async function findLeadByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads).where(eq(leads.email, email)).limit(1);
  return result[0];
}
