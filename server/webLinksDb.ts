import { eq, desc } from "drizzle-orm";
import { getDb } from "./db";
import { webLinks } from "../drizzle/schema";
import type { InsertWebLink } from "../drizzle/schema";

// ─── List by entity ──────────────────────────────────────────────────────────

export async function getWebLinksByLead(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(webLinks)
    .where(eq(webLinks.leadId, leadId))
    .orderBy(desc(webLinks.createdAt));
}

export async function getWebLinksByPerson(personId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(webLinks)
    .where(eq(webLinks.personId, personId))
    .orderBy(desc(webLinks.createdAt));
}

export async function getWebLinksByCompetitor(competitorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(webLinks)
    .where(eq(webLinks.competitorId, competitorId))
    .orderBy(desc(webLinks.createdAt));
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createWebLink(data: InsertWebLink) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(webLinks).values(data).returning();
  return inserted;
}

export async function updateWebLink(
  id: number,
  data: Partial<Pick<InsertWebLink, "url" | "title" | "description" | "category">>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [updated] = await db
    .update(webLinks)
    .set(data)
    .where(eq(webLinks.id, id))
    .returning();
  return updated;
}

export async function deleteWebLink(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(webLinks).where(eq(webLinks.id, id));
}

// ─── Scrape & Summarize ──────────────────────────────────────────────────────

export async function scrapeAndSummarizeWebLink(id: number) {
  const db = await getDb();
  if (!db) return;

  const [link] = await db
    .select()
    .from(webLinks)
    .where(eq(webLinks.id, id))
    .limit(1);
  if (!link) return;

  const { fetchWithTimeout } = await import("./enrichmentEngine");
  const url = link.url.startsWith("http") ? link.url : `https://${link.url}`;
  const scrapedContent = await fetchWithTimeout(url);

  if (!scrapedContent || scrapedContent.length < 50) {
    // Mark as scraped even if no content, so UI knows it tried
    await db
      .update(webLinks)
      .set({ scrapedAt: new Date() })
      .where(eq(webLinks.id, id));
    return;
  }

  // Generate AI summary
  let aiSummary: string | null = null;
  try {
    const { getLLMProvider } = await import("./llmProvider");
    const { generateText } = await import("ai");
    const llm = await getLLMProvider();

    const prompt = `You are a sales intelligence analyst. Summarize the following web page content in 2-3 concise sentences. Focus on what's relevant for a sales team: company info, products, news, market position, or key facts. Be specific and factual.

URL: ${link.url}
${link.title ? `Title: ${link.title}` : ""}

Page content:
${scrapedContent.slice(0, 3000)}

Respond with ONLY the summary text, no labels or prefixes.`;

    const { text } = await generateText({
      model: llm.enrichModel,
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: 300,
    });
    aiSummary = text.trim();
  } catch (err) {
    console.error("[WebLinks] AI summary failed for link", id, err);
  }

  await db
    .update(webLinks)
    .set({
      scrapedContent: scrapedContent.slice(0, 4000),
      aiSummary,
      scrapedAt: new Date(),
    })
    .where(eq(webLinks.id, id));
}

// ─── Bulk delete (for cascade) ───────────────────────────────────────────────

export async function deleteWebLinksByLead(leadId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(webLinks).where(eq(webLinks.leadId, leadId));
}

export async function deleteWebLinksByPerson(personId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(webLinks).where(eq(webLinks.personId, personId));
}

export async function deleteWebLinksByCompetitor(competitorId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(webLinks).where(eq(webLinks.competitorId, competitorId));
}
