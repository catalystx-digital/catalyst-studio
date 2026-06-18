# Architecture Overview

Catalyst Studio is a Next.js 15 application (App Router) with Prisma + PostgreSQL persistence, a large CMS component system, AI-assisted import/generation workflows, and support for both visual editing and headless consumption.

## High-Level Structure

- `app/` — Next.js routes and pages
  - `app/studio/**` — Main studio UI (site builder, content types, preview, settings, team, etc.)
  - `app/api/studio/**` — Studio-specific API routes
  - `app/dashboard`, `app/[...slug]`, auth routes, etc.
- `lib/studio/**` — Core studio domain logic (the heart of the project)
  - `components/cms/**` — The reusable CMS component library (60 components with Zod schemas + AI metadata)
  - `import/**` — AI-powered website import pipeline and detection
  - `site-builder/**` — Visual editing UI components and logic
  - `ai/**`, `headless/**`, `preview/**`, `graphql/**`, `design-system/**`, `media/**`
- `lib/services/**` — Business logic layer (unified content repository, page/structure orchestration, export, etc.)
- `components/ui/**` — Shared UI primitives (shadcn-based)
- `prisma/**` — Database schema, migrations, and seeds

## Core Content Model

- **Component templates** are reusable definitions (defined in `lib/studio/components/cms/**` and persisted per-site in `WebsiteComponentType`).
- **Page content** (component instances + layout) lives in `WebsitePage.content` as normalized JSON.
- **Site/page hierarchy and routing** lives in `WebsiteStructure` (tree with slugs, full paths, parent relationships).
- **Shared/global components** are stored separately (`WebsiteSharedComponent`) and referenced from pages with per-instance overrides.
- **Visual edits mutate the JSON content and structure**, never the component template definitions.

See `AGENTS.md` for the strict visual editing rules that all contributors must follow.

## Important Generated Artifacts

Run this before development and before every build:

```bash
npm run build:components
```

This scans the CMS component library and writes `lib/studio/components/component-registry.generated.ts`.

## Key Technical Pieces

- **Preview & Rendering**: Database-backed renderer (default) + optional Vercel Sandbox. Same resolution logic powers the public `app/[...slug]` route.
- **Headless / GraphQL**: Unified Content System (UCS) with snapshot builders, page resolvers, and a GraphQL API (`/api/studio/ucs/graphql`).
- **AI Layer**: Tool-calling via Vercel AI SDK + OpenRouter. Tools can read and mutate the site model. Context + pruning + catalogs for components/pages.
- **Import Pipeline**: Durable workflows (Vercel Workflow SDK), per-page LLM detection, design system DOM probing, staging, resumable execution.
- **Export**: Universal content model + provider adapters (see `lib/cms-export/**` and `lib/services/export/**`).
- **Auth & Tenancy**: Custom session-based auth with Account → Website scoping, RBAC, invitations, scoped API keys, and impersonation support.

## Where to Start Exploring Code

1. `lib/studio/components/cms/` — the component system
2. `app/studio/site-builder/` + `lib/studio/stores/site-builder-store.ts` — the visual editor
3. `lib/studio/import/` — the AI import engine
4. `lib/services/unified-content-repository.ts` + page/structure services — how content actually works
5. `app/api/studio/ucs/graphql/` — the headless API

## Further Reading

- [Setup Guide](setup.md)
- [AGENTS.md](../AGENTS.md) (contributor rules, directory conventions, testing notes)
- [Claude.md](../Claude.md) (project-specific instructions for AI coding agents)

This document is intentionally high-level. Most implementation details live in the well-commented code and tests.
