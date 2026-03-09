import { and, desc, eq, like, or, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  InsertUser,
  users,
  leads,
  contactMoments,
  leadDocuments,
  leadEmbeddings,
  emailIngestLog,
  persons,
  personLeadLinks,
  type Lead,
  type InsertLead,
  type InsertContactMoment,
  type InsertLeadDocument,
  type InsertLeadEmbedding,
} from "../drizzle/schema";
let _db: ReturnType<typeof drizzle> | null = null;
let _pool: pg.Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function getRawPool(): Promise<pg.Pool | null> {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
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

  if (user.passwordHash !== undefined) {
    values.passwordHash = user.passwordHash;
    updateSet.passwordHash = user.passwordHash;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  updateSet.updatedAt = new Date();

  await db.insert(users).values(values).onConflictDoUpdate({
    target: users.openId,
    set: updateSet,
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return result[0];
}

export async function getUserCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);
  return Number(result[0]?.count ?? 0);
}

export async function updateUserPassword(
  userId: number,
  passwordHash: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

// ─── Leads ────────────────────────────────────────────────────────────────────
export async function getLeads(opts: {
  search?: string;
  status?: string;
  priority?: string;
  source?: string;
  country?: string;
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
  if (opts.country) conditions.push(eq(leads.country, opts.country));
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
  const [inserted] = await db.insert(leads).values(data).returning({ id: leads.id });
  return getLeadById(inserted.id);
}

export async function updateLead(id: number, data: Partial<InsertLead>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(leads).set({ ...data, updatedAt: new Date() }).where(eq(leads.id, id));
  return getLeadById(id);
}

export async function deleteLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { deleteWebLinksByLead } = await import("./webLinksDb");
  await deleteWebLinksByLead(id);
  await db.delete(leads).where(eq(leads.id, id));
}

export async function bulkInsertLeads(data: InsertLead[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return [];
  const results = [];
  for (const lead of data) {
    const [inserted] = await db.insert(leads).values(lead).returning({ id: leads.id });
    results.push(inserted.id);
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
  const [inserted] = await db.insert(contactMoments).values(data).returning({ id: contactMoments.id });
  const contactDate = data.occurredAt ?? new Date();
  // Update lastContactedAt on lead
  await db.update(leads).set({ lastContactedAt: contactDate, updatedAt: new Date() }).where(eq(leads.id, data.leadId));
  // Update lastContactedAt on person if linked
  if (data.personId) {
    await db.update(persons).set({ lastContactedAt: contactDate, updatedAt: new Date() }).where(eq(persons.id, data.personId));
  }
  const rows = await db.select().from(contactMoments).where(eq(contactMoments.id, inserted.id)).limit(1);
  return rows[0];
}

export async function updateContactMoment(id: number, data: Partial<InsertContactMoment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    const setData = { ...data, updatedAt: new Date() };
    console.log("[ContactMoment] Updating id:", id, "with data keys:", Object.keys(setData));
    await db.update(contactMoments).set(setData).where(eq(contactMoments.id, id));
    const rows = await db.select().from(contactMoments).where(eq(contactMoments.id, id)).limit(1);
    const updated = rows[0];
    if (data.occurredAt && updated) {
      await recalcLastContactedAt(db, updated.leadId, updated.personId);
    }
    return updated;
  } catch (err) {
    console.error("[ContactMoment] Update failed for id:", id, "data:", JSON.stringify(data), "error:", err);
    throw err;
  }
}

async function recalcLastContactedAt(db: any, leadId: number, personId?: number | null) {
  // Lead: find the most recent occurredAt across all its contact moments
  if (leadId && leadId > 0) {
    const [leadMax] = await db
      .select({ max: sql<Date>`max(${contactMoments.occurredAt})` })
      .from(contactMoments)
      .where(eq(contactMoments.leadId, leadId));
    if (leadMax?.max) {
      await db.update(leads).set({ lastContactedAt: leadMax.max, updatedAt: new Date() }).where(eq(leads.id, leadId));
    }
  }
  // Person: same logic
  if (personId && personId > 0) {
    const [personMax] = await db
      .select({ max: sql<Date>`max(${contactMoments.occurredAt})` })
      .from(contactMoments)
      .where(eq(contactMoments.personId, personId));
    if (personMax?.max) {
      await db.update(persons).set({ lastContactedAt: personMax.max, updatedAt: new Date() }).where(eq(persons.id, personId));
    }
  }
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
      person: { id: persons.id, name: persons.name },
    })
    .from(contactMoments)
    .leftJoin(leads, eq(contactMoments.leadId, leads.id))
    .leftJoin(persons, eq(contactMoments.personId, persons.id))
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
      .where(sql`${contactMoments.occurredAt} >= NOW() - INTERVAL '30 days'`)
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
  const [inserted] = await db.insert(leadDocuments).values(data).returning({ id: leadDocuments.id });
  const rows = await db.select().from(leadDocuments).where(eq(leadDocuments.id, inserted.id)).limit(1);
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
    .onConflictDoUpdate({
      target: leadEmbeddings.leadId,
      set: { embedding: data.embedding, textContent: data.textContent, updatedAt: new Date() },
    });
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
  matchedPersonId?: number;
  messageId?: string;
  source?: string;
  status: "matched" | "unmatched" | "error";
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(emailIngestLog).values(data);
}

export async function isMessageProcessed(messageId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select({ id: emailIngestLog.id })
    .from(emailIngestLog)
    .where(eq(emailIngestLog.messageId, messageId))
    .limit(1);
  return result.length > 0;
}

export async function findLeadByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(leads).where(eq(leads.email, email)).limit(1);
  return result[0];
}

export async function findPersonByEmail(emailAddr: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(persons)
    .where(eq(persons.email, emailAddr))
    .limit(1);
  if (!result[0]) return undefined;
  const person = result[0];
  // Fetch linked leads
  const links = await db
    .select({
      leadId: personLeadLinks.leadId,
      relationship: personLeadLinks.relationship,
      companyName: leads.companyName,
    })
    .from(personLeadLinks)
    .innerJoin(leads, eq(personLeadLinks.leadId, leads.id))
    .where(eq(personLeadLinks.personId, person.id));
  return { person, linkedLeads: links };
}
