import { COOKIE_NAME } from "@shared/const";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod/v4";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import * as db from "./db";
import { analyticsRouter } from "./routers/analytics";
import { contactMomentsRouter } from "./routers/contactMoments";
import { documentsRouter } from "./routers/documents";
import { leadsRouter } from "./routers/leads";
import { personsRouter } from "./routers/persons";
import { competitorsRouter } from "./routers/competitors";
import { webLinksRouter } from "./routers/webLinks";
import { crmDocumentsRouter } from "./routers/crmDocuments";
import { promotorEventsRouter } from "./routers/promotorEvents";
import { settingsRouter } from "./routers/settings";

const BCRYPT_ROUNDS = 12;

export const appRouter = router({
  system: systemRouter,
  settings: settingsRouter,

  auth: router({
    me: publicProcedure.query((opts) => {
      if (!opts.ctx.user) return null;
      const { passwordHash: _, ...user } = opts.ctx.user;
      return user;
    }),

    hasUsers: publicProcedure.query(async () => {
      const count = await db.getUserCount();
      return count > 0;
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    changePassword: protectedProcedure
      .input(
        z.object({
          currentPassword: z.string(),
          newPassword: z.string().min(8),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByOpenId(ctx.user.openId);
        if (!user?.passwordHash) {
          throw new Error("No password set for this account");
        }

        const valid = await bcrypt.compare(
          input.currentPassword,
          user.passwordHash
        );
        if (!valid) {
          throw new Error("Current password is incorrect");
        }

        const newHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
        await db.updateUserPassword(user.id, newHash);

        return { success: true } as const;
      }),

    inviteUser: adminProcedure
      .input(
        z.object({
          email: z.email(),
          name: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new Error("A user with this email already exists");
        }

        const tempPassword = nanoid(16);
        const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
        const openId = nanoid();

        await db.upsertUser({
          openId,
          name: input.name || null,
          email: input.email.toLowerCase(),
          passwordHash,
          loginMethod: "email",
          lastSignedIn: new Date(),
        });

        return { tempPassword };
      }),

    listUsers: adminProcedure.query(async () => {
      return db.listUsers();
    }),

    reinviteUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const user = await db.getUserById(input.userId);
        if (!user) {
          throw new Error("User not found");
        }

        const tempPassword = nanoid(16);
        const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
        await db.updateUserPassword(user.id, passwordHash);

        return { tempPassword, email: user.email };
      }),
  }),

  leads: leadsRouter,
  contactMoments: contactMomentsRouter,
  documents: documentsRouter,
  analytics: analyticsRouter,
  persons: personsRouter,
  competitors: competitorsRouter,
  webLinks: webLinksRouter,
  crmDocuments: crmDocumentsRouter,
  promotorEvents: promotorEventsRouter,

  // File upload for documents
  upload: router({
    getUploadUrl: protectedProcedure
      .input(
        z.object({
          fileName: z.string(),
          mimeType: z.string(),
          leadId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        return {
          uploadEndpoint: "/api/upload-file",
          fileKey: `leads/${input.leadId}/${nanoid()}-${input.fileName}`,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
