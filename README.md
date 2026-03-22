# SalesFlow CRM

A full-stack B2B CRM built with React, Express, tRPC, and PostgreSQL. Designed for managing leads, contacts, competitors, and the sales pipeline — with AI-powered features like lead enrichment, document RAG with vector embeddings, brainstorming, and a conversational chat interface.

## Features

### Lead Management

Track companies through a configurable pipeline (new → contacted → qualified → proposal → negotiation → won/lost/on hold). Supports flexible lead types — default, event, festival, conference, hospitality, SaaS, retail, partner, venue, and event promotor — each with a dynamic attribute schema (e.g. visitor count and hotel need score for events, capacity for venues). Leads can be labeled, assigned to users, and carry estimated deal values.

Bulk operations include multi-select delete, label updates, assignment changes, and lead merging (combine duplicates into a single record).

### Person Directory

Manage individual contacts separately from companies. Link people to leads with relationship types (contact, decision maker, champion, partner, reseller, influencer, investor). Each person tracks role, company, email, phone, LinkedIn, and notes. Quick-import contacts from LinkedIn profile URLs using AI-based extraction.

### Competitor Intelligence

Track competitors with profiles including website, description, strengths, weaknesses, and threat level (low/medium/high). Link competitors to leads with contract details (start date, end date, value, customer satisfaction score). Attach documents and web links to build a competitive knowledge base.

### Brainstorm

Capture and develop business ideas. Each brainstorm supports a title, description, tags, and an optional link to a lead for context. AI enrichment analyzes the idea and generates market research, feasibility assessment, competitive analysis, risks, potential value, and concrete action items — using Wikipedia and Google News as research sources. An integrated AI chat lets you refine the idea conversationally; the AI can automatically update the enrichment report as new insights emerge. Upload documents (PDF, Word, Excel) directly to brainstorms for the AI to reference.

### AI Chat

Conversational CRM assistant with tool-calling support. Search leads (keyword and semantic), look up lead details, add contact moments, update records, and query lead statistics — all through natural language. Uses RAG over lead data and uploaded documents for context-aware responses. Streaming responses with a Claude-inspired UI.

### AI Enrichment

Automatically enrich leads by scraping the company website, Wikipedia, and Google News. An LLM synthesizes the data into talking points, pain points, competitive landscape, fit scores, and suggested next actions. Enrichment reports are stored on the lead and surfaced in the detail view.

### Document Management

Upload PDF, Word, Excel, HTML, and plain text files to leads, competitors, brainstorms, or the team-wide document library. Documents are automatically parsed, chunked (800 chars with 100 char overlap), and embedded with OpenAI `text-embedding-3-small` vectors (1024 dimensions) for semantic search via pgvector.

Documents support access control (all users or restricted to specific users). HTML documents and presentations can be shared via unique public URLs with view tracking.

### Web Links

Attach web links to leads, persons, or competitors. Links are automatically scraped and summarized by AI, with category tagging (website, article, news, social, documentation, review, video). Links can be re-scraped on demand to refresh content.

### Promotor Events

Leads of type "event promotor" support sub-events — individual events managed under the parent promotor record with their own details and scheduling.

### Multi-Channel Ingestion

- **Excel/CSV Import** — Column-mapping wizard with preview for bulk lead import.
- **JSON API Import** — Programmatic lead import endpoint.
- **Email Webhook** — Inbound email parsing compatible with SendGrid, Postmark, and Mailgun. Automatically matches emails to leads and persons by domain and email address, with forwarded email detection.
- **IMAP Polling** — Poll an IMAP mailbox at configurable intervals for automatic email ingestion.
- **Slack** — Slash commands (`/crm-lead`, `/crm-note`, `/crm-search`) for creating leads, logging contact moments, and searching from Slack.
- **LinkedIn** — Import person profiles from LinkedIn URLs.

### Analytics

Dashboard with pipeline funnel visualization, contact frequency charts (configurable time range), top leads by activity, recent activity timeline, and KPI overview. Tracks overdue and upcoming follow-ups, upcoming meetings, and provides an unmatched email inbox for manual email-to-lead matching.

### Calendar

Monthly and weekly calendar views showing contact moments, follow-up reminders, and upcoming meetings. Color-coded by event type with outcome indicators (positive/neutral/negative). Mark follow-ups as done directly from the calendar. Highlights overdue items.

### Priority Scoring

Algorithmic lead priority scoring (0–100) based on activity recency, document count, contact frequency, and opportunity value. Scores update automatically on lead changes with a bulk recalculation endpoint.

### Settings

Admin panel for:
- **LLM Provider** — Configure OpenAI, Anthropic, Google Gemini, or any OpenAI-compatible endpoint (Ollama, Groq, etc.). Separate model selection for chat and enrichment tasks. Connection testing built in.
- **IMAP Email** — Configure IMAP server, credentials, mailbox folder, and poll interval. Test connection and trigger manual sync.
- **User Management** — Invite users, assign roles (user/admin), reset passwords, and manage accounts. First registered user becomes admin.

### Authentication

Email/password authentication with bcrypt hashing. Cookie-based session management with HTTP-only secure cookies. Role-based access control (user and admin). GeoIP login tracking.

## Tech Stack

| Layer      | Technology                                                       |
| ---------- | ---------------------------------------------------------------- |
| Frontend   | React 19, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui |
| Backend    | Express, tRPC 11, Node.js                                        |
| Database   | PostgreSQL 16 + pgvector, Drizzle ORM                            |
| AI         | Vercel AI SDK, OpenAI / Anthropic / Google / custom providers    |
| Embeddings | OpenAI text-embedding-3-small (1024 dimensions)                  |
| Storage    | Local file storage (configurable)                                |
| Language   | TypeScript (strict mode)                                         |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (`corepack enable`)
- PostgreSQL 16+ with pgvector extension

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env   # then fill in your values (see Environment Variables below)

# Run database migrations
pnpm run db:push

# Start development server
pnpm run dev
```

The dev server starts at `http://localhost:3000` with Vite HMR for the frontend and tsx watch for the backend.

### Environment Variables

| Variable                      | Description                                                          |
| ----------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`                | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `JWT_SECRET`                  | Secret for signing session JWTs (min. 32 characters)                 |
| `BUILT_IN_FORGE_API_URL`      | Default LLM API base URL (for AI features)                           |
| `BUILT_IN_FORGE_API_KEY`      | Default LLM API key (for AI features)                                |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend API key (for client-side AI features)                       |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend API base URL (for client-side AI features)                  |

`VITE_*` variables are embedded at build time. The first user to register becomes the admin.

## Scripts

```bash
pnpm run dev        # Start dev server (tsx watch + Vite HMR)
pnpm run build      # Production build (Vite + esbuild)
pnpm start          # Run production server
pnpm run check      # TypeScript type-check
pnpm run format     # Prettier
pnpm run test       # Run tests (Vitest)
pnpm run db:push    # Generate and apply database migrations
```

## Project Structure

```
client/             React frontend
  src/
    pages/          Route page components
    components/     Reusable UI components
    hooks/          Custom React hooks
    contexts/       React contexts (theme)
server/             Express backend
  _core/            Server bootstrap, tRPC setup, auth
  routers/          tRPC route handlers
  *.ts              Business logic (crmChat, enrichmentEngine, documentRag, integrations)
shared/             Types and constants shared between client and server
drizzle/            Database schema, relations, and migration files
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for a complete guide and automated shell script to deploy to a Digital Ocean droplet with PostgreSQL + pgvector, Nginx, and Let's Encrypt SSL.

## License

MIT
