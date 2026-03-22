import {
  streamText,
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  convertToModelMessages,
  generateId,
  tool,
  stepCountIs,
} from "ai";
import { z } from "zod/v4";
import type { Express } from "express";
import { getLLMProvider } from "./llmProvider";
import {
  getBrainstormById,
  getBrainstormDocuments,
  updateBrainstorm,
} from "./brainstormDb";
import { getLeadById } from "./db";

export function registerBrainstormChatRoutes(app: Express) {
  app.post("/api/brainstorm-chat", async (req, res) => {
    try {
      const { messages: uiMessages, chatId } = req.body;

      if (
        !uiMessages ||
        !Array.isArray(uiMessages) ||
        uiMessages.length === 0
      ) {
        console.error("[brainstorm-chat] Invalid messages:", { uiMessages, chatId });
        res.status(400).json({ error: "messages array is required" });
        return;
      }

      // chatId format: "brainstorm-{id}"
      const brainstormId = parseInt(
        (chatId as string)?.replace("brainstorm-", "") ?? "0"
      );
      if (!brainstormId) {
        console.error("[brainstorm-chat] Invalid chatId:", chatId);
        res.status(400).json({ error: "Valid chatId is required" });
        return;
      }

      // Load brainstorm context
      const brainstorm = await getBrainstormById(brainstormId);
      if (!brainstorm) {
        res.status(404).json({ error: "Brainstorm not found" });
        return;
      }

      // Build context from brainstorm data
      let context = `## Brainstorm Idea
Title: ${brainstorm.title}
Description: ${brainstorm.content ?? "No description provided."}`;

      // Add enrichment data if available
      const enrichment = brainstorm.enrichmentData as Record<
        string,
        unknown
      > | null;
      if (enrichment) {
        context += `\n\n## Current Enrichment Analysis`;
        if (enrichment.marketResearch)
          context += `\nMarket Research: ${enrichment.marketResearch}`;
        if (enrichment.feasibility)
          context += `\nFeasibility: ${enrichment.feasibility}`;
        if (enrichment.relatedOpportunities)
          context += `\nRelated Opportunities: ${enrichment.relatedOpportunities}`;
        if (enrichment.competitiveAnalysis)
          context += `\nCompetitive Analysis: ${enrichment.competitiveAnalysis}`;
        if (enrichment.risks)
          context += `\nRisks: ${enrichment.risks}`;
        if (enrichment.potentialValue)
          context += `\nPotential Value: ${enrichment.potentialValue}`;
        if (
          Array.isArray(enrichment.actionItems) &&
          enrichment.actionItems.length > 0
        )
          context += `\nAction Items: ${(enrichment.actionItems as string[]).join("; ")}`;
      }

      // Add linked lead context if available
      if (brainstorm.leadId) {
        const lead = await getLeadById(brainstorm.leadId);
        if (lead) {
          context += `\n\n## Linked Company
Company: ${lead.companyName}
Website: ${lead.website ?? "N/A"}
Industry: ${lead.industry ?? "N/A"}
Location: ${lead.location ?? "N/A"}
Pain Points: ${lead.painPoints ?? "N/A"}
Opportunities: ${lead.futureOpportunities ?? "N/A"}`;
        }
      }

      // Add uploaded document content
      const documents = await getBrainstormDocuments(brainstormId);
      if (documents.length > 0) {
        context += `\n\n## Uploaded Documents`;
        for (const doc of documents) {
          const docText = doc.textContent
            ? doc.textContent.slice(0, 4000)
            : "(no text extracted)";
          context += `\n\n### Document: ${doc.fileName}\n${docText}`;
        }
      }

      // Define tools
      const brainstormTools = {
        updateEnrichment: tool({
          description:
            "Update the brainstorm enrichment analysis based on new insights from the conversation or uploaded documents. Use this when you discover important new information that should be captured in the enrichment report. Only provide the fields you want to update — omitted fields keep their current values.",
          inputSchema: z.object({
            marketResearch: z
              .string()
              .optional()
              .describe("Updated market research insights"),
            feasibility: z
              .string()
              .optional()
              .describe("Updated feasibility assessment"),
            relatedOpportunities: z
              .string()
              .optional()
              .describe("Updated related opportunities"),
            competitiveAnalysis: z
              .string()
              .optional()
              .describe("Updated competitive analysis"),
            actionItems: z
              .array(z.string())
              .optional()
              .describe("Updated action items list"),
            risks: z
              .string()
              .optional()
              .describe("Updated risks assessment"),
            potentialValue: z
              .string()
              .optional()
              .describe("Updated potential value estimate"),
          }),
          execute: async (updates) => {
            const current =
              (brainstorm.enrichmentData as Record<string, unknown>) ??
              {};
            const merged = { ...current };
            for (const [key, value] of Object.entries(updates)) {
              if (value !== undefined) {
                merged[key] = value;
              }
            }
            merged.enrichedAt = new Date().toISOString();

            await updateBrainstorm(brainstormId, {
              enrichmentData: merged,
              enrichedAt: new Date(),
            });

            return {
              success: true,
              updatedFields: Object.keys(updates).filter(
                (k) => (updates as Record<string, unknown>)[k] !== undefined
              ),
            };
          },
        }),
      };

      const systemPrompt = `You are a strategic business advisor helping refine and develop a brainstorm idea. You have full context about this idea including any prior AI analysis and uploaded documents.

${context}

## Your Role
- Help the user refine, challenge, and expand on their idea
- Provide constructive feedback and suggest improvements
- Ask probing questions to uncover blind spots
- Suggest concrete next steps and experiments
- Draw on the enrichment analysis and uploaded documents when relevant
- Be direct and practical — avoid generic advice
- When you discover significant new insights from documents or conversation that should be captured, use the updateEnrichment tool to update the enrichment analysis`;

      console.log("[brainstorm-chat] Processing request for brainstorm", brainstormId, "with", uiMessages.length, "messages");

      const modelMessages = await convertToModelMessages(uiMessages);
      const llm = await getLLMProvider();

      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({ type: "start", messageId: generateId() });

          const result = streamText({
            model: llm.model,
            system: systemPrompt,
            messages: modelMessages,
            tools: brainstormTools,
            stopWhen: stepCountIs(3),
          });

          result.consumeStream();
          writer.merge(result.toUIMessageStream({ sendStart: false }));
        },
        onError: (error) => {
          console.error("[brainstorm-chat] Stream error:", error);
          return error instanceof Error ? error.message : "Stream processing failed";
        },
      });

      pipeUIMessageStreamToResponse({ response: res, stream });
    } catch (err) {
      console.error("[brainstorm-chat] Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Brainstorm chat failed" });
      }
    }
  });
}
