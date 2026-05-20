# Setup

## Prerequisites

- Node.js 20 or newer
- pnpm 9 or newer
- A database supported by the Prisma schema

## Install

```bash
npm ci
cp .env.example .env.local
npm run db:generate
npm run dev
```

The default Studio entry point is `/studio/site-builder`.

## Tests

```powershell
$env:SKIP_DB_SETUP="true"; npm run test -- --runInBand
```

Use Playwright for browser coverage:

```bash
npm run test:e2e
```
