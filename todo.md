# SalesFlow CRM - Project TODO

## Core Data Model & Schema

- [x] Define leads table with all fields (company, contact, status, tags, etc.)
- [x] Define contact_moments table (type, notes, timestamp, user)
- [x] Define lead_documents table (file metadata, S3 key)
- [x] Define lead_embeddings table (vector data for RAG)
- [x] Run db:push to apply migrations

## Backend Routers

- [x] leads router: list, get, create, update, delete, search/filter, stats
- [x] contactMoments router: list, listAll, recent, create, update, delete, stats
- [x] documents router: list, create, delete (S3 storage)
- [x] analytics router: overview, pipeline, contactFrequency, topLeads
- [x] email ingestion endpoint (POST /api/email-ingest)
- [x] Slack webhook endpoint (POST /api/slack-webhook)
- [x] CRM AI chat endpoint with RAG (POST /api/crm-chat)
- [x] Lead enrichment endpoint (POST /api/enrich-lead/:id)
- [x] Document upload endpoint (POST /api/upload-document)
- [x] JSON bulk import endpoint (POST /api/import-json)
- [x] File import endpoint with column mapping (POST /api/import)
- [x] Import preview endpoint (POST /api/import/preview)

## Frontend Pages

- [x] Dashboard page with pipeline overview and key metrics
- [x] Leads list page with search, filter, sort, pagination
- [x] Lead detail page with company info, contact timeline, documents, enrichment
- [x] Lead create/edit form
- [x] Contact moment log modal/form
- [x] Excel/CSV import wizard with column mapping
- [x] AI chat interface page with suggested prompts
- [x] Analytics/visualization dashboard (pipeline funnel, pie charts, line chart)
- [x] Activity feed page (all contact moments across leads)

## Multi-Modal Input

- [x] Excel import (xlsx parsing, column mapping UI)
- [x] CSV import (parsing, column mapping UI)
- [x] Email CC ingestion endpoint (SendGrid/Postmark/Mailgun compatible)
- [x] Slack webhook handler (/crm-lead, /crm-note, /crm-search)
- [x] JSON API import endpoint

## AI & Vector Search

- [x] Lead embedding generation (on create/update)
- [x] Semantic search across leads using cosine similarity
- [x] AI chat with RAG (query leads, contact moments, pipeline)
- [x] LLM-powered lead enrichment with industry insights, fit scores, buying signals

## Document Storage

- [x] File upload to S3
- [x] Document listing per lead
- [x] Secure download links

## Testing

- [x] leads router tests (list, get, create, update, delete, stats)
- [x] contactMoments router tests (list, recent, listAll, create, stats)
- [x] documents router tests (list, delete)
- [x] auth tests (me, logout)
- [x] All 20 tests passing

## Data Ingestion

- [x] Ingest AmericanLeadswithPersons.xlsx data (29 leads imported)

## Pending / Future

- [ ] Email notification system for follow-up reminders
- [ ] Team member assignment and notifications
- [ ] Export leads to CSV/Excel
- [ ] Calendar integration for follow-up scheduling

## Phase 2 — New Features

- [x] Document management: upload PDF, HTML, Excel, Word files with type tagging
- [x] Shareable HTML presentation: generate unique public URL for uploaded HTML files
- [x] Share-to-client action: send share link from CRM and record as contact moment
- [x] Calendar view: monthly/weekly view of scheduled contact moments
- [x] Follow-up reminders: alerts for overdue and upcoming follow-ups
- [x] Priority score: computed score per lead displayed on list and detail pages
- [x] AI chat lead updates: update lead fields via natural language chat
- [x] AI chat tools: updateLead, addContactMoment, searchLeads
- [x] Document RAG indexing: parse PDF/HTML/Excel/Word, chunk text, store in document_chunks table
- [x] Document chunks searchable via AI chat (RAG over document content)
- [x] shareable_presentations table with unique token and view tracking
- [x] Priority score column on leads table (computed + stored)
- [x] Calendar view page (monthly/weekly) with contact moment events
- [x] 27 tests passing (auth, leads, contactMoments, documents, documentRag, analytics)

## Bug Fixes

- [x] Fix AI chat endpoint: "messages array is required" error when sending a message (AIChatBox sends single {message} not {messages:[]}; rewrote endpoint to use createUIMessageStream + convertToModelMessages)

## Phase 3 — Event Lead Attributes

- [x] Add leadType field to leads table (default, event, hospitality, saas, etc.)
- [x] Add leadAttributes JSON column to leads table for flexible type-specific data
- [x] Define event attribute schema: visitorCount, eventDurationDays, eventDates, region, hotelNeedScore, revenueEngineFit, typicalDates, venueCapacity, eventCategory
- [x] Dynamic attribute editor on lead detail/form: shows event fields when leadType = event
- [x] Lead type badge on leads list and detail pages
- [x] Import UK Events spreadsheet (26 leads) with event attributes
- [x] Index event attributes into RAG for AI chat searchability
- [x] AI chat can query by event attributes (e.g. "show events with >100k visitors")

