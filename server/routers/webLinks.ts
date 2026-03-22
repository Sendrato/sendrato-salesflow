import { z } from "zod/v4";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getWebLinksByLead,
  getWebLinksByPerson,
  getWebLinksByCompetitor,
  createWebLink,
  updateWebLink,
  deleteWebLink,
  scrapeAndSummarizeWebLink,
} from "../webLinksDb";

const categoryEnum = z.enum([
  "website",
  "article",
  "news",
  "social",
  "documentation",
  "review",
  "video",
  "other",
]);

export const webLinksRouter = router({
  listByLead: publicProcedure
    .input(z.object({ leadId: z.number() }))
    .query(({ input }) => getWebLinksByLead(input.leadId)),

  listByPerson: publicProcedure
    .input(z.object({ personId: z.number() }))
    .query(({ input }) => getWebLinksByPerson(input.personId)),

  listByCompetitor: publicProcedure
    .input(z.object({ competitorId: z.number() }))
    .query(({ input }) => getWebLinksByCompetitor(input.competitorId)),

  create: protectedProcedure
    .input(
      z
        .object({
          url: z.string().min(1),
          title: z.string().optional(),
          description: z.string().optional(),
          category: categoryEnum.optional().default("other"),
          leadId: z.number().optional(),
          personId: z.number().optional(),
          competitorId: z.number().optional(),
        })
        .refine(
          d =>
            [d.leadId, d.personId, d.competitorId].filter(Boolean).length === 1,
          {
            message:
              "Exactly one of leadId, personId, or competitorId must be provided",
          }
        )
    )
    .mutation(async ({ input, ctx }) => {
      const link = await createWebLink({ ...input, createdBy: ctx.user.id });
      // Background scrape + AI summarize
      setTimeout(
        () => scrapeAndSummarizeWebLink(link.id).catch(console.error),
        100
      );
      return link;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          url: z.string().min(1).optional(),
          title: z.string().optional(),
          description: z.string().optional(),
          category: categoryEnum.optional(),
        }),
      })
    )
    .mutation(({ input }) => updateWebLink(input.id, input.data)),

  rescrape: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await scrapeAndSummarizeWebLink(input.id);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteWebLink(input.id);
      return { success: true };
    }),
});
