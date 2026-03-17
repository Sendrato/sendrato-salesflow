import { eq, and } from "drizzle-orm";
import { getDb, getRawPool } from "./db";
import { documentAccess } from "../drizzle/schema";

export type DocumentType = "lead" | "competitor" | "crm";

/** Get allowed user IDs for a document */
export async function getDocumentAccessUsers(
  documentType: DocumentType,
  documentId: number
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ userId: documentAccess.userId })
    .from(documentAccess)
    .where(
      and(
        eq(documentAccess.documentType, documentType),
        eq(documentAccess.documentId, documentId)
      )
    );
  return rows.map((r) => r.userId);
}

/** Set access users for a document (replaces existing) */
export async function setDocumentAccess(
  documentType: DocumentType,
  documentId: number,
  userIds: number[]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(documentAccess)
    .where(
      and(
        eq(documentAccess.documentType, documentType),
        eq(documentAccess.documentId, documentId)
      )
    );
  if (userIds.length > 0) {
    await db.insert(documentAccess).values(
      userIds.map((userId) => ({
        documentType,
        documentId,
        userId,
      }))
    );
  }
}

/** Delete all access entries for a document */
export async function deleteDocumentAccess(
  documentType: DocumentType,
  documentId: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(documentAccess)
    .where(
      and(
        eq(documentAccess.documentType, documentType),
        eq(documentAccess.documentId, documentId)
      )
    );
}

/** Delete all access entries for a user (called on user deletion) */
export async function deleteDocumentAccessByUser(
  userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(documentAccess)
    .where(eq(documentAccess.userId, userId));
}
