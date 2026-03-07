import { z } from "zod/v4";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getLeadDocuments, createLeadDocument, deleteLeadDocument } from "../db";
import mysql from "mysql2/promise";

let _rawDb: mysql.Connection | null = null;
async function getRawDb(): Promise<mysql.Connection | null> {
  if (_rawDb) { try { await _rawDb.ping(); return _rawDb; } catch { _rawDb = null; } }
  if (!process.env.DATABASE_URL) return null;
  try { _rawDb = await mysql.createConnection(process.env.DATABASE_URL); return _rawDb; } catch { return null; }
}

export const documentsRouter = router({
  list: publicProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const docs = await getLeadDocuments(input.leadId);
      const db = await getRawDb();
      if (!db) return docs;
      // Attach chunk count and share count for each doc
      const enriched = await Promise.all(docs.map(async (doc) => {
        const [chunkRows] = await db.execute(
          "SELECT COUNT(*) as cnt FROM document_chunks WHERE documentId = ?",
          [doc.id]
        ) as any[];
        const [shareRows] = await db.execute(
          "SELECT COUNT(*) as cnt FROM shareable_presentations WHERE documentId = ? AND isActive = TRUE",
          [doc.id]
        ) as any[];
        return {
          ...doc,
          chunkCount: Number((chunkRows as any[])[0]?.cnt ?? 0),
          shareCount: Number((shareRows as any[])[0]?.cnt ?? 0),
        };
      }));
      return enriched;
    }),

  create: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
        fileName: z.string(),
        fileKey: z.string(),
        fileUrl: z.string(),
        mimeType: z.string().optional(),
        fileSize: z.number().optional(),
        category: z.enum(["proposal", "contract", "presentation", "report", "other"]).optional().default("other"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return createLeadDocument({
        ...input,
        uploadedBy: ctx.user.id,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getRawDb();
      if (db) {
        await db.execute("DELETE FROM document_chunks WHERE documentId = ?", [input.id]);
        await db.execute("UPDATE shareable_presentations SET isActive = FALSE WHERE documentId = ?", [input.id]);
      }
      await deleteLeadDocument(input.id);
      return { success: true };
    }),

  listShares: publicProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const db = await getRawDb();
      if (!db) return [];
      const [rows] = await db.execute(
        `SELECT sp.*, ld.fileName, ld.mimeType
         FROM shareable_presentations sp
         JOIN lead_documents ld ON ld.id = sp.documentId
         WHERE sp.leadId = ? ORDER BY sp.createdAt DESC`,
        [input.leadId]
      ) as any[];
      return rows as any[];
    }),

  deactivateShare: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getRawDb();
      if (db) await db.execute("UPDATE shareable_presentations SET isActive = FALSE WHERE token = ?", [input.token]);
      return { success: true };
    }),
});
