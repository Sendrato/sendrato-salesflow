# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm run dev          # Start dev server (tsx watch + Vite HMR)
pnpm run build        # Production build (Vite + esbuild)
pnpm start            # Run production build
pnpm run check        # Type-check (tsc --noEmit)
pnpm run format       # Format code (Prettier)
pnpm run test         # Run all tests (Vitest)
pnpm run db:push      # Generate and apply DB migrations (drizzle-kit)
```

Run a single test file: `npx vitest run server/path/to/file.test.ts`

## Architecture

Full-stack TypeScript monorepo: React frontend + Express/tRPC backend + MySQL (Drizzle ORM).

### Directory Layout

- **`client/src/`** — React 19 frontend (Vite, Wouter routing, shadcn/ui + Radix UI + Tailwind CSS)
  - `pages/` — Route page components; `components/` — Reusable UI; `hooks/` — Custom hooks; `contexts/` — React contexts
- **`server/`** — Express backend with tRPC routers
  - `_core/` — Server bootstrap, tRPC setup, auth middleware, OAuth, SDK
  - `routers/` — tRPC route handlers (leads, persons, contactMoments, documents, analytics, settings)
  - Top-level `.ts` files — Business logic (crmChat, enrichmentEngine, documentRag, db, integrations)
- **`shared/`** — Types, constants, and error definitions shared between client and server
- **`drizzle/`** — Database schema (`schema.ts`, `relations.ts`) and SQL migration files

### Key Patterns

- **tRPC** for type-safe client-server API (base path `/api/trpc`). App router composes: system, settings, auth, leads, contactMoments, documents, analytics, persons, upload.
- **Non-tRPC endpoints** for streaming/file operations: `/api/crm-chat`, `/api/email-ingest`, `/api/slack-webhook`, `/api/import`, `/api/upload-file`, `/api/enrich-lead/:id`, `/api/linkedin-import`.
- **Drizzle ORM** with MySQL dialect. Schema defined in `drizzle/schema.ts` with relations in `drizzle/relations.ts`.
- **AI/LLM**: Vercel AI SDK with OpenAI-compatible providers. Settings-driven provider config (custom API key/URL or built-in). RAG via document chunking + embeddings for semantic search.
- **Path aliases**: `@/*` → `client/src/*`, `@shared/*` → `shared/*`

### Testing

Tests live in `server/**/*.test.ts`. Pattern: create a fake tRPC context with mocked user/req/res, then use `appRouter.createCaller(ctx)` to call procedures.

## Code Style

- TypeScript strict mode
- Prettier: double quotes, semicolons, 2-space indent, 80-char width, trailing commas (es5)
- Zod for runtime validation on tRPC inputs
- React Hook Form + Zod for frontend form validation
