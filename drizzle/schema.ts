import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  json,
  real,
  boolean,
  bigint,
  serial,
  vector,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["user", "admin"]);

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "on_hold",
]);

export const leadPriorityEnum = pgEnum("lead_priority", [
  "low",
  "medium",
  "high",
]);

export const leadTypeEnum = pgEnum("lead_type", [
  "default",
  "event",
  "festival",
  "conference",
  "hospitality",
  "saas",
  "retail",
]);

export const contactMomentTypeEnum = pgEnum("contact_moment_type", [
  "email",
  "phone",
  "meeting",
  "linkedin",
  "slack",
  "demo",
  "proposal",
  "other",
]);

export const contactDirectionEnum = pgEnum("contact_direction", [
  "inbound",
  "outbound",
]);

export const contactOutcomeEnum = pgEnum("contact_outcome", [
  "positive",
  "neutral",
  "negative",
  "no_response",
]);

export const documentCategoryEnum = pgEnum("document_category", [
  "proposal",
  "contract",
  "presentation",
  "report",
  "other",
]);

export const personTypeEnum = pgEnum("person_type", [
  "prospect",
  "contact",
  "partner",
  "reseller",
  "influencer",
  "investor",
  "other",
]);

export const relationshipEnum = pgEnum("relationship", [
  "contact_at",
  "introduced_by",
  "decision_maker",
  "champion",
  "partner",
  "other",
]);

export const emailIngestStatusEnum = pgEnum("email_ingest_status", [
  "matched",
  "unmatched",
  "error",
]);

