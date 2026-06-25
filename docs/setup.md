# Setup

This is the **detailed reference** for running Catalyst Studio locally.

> **For the fastest experience**, use the one-command quickstart in the main [README.md](../README.md). It is the recommended path for most people trying the project for the first time.

This document covers:
- Manual step-by-step setup
- Using your own PostgreSQL (instead of Docker)
- Advanced configuration and troubleshooting
- CMS export provider setup
- Media storage options

## Prerequisites

- Node.js 20 or newer
- npm (using the checked-in `package-lock.json`)
- Docker with Compose v2 (easiest database option)
- (Optional) PostgreSQL 14+ if you prefer to run it yourself
- (Optional) OpenRouter API key — **only needed for AI import, greenfield generation, and the in-builder assistant**

The seeded demo, visual site builder, preview, content types, and local rendering all work **without any AI key or external services**.

## 1. Quickest Path (Recommended)

See the **Quickstart** section in [README.md](../README.md). It boils down to a single command:

```bash
npm run verify:quickstart
```

This command starts the verification path (Docker Postgres + migrations + seed + app on port 3100), verifies the sign-in flow, then shuts the app and Compose services down. If port 3100 is already in use, set `CATALYST_STUDIO_APP_PORT` to another port. Use the manual setup below when you want to keep the app running for exploration.

## 2. Manual Step-by-Step Setup

### Start the Database

**Easiest option (Docker Compose):**

```bash
docker compose up -d postgres
```

This binds PostgreSQL to the host loopback interface only and gives you:

```text
postgresql://postgres:postgres@127.0.0.1:5432/catalyst_studio
```

To use a different local port, set `CATALYST_STUDIO_DB_PORT` before starting Compose, for example `CATALYST_STUDIO_DB_PORT=5433 docker compose up -d postgres`.

**Alternative: Use your own PostgreSQL**

Skip the Docker command above. Create a database named `catalyst_studio` and set these values in your `.env` file (see next step):

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/catalyst_studio"
DIRECT_URL="postgresql://user:pass@localhost:5432/catalyst_studio"
```

> Note: `DIRECT_URL` must be a direct (non-pooled) connection for Prisma migrations.

### Install Dependencies

```bash
npm ci
```

This also runs `prisma generate` automatically.

### Configure Environment

```bash
cp .env.example .env
```

The default values in `.env.example` already point at the local Docker Postgres container.

**Only two things most people ever need to change for local testing:**

1. `AUTH_SECRET` — set a random value (see below).
2. `OPENROUTER_API_KEY` — only if you want to try AI import/generation.

Generate a strong secret:

```bash
# macOS / Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Then set:

```bash
AUTH_SECRET="your-generated-secret-here"
```

AI features (optional):

```bash
OPENROUTER_API_KEY="your-openrouter-api-key"
OPENROUTER_MODEL="anthropic/claude-3.5-sonnet"   # or any supported model
```

### Apply Migrations + Seed Demo Data

```bash
npm run db:migrate:deploy
npm run db:seed
```

The seed creates the demo account:

```
Email:    seed@example.com
Password: SeedUser!234
```

It also creates a sample website ("test-website") with pages, components, and content types.

### Start the Development Server

```bash
npm run dev
```

> The default `dev` script disables the Workflow SDK plugin (it can rewrite files repeatedly on Windows). If you need to work on workflows, use `npm run dev:workflow` instead.

Open the app (default port 3000 after `npm run dev`; the quickstart verifier uses port 3100 only while it is running):

- Sign in: http://localhost:3000/sign-in
- Dashboard: http://localhost:3000/dashboard
- Site Builder: http://localhost:3000/studio/site-builder?websiteId=test-website
- Preview: http://localhost:3000/studio/preview?websiteId=test-website
- Content Types: http://localhost:3000/studio/content-types?websiteId=test-website

## Optional: CMS Export Providers

The local demo uses the built-in **mock** provider and works without any external credentials.

To test real exports, set `CMS_PROVIDER` and the matching credentials in `.env`. See the table and instructions in the main [README.md](../README.md) under "Export Providers".

You can also disable providers you don't want to show:

```bash
CMS_DISABLED_PROVIDERS="strapi,contentful"
```

## Media Storage (Local Development)

Defaults are already configured for local file storage:

```bash
STUDIO_MEDIA_STORAGE_PROVIDER="FILE"
STUDIO_MEDIA_STORAGE_LOCAL_ROOT="./.media-cache"
STUDIO_MEDIA_STORAGE_LOCAL_PUBLIC_URL="http://localhost:3000/media"
```

S3 configuration is available if needed (see `.env.example`).

## Verification & Maintenance Commands

```bash
npm run build:components     # Regenerate CMS component registry (required after editing components)
npm run db:generate          # Regenerate Prisma client
npm run typecheck            # TypeScript check
npm run test:ci              # Run the stable public test suite
```

**One-command full verification** (Docker + seed + start + check + cleanup):

```bash
npm run verify:quickstart
```

## Common Issues

- **Port 5432 already in use** — Stop the other Postgres or set `CATALYST_STUDIO_DB_PORT=5433 npm run verify:quickstart`.
- **Prisma can't connect** — Make sure `.env` is in the project root and `DIRECT_URL` is a direct connection (not pooled).
- **AI import fails** — Confirm `OPENROUTER_API_KEY` and that you have credits/quota on OpenRouter.
- **Preview looks wrong** — The built-in database-backed renderer is the default and does **not** require Vercel Sandbox. Use `?sandbox=true` only if you have a configured Vercel Sandbox.
- **Docker not found** — Install Docker Desktop or switch to a local Postgres instance.

## Resetting Everything

```bash
docker compose down -v
docker compose up -d postgres
npm run db:migrate:deploy
npm run db:seed
```

This completely resets the local database volume and re-seeds the demo content.

## Using Your Own PostgreSQL (No Docker)

1. Create the database `catalyst_studio`.
2. Set `DATABASE_URL` and `DIRECT_URL` in `.env`.
3. Run the normal steps: `npm ci`, `npm run db:migrate:deploy`, `npm run db:seed`, `npm run dev`.

## Next Steps

After you have the app running, the best way to understand the project is to explore the seeded demo in the visual site builder and preview. All the powerful features (AI import, visual editing, headless GraphQL, exports, etc.) are demonstrated there.

For contributor-focused information, see [architecture.md](architecture.md) and [AGENTS.md](../AGENTS.md).
