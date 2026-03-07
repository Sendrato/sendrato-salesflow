import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { settingsRouter } from "./routers/settings";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { leadsRouter } from "./routers/leads";
import { contactMomentsRouter } from "./routers/contactMoments";
import { documentsRouter } from "./routers/documents";
import { analyticsRouter } from "./routers/analytics";
import { personsRouter } from "./routers/persons";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { z } from "zod/v4";

export const appRouter = router({
  system: systemRouter,
  settings: settingsRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  leads: leadsRouter,
  contactMoments: contactMomentsRouter,
  documents: documentsRouter,
  analytics: analyticsRouter,
  persons: personsRouter,

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
        // Return a presigned-style endpoint — client will POST file to /api/upload-file
        return {
          uploadEndpoint: "/api/upload-file",
          fileKey: `leads/${input.leadId}/${nanoid()}-${input.fileName}`,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
