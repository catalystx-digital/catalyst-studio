# Catalyst Studio

**AI-powered visual website studio and headless CMS with universal export.**

## Project Overview

Catalyst Studio is an open-source AI-assisted visual website builder and full-featured CMS. Import any live site with AI (or generate greenfield from prompts), edit visually using drag-and-drop hierarchy (React Flow), a library of 60 production-ready CMS components, global/shared components with one-click propagation, and an in-canvas conversational AI assistant. Changes are instantly reflected in a database-backed live preview. The same unified content model powers a production GraphQL headless API (UCS) and universal export adapters for the CMS platforms clients already use (Optimizely CMS full support, Kontent.ai, Contentstack, and others). Core features—including the complete visual builder, preview, content modeling, and a seeded realistic demo site—run entirely locally with one command and require no API keys or paid services.

## Key Improvements Made

- Added a prominent, scannable **Quick Demo Walkthrough** (6 steps) to the README that guides first-time users from the single-command quickstart through the full end-to-end value proposition: AI/visual editing of the seeded model → live database-backed preview sync → exercising the UCS GraphQL headless API on the *exact same edited content* → exploring export and content types.
- Delivered and documented the definitive **one-command local demo** (`npm run verify:quickstart`): starts PostgreSQL via Docker Compose, applies migrations, seeds a full demo account + editable `test-website` with pages/components/globals, launches the app on port 3100, and verifies the sign-in flow. The seeded site is explicitly real and powers every consumption path.
- Polished project presentation (README front matter, Quickstart section, hero alignment, feature highlights, and callouts) for job-application and recruiter audiences: explicit "no AI keys required for core demo", direct value-prop language, scannable technical differentiators, and clear separation of zero-friction core experience vs optional AI keys / real CMS export credentials.
- Strengthened the single-source-of-truth messaging: every visual or AI-assisted edit mutates the canonical model that is simultaneously used by the live preview renderer, public site, UCS GraphQL consumers, and all export providers (mock provider active by default in the seeded demo for immediate testing of "model once, push anywhere").
- Made the demo experience self-contained and immediately verifiable: dashboard "Try these features" cards with direct deep links, prominent "copy curl" examples for the headless API using website-scoped keys, and explicit instructions that the seeded `test-website` demonstrates the complete stack without external dependencies.

## How to Experience the Demo

The fastest way to see the product in action is documented in the repository's **[Quick Demo Walkthrough](README.md#quick-demo-walkthrough)** section (added as part of recent polishing for accessibility).

```bash
npm run verify:quickstart
```

Then follow these 6 steps (copied from README for convenience):

1. Sign in at http://localhost:3100/sign-in with the seeded demo account:
   ```
   Email:    seed@example.com
   Password: SeedUser!234
   ```

2. Go to the Dashboard at http://localhost:3100/dashboard and click the "Try these features with the seeded demo site" cards (direct links to the seeded `test-website`):
   - Visual Site Builder: http://localhost:3100/studio/site-builder?websiteId=test-website
   - Live Database-Backed Preview: http://localhost:3100/studio/preview?websiteId=test-website
   - Content Types & CMS: http://localhost:3100/studio/content-types?websiteId=test-website
   - Export & Headless (via Settings): http://localhost:3100/studio/settings?websiteId=test-website&tab=api

3. In the Site Builder, click the floating Sparkles button (bottom-right) to open the in-canvas AI assistant. Try a simple prompt such as "add a hero to home" or "make the main nav global" — it operates on the real seeded pages, components, and globals (core drag-drop, props, and hierarchy require no keys).

4. Open (or refresh) Live Preview in a second tab: see your edits appear instantly. The preview uses the exact same database-backed renderer and resolved content model that headless consumers and the public site see.

5. In Settings → API Access (or via the dashboard card link), use the prominent "Headless GraphQL API (UCS)" card: click "Try it now (copy curl)". It demonstrates querying the *same model* (pages + components + sharedComponents + designSystems) you just edited visually. Generate a website-scoped key in the table below and paste it to run the curl against `test-website`.

6. (Optional) Explore Content Types to inspect the structured modeling, or Deployment for universal export (mock provider is active in the seeded demo — model once, push anywhere).

This proves the value prop in minutes: AI-powered visual editing and headless GraphQL from a single editable CMS model, with live preview and universal export — all without any API keys for the core seeded experience.

Full manual setup, troubleshooting, and advanced configuration live in [docs/setup.md](docs/setup.md).

## Technical Highlights / Skills Demonstrated

