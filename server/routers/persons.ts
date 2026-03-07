import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  getPersons,
  getPersonById,
  createPerson,
  updatePerson,
  deletePerson,
  getPersonLeadLinks,
  getLeadPersonLinks,
  linkPersonToLead,
  unlinkPersonFromLead,
  getPersonContactMoments,
  getPersonsCount,
} from "../personsDb";
import { getDb } from "../db";
import { contactMoments } from "../../drizzle/schema";

const personTypeEnum = z.enum([
  "prospect",
  "contact",
  "partner",
  "reseller",
  "influencer",
  "investor",
  "other",
]);

const personInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedInUrl: z.string().optional(),
  personType: personTypeEnum.optional().default("prospect"),
  company: z.string().optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  twitterUrl: z.string().optional(),
  nextFollowUpAt: z.string().optional(),
});

export const personsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        personType: z.string().optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ input }) => {
      const [rows, total] = await Promise.all([
        getPersons(input),
        getPersonsCount(input),
      ]);
      return { persons: rows, total };
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const person = await getPersonById(input.id);
      if (!person) throw new Error("Person not found");
      return person;
    }),

  create: protectedProcedure
    .input(personInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { nextFollowUpAt, ...rest } = input;
      const id = await createPerson({
        ...rest,
        createdBy: ctx.user.id,
        nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), data: personInputSchema.partial() }))
    .mutation(async ({ input }) => {
      const { nextFollowUpAt, ...rest } = input.data;
      const person = await updatePerson(input.id, {
        ...rest,
        nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
      });
      return person;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deletePerson(input.id);
      return { success: true };
    }),

  // ─── Lead links ───────────────────────────────────────────────────────────

  getLeadLinks: publicProcedure
    .input(z.object({ personId: z.number() }))
    .query(async ({ input }) => getPersonLeadLinks(input.personId)),

  getPersonsForLead: publicProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => getLeadPersonLinks(input.leadId)),

  linkToLead: protectedProcedure
    .input(
      z.object({
        personId: z.number(),
        leadId: z.number(),
        relationship: z
          .enum(["contact_at", "introduced_by", "decision_maker", "champion", "partner", "other"])
          .optional()
          .default("contact_at"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await linkPersonToLead(input);
      return { id };
    }),

  unlinkFromLead: protectedProcedure
    .input(z.object({ personId: z.number(), leadId: z.number() }))
    .mutation(async ({ input }) => {
      await unlinkPersonFromLead(input.personId, input.leadId);
      return { success: true };
    }),

  // ─── Contact moments for a person ─────────────────────────────────────────

  getContactMoments: publicProcedure
    .input(z.object({ personId: z.number() }))
    .query(async ({ input }) => getPersonContactMoments(input.personId)),

  logContactMoment: protectedProcedure
    .input(
      z.object({
        personId: z.number(),
        leadId: z.number().optional(),
        type: z.enum(["email", "phone", "meeting", "linkedin", "slack", "demo", "proposal", "other"]),
        direction: z.enum(["inbound", "outbound"]).optional().default("outbound"),
        subject: z.string().optional(),
        notes: z.string().optional(),
        outcome: z.enum(["positive", "neutral", "negative", "no_response"]).optional().default("neutral"),
        occurredAt: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const { occurredAt, ...rest } = input;
      const [result] = await db.insert(contactMoments).values({
        ...rest,
        leadId: rest.leadId ?? 0, // 0 = person-only moment
        userId: ctx.user.id,
        source: "manual",
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      });
      // Update person lastContactedAt
      await updatePerson(input.personId, { lastContactedAt: new Date() });
      return { id: (result as any).insertId };
    }),
});
