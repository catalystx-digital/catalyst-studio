# Brief: remove real site names from lines this work adds to the public repository

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files. Memory discipline: one Node process at a time, Jest with `--runInBand --forceExit` on one path at a time, leave no process running. Smallest correct change; no behaviour change at all.

## Why
This repository is public. Work from an earlier session (now part of this branch) added comments and test data that name real organisations whose sites were used for testing. Nineteen added lines in nine files, found with:
`git diff origin/main...HEAD --unified=0` filtered for site names. Files: `lib/studio/decisions/__tests__/decisions.test.ts`, `lib/studio/decisions/questions/page.ts`, `lib/studio/import/services/__tests__/web-tools-head-meta.test.ts`, `lib/studio/import/web-detection.ts`, `lib/studio/import/utils/json-parsing.ts`, `lib/studio/import/utils/__tests__/json-parsing.test.ts`, `lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts`, `lib/studio/import/detection/__tests__/section-aggregation.test.ts`, `lib/studio/import/__tests__/web-detection.test.ts`.

## Do
1. In COMMENTS: replace each real site or organisation name with a neutral description that keeps the engineering meaning ("a large hospital site", "one site's footer", "a member-portal page"), keeping the measured numbers. Remove named page titles of real organisations' sub-pages.
2. In TEST DATA: replace real URLs with `https://example.com/...` equivalents that exercise the same rule, and real page titles with invented ones of the same shape (the multi-line title test must still test a multi-line title with a colon).
3. Do NOT change behaviour. In particular the path rule in `lib/studio/decisions/questions/page.ts` that matches `/intranet/` and one site-specific path is live behaviour - leave the rule itself exactly as it is (it is a known site-specific leftover with its own ticket), but its tests may use `example.com` hosts.
4. Re-run the same search afterwards; the only remaining hit allowed is the path literal in that rule and the tests that must name it.

Verify: `npm run typecheck` 0 errors; one at a time: `SKIP_DB_SETUP=true npx jest lib/studio/decisions --runInBand --forceExit --silent`, `... lib/studio/import/detection ...` (exactly the 4 pre-existing failures), `... lib/studio/import/utils ...`, `... lib/studio/import/services/__tests__/web-tools-head-meta.test.ts ...`, `... lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts ...`, `... lib/studio/import/__tests__/web-detection.test.ts ...`.

Final message: plain English; the remaining hits, if any, and why.
