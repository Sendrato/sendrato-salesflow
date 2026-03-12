import { z } from "zod/v4";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getPromotorEvents,
  getPromotorEventById,
  createPromotorEvent,
  updatePromotorEvent,
  deletePromotorEvent,
} from "../promotorEventsDb";

const eventDataSchema = z.object({
  eventName: z.string().min(1),
  eventAttributes: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
});

export const promotorEventsRouter = router({
  list: publicProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      return getPromotorEvents(input.leadId);
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const event = await getPromotorEventById(input.id);
      if (!event) throw new Error("Event not found");
      return event;
    }),

  create: protectedProcedure
    .input(z.object({ leadId: z.number() }).merge(eventDataSchema))
    .mutation(async ({ input, ctx }) => {
      return createPromotorEvent({
        leadId: input.leadId,
        eventName: input.eventName,
        eventAttributes: input.eventAttributes ?? {},
        notes: input.notes,
        createdBy: ctx.user.id,
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), data: eventDataSchema.partial() }))
    .mutation(async ({ input }) => {
      return updatePromotorEvent(input.id, input.data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deletePromotorEvent(input.id);
      return { success: true } as const;
    }),
});
