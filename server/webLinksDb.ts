import { eq, desc } from "drizzle-orm";
import { getDb } from "./db";
import { webLinks } from "../drizzle/schema";
import type { InsertWebLink } from "../drizzle/schema";

// ─── List by entity ──────────────────────────────────────────────────────────

export async function getWebLinksByLead(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(webLinks)
    .where(eq(webLinks.leadId, leadId))
    .orderBy(desc(webLinks.createdAt));
}

export async function getWebLinksByPerson(personId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(webLinks)
    .where(eq(webLinks.personId, personId))
    .orderBy(desc(webLinks.createdAt));
}

export async function getWebLinksByCompetitor(competitorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(webLinks)
    .where(eq(webLinks.competitorId, competitorId))
    .orderBy(desc(webLinks.createdAt));
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createWebLink(data: InsertWebLink) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(webLinks).values(data).returning();
  return inserted;
}

export async function updateWebLink(
  id: number,
  data: Partial<Pick<InsertWebLink, "url" | "title" | "description" | "category">>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [updated] = await db
    .update(webLinks)
    .set(data)
    .where(eq(webLinks.id, id))
    .returning();
  return updated;
}

export async function deleteWebLink(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(webLinks).where(eq(webLinks.id, id));
}

// ─── Bulk delete (for cascade) ───────────────────────────────────────────────

export async function deleteWebLinksByLead(leadId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(webLinks).where(eq(webLinks.leadId, leadId));
}

export async function deleteWebLinksByPerson(personId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(webLinks).where(eq(webLinks.personId, personId));
}

export async function deleteWebLinksByCompetitor(competitorId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(webLinks).where(eq(webLinks.competitorId, competitorId));
}
