import { z } from "zod/v4";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getCrmDocuments, deleteCrmDocument } from "../crmDocumentsDb";
import { getRawPool } from "../db";
import { slugify } from "@shared/slugify";

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

  updateShareSlug: protectedProcedure
    .input(z.object({ id: z.number(), slug: z.string().max(128) }))
    .mutation(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) throw new Error("No DB connection");
      const clean = input.slug ? slugify(input.slug) : null;
      if (clean) {
        const { rows: dup } = await pool.query(
          `SELECT 1 FROM shareable_presentations WHERE slug = $1 AND id != $2`,
          [clean, input.id]
        );
        if (dup.length > 0) {
          throw new Error("This URL slug is already in use");
        }
      }
      await pool.query(
        `UPDATE shareable_presentations SET slug = $1 WHERE id = $2`,
        [clean, input.id]
      );
      return { success: true, slug: clean };
    }),
});
