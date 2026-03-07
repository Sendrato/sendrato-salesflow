import { eq, or, desc, and, sql } from "drizzle-orm";
import { getDb } from "./db";
import { persons, personLeadLinks, contactMoments, leads } from "../drizzle/schema";
import type { InsertPerson, InsertPersonLeadLink } from "../drizzle/schema";

// ─── Persons ──────────────────────────────────────────────────────────────────

export async function getPersons(opts: {
  search?: string;
  personType?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const { search, personType, limit = 50, offset = 0 } = opts;

  const conditions = [];
  if (search) {
    const term = `%${search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${persons.name}) LIKE ${term}`,
        sql`LOWER(${persons.email}) LIKE ${term}`,
        sql`LOWER(${persons.company}) LIKE ${term}`,
        sql`LOWER(${persons.title}) LIKE ${term}`,
        sql`LOWER(${persons.linkedInUrl}) LIKE ${term}`
      )
    );
  }
  if (personType) {
    conditions.push(eq(persons.personType, personType as any));
  }

  const rows = await db
    .select()
    .from(persons)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(persons.updatedAt))
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function getPersonById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(persons).where(eq(persons.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPerson(data: InsertPerson) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(persons).values(data);
  return (result as any).insertId as number;
}

export async function updatePerson(id: number, data: Partial<InsertPerson>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(persons).set({ ...data, updatedAt: new Date() }).where(eq(persons.id, id));
  return getPersonById(id);
}

export async function deletePerson(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(personLeadLinks).where(eq(personLeadLinks.personId, id));
  await db.delete(persons).where(eq(persons.id, id));
}

// ─── Person ↔ Lead Links ──────────────────────────────────────────────────────

export async function getPersonLeadLinks(personId: number) {
  const db = await getDb();
  if (!db) return [];
  // Join with leads to get company name
  const rows = await db
    .select({
      link: personLeadLinks,
      lead: {
        id: leads.id,
        companyName: leads.companyName,
        status: leads.status,
        industry: leads.industry,
        location: leads.location,
      },
    })
    .from(personLeadLinks)
    .innerJoin(leads, eq(personLeadLinks.leadId, leads.id))
    .where(eq(personLeadLinks.personId, personId))
    .orderBy(desc(personLeadLinks.createdAt));
  return rows;
}

export async function getLeadPersonLinks(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      link: personLeadLinks,
      person: {
        id: persons.id,
        name: persons.name,
        email: persons.email,
        phone: persons.phone,
        linkedInUrl: persons.linkedInUrl,
        personType: persons.personType,
        title: persons.title,
        company: persons.company,
        lastContactedAt: persons.lastContactedAt,
      },
    })
    .from(personLeadLinks)
    .innerJoin(persons, eq(personLeadLinks.personId, persons.id))
    .where(eq(personLeadLinks.leadId, leadId))
    .orderBy(desc(personLeadLinks.createdAt));
  return rows;
}

export async function linkPersonToLead(data: InsertPersonLeadLink) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Avoid duplicate links for same person+lead+relationship
  const existing = await db
    .select()
    .from(personLeadLinks)
    .where(
      and(
        eq(personLeadLinks.personId, data.personId),
        eq(personLeadLinks.leadId, data.leadId)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    // Update relationship if it changed
    await db
      .update(personLeadLinks)
      .set({ relationship: data.relationship, notes: data.notes })
      .where(eq(personLeadLinks.id, existing[0].id));
    return existing[0].id;
  }
  const [result] = await db.insert(personLeadLinks).values(data);
  return (result as any).insertId as number;
}

export async function unlinkPersonFromLead(personId: number, leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .delete(personLeadLinks)
    .where(
      and(
        eq(personLeadLinks.personId, personId),
        eq(personLeadLinks.leadId, leadId)
      )
    );
}

// ─── Contact moments for a person ─────────────────────────────────────────────

export async function getPersonContactMoments(personId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(contactMoments)
    .where(eq(contactMoments.personId, personId))
    .orderBy(desc(contactMoments.occurredAt))
    .limit(100);
  return rows;
}

// ─── RAG: build text for person indexing ──────────────────────────────────────

export function buildPersonText(p: typeof persons.$inferSelect): string {
  const parts: string[] = [];
  parts.push(`Person: ${p.name}`);
  if (p.personType) parts.push(`Type: ${p.personType}`);
  if (p.title) parts.push(`Title: ${p.title}`);
  if (p.company) parts.push(`Company: ${p.company}`);
  if (p.email) parts.push(`Email: ${p.email}`);
  if (p.phone) parts.push(`Phone: ${p.phone}`);
  if (p.linkedInUrl) parts.push(`LinkedIn: ${p.linkedInUrl}`);
  if (p.notes) parts.push(`Notes: ${p.notes}`);
  if (p.tags && Array.isArray(p.tags)) parts.push(`Tags: ${p.tags.join(", ")}`);
  return parts.join("\n");
}

// ─── Person count helper ───────────────────────────────────────────────────────

export async function getPersonsCount(opts: { search?: string; personType?: string }) {
  const db = await getDb();
  if (!db) return 0;
  const { search, personType } = opts;
  const conditions = [];
  if (search) {
    const term = `%${search.toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${persons.name}) LIKE ${term}`,
        sql`LOWER(${persons.email}) LIKE ${term}`,
        sql`LOWER(${persons.company}) LIKE ${term}`,
        sql`LOWER(${persons.title}) LIKE ${term}`
      )
    );
  }
  if (personType) conditions.push(eq(persons.personType, personType as any));
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(persons)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return Number(row?.count ?? 0);
}
