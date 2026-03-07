/**
 * CRM AI Chat endpoint with RAG (Retrieval-Augmented Generation)
 * Uses semantic search over lead embeddings to provide context-aware answers.
 */

import { streamText, stepCountIs, tool, generateText, createUIMessageStream, pipeUIMessageStreamToResponse, convertToModelMessages, generateId } from "ai";
import type { Express } from "express";
import { z } from "zod/v4";
import { getLLMProvider } from "./llmProvider";
import {
  getLeads,
  getLeadById,
  getContactMoments,
  getAllEmbeddings,
  getLeadsByIds,
  upsertLeadEmbedding,
  updateLead,
  createContactMoment,
} from "./db";
import { searchDocumentChunks, computePriorityScore } from "./documentRag";
import mysql from "mysql2/promise";

let _rawDb: mysql.Connection | null = null;
async function getRawDb(): Promise<mysql.Connection | null> {
  if (_rawDb) { try { await _rawDb.ping(); return _rawDb; } catch { _rawDb = null; } }
  if (!process.env.DATABASE_URL) return null;
  try { _rawDb = await mysql.createConnection(process.env.DATABASE_URL); return _rawDb; } catch { return null; }
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

// Build a text representation of a lead for embedding
export function buildLeadText(lead: Record<string, unknown>): string {
  const parts = [
    `Company: ${lead.companyName}`,
    lead.website ? `Website: ${lead.website}` : null,
    lead.industry ? `Industry: ${lead.industry}` : null,
    lead.contactPerson ? `Contact: ${lead.contactPerson}` : null,
    lead.contactTitle ? `Title: ${lead.contactTitle}` : null,
    lead.email ? `Email: ${lead.email}` : null,
    lead.status ? `Status: ${lead.status}` : null,
    lead.priority ? `Priority: ${lead.priority}` : null,
    lead.location ? `Location: ${lead.location}` : null,
    lead.painPoints ? `Pain Points: ${lead.painPoints}` : null,
    lead.futureOpportunities ? `Opportunities: ${lead.futureOpportunities}` : null,
    lead.revenueModel ? `Revenue Model: ${lead.revenueModel}` : null,
    lead.notes ? `Notes: ${lead.notes}` : null,
    lead.tags && Array.isArray(lead.tags) ? `Tags: ${(lead.tags as string[]).join(", ")}` : null,
  ].filter(Boolean);
  return parts.join("\n");
}

// Keyword-based search using TF-IDF style scoring
function keywordScore(query: string, text: string): number {
  const queryTokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const textLower = text.toLowerCase();
  if (queryTokens.length === 0) return 0;
  let score = 0;
  for (const token of queryTokens) {
    const count = (textLower.match(new RegExp(token, "g")) ?? []).length;
    if (count > 0) score += 1 + Math.log(count);
  }
  return score / queryTokens.length;
}

// Search over stored lead text content
async function semanticSearch(query: string, topK = 8): Promise<Array<{ leadId: number; score: number }>> {
  try {
    const allEmbeddings = await getAllEmbeddings();
    if (allEmbeddings.length === 0) return [];
    const scores = allEmbeddings
      .filter((e) => e.textContent)
      .map((e) => ({
        leadId: e.leadId,
        score: keywordScore(query, e.textContent as string),
      }))
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    return scores;
  } catch (err) {
    console.error("[semanticSearch] Error:", err);
    return [];
  }
}

// Store text content for a lead (no embedding needed)
export async function indexLead(lead: Record<string, unknown>) {
  try {
    const text = buildLeadText(lead);
    await upsertLeadEmbedding({
      leadId: lead.id as number,
      embedding: [],
      textContent: text,
    });
  } catch (err) {
    console.error("[indexLead] Error:", err);
  }
}

// Enrich a lead using LLM
export async function enrichLead(leadId: number): Promise<Record<string, unknown> | null> {
  const lead = await getLeadById(leadId);
  if (!lead) return null;

  const { provider, chatModel } = await getLLMProvider();
  const leadText = buildLeadText(lead as unknown as Record<string, unknown>);

  try {
    const { text } = await generateText({
      model: provider.chat(chatModel),
      system: `You are a B2B sales intelligence analyst. Given lead information, provide structured enrichment insights in JSON format.`,
      messages: [
        {
          role: "user",
          content: `Analyze this lead and provide enrichment insights as JSON:

${leadText}

Return a JSON object with these fields:
- industryInsights: string (2-3 sentences about the industry)
- competitiveLandscape: string (key competitors or market context)
- buyingSignals: string[] (list of positive buying indicators from the data)
- recommendedApproach: string (suggested sales approach)
- estimatedDealSize: string (rough estimate based on company type)
- keyDecisionFactors: string[] (what matters most to this prospect)
- socialPresence: string (assessment of their digital/social presence)
- urgencyScore: number (1-10, how urgent is this lead)
- fitScore: number (1-10, how well do they fit your ICP)`,
        },
      ],
    });

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const enrichment = JSON.parse(jsonMatch[0]);

    // Save enrichment to lead
    await updateLead(leadId, {
      enrichmentData: enrichment,
      enrichedAt: new Date(),
    });

    return enrichment;
  } catch (err) {
    console.error("[enrichLead] Error:", err);
    return null;
  }
}

export function registerCrmChatRoutes(app: Express) {
  // In-memory chat history store (keyed by chatId)
  // For production, persist to DB; this is sufficient for single-session use
  const chatHistories = new Map<string, any[]>();

  // CRM AI Chat endpoint with RAG
  app.post("/api/crm-chat", async (req, res) => {
    try {
      // AIChatBox sends { message, chatId, userId } — a single UIMessage
      const { message, chatId, messages: legacyMessages } = req.body;

      // Support both single-message (new) and messages-array (legacy) formats
      let uiMessages: any[];
      if (message) {
        // New format: single message from AIChatBox
        const historyKey = chatId ?? "default";
        const history = chatHistories.get(historyKey) ?? [];
        history.push(message);
        chatHistories.set(historyKey, history);
        uiMessages = history;
      } else if (legacyMessages && Array.isArray(legacyMessages)) {
        uiMessages = legacyMessages;
      } else {
        res.status(400).json({ error: "message or messages array is required" });
        return;
      }

      // Extract last user message for semantic search
      const lastUserMessage = [...uiMessages].reverse().find((m: { role: string }) => m.role === "user");
      const userQuery = lastUserMessage?.parts?.find((p: { type: string }) => p.type === "text")?.text ?? "";

      // Perform semantic search to get relevant leads
      let contextLeads: Array<Record<string, unknown>> = [];
      if (userQuery) {
        const searchResults = await semanticSearch(userQuery, 5);
        if (searchResults.length > 0) {
          const leadIds = searchResults.map((r) => r.leadId);
          contextLeads = await getLeadsByIds(leadIds) as Array<Record<string, unknown>>;
        }
      }

      // Build RAG context
      const ragContext = contextLeads.length > 0
        ? `\n\nRELEVANT LEADS FROM DATABASE:\n${contextLeads.map((l) => buildLeadText(l)).join("\n---\n")}`
        : "";

      const crmTools = {
        searchLeads: tool({
          description: "Search for leads by company name, contact, status, or any criteria",
          inputSchema: z.object({
            query: z.string().describe("Search query"),
            status: z.string().optional().describe("Filter by status"),
            limit: z.number().optional().default(10),
          }),
          execute: async ({ query, status, limit }) => {
            const result = await getLeads({ search: query, status, limit });
            return result.items.map((l) => ({
              id: l.id,
              companyName: l.companyName,
              contactPerson: l.contactPerson,
              email: l.email,
              status: l.status,
              priority: l.priority,
              painPoints: l.painPoints,
              futureOpportunities: l.futureOpportunities,
            }));
          },
        }),

        getLeadDetails: tool({
          description: "Get full details of a specific lead including contact history",
          inputSchema: z.object({
            leadId: z.number().describe("The lead ID"),
          }),
          execute: async ({ leadId }) => {
            const [lead, moments] = await Promise.all([
              getLeadById(leadId),
              getContactMoments(leadId),
            ]);
            return { lead, recentContactMoments: moments.slice(0, 5) };
          },
        }),

        getLeadStats: tool({
          description: "Get overall CRM statistics and pipeline overview",
          inputSchema: z.object({}),
          execute: async () => {
            const { getLeadStats, getContactMomentStats } = await import("./db");
            const [leadStats, momentStats] = await Promise.all([getLeadStats(), getContactMomentStats()]);
            return { leadStats, momentStats };
          },
        }),

        semanticSearchLeads: tool({
          description: "Find leads using semantic/meaning-based search",
          inputSchema: z.object({
            query: z.string().describe("Natural language description of what you're looking for"),
          }),
          execute: async ({ query }) => {
            const results = await semanticSearch(query, 8);
            if (results.length === 0) return [];
            const leads = await getLeadsByIds(results.map((r) => r.leadId));
            return leads.map((l, i) => ({
              ...l,
              relevanceScore: results[i]?.score ?? 0,
            }));
          },
        }),

        searchDocuments: tool({
          description: "Search across all uploaded documents (PDFs, presentations, proposals, contracts, Excel files, Word docs) for relevant content",
          inputSchema: z.object({
            query: z.string().describe("What to search for in documents"),
            limit: z.number().optional().default(5),
          }),
          execute: async ({ query, limit }) => {
            const results = await searchDocumentChunks(query, limit ?? 5);
            return results.map((r) => ({
              documentId: r.documentId,
              leadId: r.leadId,
              leadName: r.leadName,
              fileName: r.fileName,
              relevantExcerpt: r.textContent.slice(0, 400),
              score: r.score,
            }));
          },
        }),

        updateLead: tool({
          description: "Update a lead's fields directly. Use this when the user asks to change status, priority, notes, contact info, estimated value, follow-up date, or any other lead field.",
          inputSchema: z.object({
            leadId: z.number().describe("The ID of the lead to update"),
            updates: z.object({
              status: z.enum(["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost", "on_hold"]).optional(),
              priority: z.enum(["low", "medium", "high"]).optional(),
              notes: z.string().optional(),
              contactPerson: z.string().optional(),
              contactTitle: z.string().optional(),
              email: z.string().optional(),
              phone: z.string().optional(),
              estimatedValue: z.number().optional(),
              nextFollowUpAt: z.string().optional().describe("ISO date string for next follow-up"),
              tags: z.array(z.string()).optional(),
              painPoints: z.string().optional(),
              futureOpportunities: z.string().optional(),
            }).describe("Fields to update on the lead"),
          }),
          execute: async ({ leadId, updates }) => {
            const lead = await getLeadById(leadId);
            if (!lead) return { success: false, error: "Lead not found" };

            const updateData: Record<string, unknown> = { ...updates };
            if (updates.nextFollowUpAt) {
              updateData.nextFollowUpAt = new Date(updates.nextFollowUpAt);
            }

            await updateLead(leadId, updateData as any);

            // Re-index the lead
            const updated = await getLeadById(leadId);
            if (updated) await indexLead(updated as unknown as Record<string, unknown>);

            // Refresh priority score
            const score = await computePriorityScore(leadId);
            const db = await getRawDb();
            if (db) await db.execute("UPDATE leads SET priorityScore = ? WHERE id = ?", [score, leadId]);

            return { success: true, leadId, updatedFields: Object.keys(updates), newPriorityScore: score };
          },
        }),

        addContactMoment: tool({
          description: "Log a new contact moment (interaction) for a lead. Use this when the user says they called, emailed, met with, or had any interaction with a lead.",
          inputSchema: z.object({
            leadId: z.number().describe("The ID of the lead"),
            type: z.enum(["email", "phone", "meeting", "linkedin", "slack", "demo", "proposal", "other"]).describe("Type of interaction"),
            subject: z.string().optional().describe("Subject or title of the interaction"),
            notes: z.string().optional().describe("Notes about what was discussed"),
            outcome: z.enum(["positive", "neutral", "negative", "no_response"]).optional().default("neutral"),
            direction: z.enum(["inbound", "outbound"]).optional().default("outbound"),
            followUpAt: z.string().optional().describe("ISO date string for follow-up reminder"),
          }),
          execute: async ({ leadId, type, subject, notes, outcome, direction, followUpAt }) => {
            const lead = await getLeadById(leadId);
            if (!lead) return { success: false, error: "Lead not found" };

            const moment = await createContactMoment({
              leadId,
              type,
              subject,
              notes,
              outcome: outcome ?? "neutral",
              direction: direction ?? "outbound",
              source: "ai_chat",
              followUpAt: followUpAt ? new Date(followUpAt) : undefined,
            });

            // Update lastContactedAt on lead
            await updateLead(leadId, { lastContactedAt: new Date() });

            // Refresh priority score
            const score = await computePriorityScore(leadId);
            const db = await getRawDb();
            if (db) await db.execute("UPDATE leads SET priorityScore = ? WHERE id = ?", [score, leadId]);

            return { success: true, momentId: moment, leadName: lead.companyName, type, newPriorityScore: score };
          },
        }),
      };

      const systemPrompt = `You are an intelligent CRM assistant for SalesFlow CRM. You help sales teams manage leads, track interactions, and identify opportunities.

You have access to the full CRM database through tools. Use them to answer questions accurately.

Current context from semantic search:${ragContext}

Capabilities:
- Search and retrieve lead information (searchLeads, semanticSearchLeads, getLeadDetails)
- Search across all uploaded documents like PDFs, proposals, presentations, contracts (searchDocuments)
- Update lead fields directly: status, priority, notes, contact info, follow-up dates (updateLead)
- Log contact moments / interactions for leads (addContactMoment)
- Get pipeline statistics and analytics (getLeadStats)

Guidelines:
- Be concise and actionable in your responses
- When asked about leads, use searchLeads or semanticSearchLeads tools first
- When asked about documents, proposals, or presentations, use searchDocuments
- When user says "update", "change", "set", "mark" for a lead field, use the updateLead tool
- When user says "log", "record", "I called", "I emailed", "I met with", use addContactMoment
- Always confirm what action was taken after using updateLead or addContactMoment
- Format responses with clear structure when listing multiple items
- Always cite specific lead names and IDs when referencing them`;

      // Convert UIMessages to model messages for the LLM
      const modelMessages = await convertToModelMessages(uiMessages);

      const historyKey = chatId ?? "default";
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({ type: "start", messageId: generateId() });

          const { provider, chatModel } = await getLLMProvider();
          const result = streamText({
            model: provider.chat(chatModel),
            system: systemPrompt,
            messages: modelMessages,
            tools: crmTools,
            stopWhen: stepCountIs(5),
          });

          result.consumeStream();
          writer.merge(result.toUIMessageStream({ sendStart: false }));
        },
        onFinish: async ({ messages: finalMessages }) => {
          // Append assistant response to history
          const assistantMsg = finalMessages[finalMessages.length - 1];
          if (assistantMsg?.role === "assistant") {
            const history = chatHistories.get(historyKey) ?? [];
            // Only add if not already there
            if (!history.find((m: any) => m.id === assistantMsg.id)) {
              history.push(assistantMsg);
              chatHistories.set(historyKey, history);
            }
          }
        },
      });

      pipeUIMessageStreamToResponse({ response: res, stream });
    } catch (error) {
      console.error("[/api/crm-chat] Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Index all leads (generate embeddings)
  app.post("/api/index-leads", async (req, res) => {
    try {
      const { items } = await getLeads({ limit: 1000 });
      let indexed = 0;
      for (const lead of items) {
        await indexLead(lead as unknown as Record<string, unknown>);
        indexed++;
      }
      res.json({ success: true, indexed });
    } catch (error) {
      console.error("[/api/index-leads] Error:", error);
      res.status(500).json({ error: "Failed to index leads" });
    }
  });

  // Enrich a lead with AI
  app.post("/api/enrich-lead/:id", async (req, res) => {
    try {
      const leadId = parseInt(req.params.id);
      const enrichment = await enrichLead(leadId);
      if (!enrichment) {
        res.status(404).json({ error: "Lead not found or enrichment failed" });
        return;
      }
      res.json({ success: true, enrichment });
    } catch (error) {
      console.error("[/api/enrich-lead] Error:", error);
      res.status(500).json({ error: "Failed to enrich lead" });
    }
  });
}
