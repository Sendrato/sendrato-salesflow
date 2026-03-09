import { z } from "zod/v4";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getContactMoments,
  getRecentContactMoments,
  createContactMoment,
  updateContactMoment,
  deleteContactMoment,
  getContactMomentStats,
} from "../db";

const momentTypeEnum = z.enum(["email", "phone", "meeting", "linkedin", "slack", "demo", "proposal", "other"]);
const momentOutcomeEnum = z.enum(["positive", "neutral", "negative", "no_response"]);

export const contactMomentsRouter = router({
  list: publicProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      return getContactMoments(input.leadId);
    }),

  recent: publicProcedure
    .input(z.object({ limit: z.number().optional().default(20) }))
    .query(async ({ input }) => {
      return getRecentContactMoments(input.limit);
    }),

  create: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
        type: momentTypeEnum,
        direction: z.enum(["inbound", "outbound"]).optional().default("outbound"),
        subject: z.string().optional(),
        notes: z.string().optional(),
        outcome: momentOutcomeEnum.optional().default("neutral"),
        occurredAt: z.string().optional(),
        followUpAt: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return createContactMoment({
        ...input,
        userId: ctx.user.id,
        source: "manual",
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        followUpAt: input.followUpAt ? new Date(input.followUpAt) : undefined,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          type: momentTypeEnum.optional(),
          subject: z.string().optional(),
          notes: z.string().optional(),
          outcome: momentOutcomeEnum.optional(),
          occurredAt: z.string().optional(),
          followUpAt: z.string().optional(),
          followUpDone: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const updateData: Record<string, any> = {};
      if (input.data.type !== undefined) updateData.type = input.data.type;
      if (input.data.subject !== undefined) updateData.subject = input.data.subject;
      if (input.data.notes !== undefined) updateData.notes = input.data.notes;
      if (input.data.outcome !== undefined) updateData.outcome = input.data.outcome;
      if (input.data.occurredAt) {
        const d = new Date(input.data.occurredAt);
        if (!isNaN(d.getTime())) updateData.occurredAt = d;
      }
      if (input.data.followUpAt) {
        const d = new Date(input.data.followUpAt);
        if (!isNaN(d.getTime())) updateData.followUpAt = d;
      }
      if (input.data.followUpDone !== undefined) updateData.followUpDone = input.data.followUpDone;
      return await updateContactMoment(input.id, updateData);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteContactMoment(input.id);
      return { success: true };
    }),

  listAll: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        type: z.string().optional(),
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ input }) => {
      const { getRecentContactMomentsWithLeads } = await import("../db");
      return getRecentContactMomentsWithLeads(input);
    }),

  stats: publicProcedure.query(async () => {
    return getContactMomentStats();
  }),
});
