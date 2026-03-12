import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { promotorEvents } from "../drizzle/schema";
import type { InsertPromotorEvent } from "../drizzle/schema";

export async function getPromotorEvents(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(promotorEvents)
    .where(eq(promotorEvents.leadId, leadId))
    .orderBy(desc(promotorEvents.updatedAt));
}

export async function getPromotorEventById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(promotorEvents)
    .where(eq(promotorEvents.id, id));
  return row ?? null;
}

export async function createPromotorEvent(data: InsertPromotorEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.insert(promotorEvents).values(data).returning();
  return row;
}

export async function updatePromotorEvent(
  id: number,
  data: Partial<Omit<InsertPromotorEvent, "id">>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db
    .update(promotorEvents)
    .set({ ...data, updatedAt: sql`NOW()` })
    .where(eq(promotorEvents.id, id))
    .returning();
  return row;
}

export async function deletePromotorEvent(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(promotorEvents).where(eq(promotorEvents.id, id));
}

export async function deletePromotorEventsByLead(leadId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(promotorEvents)
    .where(eq(promotorEvents.leadId, leadId));
}
