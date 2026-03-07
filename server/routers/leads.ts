import { z } from "zod/v4";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  bulkInsertLeads,
  getLeadStats,
} from "../db";

const leadStatusEnum = z.enum(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost", "on_hold"]);
const leadPriorityEnum = z.enum(["low", "medium", "high"]);

const leadInputSchema = z.object({
  companyName: z.string().min(1),
  website: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  location: z.string().optional(),
  contactPerson: z.string().optional(),
  contactTitle: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  status: leadStatusEnum.optional().default("new"),
  priority: leadPriorityEnum.optional().default("medium"),
  source: z.string().optional(),
  assignedTo: z.number().optional(),
  estimatedValue: z.number().optional(),
  currency: z.string().optional().default("USD"),
  socialMedia: z.string().optional(),
  ticketingSystem: z.string().optional(),
  paymentMethods: z.string().optional(),
  mobileApp: z.string().optional(),
  painPoints: z.string().optional(),
  currentPilot: z.string().optional(),
  futureOpportunities: z.string().optional(),
  revenueModel: z.string().optional(),
  risks: z.string().optional(),
  brandTone: z.string().optional(),
  surveyStatus: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  nextFollowUpAt: z.string().optional(),
  leadType: z.enum(["default", "event", "festival", "conference", "hospitality", "saas", "retail"]).optional().default("default"),
  leadAttributes: z.record(z.string(), z.unknown()).optional(),
});

export const leadsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        source: z.string().optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ input }) => {
      return getLeads(input);
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const lead = await getLeadById(input.id);
      if (!lead) throw new Error("Lead not found");
      return lead;
    }),

  create: protectedProcedure
    .input(leadInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { nextFollowUpAt, ...rest } = input;
      const lead = await createLead({
        ...rest,
        createdBy: ctx.user.id,
        source: rest.source ?? "manual",
        nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
      });
      return lead;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), data: leadInputSchema.partial() }))
    .mutation(async ({ input }) => {
      const { nextFollowUpAt, ...restData } = input.data;
      const lead = await updateLead(input.id, {
        ...restData,
        nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
      });
      return lead;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteLead(input.id);
      return { success: true };
    }),

  bulkCreate: protectedProcedure
    .input(z.array(leadInputSchema))
    .mutation(async ({ input, ctx }) => {
      const ids = await bulkInsertLeads(
        input.map((l) => {
          const { nextFollowUpAt, ...rest } = l;
          return {
            ...rest,
            createdBy: ctx.user.id,
            source: rest.source ?? "import",
            nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
          };
        })
      );
      return { inserted: ids.length, ids };
    }),

  stats: publicProcedure.query(async () => {
    return getLeadStats();
  }),
});
