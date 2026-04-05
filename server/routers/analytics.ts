import { z } from "zod/v4";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getUserAllowedCountries } from "../_core/authorization";
import {
  getLeadStats,
  getContactMomentStats,
  getRecentContactMoments,
  getUnmatchedEmails,
  matchIngestEmail,
  dismissIngestEmail,
  getRawPool,
} from "../db";
import { getDb } from "../db";
import { leads, contactMoments, persons } from "../../drizzle/schema";
import { sql, desc, eq, and, lt, gte, lte, inArray, or } from "drizzle-orm";

export const analyticsRouter = router({
  overview: publicProcedure.query(async ({ ctx }) => {
    const allowedCountries = getUserAllowedCountries(ctx.user);
    const [leadStats, momentStats] = await Promise.all([
      getLeadStats(allowedCountries),
      getContactMomentStats(allowedCountries),
    ]);
    return { leadStats, momentStats };
  }),

  pipeline: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const allowedCountries = getUserAllowedCountries(ctx.user);
    const countryFilter = Array.isArray(allowedCountries)
      ? inArray(leads.country, allowedCountries)
      : undefined;
    return db
      .select({
        status: leads.status,
        count: sql<number>`count(*)`,
        totalValue: sql<number>`COALESCE(SUM(${leads.estimatedValue}), 0)`,
      })
      .from(leads)
      .where(countryFilter)
      .groupBy(leads.status)
      .orderBy(leads.status);
  }),

  contactFrequency: publicProcedure
    .input(z.object({ days: z.number().optional().default(30) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const allowedCountries = getUserAllowedCountries(ctx.user);
      const needsFilter = Array.isArray(allowedCountries);
      const conditions: any[] = [
        sql`${contactMoments.occurredAt} >= NOW() - INTERVAL '1 day' * ${input.days}`,
      ];
      if (needsFilter) {
        conditions.push(
          or(
            eq(contactMoments.leadId, 0),
            inArray(leads.country, allowedCountries!)
          )
        );
      }
      const base = db
        .select({
          date: sql<string>`DATE(${contactMoments.occurredAt})`,
          count: sql<number>`count(*)`,
        })
        .from(contactMoments);
      const query = needsFilter
        ? base.leftJoin(leads, eq(contactMoments.leadId, leads.id))
        : base;
      return (query as typeof base)
        .where(and(...conditions))
        .groupBy(sql`DATE(${contactMoments.occurredAt})`)
        .orderBy(sql`DATE(${contactMoments.occurredAt})`);
    }),

  topLeads: publicProcedure
    .input(z.object({ limit: z.number().optional().default(10) }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const allowedCountries = getUserAllowedCountries(ctx.user);
      const countryFilter = Array.isArray(allowedCountries)
        ? inArray(leads.country, allowedCountries)
        : undefined;
      return db
        .select({
          id: leads.id,
          companyName: leads.companyName,
          contactPerson: leads.contactPerson,
          status: leads.status,
          priority: leads.priority,
          estimatedValue: leads.estimatedValue,
          lastContactedAt: leads.lastContactedAt,
          contactCount: sql<number>`(SELECT count(*) FROM contact_moments WHERE "leadId" = ${leads.id})`,
        })
        .from(leads)
        .where(countryFilter)
        .orderBy(desc(leads.updatedAt))
        .limit(input.limit);
    }),

  recentActivity: publicProcedure
    .input(z.object({ limit: z.number().optional().default(15) }))
    .query(async ({ input, ctx }) => {
      const allowedCountries = getUserAllowedCountries(ctx.user);
      return getRecentContactMoments(input.limit, allowedCountries);
    }),

  followUps: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db)
      return { overdue: [], upcoming: [], overdueCount: 0, upcomingCount: 0 };

    const allowedCountries = getUserAllowedCountries(ctx.user);
    const needsFilter = Array.isArray(allowedCountries);
    const countryCondition = needsFilter
      ? or(
          eq(contactMoments.leadId, 0),
          inArray(leads.country, allowedCountries!)
        )
      : undefined;

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const baseSelect = {
      momentId: contactMoments.id,
      leadId: contactMoments.leadId,
      personId: contactMoments.personId,
      companyName: leads.companyName,
      personName: persons.name,
      subject: contactMoments.subject,
      type: contactMoments.type,
      followUpAt: contactMoments.followUpAt,
    };

    const notDone = eq(contactMoments.followUpDone, false);

    const overdue = await db
      .select(baseSelect)
      .from(contactMoments)
      .leftJoin(leads, eq(contactMoments.leadId, leads.id))
      .leftJoin(persons, eq(contactMoments.personId, persons.id))
      .where(
        and(
          sql`${contactMoments.followUpAt} IS NOT NULL`,
          lt(contactMoments.followUpAt, now),
          notDone,
          countryCondition
        )
      )
      .orderBy(contactMoments.followUpAt)
      .limit(20);

    const upcoming = await db
      .select(baseSelect)
      .from(contactMoments)
      .leftJoin(leads, eq(contactMoments.leadId, leads.id))
      .leftJoin(persons, eq(contactMoments.personId, persons.id))
      .where(
        and(
          sql`${contactMoments.followUpAt} IS NOT NULL`,
          gte(contactMoments.followUpAt, now),
          lte(contactMoments.followUpAt, sevenDaysFromNow),
          notDone,
          countryCondition
        )
      )
      .orderBy(contactMoments.followUpAt)
      .limit(20);

    // Count queries: need to join leads when country filtering is active
    const overdueCountBase = db
      .select({ count: sql<number>`count(*)` })
      .from(contactMoments);
    const overdueCountQuery = needsFilter
      ? overdueCountBase.leftJoin(leads, eq(contactMoments.leadId, leads.id))
      : overdueCountBase;
    const [overdueCount] = await (
      overdueCountQuery as typeof overdueCountBase
    ).where(
      and(
        sql`${contactMoments.followUpAt} IS NOT NULL`,
        lt(contactMoments.followUpAt, now),
        notDone,
        countryCondition
      )
    );

    const upcomingCountBase = db
      .select({ count: sql<number>`count(*)` })
      .from(contactMoments);
    const upcomingCountQuery = needsFilter
      ? upcomingCountBase.leftJoin(leads, eq(contactMoments.leadId, leads.id))
      : upcomingCountBase;
    const [upcomingCount] = await (
      upcomingCountQuery as typeof upcomingCountBase
    ).where(
      and(
        sql`${contactMoments.followUpAt} IS NOT NULL`,
        gte(contactMoments.followUpAt, now),
        lte(contactMoments.followUpAt, sevenDaysFromNow),
        notDone,
        countryCondition
      )
    );

    // Upcoming meetings: type="meeting" with occurredAt in the future (within 21 days)
    const twentyOneDaysFromNow = new Date(
      now.getTime() + 21 * 24 * 60 * 60 * 1000
    );
    const upcomingMeetings = await db
      .select({
        momentId: contactMoments.id,
        leadId: contactMoments.leadId,
        personId: contactMoments.personId,
        companyName: leads.companyName,
        personName: persons.name,
        subject: contactMoments.subject,
        type: contactMoments.type,
        occurredAt: contactMoments.occurredAt,
        notes: contactMoments.notes,
      })
      .from(contactMoments)
      .leftJoin(leads, eq(contactMoments.leadId, leads.id))
      .leftJoin(persons, eq(contactMoments.personId, persons.id))
      .where(
        and(
          eq(contactMoments.type, "meeting"),
          gte(contactMoments.occurredAt, now),
          lte(contactMoments.occurredAt, twentyOneDaysFromNow),
          countryCondition
        )
      )
      .orderBy(contactMoments.occurredAt)
      .limit(20);

    const meetingsCountBase = db
      .select({ count: sql<number>`count(*)` })
      .from(contactMoments);
    const meetingsCountQuery = needsFilter
      ? meetingsCountBase.leftJoin(leads, eq(contactMoments.leadId, leads.id))
      : meetingsCountBase;
    const [upcomingMeetingsCount] = await (
      meetingsCountQuery as typeof meetingsCountBase
    ).where(
      and(
        eq(contactMoments.type, "meeting"),
        gte(contactMoments.occurredAt, now),
        lte(contactMoments.occurredAt, twentyOneDaysFromNow),
        countryCondition
      )
    );

    return {
      overdue,
      upcoming,
      overdueCount: Number(overdueCount?.count ?? 0),
      upcomingCount: Number(upcomingCount?.count ?? 0),
      upcomingMeetings,
      upcomingMeetingsCount: Number(upcomingMeetingsCount?.count ?? 0),
    };
  }),

  // ─── Unmatched Emails ─────────────────────────────────────────────────────

  unmatchedEmails: protectedProcedure.query(async () => {
    return getUnmatchedEmails();
  }),

  matchEmail: protectedProcedure
    .input(
      z.object({
        ingestId: z.number(),
        leadId: z.number().optional(),
        personId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return matchIngestEmail(input.ingestId, {
        leadId: input.leadId,
        personId: input.personId,
        userId: ctx.user.id,
      });
    }),

  dismissEmail: protectedProcedure
    .input(z.object({ ingestId: z.number() }))
    .mutation(async ({ input }) => {
      await dismissIngestEmail(input.ingestId);
      return { success: true };
    }),

  recentShareViews: publicProcedure
    .input(z.object({ limit: z.number().optional().default(10) }))
    .query(async ({ input, ctx }) => {
      const pool = await getRawPool();
      if (!pool) return [];
      const allowedCountries = getUserAllowedCountries(ctx.user);
      let whereClause = "";
      const params: any[] = [input.limit];
      if (Array.isArray(allowedCountries)) {
        const placeholders = allowedCountries.map((_, i) => `$${i + 2}`);
        whereClause = `WHERE (l.id IS NULL OR l.country IN (${placeholders.join(", ")}))`;
        params.push(...allowedCountries);
      }
      const { rows } = await pool.query(
        `SELECT pv.id, pv."viewedAt", pv."ipAddress", pv.country, pv.city, pv."userAgent",
                sp.title AS "shareTitle", sp.token,
                COALESCE(ld."fileName", cd."fileName") AS "fileName",
                l."companyName", l.id AS "leadId"
         FROM presentation_views pv
         JOIN shareable_presentations sp ON sp.id = pv."presentationId"
         LEFT JOIN lead_documents ld ON ld.id = sp."documentId"
         LEFT JOIN leads l ON l.id = sp."leadId"
         LEFT JOIN crm_documents cd ON cd.id = sp."crmDocumentId"
         ${whereClause}
         ORDER BY pv."viewedAt" DESC
         LIMIT $1`,
        params
      );
      return rows as {
        id: number;
        viewedAt: string;
        ipAddress: string | null;
        country: string | null;
        city: string | null;
        userAgent: string | null;
        shareTitle: string | null;
        token: string;
        fileName: string | null;
        companyName: string | null;
        leadId: number | null;
      }[];
    }),
});
