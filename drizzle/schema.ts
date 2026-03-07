import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  float,
  boolean,
  bigint,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Leads ───────────────────────────────────────────────────────────────────
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  // Company info
  companyName: varchar("companyName", { length: 255 }).notNull(),
  website: varchar("website", { length: 512 }),
  industry: varchar("industry", { length: 128 }),
  companySize: varchar("companySize", { length: 64 }),
  location: varchar("location", { length: 255 }),
  // Primary contact
  contactPerson: varchar("contactPerson", { length: 255 }),
  contactTitle: varchar("contactTitle", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  // CRM fields
  status: mysqlEnum("status", [
    "new",
    "contacted",
    "qualified",
    "proposal",
    "negotiation",
    "won",
    "lost",
    "on_hold",
  ])
    .default("new")
    .notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  source: varchar("source", { length: 128 }), // excel_import, manual, slack, email, etc.
  assignedTo: int("assignedTo"), // user id
  estimatedValue: float("estimatedValue"),
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
  leadType: mysqlEnum("leadType", [
    "default",
    "event",
    "festival",
    "conference",
    "hospitality",
    "saas",
    "retail",
  ]).default("default").notNull(),
  // Flexible JSON attributes — schema depends on leadType
  // For event/festival: { visitorCount, eventDurationDays, typicalDates, region, hotelNeedScore, revenueEngineFit, venueCapacity, eventCategory, ticketPriceRange }
  // For conference: { attendeeCount, eventDurationDays, typicalDates, region, sponsorshipTiers, speakerCount }
  leadAttributes: json("leadAttributes").$type<Record<string, unknown>>(),
  // AI enrichment
  enrichmentData: json("enrichmentData"), // LLM-generated insights
  enrichedAt: timestamp("enrichedAt"),
  // Tags stored as JSON array of strings
  tags: json("tags").$type<string[]>(),
  // Priority score (0-100, computed from activity + recency + opportunity)
  priorityScore: int("priorityScore").default(0),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
  lastContactedAt: timestamp("lastContactedAt"),
  nextFollowUpAt: timestamp("nextFollowUpAt"),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ─── Contact Moments ─────────────────────────────────────────────────────────
export const contactMoments = mysqlTable("contact_moments", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  type: mysqlEnum("type", [
    "email",
    "phone",
    "meeting",
    "linkedin",
    "slack",
    "demo",
    "proposal",
    "other",
  ]).notNull(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).default("outbound"),
  subject: varchar("subject", { length: 512 }),
  notes: text("notes"),
  outcome: mysqlEnum("outcome", [
    "positive",
    "neutral",
    "negative",
    "no_response",
  ]).default("neutral"),
  // For email ingestion
  emailFrom: varchar("emailFrom", { length: 320 }),
  emailTo: varchar("emailTo", { length: 1024 }),
  emailRaw: text("emailRaw"),
  // Person link (optional — moment can be against a person, a lead, or both)
  personId: int("personId"),
  // Source tracking
  source: varchar("source", { length: 64 }).default("manual"), // manual, email_ingest, slack
  userId: int("userId"),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  // Follow-up scheduling
  followUpAt: timestamp("followUpAt"),
  followUpDone: boolean("followUpDone").default(false),
});

export type ContactMoment = typeof contactMoments.$inferSelect;
export type InsertContactMoment = typeof contactMoments.$inferInsert;

