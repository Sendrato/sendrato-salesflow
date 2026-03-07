import "dotenv/config";
import pg from "pg";
import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Set up embedding provider (Forge API fallback or OpenAI)
const apiKey = process.env.BUILT_IN_FORGE_API_KEY || process.env.OPENAI_API_KEY;
const baseURL = process.env.BUILT_IN_FORGE_API_URL
  ? `${process.env.BUILT_IN_FORGE_API_URL}/v1`
  : "https://api.openai.com/v1";
const provider = createOpenAI({ apiKey, baseURL });

// Get all leads
const { rows: leads } = await pool.query("SELECT * FROM leads");
console.log(`Found ${leads.length} leads to index`);

let indexed = 0;
for (const lead of leads) {
  // Parse leadAttributes JSON if present
  let attrText = "";
  if (lead.leadAttributes) {
    try {
      const attrs = typeof lead.leadAttributes === "string"
        ? JSON.parse(lead.leadAttributes)
        : lead.leadAttributes;
      const attrParts = [];
      if (attrs.visitorCount) attrParts.push(`Visitor Count: ${attrs.visitorCount.toLocaleString()}`);
      if (attrs.eventDurationDays) attrParts.push(`Event Duration: ${attrs.eventDurationDays} days`);
      if (attrs.typicalDates) attrParts.push(`Typical Dates: ${attrs.typicalDates}`);
      if (attrs.region) attrParts.push(`Region: ${attrs.region}`);
      if (attrs.hotelNeedScore) attrParts.push(`Hotel Need Score: ${attrs.hotelNeedScore}`);
      if (attrs.revenueEngineFit) attrParts.push(`Revenue Engine Fit: ${attrs.revenueEngineFit}`);
      if (attrs.outreachTier) attrParts.push(`Outreach Tier: ${attrs.outreachTier}`);
      if (attrs.whyTarget) attrParts.push(`Why Target: ${attrs.whyTarget}`);
      if (attrs.venueCapacity) attrParts.push(`Venue Capacity: ${attrs.venueCapacity}`);
      if (attrs.eventCategory) attrParts.push(`Event Category: ${attrs.eventCategory}`);
      attrText = attrParts.join("\n");
    } catch {}
  }

  const text = [
    `Company: ${lead.companyName}`,
    lead.leadType && lead.leadType !== "default" ? `Lead Type: ${lead.leadType}` : null,
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
    attrText || null,
  ].filter(Boolean).join("\n");

  // Generate embedding
  let embeddingVector = null;
  try {
    const { embedding } = await embed({
      model: provider.textEmbeddingModel("text-embedding-3-small"),
      value: text,
    });
    embeddingVector = JSON.stringify(embedding);
  } catch (err) {
    console.warn(`  Failed to embed lead ${lead.id}: ${err.message}`);
  }

  // Upsert into lead_embeddings
  await pool.query(
    `INSERT INTO lead_embeddings ("leadId", embedding, "textContent", "updatedAt")
     VALUES ($1, $2::vector, $3, NOW())
     ON CONFLICT ("leadId") DO UPDATE SET embedding = EXCLUDED.embedding, "textContent" = EXCLUDED."textContent", "updatedAt" = NOW()`,
    [lead.id, embeddingVector, text]
  );
  indexed++;
  if (indexed % 10 === 0) console.log(`  Indexed ${indexed}/${leads.length} leads...`);
}

console.log(`Indexed ${indexed} leads with embeddings`);
await pool.end();
