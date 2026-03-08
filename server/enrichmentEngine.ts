/**
 * enrichmentEngine.ts
 * Real-world web research engine for lead enrichment.
 * Fetches data from: company website, Wikipedia, Google News RSS.
 * Then uses LLM to synthesise a structured intelligence report.
 */

import { generateText } from "ai";
import { getLLMProvider } from "./llmProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnrichmentSource {
  type: "website" | "wikipedia" | "news";
  url: string;
  title: string;
  snippet: string;
}

export interface EnrichmentResult {
  overview: string;
  recentNews: string;
  keyPeople: string;
  painPoints: string;
  opportunities: string;
  talkingPoints: string[];
  competitiveLandscape: string;
  estimatedDealSize: string;
  urgencyScore: number;
  fitScore: number;
  nextBestAction: string;
  sources: EnrichmentSource[];
  enrichedAt: string;
  webDataFound: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function stripHtml(html: string): string {
  // Remove scripts, styles, nav, footer
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 4000); // cap at 4k chars
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    return stripHtml(html);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

// ─── Data Sources ─────────────────────────────────────────────────────────────

async function fetchCompanyWebsite(
  website: string | null | undefined,
  companyName: string
): Promise<EnrichmentSource | null> {
  if (!website) return null;
  const url = website.startsWith("http") ? website : `https://${website}`;
  const text = await fetchWithTimeout(url);
  if (!text || text.length < 100) return null;
  return {
    type: "website",
    url,
    title: `${companyName} Official Website`,
    snippet: text.slice(0, 1500),
  };
}

async function fetchWikipedia(
  companyName: string
): Promise<EnrichmentSource | null> {
  try {
    // Step 1: search Wikipedia for the company
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(companyName)}&format=json&srlimit=1`;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 6000);
    const searchRes = await fetch(searchUrl, { signal: controller.signal });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json() as {
      query: { search: Array<{ title: string }> };
    };
    const firstResult = searchData?.query?.search?.[0];
    if (!firstResult) return null;

    // Step 2: fetch the summary for the found article
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstResult.title)}`;
    const controller2 = new AbortController();
    setTimeout(() => controller2.abort(), 6000);
    const summaryRes = await fetch(summaryUrl, { signal: controller2.signal });
    if (!summaryRes.ok) return null;
    const summaryData = await summaryRes.json() as {
      title: string;
      extract: string;
      content_urls: { desktop: { page: string } };
    };
    if (!summaryData.extract) return null;

    return {
      type: "wikipedia",
      url: summaryData.content_urls?.desktop?.page ?? summaryUrl,
      title: summaryData.title,
      snippet: summaryData.extract.slice(0, 2000),
    };
  } catch {
    return null;
  }
}

async function fetchGoogleNews(
  companyName: string
): Promise<EnrichmentSource[]> {
  try {
    const q = encodeURIComponent(companyName);
    const rssUrl = `https://news.google.com/rss/search?q=${q}&hl=en-GB&gl=GB&ceid=GB:en`;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 6000);
    const res = await fetch(rssUrl, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Parse RSS items
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;
    const linkRegex = /<link>(.*?)<\/link>/;
    const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/;
    const dateRegex = /<pubDate>(.*?)<\/pubDate>/;

    const sources: EnrichmentSource[] = [];
    let match;
    while ((match = itemRegex.exec(xml)) !== null && sources.length < 4) {
      const item = match[1];
      const titleMatch = titleRegex.exec(item);
      const linkMatch = linkRegex.exec(item);
      const descMatch = descRegex.exec(item);
      const dateMatch = dateRegex.exec(item);

      const title = (titleMatch?.[1] ?? titleMatch?.[2] ?? "").trim();
      const link = (linkMatch?.[1] ?? "").trim();
      const desc = stripHtml(descMatch?.[1] ?? descMatch?.[2] ?? "").slice(0, 300);
      const date = (dateMatch?.[1] ?? "").slice(0, 16);

      if (title && link) {
        sources.push({
          type: "news",
          url: link,
          title: `${title} (${date})`,
          snippet: desc || title,
        });
      }
    }
    return sources;
  } catch {
    return [];
  }
}

// ─── Main Enrichment Function ─────────────────────────────────────────────────