// ─── Lead Documents ───────────────────────────────────────────────────────────
export const leadDocuments = mysqlTable("lead_documents", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileKey: varchar("fileKey", { length: 1024 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  category: mysqlEnum("category", [
    "proposal",
    "contract",
    "presentation",
    "report",
    "other",
  ]).default("other"),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LeadDocument = typeof leadDocuments.$inferSelect;
export type InsertLeadDocument = typeof leadDocuments.$inferInsert;

// ─── Document Chunks (RAG) ────────────────────────────────────────────────────
export const documentChunks = mysqlTable("document_chunks", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  leadId: int("leadId").notNull(),
  chunkIndex: int("chunkIndex").notNull(),
  textContent: text("textContent").notNull(),
  // metadata for display
  pageNumber: int("pageNumber"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = typeof documentChunks.$inferInsert;

// ─── Shareable Presentations ──────────────────────────────────────────────────
export const shareablePresentations = mysqlTable("shareable_presentations", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  leadId: int("leadId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 512 }),
  // optional password protection
  passwordHash: varchar("passwordHash", { length: 255 }),
  // expiry
  expiresAt: timestamp("expiresAt"),
  // tracking
  viewCount: int("viewCount").default(0),
  lastViewedAt: timestamp("lastViewedAt"),
  // who created it
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  isActive: boolean("isActive").default(true),
});

export type ShareablePresentation = typeof shareablePresentations.$inferSelect;
export type InsertShareablePresentation = typeof shareablePresentations.$inferInsert;

// ─── Lead Embeddings (Vector DB) ─────────────────────────────────────────────
export const leadEmbeddings = mysqlTable("lead_embeddings", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull().unique(),
  // Store embedding as JSON array of floats (1536 dims for text-embedding-3-small)
  embedding: json("embedding").$type<number[]>(),
  textContent: text("textContent"), // the text that was embedded
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeadEmbedding = typeof leadEmbeddings.$inferSelect;
export type InsertLeadEmbedding = typeof leadEmbeddings.$inferInsert;

// ─── Persons ─────────────────────────────────────────────────────────────────
export const persons = mysqlTable("persons", {
  id: int("id").autoincrement().primaryKey(),
  // Core identity
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  linkedInUrl: varchar("linkedInUrl", { length: 512 }),
  // Role / type in our network
  personType: mysqlEnum("personType", [
    "prospect",    // potential customer we haven't qualified yet
    "contact",     // known contact at a company/event
    "partner",     // formal or informal business partner
    "reseller",    // resells our product/service
    "influencer",  // can introduce us to others
    "investor",
    "other",
  ]).default("prospect").notNull(),
  // Current affiliation (free text — may not match a lead yet)
  company: varchar("company", { length: 255 }),
  title: varchar("title", { length: 255 }),
  // Rich info
  notes: text("notes"),
  tags: json("tags").$type<string[]>(),
  source: varchar("source", { length: 128 }).default("manual"), // linkedin, manual, import, etc.
  // Social
  twitterUrl: varchar("twitterUrl", { length: 512 }),
  // AI enrichment
  enrichmentData: json("enrichmentData"),
  enrichedAt: timestamp("enrichedAt"),
  // Tracking
  lastContactedAt: timestamp("lastContactedAt"),
  nextFollowUpAt: timestamp("nextFollowUpAt"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Person = typeof persons.$inferSelect;
export type InsertPerson = typeof persons.$inferInsert;

// ─── Person ↔ Lead Links ──────────────────────────────────────────────────────
export const personLeadLinks = mysqlTable("person_lead_links", {
  id: int("id").autoincrement().primaryKey(),
  personId: int("personId").notNull(),
  leadId: int("leadId").notNull(),
  // How this person relates to the lead/company
  relationship: mysqlEnum("relationship", [
    "contact_at",    // works at this company/event
    "introduced_by", // introduced us to this lead
    "decision_maker",
    "champion",      // internal advocate
    "partner",
    "other",
  ]).default("contact_at").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PersonLeadLink = typeof personLeadLinks.$inferSelect;
export type InsertPersonLeadLink = typeof personLeadLinks.$inferInsert;

// ─── Email Ingest Log ─────────────────────────────────────────────────────────
export const emailIngestLog = mysqlTable("email_ingest_log", {
  id: int("id").autoincrement().primaryKey(),
  rawPayload: text("rawPayload"),
  parsedFrom: varchar("parsedFrom", { length: 320 }),
  parsedTo: text("parsedTo"),
  parsedSubject: varchar("parsedSubject", { length: 512 }),
  matchedLeadId: int("matchedLeadId"),
  status: mysqlEnum("status", ["matched", "unmatched", "error"]).default("unmatched"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailIngestLog = typeof emailIngestLog.$inferSelect;

// ─── App Settings (LLM config, etc.) ─────────────────────────────────────────
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AppSetting = typeof appSettings.$inferSelect;
