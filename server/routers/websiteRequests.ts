import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getPendingWebsiteRequests,
  listWebsiteRequests,
  markWebsiteRequestHandled,
  markWebsiteRequestUnhandled,
} from "../websiteRequestsDb";

export const websiteRequestsRouter = router({
  /** Dashboard triage queue: enquiries nobody has picked up yet. */
  pending: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ input }) => getPendingWebsiteRequests(input.limit)),

  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(25),
        offset: z.number().int().min(0).default(0),
        includeSpam: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => listWebsiteRequests(input)),

  markHandled: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input, ctx }) =>
      markWebsiteRequestHandled(input.id, ctx.user.id)
    ),

  markUnhandled: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => markWebsiteRequestUnhandled(input.id)),
});
