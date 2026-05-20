# AGENTS.md

These repository rules apply to all automated and human contributors.

## Development Expectations

- Ground feature work and bug fixes in code, tests, logs, or reproducible behavior.
- Keep changes scoped to the requested behavior.
- Prefer existing project patterns over new abstractions.
- Do not mask runtime failures with silent fallbacks.
- Update or add focused tests when behavior changes.

## Directory Conventions

- Studio application code lives in `lib/studio/**` and `app/studio/**`.
- Studio API routes live in `app/api/studio/**`.
- Shared UI lives in `components/ui/**`.
- Shared utilities live in `lib/**`.
- Shared hooks live in `hooks/**`.

## Import Rules

- Studio imports use `@/lib/studio/...`.
- Shared imports use standard aliases such as `@/components/ui/...` and `@/lib/utils`.
- Do not introduce legacy private namespace paths.

## Visual Editing Model

- Component templates are reusable definitions.
- Page component hierarchy and ordering live in `WebsitePage.content` JSON.
- Page/site hierarchy lives in `WebsiteStructure`.
- Add, delete, drag, drop, and reorder operations mutate page content JSON, not template definitions.

## Test Notes

- Many Jest helpers expect Prisma migrations to be skipped.
- PowerShell: `$env:SKIP_DB_SETUP="true"; npm run test -- <path>`
- Bash/macOS/Linux: `SKIP_DB_SETUP=true npm run test -- <path>`
