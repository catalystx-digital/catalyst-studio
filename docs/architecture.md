# Architecture

Catalyst Studio is a Next.js application with App Router pages, API routes, Prisma persistence, a CMS component registry, and AI-assisted import workflows.

## Main Areas

- `app/studio/**` - user-facing Studio pages.
- `app/api/studio/**` - Studio API routes.
- `lib/studio/**` - Studio components, stores, import services, media services, and headless rendering support.
- `components/ui/**` - shared UI primitives.
- `scripts/**` - registry generation, export, evaluation, and utility scripts.
- `prisma/**` - database schema, migrations, and seed data.

## Content Model

- Component templates define reusable component capabilities.
- Page content stores component instances and layout ordering as JSON.
- Website structure stores page hierarchy and routing metadata.

## Generated Registry

Run `npm run build:components` before development and builds. This updates the generated component registry consumed by the Studio runtime.
