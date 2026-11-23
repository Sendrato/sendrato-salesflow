/**
 * Website request persistence
 *
 * Every submission posted to /api/website-request is stored verbatim in
 * website_requests (audit trail + idempotency), while the CRM-visible result
 * is a person in the People section plus an inbound contact moment.
 */

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "./db";
import { persons, websiteRequests } from "../drizzle/schema";
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
