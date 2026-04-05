import { eq, or, desc, and, sql, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  persons,
  personLeadLinks,
  contactMoments,
  leads,
  emailIngestLog,
  webLinks,
} from "../drizzle/schema";
import type { InsertPerson, InsertPersonLeadLink } from "../drizzle/schema";

// ─── Persons ──────────────────────────────────────────────────────────────────

export async function getPersons(opts: {
  search?: string;
  personType?: string;
  assignedTo?: number;
  allowedCountries?: string[] | null;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const {
    search,
    personType,
    assignedTo,
    allowedCountries,
    limit = 50,
    offset = 0,
  } = opts;

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
  if (assignedTo) {
    conditions.push(eq(persons.assignedTo, assignedTo));
  }
  if (Array.isArray(allowedCountries)) {
    conditions.push(
      or(
        sql`NOT EXISTS (
          SELECT 1 FROM person_lead_links pll
          WHERE pll."personId" = ${persons.id}
        )`,
        sql`EXISTS (
          SELECT 1 FROM person_lead_links pll
          JOIN leads l ON l.id = pll."leadId"
          WHERE pll."personId" = ${persons.id}
          AND ${inArray(leads.country, allowedCountries)}
        )`
      )
    );
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
  const rows = await db
    .select()
    .from(persons)
    .where(eq(persons.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createPerson(data: InsertPerson) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db
    .insert(persons)
    .values(data)
    .returning({ id: persons.id });
  return result.id;
}

export async function updatePerson(id: number, data: Partial<InsertPerson>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .update(persons)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(persons.id, id));
  return getPersonById(id);
}

export async function deletePerson(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { deleteWebLinksByPerson } = await import("./webLinksDb");
  await deleteWebLinksByPerson(id);
  // Nullify personId on contact moments (they still belong to leads)
  await db
    .update(contactMoments)
    .set({ personId: null })
    .where(eq(contactMoments.personId, id));
  await db
    .update(emailIngestLog)
    .set({ matchedPersonId: null })
    .where(eq(emailIngestLog.matchedPersonId, id));
  await db.delete(personLeadLinks).where(eq(personLeadLinks.personId, id));
  await db.delete(persons).where(eq(persons.id, id));
}

export async function mergePersons(keepId: number, removeId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [keep, remove] = await Promise.all([
    getPersonById(keepId),
    getPersonById(removeId),
  ]);
  if (!keep || !remove) throw new Error("Person not found");

  // Move contact moments
  await db
    .update(contactMoments)
    .set({ personId: keepId })
    .where(eq(contactMoments.personId, removeId));

  // Move lead links (skip duplicates)
  const existingLinks = await db
    .select({ leadId: personLeadLinks.leadId })
    .from(personLeadLinks)
    .where(eq(personLeadLinks.personId, keepId));
  const existingLeadIds = new Set(existingLinks.map(l => l.leadId));
  const removeLinks = await db
    .select()
    .from(personLeadLinks)
    .where(eq(personLeadLinks.personId, removeId));
  for (const link of removeLinks) {
    if (existingLeadIds.has(link.leadId)) {
      await db.delete(personLeadLinks).where(eq(personLeadLinks.id, link.id));
    } else {
      await db
        .update(personLeadLinks)
        .set({ personId: keepId })
        .where(eq(personLeadLinks.id, link.id));
    }
  }

  // Move web links
  await db
    .update(webLinks)
    .set({ personId: keepId })
    .where(eq(webLinks.personId, removeId));

  // Move email ingest log
  await db
    .update(emailIngestLog)
    .set({ matchedPersonId: keepId })
    .where(eq(emailIngestLog.matchedPersonId, removeId));

  // Merge text fields (fill empty fields on keep from remove)
  const updates: Partial<InsertPerson> = {};
  if (!keep.email && remove.email) updates.email = remove.email;
  if (!keep.phone && remove.phone) updates.phone = remove.phone;
  if (!keep.linkedInUrl && remove.linkedInUrl)
    updates.linkedInUrl = remove.linkedInUrl;
  if (!keep.twitterUrl && remove.twitterUrl)
    updates.twitterUrl = remove.twitterUrl;
  if (!keep.company && remove.company) updates.company = remove.company;
  if (!keep.title && remove.title) updates.title = remove.title;
  if (!keep.notes && remove.notes) updates.notes = remove.notes;
  if (!keep.source && remove.source) updates.source = remove.source;

  if (Object.keys(updates).length > 0) {
    await db
      .update(persons)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(persons.id, keepId));
  }

  // Delete the removed person
  const { deleteWebLinksByPerson } = await import("./webLinksDb");
  await deleteWebLinksByPerson(removeId);
  await db
    .delete(personLeadLinks)
    .where(eq(personLeadLinks.personId, removeId));
  await db.delete(persons).where(eq(persons.id, removeId));

  return getPersonById(keepId);
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
  const [result] = await db
    .insert(personLeadLinks)
    .values(data)
    .returning({ id: personLeadLinks.id });
  return result.id;
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

export async function getPersonsCount(opts: {
  search?: string;
  personType?: string;
  assignedTo?: number;
  allowedCountries?: string[] | null;
}) {
  const db = await getDb();
  if (!db) return 0;
  const { search, personType, assignedTo, allowedCountries } = opts;
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
  if (assignedTo) conditions.push(eq(persons.assignedTo, assignedTo));
  if (Array.isArray(allowedCountries)) {
    conditions.push(
      or(
        sql`NOT EXISTS (
          SELECT 1 FROM person_lead_links pll
          WHERE pll."personId" = ${persons.id}
        )`,
        sql`EXISTS (
          SELECT 1 FROM person_lead_links pll
          JOIN leads l ON l.id = pll."leadId"
          WHERE pll."personId" = ${persons.id}
          AND ${inArray(leads.country, allowedCountries)}
        )`
      )
    );
  }
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(persons)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return Number(row?.count ?? 0);
}
