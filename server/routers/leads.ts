import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  mergeLeads,
  bulkInsertLeads,
  getLeadStats,
  getLeadsByIds,
} from "../db";
import type { User } from "../../drizzle/schema";

const leadStatusEnum = z.enum([
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "on_hold",
]);
const leadPriorityEnum = z.enum(["low", "medium", "high"]);

const leadInputSchema = z.object({
  companyName: z.string().min(1),
  website: z.string().optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  location: z.string().optional(),
  country: z.string().optional(),
  contactPerson: z.string().optional(),
  contactTitle: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  status: leadStatusEnum.optional(),
  priority: leadPriorityEnum.optional(),
  source: z.string().optional(),
  assignedTo: z.number().optional(),
  estimatedValue: z.number().optional(),
  currency: z.string().optional(),
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
  label: z.string().optional(),
  nextFollowUpAt: z.string().optional(),
  leadType: z
    .enum([
      "default",
      "event",
      "festival",
      "conference",
      "hospitality",
      "saas",
      "retail",
      "partner",
      "venue",
      "event_promotor",
    ])
    .optional(),
  leadAttributes: z.record(z.string(), z.unknown()).optional(),
});

/** Return the user's allowed countries array, or null if unrestricted. */
function getUserAllowedCountries(
  user: User | null
): string[] | null {
  if (!user) return null;
  if (user.role === "admin") return null;
  return user.allowedCountries ?? null;
}

function assertCountryAuthorized(
  user: User,
  country: string | undefined | null
) {
  const allowed = getUserAllowedCountries(user);
  if (!allowed) return;
  if (country && !allowed.includes(country)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not authorized for this country",
    });
  }
}

export const leadsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        source: z.string().optional(),
        country: z.string().optional(),
        leadType: z.string().optional(),
        label: z.string().optional(),
        assignedTo: z.number().optional(),
        sizeMin: z.number().optional(),
        sizeMax: z.number().optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const allowedCountries = getUserAllowedCountries(ctx.user);
      return getLeads({ ...input, allowedCountries });
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const lead = await getLeadById(input.id);
      if (!lead) throw new Error("Lead not found");
      const allowed = getUserAllowedCountries(ctx.user);
      if (allowed && lead.country && !allowed.includes(lead.country)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized for this country",
        });
      }
      return lead;
    }),

  create: protectedProcedure
    .input(leadInputSchema)
    .mutation(async ({ input, ctx }) => {
      assertCountryAuthorized(ctx.user, input.country);
      const { nextFollowUpAt, ...rest } = input;
      const lead = await createLead({
        ...rest,
        status: rest.status ?? "new",
        priority: rest.priority ?? "medium",
        currency: rest.currency ?? "USD",
        leadType: (rest.leadType ?? "default") as any,
        createdBy: ctx.user.id,
        source: rest.source ?? "manual",
        nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
      });
      return lead;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), data: leadInputSchema.partial() }))
    .mutation(async ({ input, ctx }) => {
      // Check authorization on the existing lead
      const allowed = getUserAllowedCountries(ctx.user);
      if (allowed) {
        const existing = await getLeadById(input.id);
        if (existing?.country && !allowed.includes(existing.country)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not authorized for this lead's country",
          });
        }
        // Also check the new country if being changed
        if (
          input.data.country &&
          !allowed.includes(input.data.country)
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not authorized for this country",
          });
        }
      }
      const { nextFollowUpAt, ...restData } = input.data;
      const lead = await updateLead(input.id, {
        ...restData,
        nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : undefined,
      });
      return lead;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const allowed = getUserAllowedCountries(ctx.user);
      if (allowed) {
        const existing = await getLeadById(input.id);
        if (existing?.country && !allowed.includes(existing.country)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not authorized for this lead's country",
          });
        }
      }
      await deleteLead(input.id);
      return { success: true };
    }),

  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input, ctx }) => {
      const allowed = getUserAllowedCountries(ctx.user);
      if (allowed) {
        const existingLeads = await getLeadsByIds(input.ids);
        for (const lead of existingLeads) {
          if (lead.country && !allowed.includes(lead.country)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Not authorized for country: ${lead.country}`,
            });
          }
        }
      }
      for (const id of input.ids) {
        await deleteLead(id);
      }
      return { success: true, deleted: input.ids.length };
    }),

  bulkUpdateLabel: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1), label: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const allowed = getUserAllowedCountries(ctx.user);
      if (allowed) {
        const existingLeads = await getLeadsByIds(input.ids);
        for (const lead of existingLeads) {
          if (lead.country && !allowed.includes(lead.country)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Not authorized for country: ${lead.country}`,
            });
          }
        }
      }
      for (const id of input.ids) {
        await updateLead(id, { label: input.label || null });
      }
      return { success: true, updated: input.ids.length };
    }),

  bulkUpdateAssignedTo: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.number()).min(1),
        assignedTo: z.number().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allowed = getUserAllowedCountries(ctx.user);
      if (allowed) {
        const existingLeads = await getLeadsByIds(input.ids);
        for (const lead of existingLeads) {
          if (lead.country && !allowed.includes(lead.country)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Not authorized for country: ${lead.country}`,
            });
          }
        }
      }
      for (const id of input.ids) {
        await updateLead(id, { assignedTo: input.assignedTo });
      }
      return { success: true, updated: input.ids.length };
    }),

  merge: protectedProcedure
    .input(z.object({ keepId: z.number(), removeId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const allowed = getUserAllowedCountries(ctx.user);
      if (allowed) {
        const [keep, remove] = await Promise.all([
          getLeadById(input.keepId),
          getLeadById(input.removeId),
        ]);
        if (keep?.country && !allowed.includes(keep.country)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not authorized for this lead's country",
          });
        }
        if (remove?.country && !allowed.includes(remove.country)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Not authorized for this lead's country",
          });
        }
      }
      return mergeLeads(input.keepId, input.removeId);
    }),

  bulkCreate: protectedProcedure
    .input(z.array(leadInputSchema))
    .mutation(async ({ input, ctx }) => {
      const allowed = getUserAllowedCountries(ctx.user);
      if (allowed) {
        for (const l of input) {
          if (l.country && !allowed.includes(l.country)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Not authorized for country: ${l.country}`,
            });
          }
        }
      }
      const ids = await bulkInsertLeads(
        input.map(l => {
          const { nextFollowUpAt, ...rest } = l;
          return {
            ...rest,
            status: rest.status ?? "new",
            priority: rest.priority ?? "medium",
            currency: rest.currency ?? "USD",
            leadType: (rest.leadType ?? "default") as any,
            createdBy: ctx.user.id,
            source: rest.source ?? "import",
            nextFollowUpAt: nextFollowUpAt
              ? new Date(nextFollowUpAt)
              : undefined,
          };
        })
      );
      return { inserted: ids.length, ids };
    }),

  stats: publicProcedure.query(async () => {
    return getLeadStats();
  }),
});
