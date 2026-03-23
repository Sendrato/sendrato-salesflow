import { z } from "zod/v4";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getLeadDocuments,
  getAllLeadDocuments,
  createLeadDocument,
  deleteLeadDocument,
  getRawPool,
} from "../db";
import { getDocumentAccessUsers, setDocumentAccess } from "../documentAccessDb";

export const documentsRouter = router({
  list: publicProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input, ctx }) => {
      const docs = await getLeadDocuments(input.leadId, {
        userId: ctx.user?.id,
        isAdmin: ctx.user?.role === "admin",
      });
      const pool = await getRawPool();
      if (!pool) return docs;
      // Attach chunk count and share count for each doc
      const enriched = await Promise.all(
        docs.map(async doc => {
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
        })
      );
      return enriched;
    }),

  listAll: publicProcedure
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
      getAllLeadDocuments({
        ...(input ?? {}),
        userId: ctx.user?.id,
        isAdmin: ctx.user?.role === "admin",
      })
    ),

  create: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
        fileName: z.string(),
        fileKey: z.string(),
        fileUrl: z.string(),
        mimeType: z.string().optional(),
        fileSize: z.number().optional(),
        category: z
          .enum(["proposal", "contract", "presentation", "report", "other"])
          .optional()
          .default("other"),
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
        await pool.query(
          'DELETE FROM document_chunks WHERE "documentId" = $1',
          [input.id]
        );
        await pool.query(
          'UPDATE shareable_presentations SET "isActive" = FALSE WHERE "documentId" = $1',
          [input.id]
        );
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
      if (pool)
        await pool.query(
          'UPDATE shareable_presentations SET "isActive" = FALSE WHERE token = $1',
          [input.token]
        );
      return { success: true };
    }),

  listShareViews: protectedProcedure
    .input(z.object({ presentationId: z.number() }))
    .query(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) return [];
      const { rows } = await pool.query(
        `SELECT id, "presentationId", "viewedAt", "ipAddress", country, city, "userAgent", referrer
         FROM presentation_views
         WHERE "presentationId" = $1
         ORDER BY "viewedAt" DESC
         LIMIT 200`,
        [input.presentationId]
      );
      return rows as {
        id: number;
        presentationId: number;
        viewedAt: string;
        ipAddress: string | null;
        country: string | null;
        city: string | null;
        userAgent: string | null;
        referrer: string | null;
      }[];
    }),

  getAccess: protectedProcedure
    .input(
      z.object({
        documentType: z.enum(["lead", "competitor", "crm"]),
        documentId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const pool = await getRawPool();
      if (!pool) return { accessType: "all" as const, userIds: [] as number[] };

      const tableMap: Record<string, string> = {
        lead: "lead_documents",
        competitor: "competitor_documents",
        crm: "crm_documents",
      };
      const table = tableMap[input.documentType];
      const { rows } = await pool.query(
        `SELECT "accessType" FROM "${table}" WHERE id = $1`,
        [input.documentId]
      );
      const accessType = (rows[0]?.accessType ?? "all") as "all" | "restricted";
      const userIds =
        accessType === "restricted"
          ? await getDocumentAccessUsers(input.documentType, input.documentId)
          : [];
      return { accessType, userIds };
    }),

  setAccess: protectedProcedure
    .input(
      z.object({
        documentType: z.enum(["lead", "competitor", "crm"]),
        documentId: z.number(),
        accessType: z.enum(["all", "restricted"]),
        userIds: z.array(z.number()).optional().default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const pool = await getRawPool();
      if (!pool) throw new Error("DB not available");

      const tableMap: Record<string, string> = {
        lead: "lead_documents",
        competitor: "competitor_documents",
        crm: "crm_documents",
      };
      const table = tableMap[input.documentType];

      await pool.query(
        `UPDATE "${table}" SET "accessType" = $1 WHERE id = $2`,
        [input.accessType, input.documentId]
      );

      if (input.accessType === "restricted") {
        await setDocumentAccess(
          input.documentType,
          input.documentId,
          input.userIds
        );
      } else {
        await setDocumentAccess(input.documentType, input.documentId, []);
      }

      return { success: true };
    }),
});
