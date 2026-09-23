# Brief: fix7 review round 1 - three findings

You are a coder with one bounded task. Not an orchestrator. Same rules as `docs/import/briefs/fix7-decision-question-allowlist.md` (read it): no commit/stage/push, no internet, no paid calls, no `.env*` except `.env.example`, no imports or database, one Node process at a time, Jest with `SKIP_DB_SETUP=true --runInBand --forceExit`. The uncommitted fix7 change in this working copy is yours to amend; keep it otherwise intact. Smallest correct change, no dead code.

An independent reviewer found, and reproduced:

1. **High - priority injection re-adds a URL whose private check failed.** `lib/studio/import/services/sitemap-discovery.service.ts` ~520: `/staff-portal/` fails its model check in `filterReachableUrls` and is skipped with `private-check-failed`. If it is also in `priorityPaths`, `injectPriorityUrls` checks it again with the fallback rule (state already failed), passes, and injects `/staff-portal`. A URL that failed its check must stay excluded. Fix: carry the set of URLs excluded as `private-check-failed` (normalized the same way `injectPriorityUrls` compares paths, so trailing slash and case do not matter) into priority injection and refuse to re-insert them.
2. **Medium - a failure during priority injection loses its skip reason.** ~522: when the first failure happens on an injected priority URL, it is excluded but not recorded in `skipped`, so the empty-result warning undercounts. Fix: `injectPriorityUrls` returns its skips and discovery merges them into `skipped`, with `private-check-failed` for failures (and `private-path` for fallback-private).
3. **Low - harness error message.** `lib/studio/import/web-detection.ts` ~1026: the error should also say both `import.block.component` and `import.block.multiple` must be enabled through `DECISION_MODEL_QUESTIONS` (empty/unset enables them by default).

Tests (write first, confirm they fail before the fix) in `lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts`:
- a URL failing its check in the sitemap pass, also listed in `priorityPaths` without its trailing slash → not in the result.
- first failure on a priority URL → excluded and present in `skipped` with `private-check-failed`.

Verify, quoting raw jest summary lines: `npx tsc --noEmit -p tsconfig.json`; `SKIP_DB_SETUP=true npx jest lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts --runInBand --forceExit`; `SKIP_DB_SETUP=true npx jest lib/studio/decisions --runInBand --forceExit`; `npm run test:import`.

Final message: plain English - each fix with file:line, each new test, the raw jest summary lines.
