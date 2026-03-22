import { z } from "zod/v4";
import { generateText } from "ai";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getBrainstorms,
  getBrainstormsCount,
  getBrainstormById,
  createBrainstorm,
  updateBrainstorm,
  deleteBrainstorm,
  getBrainstormDocuments,
  deleteBrainstormDocument,
} from "../brainstormDb";
import { getLeadById } from "../db";
import { getLLMProvider } from "../llmProvider";
import {
  fetchWikipedia,
  fetchGoogleNews,
  type EnrichmentSource,
} from "../enrichmentEngine";

export const brainstormRouter = router({
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        leadId: z.number().optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ input }) => {
      const [items, total] = await Promise.all([
        getBrainstorms(input),
        getBrainstormsCount(input),
      ]);
      return { items, total };
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const item = await getBrainstormById(input.id);
      if (!item) throw new Error("Brainstorm not found");
      return item;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        content: z.string().optional(),
        leadId: z.number().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = await createBrainstorm({
        ...input,
        createdBy: ctx.user.id,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          title: z.string().optional(),
          content: z.string().optional(),
          leadId: z.number().nullable().optional(),
          tags: z.array(z.string()).optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      return updateBrainstorm(input.id, input.data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteBrainstorm(input.id);
      return { success: true };
    }),

  listDocuments: publicProcedure
    .input(z.object({ brainstormId: z.number() }))
    .query(async ({ input }) => {
      return getBrainstormDocuments(input.brainstormId);
    }),

  deleteDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteBrainstormDocument(input.id);
      return { success: true };
    }),

  saveChatMessages: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        chatMessages: z.array(z.unknown()),
      })
    )
    .mutation(async ({ input }) => {
      await updateBrainstorm(input.id, {
        chatMessages: input.chatMessages,
      });
      return { success: true };
    }),

  enrich: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const brainstorm = await getBrainstormById(input.id);
      if (!brainstorm) throw new Error("Brainstorm not found");

      // Load linked lead if present
      let leadContext = "";
      if (brainstorm.leadId) {
        const lead = await getLeadById(brainstorm.leadId);
        if (lead) {
          leadContext = `
## Linked Company Context
Company: ${lead.companyName}
Website: ${lead.website ?? "N/A"}
Industry: ${lead.industry ?? "N/A"}
Location: ${lead.location ?? "N/A"}
Pain Points: ${lead.painPoints ?? "N/A"}
Opportunities: ${lead.futureOpportunities ?? "N/A"}
Notes: ${lead.notes ?? "N/A"}`;
        }
      }

      // Extract search terms from title/content
      const searchTerms =
        brainstorm.title + (brainstorm.content ? " " + brainstorm.content : "");
      const shortQuery = searchTerms.slice(0, 100);

      // Web research in parallel
      const [wikiSource, newsSources] = await Promise.all([
        fetchWikipedia(shortQuery).catch(() => null),
        fetchGoogleNews(shortQuery).catch(() => []),
      ]);

      const sources: EnrichmentSource[] = [
        ...(wikiSource ? [wikiSource] : []),
        ...newsSources,
      ];
      const webDataFound = sources.length > 0;

      const webContext =
        sources.length > 0
          ? sources
              .map(s => `\n### Source: ${s.title}\nURL: ${s.url}\n${s.snippet}`)
              .join("\n\n")
          : "No web data was retrievable. Use your general knowledge.";

      const prompt = `You are a strategic business analyst. You have been given a brainstorm idea along with optional company context and web research. Analyze this idea thoroughly.

## Brainstorm Idea
Title: ${brainstorm.title}
Description: ${brainstorm.content ?? "No description provided."}
${leadContext}

## Web Research Gathered
${webContext}

## Instructions
Based on ALL the above information, produce a JSON analysis report with these exact fields:
- marketResearch: string (market size, trends, relevant data points — 3-4 sentences)
- feasibility: string (technical and business feasibility assessment — 2-3 sentences)
- relatedOpportunities: string (adjacent opportunities discovered — 2-3 sentences)
- competitiveAnalysis: string (existing solutions, competitors, differentiation — 2-3 sentences)
- actionItems: string[] (5-8 concrete next steps)
- risks: string (key risks and mitigation strategies — 2-3 sentences)
- potentialValue: string (estimated value/impact — 1-2 sentences)

Respond with ONLY the JSON object, no markdown fences.`;

      const llm = await getLLMProvider();
      const { text: content } = await generateText({
        model: llm.enrichModel,
        messages: [{ role: "user", content: prompt }],
        maxOutputTokens: 1500,
      });

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("LLM did not return valid JSON");

      const parsed = JSON.parse(jsonMatch[0]);

      const enrichmentData = {
        marketResearch: parsed.marketResearch ?? "",
        feasibility: parsed.feasibility ?? "",
        relatedOpportunities: parsed.relatedOpportunities ?? "",
        competitiveAnalysis: parsed.competitiveAnalysis ?? "",
        actionItems: parsed.actionItems ?? [],
        risks: parsed.risks ?? "",
        potentialValue: parsed.potentialValue ?? "",
        sources,
        enrichedAt: new Date().toISOString(),
        webDataFound,
      };

      await updateBrainstorm(input.id, {
        enrichmentData,
        enrichedAt: new Date(),
      });

      return enrichmentData;
    }),
});
