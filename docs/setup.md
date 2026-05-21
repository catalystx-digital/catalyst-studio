# Setup

This guide gets Catalyst Studio running locally from a fresh clone.

## Prerequisites

- Node.js 20 or newer
- npm, using the checked-in `package-lock.json`
- PostgreSQL 14 or newer for local development, or Neon Postgres for hosted deployments
- Optional: an OpenRouter API key for AI-assisted import and generation

## 1. Install Dependencies

```bash
npm ci
```

`npm ci` runs `prisma generate` through the project postinstall script.

## 2. Configure Environment

```bash
cp .env.example .env.local
```

Update at least these values in `.env.local`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/catalyst_studio"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/catalyst_studio"
AUTH_SECRET="replace-with-a-random-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

For Neon, use the pooled connection string for `DATABASE_URL` and the direct non-pooler connection string for `DIRECT_URL`.

AI features require:

```bash
OPENROUTER_API_KEY="your-openrouter-api-key"
OPENROUTER_MODEL="anthropic/claude-3.5-sonnet"
```

For local media storage, the defaults are enough:

```bash
STUDIO_MEDIA_STORAGE_PROVIDER="FILE"
STUDIO_MEDIA_STORAGE_LOCAL_ROOT="./.media-cache"
STUDIO_MEDIA_STORAGE_LOCAL_PUBLIC_URL="http://localhost:3000/media"
```

## 3. Prepare The Database

Generate the Prisma client:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate
```

Seed data when needed:

```bash
npm run db:seed
```

## 4. Start The App

```bash
npm run dev
```

The default dev command disables the Workflow SDK route generator because it can repeatedly rewrite generated files during local development on Windows:

```bash
npm run dev
```

Maintainers who need to work on Workflow routes can use `npm run dev:workflow`.

Open:

```text
http://localhost:3000/studio/site-builder
```

Create the first user at:

```text
http://localhost:3000/sign-up
```

## Verification

Run the stable public smoke suite:

```powershell
$env:SKIP_DB_SETUP="true"; npm run test:ci
```

Build the app:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/catalyst_studio"; npm run build
```

The build currently skips TypeScript validation through `next.config.ts`, matching the current application configuration. `npm run typecheck` and the full `npm run test` suite are available for maintainers, but they are not yet release-clean.

## Common Issues

- `DATABASE_URL` missing during build: set `DATABASE_URL` in `.env.local` or in the shell before `npm run build`.
- Prisma migration connection issues: ensure `DIRECT_URL` points to a direct database connection, not a pooled runtime URL.
- AI import fails: verify `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`.
- Studio preview uses the built-in database-backed renderer by default and does not require Vercel Sandbox locally or on Vercel.
- Vercel Sandbox is optional. Use `sandbox=true` only after configuring a Vercel team/project with Sandbox access.
