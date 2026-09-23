# Brief: fix7 review round 2 - two findings

Same rules as `docs/import/briefs/fix7-decision-question-allowlist.md`. Amend the uncommitted change in this working copy; smallest correct change, no dead code.

The reviewer reproduced:
1. **High** - `lib/studio/import/services/sitemap-discovery.service.ts` ~531: `priorityPaths: ['/staff-portal', '/STAFF-PORTAL/']`. The first check fails (`private-check-failed`); the second uses the fallback and injects the same URL, because `failedPrivatePaths` only holds failures from the sitemap pass. Fix: when a priority private check fails, add its `normalizedPath` to `failedPrivatePaths` (and skip any later duplicate of an already-handled normalized path).
2. **Medium** - ~275: when a URL is both in the sitemap and in `priorityPaths` and is private, merging priority skips records it twice (`"private-path":2` for one URL). Fix: deduplicate the merged skips by normalized URL (pathname lowercased, trailing slash removed) and reason.

Tests first (confirm they fail before the fix), in `lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts`: the duplicate-priority-path case; the sitemap+priority private URL counted once.

Verify, quoting raw jest summary lines: `npx tsc --noEmit -p tsconfig.json`; `SKIP_DB_SETUP=true npx jest lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts --runInBand --forceExit`; `npm run test:import`.

Final message: plain English - each fix with file:line, each new test, raw jest summary lines.