export async function enrichLeadFromWeb(lead: {
  id: number;
  companyName: string;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  contactPerson?: string | null;
  contactTitle?: string | null;
  painPoints?: string | null;
  futureOpportunities?: string | null;
  revenueModel?: string | null;
  notes?: string | null;
  leadType?: string | null;
  leadAttributes?: unknown;
}): Promise<EnrichmentResult> {
  // ── Gather data from all sources in parallel ──────────────────────────────
  const [websiteSource, wikiSource, newsSources] = await Promise.all([
    fetchCompanyWebsite(lead.website, lead.companyName),
    fetchWikipedia(lead.companyName),
    fetchGoogleNews(lead.companyName),
  ]);

  const sources: EnrichmentSource[] = [
    ...(websiteSource ? [websiteSource] : []),
    ...(wikiSource ? [wikiSource] : []),
    ...newsSources,
  ];

  const webDataFound = sources.length > 0;

  // ── Build context for LLM ─────────────────────────────────────────────────
  const leadContext = `
Company: ${lead.companyName}
Website: ${lead.website ?? "N/A"}
Industry: ${lead.industry ?? "N/A"}
Location: ${lead.location ?? "N/A"}
Lead Type: ${lead.leadType ?? "default"}
Contact: ${lead.contactPerson ?? "N/A"} (${lead.contactTitle ?? "N/A"})
Known Pain Points: ${lead.painPoints ?? "N/A"}
Known Opportunities: ${lead.futureOpportunities ?? "N/A"}
Revenue Model: ${lead.revenueModel ?? "N/A"}
Notes: ${lead.notes ?? "N/A"}
${lead.leadAttributes ? `Event/Type Attributes: ${JSON.stringify(lead.leadAttributes)}` : ""}
`.trim();

  const webContext = sources.length > 0
    ? sources
        .map((s) => `\n### Source: ${s.title}\nURL: ${s.url}\n${s.snippet}`)
        .join("\n\n")
    : "No web data was retrievable. Use your general knowledge about this company/industry.";

  const prompt = `You are a B2B sales intelligence analyst. You have been given CRM data about a lead plus fresh web research. Synthesise this into a structured intelligence report.

## CRM Lead Data
${leadContext}

## Web Research Gathered
${webContext}

## Instructions
Based on ALL the above information, produce a JSON intelligence report with these exact fields:
- overview: string (3-4 sentences: what the company/event does, scale, key facts from web research)
- recentNews: string (2-3 sentences summarising the most relevant recent news; "No recent news found" if none)
- keyPeople: string (notable people found in web research, or "Not found in web research")
- painPoints: string (2-3 sentences on likely pain points based on industry + web research)
- opportunities: string (2-3 sentences on specific sales opportunities for our product/service)
- talkingPoints: string[] (4-6 specific, concrete talking points for the first sales call, grounded in web findings)
- competitiveLandscape: string (brief competitive context from web research)
- estimatedDealSize: string (e.g. "$10k-50k/year" based on company size/type)
- urgencyScore: number (1-10)
- fitScore: number (1-10)
- nextBestAction: string (specific recommended next step)

Respond with ONLY the JSON object, no markdown fences.`;

  // ── Call LLM ──────────────────────────────────────────────────────────────
  const llm = await getLLMProvider();
  const { text: content } = await generateText({
    model: llm.enrichModel,
    messages: [{ role: "user", content: prompt }],
    maxOutputTokens: 1500,
  });

  // Extract JSON (handle any markdown wrapping)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("LLM did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]) as Partial<EnrichmentResult>;

  return {
    overview: parsed.overview ?? "",
    recentNews: parsed.recentNews ?? "No recent news found.",
    keyPeople: parsed.keyPeople ?? "Not found in web research.",
    painPoints: parsed.painPoints ?? "",
    opportunities: parsed.opportunities ?? "",
    talkingPoints: parsed.talkingPoints ?? [],
    competitiveLandscape: parsed.competitiveLandscape ?? "",
    estimatedDealSize: parsed.estimatedDealSize ?? "Unknown",
    urgencyScore: Number(parsed.urgencyScore ?? 5),
    fitScore: Number(parsed.fitScore ?? 5),
    nextBestAction: parsed.nextBestAction ?? "",
    sources,
    enrichedAt: new Date().toISOString(),
    webDataFound,
  };
}
