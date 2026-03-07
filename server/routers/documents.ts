import { z } from "zod/v4";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getLeadDocuments, createLeadDocument, deleteLeadDocument, getRawPool } from "../db";

export const documentsRouter = router({
  list: publicProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const docs = await getLeadDocuments(input.leadId);
      const pool = await getRawPool();
      if (!pool) return docs;
      // Attach chunk count and share count for each doc
      const enriched = await Promise.all(docs.map(async (doc) => {
        const chunkResult = await pool.query(
          'SELECT COUNT(*) as cnt FROM document_chunks WHERE "documentId" = $1',
          [doc.id]
        );
        const shareResult = await pool.query(
          'SELECT COUNT(*) as cnt FROM shareable_presentations WHERE "documentId" = $1 AND "isActive" = TRUE',
          [doc.id]
        );
        return {
          ...doc,
          chunkCount: Number(chunkResult.rows[0]?.cnt ?? 0),
          shareCount: Number(shareResult.rows[0]?.cnt ?? 0),
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
      const pool = await getRawPool();
      if (pool) {
        await pool.query('DELETE FROM document_chunks WHERE "documentId" = $1', [input.id]);
        await pool.query('UPDATE shareable_presentations SET "isActive" = FALSE WHERE "documentId" = $1', [input.id]);
      }
      await deleteLeadDocument(input.id);
      return { success: true };
    }),

  listShares: publicProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) return [];
      const { rows } = await pool.query(
        `SELECT sp.*, ld."fileName", ld."mimeType"
         FROM shareable_presentations sp
         JOIN lead_documents ld ON ld.id = sp."documentId"
         WHERE sp."leadId" = $1 ORDER BY sp."createdAt" DESC`,
        [input.leadId]
      );
      return rows as any[];
    }),

  deactivateShare: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const pool = await getRawPool();
      if (pool) await pool.query('UPDATE shareable_presentations SET "isActive" = FALSE WHERE token = $1', [input.token]);
      return { success: true };
    }),
});
