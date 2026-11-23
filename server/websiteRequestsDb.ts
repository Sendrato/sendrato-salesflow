/**
 * Website request persistence
 *
 * Every submission posted to /api/website-request is stored verbatim in
 * website_requests (audit trail + idempotency), while the CRM-visible result
 * is a person in the People section plus an inbound contact moment.
 */

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "./db";
import { contactMoments, persons, websiteRequests } from "../drizzle/schema";
import type {
  InsertWebsiteRequest,
  Person,
  WebsiteRequest,
} from "../drizzle/schema";

export async function findWebsiteRequestByExternalId(
  externalId: string
): Promise<WebsiteRequest | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(websiteRequests)
    .where(eq(websiteRequests.externalId, externalId))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertWebsiteRequest(
  data: InsertWebsiteRequest
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db
    .insert(websiteRequests)
    .values(data)
    .returning({ id: websiteRequests.id });
  return row.id;
}

export async function updateWebsiteRequest(
  id: number,
  data: Partial<InsertWebsiteRequest>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(websiteRequests).set(data).where(eq(websiteRequests.id, id));
}

/** Case-insensitive person lookup by email address. */
export async function findPersonByEmailInsensitive(
  email: string
): Promise<Person | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(persons)
    .where(sql`LOWER(${persons.email}) = ${email.trim().toLowerCase()}`)
    .orderBy(persons.id)
    .limit(1);
  return rows[0] ?? null;
}

export async function listWebsiteRequests(opts: {
  limit?: number;
  offset?: number;
  includeSpam?: boolean;
}): Promise<{ requests: WebsiteRequest[]; total: number }> {
  const db = await getDb();
  if (!db) return { requests: [], total: 0 };
  const { limit = 25, offset = 0, includeSpam = false } = opts;
  const where = includeSpam ? undefined : sql`status != 'spam'`;
  const [rows, [count]] = await Promise.all([
    db
      .select()
      .from(websiteRequests)
      .where(where)
      .orderBy(desc(websiteRequests.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(websiteRequests)
      .where(where),
  ]);
  return { requests: rows, total: Number(count?.count ?? 0) };
}

export type PendingWebsiteRequest = {
  id: number;
  name: string | null;
  email: string | null;
  company: string | null;
  requestType: string | null;
  eventType: string | null;
  message: string | null;
  personId: number | null;
  personName: string | null;
  notifiedAt: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
};

/**
 * The dashboard triage queue: genuine enquiries nobody has picked up yet.
 * Spam and failed rows are excluded — they are not work for the sales team.
 */
export async function getPendingWebsiteRequests(limit = 20): Promise<{
  requests: PendingWebsiteRequest[];
  count: number;
}> {
  const db = await getDb();
  if (!db) return { requests: [], count: 0 };
  const pending = and(
    isNull(websiteRequests.handledAt),
    eq(websiteRequests.status, "new")
  );
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: websiteRequests.id,
        name: websiteRequests.name,
        email: websiteRequests.email,
        company: websiteRequests.company,
        requestType: websiteRequests.requestType,
        eventType: websiteRequests.eventType,
        message: websiteRequests.message,
        personId: websiteRequests.personId,
        personName: persons.name,
        notifiedAt: websiteRequests.notifiedAt,
        submittedAt: websiteRequests.submittedAt,
        createdAt: websiteRequests.createdAt,
      })
      .from(websiteRequests)
      .leftJoin(persons, eq(websiteRequests.personId, persons.id))
      .where(pending)
      .orderBy(desc(websiteRequests.createdAt))
      .limit(limit),
    db
      .select({ count: sql<number>`count(*)` })
      .from(websiteRequests)
      .where(pending),
  ]);
  return { requests: rows, count: Number(total?.count ?? 0) };
}

/**
 * Take a request off the queue. Also completes the follow-up the intake
 * created, so the same enquiry does not keep nagging from two dashboard
 * sections once it has been dealt with.
 */
export async function markWebsiteRequestHandled(
  id: number,
  userId: number
): Promise<{ success: true }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db
    .update(websiteRequests)
    .set({ handledAt: new Date(), handledBy: userId })
    .where(eq(websiteRequests.id, id))
    .returning({ contactMomentId: websiteRequests.contactMomentId });
  if (row?.contactMomentId) {
    await db
      .update(contactMoments)
      .set({ followUpDone: true, updatedAt: new Date() })
      .where(eq(contactMoments.id, row.contactMomentId));
  }
  return { success: true };
}

/** Put a request back on the queue (undo). */
export async function markWebsiteRequestUnhandled(
  id: number
): Promise<{ success: true }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db
    .update(websiteRequests)
    .set({ handledAt: null, handledBy: null })
    .where(eq(websiteRequests.id, id))
    .returning({ contactMomentId: websiteRequests.contactMomentId });
  if (row?.contactMomentId) {
    await db
      .update(contactMoments)
      .set({ followUpDone: false, updatedAt: new Date() })
      .where(eq(contactMoments.id, row.contactMomentId));
  }
  return { success: true };
}

/** Requests whose notification email never went out (for retrying). */
export async function getUnnotifiedWebsiteRequests(
  limit = 25
): Promise<WebsiteRequest[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(websiteRequests)
    .where(
      and(isNull(websiteRequests.notifiedAt), eq(websiteRequests.status, "new"))
    )
    .orderBy(desc(websiteRequests.createdAt))
    .limit(limit);
}
