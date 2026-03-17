import { z } from "zod/v4";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getCrmDocuments,
  deleteCrmDocument,
} from "../crmDocumentsDb";
import { getRawPool } from "../db";

export const crmDocumentsRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          category: z.string().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
        .optional()
    )
    .query(({ input, ctx }) =>
      getCrmDocuments({
        ...(input ?? {}),
        userId: ctx.user?.id,
        isAdmin: ctx.user?.role === "admin",
      })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = await getRawPool();
      if (pool) {
        await pool.query(
          'UPDATE shareable_presentations SET "isActive" = FALSE WHERE "crmDocumentId" = $1',
          [input.id]
        );
      }
      await deleteCrmDocument(input.id);
      return { success: true };
    }),

  listShares: publicProcedure.query(async () => {
    const pool = await getRawPool();
    if (!pool) return [];
    const { rows } = await pool.query(
      `SELECT sp.*, cd."fileName", cd."mimeType"
       FROM shareable_presentations sp
       JOIN crm_documents cd ON cd.id = sp."crmDocumentId"
       WHERE sp."crmDocumentId" IS NOT NULL AND sp."isActive" = TRUE
       ORDER BY sp."createdAt" DESC`
    );
    return rows as any[];
  }),

  deactivateShare: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const pool = await getRawPool();
      if (pool) {
        await pool.query(
          'UPDATE shareable_presentations SET "isActive" = FALSE WHERE token = $1',
          [input.token]
        );
      }
      return { success: true };
    }),
});
