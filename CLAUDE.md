# CLAUDE.md

This project is the open-source Catalyst Studio repository.

## Repository Rules

- Studio code belongs under `lib/studio/**`, `app/studio/**`, and `app/api/studio/**`.
- Shared code belongs in the existing shared locations such as `components/ui/**`, `lib/**`, and `hooks/**`.
- Use `@/lib/studio/...` for Studio imports.
- Do not add private deployment instructions, credentials, or internal work logs to this repository.

## Verification

- Run `npm run build:components` after changing component definitions.
- Use `npm run typecheck` for TypeScript verification.
- Use `$env:SKIP_DB_SETUP="true"; npm run test -- <path>` for Jest suites that do not need database setup.
