# Setup

This guide gets Catalyst Studio running locally from a fresh clone with seeded demo data.

## Prerequisites

- Node.js 20 or newer
- npm, using the checked-in `package-lock.json`
- Docker with Compose v2 for the included PostgreSQL service
- Optional: PostgreSQL 14+ installed locally if you do not want to use Docker
- Optional: an OpenRouter API key for AI-assisted import and generation

## 1. Start PostgreSQL

The easiest local database is the included Compose service:

```bash
docker compose up -d postgres
```

It exposes:

```text
postgresql://postgres:postgres@localhost:5432/catalyst_studio
```

If port `5432` is already in use, either stop the other database or change the left side of the port mapping in `docker-compose.yml` and update `DATABASE_URL` / `DIRECT_URL` in `.env` accordingly. To run the quickstart verifier against a remapped host port, set `CATALYST_STUDIO_DB_PORT`, for example `CATALYST_STUDIO_DB_PORT=5433 npm run verify:quickstart`.

If you prefer your own PostgreSQL 14+ instance, skip the Compose command and create a database named `catalyst_studio`. Then set `DATABASE_URL` and `DIRECT_URL` in `.env` to that database before running migrations.

## 2. Install Dependencies

```bash
npm ci
```

`npm ci` runs `prisma generate` through the project postinstall script.

## 3. Configure Environment

```bash
cp .env.example .env
```

For the included Compose database, the default database values in `.env.example` are already correct. Prisma CLI commands load `.env`, so keep the database variables there for local development:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/catalyst_studio"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/catalyst_studio"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
AUTH_SECRET="replace-with-a-random-secret"
```

For a real local environment, replace `AUTH_SECRET` with a strong value. On macOS/Linux you can run:

```bash
openssl rand -base64 32
```

On Windows PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

AI features require:

```bash
OPENROUTER_API_KEY="your-openrouter-api-key"
OPENROUTER_MODEL="anthropic/claude-3.5-sonnet"
```

AI keys are optional for trying the seeded dashboard, site builder, content model, and preview screens.

## Optional CMS Export Providers

The local demo works without external CMS credentials. To test export into another CMS, set `CMS_PROVIDER` and the matching provider credentials in `.env`.

| Provider slug | Display name | Required configuration |
| --- | --- | --- |
| `mock` | Mock Provider | No external credentials. Useful for local demos and tests. |
| `optimizely` | Optimizely CMS | `OPTIMIZELY_CLIENT_ID`, `OPTIMIZELY_CLIENT_SECRET`, `OPTIMIZELY_PAGE_CONTAINER`, `OPTIMIZELY_BLOCK_CONTAINER` |
| `kontent` | Kontent.ai | `KONTENT_ENVIRONMENT_ID`, `KONTENT_MANAGEMENT_API_KEY` |
| `contentstack` | Contentstack | `CONTENTSTACK_API_KEY`, `CONTENTSTACK_MANAGEMENT_TOKEN` |
| `umbraco-compose` | Umbraco Compose | `UMBRACO_PROJECT_ALIAS`, `UMBRACO_REGION`, plus management credentials or `UMBRACO_PAT` depending on mode |
| `strapi` | Strapi | `STRAPI_BASE_URL` plus API/admin credentials depending on the operation |
| `contentful` | Contentful | Adapter exists, but it is not currently auto-detected from `.env`; use explicit/manual provider configuration. |

`CMS_PROVIDER="auto"` checks configured credentials in this order: Optimizely, Kontent.ai, Contentstack, Strapi, Umbraco Compose, then falls back to `mock` when enabled.

Use `CMS_DISABLED_PROVIDERS` to hide adapters that should not be selectable in a local or hosted environment:

```bash
CMS_DISABLED_PROVIDERS="strapi,contentful"
```

For local media storage, the defaults are enough:

```bash
STUDIO_MEDIA_STORAGE_PROVIDER="FILE"
STUDIO_MEDIA_STORAGE_LOCAL_ROOT="./.media-cache"
STUDIO_MEDIA_STORAGE_LOCAL_PUBLIC_URL="http://localhost:3000/media"
```

## 4. Prepare The Database

Apply existing migrations:

```bash
npm run db:migrate:deploy
```

Seed demo data:

```bash
npm run db:seed
```

The seed creates a demo account, sample websites, pages, component types, usage data, and this login:

```text
Email: seed@example.com
Password: SeedUser!234
```

## 5. Start The App

```bash
npm run dev
```

The default dev command disables the Workflow SDK route generator because it can repeatedly rewrite generated files during local development on Windows. Maintainers who need to work on Workflow routes can use:

```bash
npm run dev:workflow
```

Open:

```text
http://localhost:3000/sign-in
```

After signing in with the seed account, try:

```text
http://localhost:3000/dashboard
http://localhost:3000/studio/site-builder?websiteId=test-website
http://localhost:3000/studio/content-types?websiteId=test-website
http://localhost:3000/studio/preview/site/test-website
```

## Verification

Generate the Prisma client:

```bash
npm run db:generate
```

Generate the CMS component registry:

```bash
npm run build:components
```

Run the stable public smoke suite:

```powershell
$env:SKIP_DB_SETUP="true"; npm run test:ci
```

Verify the Docker quickstart path end to end:

```bash
npm run verify:quickstart
```

This requires Docker with Compose v2. It starts the Compose Postgres service, applies migrations, seeds the demo data, starts the app on port `3100`, and checks the seeded sign-in plus site-builder route. If you use your own PostgreSQL instance instead of Docker, run `npm run db:migrate:deploy`, `npm run db:seed`, and then sign in manually with the seed account.

Build the app:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/catalyst_studio"; npm run build
```

The build currently skips TypeScript validation through `next.config.ts`, matching the current application configuration. `npm run typecheck` and the full `npm run test` suite are available for maintainers, but they are not yet release-clean.

## Common Issues

- `docker` is not recognized: install Docker Desktop, or run your own PostgreSQL instance and keep the same connection strings in `.env`.
- Port `5432` is already in use: stop the existing database, or remap the Compose port, update `DATABASE_URL` / `DIRECT_URL` in `.env`, and set `CATALYST_STUDIO_DB_PORT` when running `npm run verify:quickstart`.
- Prisma is connecting to the wrong database: check `.env`; Prisma CLI commands load that file from the project root.
- `DATABASE_URL` missing during build: set `DATABASE_URL` in `.env` or in the shell before `npm run build`.
- Prisma migration connection issues: ensure `DIRECT_URL` points to a direct database connection, not a pooled runtime URL.
- AI import fails: verify `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`.
- Studio preview uses the built-in database-backed renderer by default and does not require Vercel Sandbox locally or on Vercel.
- Vercel Sandbox is optional. Use `sandbox=true` only after configuring a Vercel team/project with Sandbox access.

## Resetting Local Data

To remove the local database volume created by Compose:

```bash
docker compose down -v
```

Then start PostgreSQL again and rerun migrations and seed data:

```bash
docker compose up -d postgres
npm run db:migrate:deploy
npm run db:seed
```