## Phase 4 — Person Entity & Event Attributes

### Person Entity

- [x] persons table: name, linkedInUrl, email, phone, personType (contact/partner/reseller/influencer/prospect), company (free text), title, notes, tags, source, createdAt
- [x] person_lead_links table: personId, leadId, relationship (contact_at/introduced_by/partner/other), notes
- [x] contact_moments: add optional personId column (moment can be against a person, a lead, or both)
- [x] Persons tRPC router: list, get, create, update, delete, search, linkToLead, unlinkFromLead, logContactMoment, getContactMoments, getLeadLinks
- [x] Persons list page: searchable table with type badges, last contact, linked leads count
- [x] Person detail page: profile card, contact timeline, linked leads
- [x] Add Person from LinkedIn: quick-add form with LinkedIn URL, name, title, company
- [x] Person type badges: Contact, Partner, Reseller, Influencer, Prospect
- [x] Persons sidebar nav item (People)

### Event Attributes (completing Phase 3)

- [x] Fix LeadDetail: add updateLeadMutation and wire LeadAttributeEditor save callbacks
- [x] Import UK Events spreadsheet (26 events) with leadType=event and leadAttributes populated
- [x] All 55 leads re-indexed for RAG (including event attributes)
- [x] 27 tests passing

## Phase 5 — LinkedIn Quick-Import

- [x] Server endpoint POST /api/linkedin-import: fetch public LinkedIn page, extract text, use LLM to parse name/title/company/summary
- [x] Return structured JSON: name, title, company, linkedInUrl, summary/notes, personType suggestion
- [x] Frontend: LinkedIn URL input field in Persons quick-add form with "Import" button
- [x] Show loading spinner while fetching + extracting
- [x] Pre-fill all form fields from LLM response, user can review/edit before saving
- [x] Handle errors gracefully (private profile, rate limit, invalid URL) with user-friendly toast messages

## Bug Fixes (Phase 5)

- [x] Fix LinkedIn import: was hitting wrong Forge API endpoint (/responses instead of /v1/chat/completions) and crashing on LinkedIn's HTTP 999 status. Fixed: use openai.chat() with /v1 baseURL, use plain fetch (not patchedFetch) for LinkedIn page fetch, improved URL slug name inference.

## Bug Fixes (Phase 6)

- [x] Lead detail page: add Persons tab showing all persons linked to the lead, with link/unlink actions (search persons, select relationship, unlink button, view person link)

## Bug Fixes (Phase 7)

- [x] Make all search case-insensitive: leads (companyName, contactPerson, email, notes, industry), persons (name, email, company, title, linkedInUrl), contact moments (notes, subject, lead name) — all use LOWER() SQL; RAG keyword search was already case-insensitive via .toLowerCase()

## Phase 8 — AI Enrichment with Web Scraping (COMPLETED)

- [x] Enrichment engine (enrichmentEngine.ts): scrapes company website, Wikipedia API, Google News RSS
- [x] Scrape company website homepage and extract text content
- [x] Wikipedia search + article fetch for company/event overview
- [x] Google News RSS feed for recent news headlines
- [x] LLM synthesises into: overview, recentNews, keyPeople, talkingPoints, painPoints, opportunities, competitiveLandscape, nextBestAction, estimatedDealSize, urgencyScore, fitScore
- [x] Sources array with type (website/wikipedia/news) and URL for clickable links
- [x] Frontend enrichment tab: scores row, overview, news, key people, talking points, next best action, sources
- [x] Re-indexes lead after enrichment for AI chat searchability
- [x] 27 tests passing

## Phase 9 — LLM API Key Management

- [x] app_settings table: key/value store for LLM config (provider, model, apiKey, baseUrl, chatModel, enrichmentModel)
- [x] settings tRPC router: get, update (admin only), testConnection
- [x] getLLMProvider() shared helper: reads DB settings at runtime, returns AI SDK provider with correct key/URL
- [x] Fallback: if no custom key configured, use Manus Forge API (BUILT_IN_FORGE_API_KEY)
- [x] Update crmChat.ts to use getLLMProvider()
- [x] Update enrichmentEngine.ts to use getLLMProvider()
- [x] Update integrations.ts LinkedIn import to use getLLMProvider()
- [x] Settings page: provider dropdown (OpenAI, Anthropic, Google Gemini, OpenAI-compatible/custom)
- [x] Settings page: model name input (e.g. gpt-4o, claude-sonnet-4-5, gemini-2.5-flash)
- [x] Settings page: API key input (masked, stored encrypted in DB)
- [x] Settings page: base URL input (for custom/self-hosted endpoints like Ollama, Groq)
- [x] Settings page: "Test Connection" button that calls a test LLM completion
- [x] Settings page: separate chat model vs enrichment model configuration
- [x] Settings nav item in sidebar
