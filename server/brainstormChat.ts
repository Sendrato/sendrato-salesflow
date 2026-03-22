import {
  streamText,
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  convertToModelMessages,
  generateId,
} from "ai";
import type { Express } from "express";
import { getLLMProvider } from "./llmProvider";
import { getBrainstormById } from "./brainstormDb";
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
        res.status(400).json({ error: "messages array is required" });
        return;
      }

      // chatId format: "brainstorm-{id}"
      const brainstormId = parseInt(
        (chatId as string)?.replace("brainstorm-", "") ?? "0"
      );
      if (!brainstormId) {
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
        context += `\n\n## AI Enrichment Analysis (previously generated)`;
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

      const systemPrompt = `You are a strategic business advisor helping refine and develop a brainstorm idea. You have full context about this idea including any prior AI analysis.

${context}

## Your Role
- Help the user refine, challenge, and expand on their idea
- Provide constructive feedback and suggest improvements
- Ask probing questions to uncover blind spots
- Suggest concrete next steps and experiments
- Draw on the enrichment analysis when relevant
- Be direct and practical — avoid generic advice`;

      const modelMessages = await convertToModelMessages(uiMessages);
      const llm = await getLLMProvider();

      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({ type: "start", messageId: generateId() });

          const result = streamText({
            model: llm.model,
            system: systemPrompt,
            messages: modelMessages,
          });

          result.consumeStream();
          writer.merge(result.toUIMessageStream({ sendStart: false }));
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
