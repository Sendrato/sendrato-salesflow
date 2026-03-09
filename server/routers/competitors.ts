import { z } from "zod/v4";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getCompetitors,
  getCompetitorsCount,
  getCompetitorById,
  createCompetitor,
  updateCompetitor,
  deleteCompetitor,
  getCompetitorLeadLinks,
  getLeadCompetitorLinks,
  linkCompetitorToLead,
  updateCompetitorLeadLink,
  unlinkCompetitorFromLead,
  getCompetitorDocuments,
  createCompetitorDocument,
  deleteCompetitorDocument,
  getCompetitorStats,
} from "../competitorsDb";
import { getRawPool } from "../db";

const threatLevelEnum = z.enum(["low", "medium", "high"]);

const competitorInputSchema = z.object({
  name: z.string().min(1),
  website: z.string().optional(),
  description: z.string().optional(),
  products: z.string().optional(),
  regions: z.string().optional(),
  pricing: z.string().optional(),
  businessModel: z.string().optional(),
  threatLevel: threatLevelEnum.optional().default("medium"),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const competitorsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        threatLevel: z.string().optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ input }) => {
      const [rows, total] = await Promise.all([
        getCompetitors(input),
        getCompetitorsCount(input),
      ]);
      return { competitors: rows, total };
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const competitor = await getCompetitorById(input.id);
      if (!competitor) throw new Error("Competitor not found");
      return competitor;
    }),

  create: protectedProcedure
    .input(competitorInputSchema)
    .mutation(async ({ input, ctx }) => {
      const id = await createCompetitor({
        ...input,
        createdBy: ctx.user.id,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({ id: z.number(), data: competitorInputSchema.partial() })
    )
    .mutation(async ({ input }) => {
      return updateCompetitor(input.id, input.data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCompetitor(input.id);
      return { success: true };
    }),

  stats: publicProcedure.query(async () => {
    return getCompetitorStats();
  }),

  // ─── Lead links ───────────────────────────────────────────────────────────

  getLeadLinks: publicProcedure
    .input(z.object({ competitorId: z.number() }))
    .query(async ({ input }) => {
      return getCompetitorLeadLinks(input.competitorId);
    }),

  getCompetitorsForLead: publicProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      return getLeadCompetitorLinks(input.leadId);
    }),

  linkToLead: protectedProcedure
    .input(
      z.object({
        competitorId: z.number(),
        leadId: z.number(),
        competitorProduct: z.string().optional(),
        contractStartDate: z.string().optional(),
        contractEndDate: z.string().optional(),
        contractValue: z.number().optional(),
        contractCurrency: z.string().optional(),
        likes: z.string().optional(),
        dislikes: z.string().optional(),
        satisfaction: z.string().optional(),
        intelSource: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { contractStartDate, contractEndDate, ...rest } = input;
      const id = await linkCompetitorToLead({
        ...rest,
        contractStartDate: contractStartDate
          ? new Date(contractStartDate)
          : undefined,
        contractEndDate: contractEndDate
          ? new Date(contractEndDate)
          : undefined,
      });
      return { id };
    }),

  updateLeadLink: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          competitorProduct: z.string().optional(),
          contractStartDate: z.string().optional(),
          contractEndDate: z.string().optional(),
          contractValue: z.number().optional(),
          contractCurrency: z.string().optional(),
          likes: z.string().optional(),
          dislikes: z.string().optional(),
          satisfaction: z.string().optional(),
          intelSource: z.string().optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const { contractStartDate, contractEndDate, ...rest } = input.data;
      return updateCompetitorLeadLink(input.id, {
        ...rest,
        contractStartDate: contractStartDate
          ? new Date(contractStartDate)
          : undefined,
        contractEndDate: contractEndDate
          ? new Date(contractEndDate)
          : undefined,
      });
    }),

  unlinkFromLead: protectedProcedure
    .input(
      z.object({ competitorId: z.number(), leadId: z.number() })
    )
    .mutation(async ({ input }) => {
      await unlinkCompetitorFromLead(input.competitorId, input.leadId);
      return { success: true };
    }),

  // ─── Documents ────────────────────────────────────────────────────────────

  listDocuments: publicProcedure
    .input(z.object({ competitorId: z.number() }))
    .query(async ({ input }) => {
      const docs = await getCompetitorDocuments(input.competitorId);
      const pool = await getRawPool();
      if (!pool) return docs;
      const enriched = await Promise.all(
        docs.map(async (doc) => {
          const chunkResult = await pool.query(
            'SELECT COUNT(*) as cnt FROM document_chunks WHERE "competitorDocumentId" = $1',
            [doc.id]
          );
          return {
            ...doc,
            chunkCount: Number(chunkResult.rows[0]?.cnt ?? 0),
          };
        })
      );
      return enriched;
    }),

  createDocument: protectedProcedure
    .input(
      z.object({
        competitorId: z.number(),
        fileName: z.string(),
        fileKey: z.string(),
        fileUrl: z.string(),
        mimeType: z.string().optional(),
        fileSize: z.number().optional(),
        category: z
          .enum([
            "proposal",
            "contract",
            "presentation",
            "report",
            "other",
          ])
          .optional()
          .default("other"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return createCompetitorDocument({
        ...input,
        uploadedBy: ctx.user.id,
      });
    }),

  deleteDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCompetitorDocument(input.id);
      return { success: true };
    }),
});
