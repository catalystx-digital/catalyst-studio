# Catalyst Studio

Catalyst Studio is an open-source AI-assisted website and CMS studio built with Next.js, React, Prisma, and the Vercel AI SDK. It includes tools for importing websites, building page structures, editing CMS-style components, previewing generated experiences, and exporting site output.

## Features

- AI-assisted website import and page generation
- Visual site builder at `/studio/site-builder`
- CMS component library and component registry generation
- Universal content and page structure models
- Headless preview and generated-head tooling
- Prisma-backed persistence with Supabase-compatible configuration

## Getting Started

```bash
npm ci
cp .env.example .env.local
npm run db:generate
npm run dev
```

Open `http://localhost:3000/studio/site-builder`.

Most tests that do not need a real database should run with Prisma setup skipped:

```powershell
$env:SKIP_DB_SETUP="true"; npm run test -- --runInBand
```

## Useful Scripts

- `npm run dev` - generate the component registry and start Next.js.
- `npm run build` - generate the component registry and build the app.
- `npm run typecheck` - run TypeScript checks.
- `npm run test` - run Jest tests.
- `npm run test:ci` - run the stable public CI smoke suite.
- `npm run test:e2e` - run Playwright tests.

## Documentation

- [Setup](docs/setup.md)
- [Architecture](docs/architecture.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)

## License

Catalyst Studio is licensed under the [Apache License 2.0](LICENSE).
