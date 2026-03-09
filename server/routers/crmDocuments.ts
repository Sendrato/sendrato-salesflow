import { z } from "zod/v4";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getCrmDocuments,
  deleteCrmDocument,
} from "../crmDocumentsDb";

export const crmDocumentsRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          category: z.string().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
        .optional()
    )
    .query(({ input }) => getCrmDocuments(input ?? {})),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCrmDocument(input.id);
      return { success: true };
    }),
});
