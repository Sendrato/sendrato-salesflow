import { z } from "zod/v4";
import { publicProcedure, router } from "../_core/trpc";
import { getLeadStats, getContactMomentStats, getRecentContactMoments } from "../db";
import { getDb } from "../db";
import { leads, contactMoments } from "../../drizzle/schema";
import { sql, desc } from "drizzle-orm";

export const analyticsRouter = router({
  overview: publicProcedure.query(async () => {
    const [leadStats, momentStats] = await Promise.all([
      getLeadStats(),
      getContactMomentStats(),
    ]);
    return { leadStats, momentStats };
  }),

  pipeline: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        status: leads.status,
        count: sql<number>`count(*)`,
        totalValue: sql<number>`COALESCE(SUM(${leads.estimatedValue}), 0)`,
      })
      .from(leads)
      .groupBy(leads.status)
      .orderBy(leads.status);
  }),

  contactFrequency: publicProcedure
    .input(z.object({ days: z.number().optional().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          date: sql<string>`DATE(${contactMoments.occurredAt})`,
          count: sql<number>`count(*)`,
        })
        .from(contactMoments)
        .where(sql`${contactMoments.occurredAt} >= NOW() - INTERVAL '1 day' * ${input.days}`)
        .groupBy(sql`DATE(${contactMoments.occurredAt})`)
        .orderBy(sql`DATE(${contactMoments.occurredAt})`);
    }),

  topLeads: publicProcedure
    .input(z.object({ limit: z.number().optional().default(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select({
          id: leads.id,
          companyName: leads.companyName,
          contactPerson: leads.contactPerson,
          status: leads.status,
          priority: leads.priority,
          estimatedValue: leads.estimatedValue,
          lastContactedAt: leads.lastContactedAt,
          contactCount: sql<number>`(SELECT count(*) FROM contact_moments WHERE leadId = ${leads.id})`,
        })
        .from(leads)
        .orderBy(desc(leads.updatedAt))
        .limit(input.limit);
    }),

  recentActivity: publicProcedure
    .input(z.object({ limit: z.number().optional().default(15) }))
    .query(async ({ input }) => {
      return getRecentContactMoments(input.limit);
    }),
});
