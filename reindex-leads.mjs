import "dotenv/config";
import mysql from "mysql2/promise";

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Get all leads
const [leads] = await db.execute("SELECT * FROM leads");
console.log(`Found ${leads.length} leads to index`);

// Build text for each lead and store in lead_embeddings
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

  const parts = [
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

  // Upsert into lead_embeddings
  await db.execute(
    `INSERT INTO lead_embeddings (leadId, embedding, textContent, updatedAt)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE textContent = VALUES(textContent), updatedAt = NOW()`,
    [lead.id, JSON.stringify([]), parts]
  );
  indexed++;
}

console.log(`Indexed ${indexed} leads`);
await db.end();
