import { eq, desc, ilike, or, and, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  crmDocuments,
  users,
  type InsertCrmDocument,
} from "@shared/../drizzle/schema";

export async function getCrmDocuments(
  opts: {
    search?: string;
    category?: string;
    limit?: number;
    offset?: number;
    userId?: number;
    isAdmin?: boolean;
  } = {}
) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];

  if (opts.category) {
    conditions.push(eq(crmDocuments.category, opts.category as any));
  }

  if (opts.search) {
    const pattern = `%${opts.search}%`;
    conditions.push(
      or(
        ilike(crmDocuments.fileName, pattern),
        ilike(crmDocuments.description, pattern)
      )
    );
  }

  // Access filtering
  if (!opts.isAdmin && opts.userId) {
    conditions.push(
      or(
        eq(crmDocuments.accessType, "all"),
        eq(crmDocuments.uploadedBy, opts.userId),
        sql`EXISTS (
          SELECT 1 FROM document_access da
          WHERE da."documentType" = 'crm'
          AND da."documentId" = ${crmDocuments.id}
          AND da."userId" = ${opts.userId}
        )`
      )
    );
  } else if (!opts.isAdmin && !opts.userId) {
    conditions.push(eq(crmDocuments.accessType, "all"));
  }

  const rows = await db
    .select({
      id: crmDocuments.id,
      fileName: crmDocuments.fileName,
      fileKey: crmDocuments.fileKey,
      fileUrl: crmDocuments.fileUrl,
      mimeType: crmDocuments.mimeType,
      fileSize: crmDocuments.fileSize,
      category: crmDocuments.category,
      description: crmDocuments.description,
      accessType: crmDocuments.accessType,
      uploadedBy: crmDocuments.uploadedBy,
      createdAt: crmDocuments.createdAt,
      uploaderName: users.name,
    })
    .from(crmDocuments)
    .leftJoin(users, eq(crmDocuments.uploadedBy, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(crmDocuments.createdAt))
    .limit(opts.limit ?? 100)
    .offset(opts.offset ?? 0);

  return rows;
}

export async function getCrmDocumentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [doc] = await db
    .select()
    .from(crmDocuments)
    .where(eq(crmDocuments.id, id));
  return doc ?? null;
}

export async function createCrmDocument(data: InsertCrmDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [doc] = await db.insert(crmDocuments).values(data).returning();
  return doc;
}

export async function deleteCrmDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { deleteDocumentAccess } = await import("./documentAccessDb");
  await deleteDocumentAccess("crm", id);
  await db.delete(crmDocuments).where(eq(crmDocuments.id, id));
}
