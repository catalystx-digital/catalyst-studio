# Brief: fix8 - attachment pages with a WordPress duplicate-number suffix

Same rules as `docs/import/briefs/fix8-menu-first-page-picking.md`. Amend the uncommitted change; smallest correct change, no dead code.

Evidence: a real 6-page import picked `/fig2-jpg-4/`. WordPress appends `-2`, `-3`, `-4` ... when an attachment slug repeats, so `isLikelyAttachmentPageUrl` (`lib/studio/import/services/sitemap-discovery.service.ts` ~57-60) misses it because it requires the segment to end in `-<ext>`.

Fix: allow an optional `-<digits>` after the extension (e.g. `/-([a-z0-9]+)(?:-\d+)?$/i`), still checked against `MEDIA_EXTENSIONS` only.

Test (first, confirm it fails): `/fig2-jpg-4/` and `/photo-png-12/` are attachment pages; `/top-10/`, `/site-map-2/`, `/web-design-2024/` are not.

Verify, quoting raw jest summary lines: `npx tsc --noEmit -p tsconfig.json`; `SKIP_DB_SETUP=true npx jest lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts --runInBand --forceExit`; `npm run test:import`.
