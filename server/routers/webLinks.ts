import { z } from "zod/v4";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getWebLinksByLead,
  getWebLinksByPerson,
  getWebLinksByCompetitor,
  createWebLink,
  updateWebLink,
  deleteWebLink,
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
          (d) =>
            [d.leadId, d.personId, d.competitorId].filter(Boolean).length ===
            1,
          {
            message:
              "Exactly one of leadId, personId, or competitorId must be provided",
          }
        )
    )
    .mutation(({ input, ctx }) =>
      createWebLink({ ...input, createdBy: ctx.user.id })
    ),

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

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteWebLink(input.id);
      return { success: true };
    }),
});
