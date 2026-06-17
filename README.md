# Catalyst Studio

Catalyst Studio is an open-source AI-assisted website and CMS studio. It helps teams import an existing website, turn pages into structured CMS-style components, visually edit page hierarchies, preview generated experiences, and export content into headless delivery workflows.

The project is built with Next.js, React, Prisma, PostgreSQL, and the Vercel AI SDK. It is designed to be hackable locally: the core studio, seeded demo data, component registry, and preview renderer run on your machine without paid services. AI import/generation and external CMS exports are optional integrations.

## What You Can Try

- Import or generate website pages into reusable component data.
- Edit page structure in the visual site builder at `/studio/site-builder`.
- Manage websites, content types, usage, integrations, and deployment settings from the studio.
- Preview seeded website pages through the built-in database-backed renderer.
- Export structured content toward multiple CMS providers from one universal content model.
- Extend the CMS component library under `lib/studio/components/cms/**`.

## Export Targets

Catalyst Studio's export layer is designed around provider adapters. The goal is to let teams model content once, then push it to the CMS their client already uses.

![Catalyst Studio export provider support](docs/images/readme/export-providers.svg)

| Provider | Status | Notes |
| --- | --- | --- |
| Optimizely CMS | Active adapter | Schema-first export for pages, folders, blocks, shared components, and publishing workflows. Requires Optimizely credentials and page/block containers. |
| Kontent.ai | Active adapter | Creates/updates content types, items, variants, and component references through the Management API. |
| Contentstack | Active adapter | Creates content types and entries through the Contentstack Management API. |
| Umbraco Compose | Partial adapter | Supports schema/content ingestion flows; media upload is still marked as incomplete in code. |
| Strapi | Experimental adapter | Supports Content-Type Builder based schema operations and content sync, but requires admin credentials and a running Strapi instance. |
| Contentful | Adapter present | Provider implementation exists, but it is not currently part of environment auto-detection. Configure it manually before relying on it. |
| Mock Provider | Development | Local deterministic provider for tests and demos without external CMS credentials. |

Set `CMS_PROVIDER=auto` to pick a configured provider from available credentials, or set a provider explicitly, for example `CMS_PROVIDER=kontent`.

## Screenshots

Screenshots are stored in `docs/images/readme/`.

![Imported website canvas and preview example](docs/images/readme/imported-website-flow.svg)

![Website import in progress](docs/images/readme/import-progress.svg)

![Database-backed live preview](docs/images/readme/live-preview-mozilla.svg)

![Imported site in the visual editor](docs/images/readme/imported-site-editor.png)

![Catalyst Studio landing page](docs/images/readme/landing.png)

![Catalyst Studio dashboard](docs/images/readme/dashboard.png)

![Catalyst Studio content types](docs/images/readme/content-types.png)

## Quickstart

Requirements:

- Node.js 20 or newer
- npm
- Docker with Compose v2 for the one-command database setup

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Install and prepare the app:

```bash
npm ci
cp .env.example .env
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Open `http://localhost:3000/sign-in` and use the seeded demo account:

```text
Email: seed@example.com
Password: SeedUser!234
```

Then open `http://localhost:3000/dashboard` or `http://localhost:3000/studio/site-builder?websiteId=test-website`.

AI features require an `OPENROUTER_API_KEY`, but the seeded demo, dashboard, content model screens, and local preview flow work without one.

External CMS export is optional. The local demo defaults to the mock/development path unless provider credentials are configured.

## Useful Scripts

- `npm run dev` - generate the component registry and start Next.js.
- `npm run build` - generate the component registry and build the app.
- `npm run db:migrate:deploy` - apply existing Prisma migrations to the configured database.
- `npm run db:migrate` - create or apply migrations while changing the Prisma schema.
- `npm run db:seed` - create the seeded demo account and sample content.
- `npm run typecheck` - run TypeScript checks.
- `npm run test:ci` - run the stable public smoke suite.
- `npm run test:e2e` - run Playwright tests.

Run the public smoke suite:

```powershell
$env:SKIP_DB_SETUP="true"; npm run test:ci
```

Verify the Docker quickstart end to end:

```bash
npm run verify:quickstart
```

This command starts the Docker Compose Postgres service, applies migrations, seeds the demo account, starts the app on port `3100`, and checks the seeded sign-in flow.

Using your own PostgreSQL 14+ instance is also supported. Skip `docker compose up -d postgres`, set `DATABASE_URL` and `DIRECT_URL` in `.env` to your database, then run the same `npm ci`, `npm run db:migrate:deploy`, `npm run db:seed`, and `npm run dev` commands.

## Project Map

- `app/studio/**` - Studio pages and layouts.
- `app/api/studio/**` - Studio API routes.
- `lib/studio/**` - Studio domain logic, components, imports, preview, and workflows.
- `lib/studio/components/cms/**` - Reusable CMS component definitions.
- `components/ui/**` - Shared UI primitives.
- `prisma/**` - Database schema, migrations, and seed data.
- `docs/**` - Setup and architecture notes.

## Documentation

- [Setup](docs/setup.md)
- [Architecture](docs/architecture.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

## Contributing

Issues and pull requests are welcome. Please keep changes scoped, add focused tests when behavior changes, and follow the import and directory conventions in [AGENTS.md](AGENTS.md).

## License

Catalyst Studio is licensed under the [Apache License 2.0](LICENSE).