export const competitorThreatLevelEnum = pgEnum("competitor_threat_level", [
  "low",
  "medium",
  "high",
]);

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Leads ───────────────────────────────────────────────────────────────────
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  // Company info
  companyName: varchar("companyName", { length: 255 }).notNull(),
  website: varchar("website", { length: 512 }),
  industry: varchar("industry", { length: 128 }),
  companySize: varchar("companySize", { length: 64 }),
  location: varchar("location", { length: 255 }),
  country: varchar("country", { length: 128 }),
  // Primary contact
  contactPerson: varchar("contactPerson", { length: 255 }),
  contactTitle: varchar("contactTitle", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  // CRM fields
  status: leadStatusEnum("status").default("new").notNull(),
  priority: leadPriorityEnum("priority").default("medium").notNull(),
  source: varchar("source", { length: 128 }),
  assignedTo: integer("assignedTo"),
  estimatedValue: real("estimatedValue"),
  currency: varchar("currency", { length: 8 }).default("USD"),
  // Rich text fields from spreadsheet
  socialMedia: text("socialMedia"),
  ticketingSystem: varchar("ticketingSystem", { length: 512 }),
  paymentMethods: text("paymentMethods"),
  mobileApp: varchar("mobileApp", { length: 255 }),
  painPoints: text("painPoints"),
  currentPilot: text("currentPilot"),
  futureOpportunities: text("futureOpportunities"),
  revenueModel: text("revenueModel"),
  risks: text("risks"),
  brandTone: varchar("brandTone", { length: 512 }),
  surveyStatus: varchar("surveyStatus", { length: 255 }),
  notes: text("notes"),
  // Lead type for flexible attribute schemas
  leadType: leadTypeEnum("leadType").default("default").notNull(),
  leadAttributes: json("leadAttributes").$type<Record<string, unknown>>(),
  // AI enrichment
  enrichmentData: json("enrichmentData"),
  enrichedAt: timestamp("enrichedAt"),
  // Tags stored as JSON array of strings
  tags: json("tags").$type<string[]>(),
  // Priority score (0-100, computed from activity + recency + opportunity)
  priorityScore: integer("priorityScore").default(0),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  createdBy: integer("createdBy"),
  lastContactedAt: timestamp("lastContactedAt"),
  nextFollowUpAt: timestamp("nextFollowUpAt"),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ─── Contact Moments ─────────────────────────────────────────────────────────
export const contactMoments = pgTable("contact_moments", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId").notNull(),
  type: contactMomentTypeEnum("type").notNull(),
  direction: contactDirectionEnum("direction").default("outbound"),
  subject: varchar("subject", { length: 512 }),
  notes: text("notes"),
  outcome: contactOutcomeEnum("outcome").default("neutral"),
  // For email ingestion
  emailFrom: varchar("emailFrom", { length: 320 }),
  emailTo: varchar("emailTo", { length: 1024 }),
  emailRaw: text("emailRaw"),
  // Person link (optional — moment can be against a person, a lead, or both)
  personId: integer("personId"),
  // Source tracking
  source: varchar("source", { length: 64 }).default("manual"),
  userId: integer("userId"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  // Follow-up scheduling
  followUpAt: timestamp("followUpAt"),
  followUpDone: boolean("followUpDone").default(false),
});

export type ContactMoment = typeof contactMoments.$inferSelect;
export type InsertContactMoment = typeof contactMoments.$inferInsert;

// ─── Lead Documents ───────────────────────────────────────────────────────────
export const leadDocuments = pgTable("lead_documents", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId").notNull(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileKey: varchar("fileKey", { length: 1024 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  category: documentCategoryEnum("category").default("other"),
  uploadedBy: integer("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadDocument = typeof leadDocuments.$inferSelect;
export type InsertLeadDocument = typeof leadDocuments.$inferInsert;

// ─── Document Chunks (RAG) ────────────────────────────────────────────────────
export const documentChunks = pgTable("document_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("documentId").notNull(),
  leadId: integer("leadId").notNull(),
  competitorDocumentId: integer("competitorDocumentId"),
  competitorId: integer("competitorId"),
  chunkIndex: integer("chunkIndex").notNull(),
  textContent: text("textContent").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }),
  pageNumber: integer("pageNumber"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = typeof documentChunks.$inferInsert;

// ─── Shareable Presentations ──────────────────────────────────────────────────
export const shareablePresentations = pgTable("shareable_presentations", {
  id: serial("id").primaryKey(),
  documentId: integer("documentId").notNull(),
  leadId: integer("leadId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 512 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  expiresAt: timestamp("expiresAt"),
  viewCount: integer("viewCount").default(0),
  lastViewedAt: timestamp("lastViewedAt"),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  isActive: boolean("isActive").default(true),
});

export type ShareablePresentation = typeof shareablePresentations.$inferSelect;
export type InsertShareablePresentation = typeof shareablePresentations.$inferInsert;

// ─── Lead Embeddings (Vector DB) ─────────────────────────────────────────────
export const leadEmbeddings = pgTable("lead_embeddings", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId").notNull().unique(),
  embedding: vector("embedding", { dimensions: 1024 }),
  textContent: text("textContent"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type LeadEmbedding = typeof leadEmbeddings.$inferSelect;
export type InsertLeadEmbedding = typeof leadEmbeddings.$inferInsert;

// ─── Persons ─────────────────────────────────────────────────────────────────
export const persons = pgTable("persons", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  linkedInUrl: varchar("linkedInUrl", { length: 512 }),
  personType: personTypeEnum("personType").default("prospect").notNull(),
  company: varchar("company", { length: 255 }),
  title: varchar("title", { length: 255 }),
  notes: text("notes"),
  tags: json("tags").$type<string[]>(),
  source: varchar("source", { length: 128 }).default("manual"),
  twitterUrl: varchar("twitterUrl", { length: 512 }),
  enrichmentData: json("enrichmentData"),
  enrichedAt: timestamp("enrichedAt"),
  lastContactedAt: timestamp("lastContactedAt"),
  nextFollowUpAt: timestamp("nextFollowUpAt"),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Person = typeof persons.$inferSelect;
export type InsertPerson = typeof persons.$inferInsert;

// ─── Person ↔ Lead Links ──────────────────────────────────────────────────────
export const personLeadLinks = pgTable("person_lead_links", {
  id: serial("id").primaryKey(),
  personId: integer("personId").notNull(),
  leadId: integer("leadId").notNull(),
  relationship: relationshipEnum("relationship").default("contact_at").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PersonLeadLink = typeof personLeadLinks.$inferSelect;
export type InsertPersonLeadLink = typeof personLeadLinks.$inferInsert;

// ─── Email Ingest Log ─────────────────────────────────────────────────────────
export const emailIngestLog = pgTable("email_ingest_log", {
  id: serial("id").primaryKey(),
  rawPayload: text("rawPayload"),
  parsedFrom: varchar("parsedFrom", { length: 320 }),
  parsedTo: text("parsedTo"),
  parsedSubject: varchar("parsedSubject", { length: 512 }),
  matchedLeadId: integer("matchedLeadId"),
  matchedPersonId: integer("matchedPersonId"),
  messageId: varchar("messageId", { length: 512 }),
  source: varchar("source", { length: 64 }).default("webhook"),
  status: emailIngestStatusEnum("status").default("unmatched"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailIngestLog = typeof emailIngestLog.$inferSelect;

// ─── App Settings (LLM config, etc.) ─────────────────────────────────────────
export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AppSetting = typeof appSettings.$inferSelect;

// ─── Competitors ─────────────────────────────────────────────────────────────
export const competitors = pgTable("competitors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  website: varchar("website", { length: 512 }),
  description: text("description"),
  products: text("products"),
  regions: text("regions"),
  pricing: text("pricing"),
  businessModel: text("businessModel"),
  threatLevel: competitorThreatLevelEnum("threatLevel").default("medium").notNull(),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  notes: text("notes"),
  tags: json("tags").$type<string[]>(),
  enrichmentData: json("enrichmentData"),
  enrichedAt: timestamp("enrichedAt"),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Competitor = typeof competitors.$inferSelect;
export type InsertCompetitor = typeof competitors.$inferInsert;

// ─── Competitor ↔ Lead Links ─────────────────────────────────────────────────
export const competitorLeadLinks = pgTable("competitor_lead_links", {
  id: serial("id").primaryKey(),
  competitorId: integer("competitorId").notNull(),
  leadId: integer("leadId").notNull(),
  competitorProduct: varchar("competitorProduct", { length: 512 }),
  contractStartDate: timestamp("contractStartDate"),
  contractEndDate: timestamp("contractEndDate"),
  contractValue: real("contractValue"),
  contractCurrency: varchar("contractCurrency", { length: 8 }).default("USD"),
  likes: text("likes"),
  dislikes: text("dislikes"),
  satisfaction: varchar("satisfaction", { length: 32 }),
  intelSource: varchar("intelSource", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type CompetitorLeadLink = typeof competitorLeadLinks.$inferSelect;
export type InsertCompetitorLeadLink = typeof competitorLeadLinks.$inferInsert;

// ─── Competitor Documents ────────────────────────────────────────────────────
export const competitorDocuments = pgTable("competitor_documents", {
  id: serial("id").primaryKey(),
  competitorId: integer("competitorId").notNull(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileKey: varchar("fileKey", { length: 1024 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  category: documentCategoryEnum("category").default("other"),
  uploadedBy: integer("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CompetitorDocument = typeof competitorDocuments.$inferSelect;
export type InsertCompetitorDocument = typeof competitorDocuments.$inferInsert;

// ─── Web Links (polymorphic) ─────────────────────────────────────────────────

export const webLinkCategoryEnum = pgEnum("web_link_category", [
  "website",
  "article",
  "news",
  "social",
  "documentation",
  "review",
  "video",
  "other",
]);

export const webLinks = pgTable("web_links", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  title: varchar("title", { length: 512 }),
  description: text("description"),
  category: webLinkCategoryEnum("category").default("other").notNull(),
  leadId: integer("leadId"),
  personId: integer("personId"),
  competitorId: integer("competitorId"),
  scrapedContent: text("scrapedContent"),
  aiSummary: text("aiSummary"),
  scrapedAt: timestamp("scrapedAt"),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WebLink = typeof webLinks.$inferSelect;
export type InsertWebLink = typeof webLinks.$inferInsert;
