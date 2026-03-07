# SalesFlow CRM

A full-stack CRM built with React, Express, tRPC, and MySQL. Designed for managing leads, contacts, and the sales pipeline — with AI-powered features like lead enrichment, document RAG, and a conversational chat interface.

## Features

**Lead Management** — Track companies through a configurable pipeline (new → contacted → qualified → proposal → negotiation → won/lost). Supports flexible lead types (default, event, hospitality, SaaS, etc.) with dynamic attribute schemas per type.

**Person Directory** — Manage individual contacts separately from companies. Link people to leads with relationship types (contact, partner, reseller, influencer). Quick-import from LinkedIn profiles via URL.

**AI Chat** — Conversational interface with tool-calling support. Search leads, add contact moments, and update records through natural language. Uses RAG over lead data and uploaded documents.

**AI Enrichment** — Automatically enrich leads by scraping the company website, Wikipedia, and Google News. An LLM synthesizes the data into talking points, pain points, competitive landscape, fit scores, and suggested next actions.

**Document Management** — Upload PDF, Word, Excel, and HTML files to leads. Documents are parsed, chunked, and embedded for semantic search via the AI chat. HTML documents can be shared via unique public URLs.

**Multi-Channel Ingestion** — Import leads from Excel/CSV with a column-mapping wizard. Ingest emails via webhook (SendGrid/Postmark/Mailgun compatible). Slack slash commands for quick lead search and note creation.

**Analytics** — Dashboard with pipeline funnel, contact frequency charts, top leads, and KPI overview.

**Calendar** — Monthly and weekly views of scheduled contact moments and follow-up reminders.

**Settings** — Admin panel for configuring the LLM provider (OpenAI, Anthropic, Google Gemini, or any OpenAI-compatible endpoint like Ollama or Groq) with connection testing.

## Tech Stack

| Layer      | Technology                                          |
|------------|-----------------------------------------------------|
| Frontend   | React 19, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui |
| Backend    | Express, tRPC 11, Node.js                           |
| Database   | MySQL 8, Drizzle ORM                                |
| AI         | Vercel AI SDK, OpenAI-compatible providers           |
| Storage    | AWS S3 (presigned URLs)                              |
| Language   | TypeScript (strict mode)                             |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (`corepack enable`)
- MySQL 8

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

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string (`mysql://user:pass@host:3306/db`) |
| `JWT_SECRET` | Secret for signing session JWTs |
| `VITE_APP_ID` | OAuth application ID |
| `OAUTH_SERVER_URL` | OAuth server URL |
| `OWNER_OPEN_ID` | Admin user's OpenID |
| `BUILT_IN_FORGE_API_URL` | Default LLM API base URL |
| `BUILT_IN_FORGE_API_KEY` | Default LLM API key |
| `VITE_OAUTH_PORTAL_URL` | OAuth login portal URL (frontend) |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend API key |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend API base URL |

`VITE_*` variables are embedded at build time.

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
  _core/            Server bootstrap, tRPC setup, auth, OAuth
  routers/          tRPC route handlers
  *.ts              Business logic (crmChat, enrichmentEngine, documentRag, integrations)
shared/             Types and constants shared between client and server
drizzle/            Database schema, relations, and migration files
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for a complete guide and automated shell script to deploy to a Digital Ocean droplet with MySQL, Nginx, and Let's Encrypt SSL.

## License

MIT