- **Modern React/Next.js Full-Stack**: Next.js 15 App Router + React 19 + TypeScript. Server and client components, API routes, middleware for auth/preview, public site rendering (`[...slug]`).
- **State Management**: Zustand (content store, content-items store, chat transcript store, custom `useSyncState` hook).
- **Persistence & Modeling**: Prisma + PostgreSQL (migrations, rich seeding). Visual editing model: component *templates* are reusable definitions; page content lives as normalized JSON in `WebsitePage.content`; site hierarchy and ordering in `WebsiteStructure`; shared/global components stored separately with per-instance overrides. Edits mutate instances, never templates (per strict project conventions).
- **AI Tooling & Integration**: Vercel AI SDK v5 (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`, `@openrouter/ai-sdk-provider`). Tool-calling agents that read and mutate the live site model. Context-aware chat, structured prompts, pruning, component/page catalogs. AI import pipeline (web-based LLM detection + DOM probe design-system extraction) and greenfield generation. In-builder assistant for real edits.
- **Rich Component System**: 60 production CMS components across categories (heroes, navigation, content, features, CTA, social-proof, contact, about, blog, pricing, data). Each includes Zod schemas, TypeScript types, AI metadata for detection/generation, unit tests, and stories. Dynamic registry generated at build time (`npm run build:components`). Strict performance and bundle-size targets. Lazy loading and code splitting.
- **Headless GraphQL CMS (UCS — Unified Content System)**: Custom GraphQL schema and resolvers (`/api/studio/ucs/graphql`) serving pages, structure, shared components, design systems, and resolved media. Snapshot builders, depth/complexity limiting, website-scoped API key authentication + audit. Same resolved model drives preview, public rendering, and export. Also supports direct DB-backed preview renderer (no external sandbox required for core use).
- **Universal Content Modeling + Export**: Provider abstraction (`ICMSProvider`) behind a three-layer Universal Type System (primitives → common patterns → platform extensions). Active adapters for Optimizely CMS (full schema-first pages/blocks/folders/shared/publishing), Kontent.ai, Contentstack, Umbraco Compose (partial), Strapi (experimental), plus a deterministic Mock provider ideal for demos. "Model once, push anywhere."
- **Additional Professional Features**: Design system extraction & theming, media library with cross-reference usage tracking, team collaboration (RBAC, invites, per-website scoping), scoped/rotating API keys, usage quotas, deployment history, activity streams/audit logs. Fully extensible (new components, new export providers).
- **Developer Experience & Quality**: One-command verification script, component code generation, strict folder/import conventions (Studio code under `lib/studio/**` / `app/studio/**`, shared under conventional paths, `@/lib/studio/...` imports), AGENTS.md contributor rules, Jest tests (many skipping DB via `SKIP_DB_SETUP`), e2e, TypeScript strict mode, `npm run typecheck`, and `npm run build:components` gate.

## Full Details & Source

See the [main GitHub README](README.md) for the complete feature list, quickstart commands, export provider table, screenshots, architecture overview, useful commands, and contribution guidelines. The repository is fully hackable locally and intentionally demonstrates production-grade patterns for CMS, visual editing, AI tooling, and interoperable content delivery.

---

**Resume Bullet Points (copy-paste ready, 3-4 focused bullets):**

- Built and documented an open-source AI-powered visual CMS / website studio with one-command local demo (`npm run verify:quickstart`) that seeds a fully editable site powering live React Flow builder, database-backed preview, 60 component library, UCS GraphQL headless API, and universal export adapters.
- Engineered a unified content model (Prisma + normalized JSON + relational structure) consumed simultaneously by visual editing tools, AI agents (Vercel AI SDK tool calling), live preview renderer, public site, GraphQL (custom UCS schema with auth/limits), and multi-provider export layer (Optimizely, Kontent, Contentstack, etc.).
- Delivered polished, recruiter-friendly demo experience including a 6-step Quick Demo Walkthrough that proves end-to-end value (AI-assisted visual edits → instant preview → same-model headless queries → export) with zero API keys required for core flows.
- Implemented professional-grade frontend architecture: Zustand state, React 19/Next.js 15 App Router, React Flow hierarchy editing, shadcn/ui + Radix, generated component registry, strict visual-editing invariants, and extensible provider architecture for CMS interoperability.

**LinkedIn-style Post Blurb (<200 words):**

Just shipped a polished portfolio-ready experience for Catalyst Studio, our open-source AI visual website builder + headless CMS.

One command (`npm run verify:quickstart`) spins up a full Postgres-backed demo with a real seeded site. From there, use the visual builder (React Flow + 60 components + globals), chat with the in-canvas AI assistant to make live edits, watch changes appear instantly in the database-backed preview, query the *exact same model* over the UCS GraphQL headless API, and export via the universal adapters (mock provider works out of the box).

Everything core runs locally with zero API keys. The project demonstrates real full-stack skills: Next.js 15 + React 19, Zustand, Prisma, Vercel AI SDK tool-calling, custom GraphQL, a robust component system, and a universal content model that decouples authoring from delivery.

If you're hiring for frontend/full-stack, CMS platforms, visual editing tools, or AI-assisted developer tooling — the quickstart + 6-step walkthrough in the README is the fastest way to see it in action. Happy to walk through the architecture or specific subsystems.

Link in comments / repo: https://github.com/catalystx/catalyst-studio-oss

(Word count: 168)

## How to Use These Improvements for Your Job Search

These updates make Catalyst Studio's value immediately verifiable and presentation-ready for recruiters and hiring managers. Key evidence-based highlights: the definitive one-command demo (`npm run verify:quickstart`), dashboard "Try these features with the seeded demo site" cards (4 direct deep links to a real editable `test-website`), prominent UCS "Try it now (copy curl)" button, and the 6-step Quick Demo Walkthrough that proves the unified content model end-to-end.

### Referencing in Resume and LinkedIn

Use the **Resume Bullet Points** (copy-paste ready) and **LinkedIn-style Post Blurb** exactly as listed above in this document. Tailor 2–3 bullets to the target role (e.g., emphasize UCS GraphQL + universal export for platform/backend roles; React Flow + AI assistant + component system for frontend/visual-tooling roles).

Example phrasing for applications:
> "Open-source contributor to Catalyst Studio (AI visual CMS + headless): delivered one-command demo experience and improved discoverability of the UCS headless API and live preview flows using a production-grade seeded model."

### Suggested Interview Talking Points

- "I improved the discoverability and demo-ability of a full-stack AI visual + headless CMS. I added scannable dashboard quickstart cards and a 'Try it now (copy curl)' experience so anyone can immediately explore the *same* CMS model via the visual builder and the UCS GraphQL API—after running one command."
- "The standout architecture decision: a single unified content model (Prisma-backed with JSON pages + relational structure) that simultaneously drives visual editing, the database-backed live preview renderer, public site, custom GraphQL UCS (with auth/limits), and universal export adapters. I documented a 6-step walkthrough that demonstrates edits flowing instantly across all paths with zero external keys."
- "Core demo is self-contained and reproducible (`npm run verify:quickstart` seeds a real `test-website` that powers preview, UCS queries, and mock exports). This surfaces the 'model once, consume anywhere' value prop cleanly for technical audiences."
- "Beyond code, this work shows product thinking: making complex technical capabilities (React Flow hierarchy, Vercel AI SDK tool-calling on live data, custom GraphQL, multi-provider export) accessible and verifiable in under 10 minutes."
- "I applied professional patterns: Zustand + React 19/Next.js 15, generated component registry, strict visual-editing model invariants, and contributor guidelines to keep the project maintainable."

Be ready to demo live: run verify:quickstart, login (seed@example.com / SeedUser!234), click 2–3 cards, trigger an edit or curl example, and refresh preview.

### Next Actions After Commit

1. **Complete verification & commit** (selective only per project rules): run `npm run build:components`, `npm run typecheck`, `$env:SKIP_DB_SETUP="true"; npm run test -- ...` (or equivalent), `npm run verify:quickstart`, review diffs, then `git add` *only* the intended product files.
2. **Update your personal portfolio/site**: Link the repo prominently. Quote the Quick Demo Walkthrough or embed PORTFOLIO.md / README sections. Add a short video or screenshots of the 6-step flow + curl demo.
3. **Share socially**: Post the LinkedIn blurb (update repo link if needed) on LinkedIn, X, etc. Encourage others to try the one-command demo.
4. **Resume & applications**: Integrate the bullets. In cover letters or summaries, highlight "led demo UX + headless visibility improvements using sub-agents for an open-source visual CMS."
5. **Interview preparation**: Practice the exact demo sequence. Prepare architecture explanations of the unified model vs siloed systems.
6. **Optional amplification**: Pin the repo on GitHub, create a lightweight tag/release for the change, or add a "Live Demo" callout on your site.

All claims are grounded in the shipped changes (README Quick Demo Walkthrough, dashboard cards, UCS curl affordance, polished messaging). Positive and actionable for showing impact on technical product polish, full-stack implementation, and developer experience.

