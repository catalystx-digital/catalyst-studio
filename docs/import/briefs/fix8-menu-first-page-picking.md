# Brief: a capped import picks the site's menu pages first, then spreads across the sitemap

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files, never run `scripts/standalone-import.ts` or anything touching a database. Memory discipline: one Node process at a time, Jest with `--runInBand --forceExit` on one path at a time, always with `SKIP_DB_SETUP=true`, leave no process running. Smallest correct change, no dead code, match the surrounding style. Other uncommitted changes in this working copy must be kept.

## Evidence
`expandUrlsForImport` in `lib/studio/import/services/sitemap-discovery.service.ts` (~lines 219-256) orders sitemap entries with `compareEntries` (~353-379): home, then sitemap `priority` when both publish one, then shallower paths, then alphabetical. `filterReachableUrls` then takes the first `maxUrls` that pass. On one real site a 6-page import took five machine-named image pages because they sorted first; after `-jpg` attachment pages were filtered, it took five other machine-named figure pages. `docs/import/block-detection-plan.md` section 5d lists three options; the founder chose: **prefer pages in the site's own navigation, then spread the rest across the sitemap.**

The home page HTML is already fetched at ~line 219 (only to look for `<link rel=sitemap>`). `extractLinksFromHtml` (~1148) is a regex over every `<a>` and does not know which links are navigation. `parse5` is already a dependency (`lib/studio/import/detection/blocks/block-input.ts:1`).

## Changes
1. Keep the home HTML from the existing fetch. Add one small pure, exported helper (same file or a sibling module under `lib/studio/import/services/`), e.g. `extractNavigationUrls(html, origin): string[]`: parse with `parse5`; collect `href`s of `<a>` elements that sit inside a `<nav>` or `<header>` element (or an element with `role="navigation"`), in document order; resolve against origin; keep same-host only; drop `#`, `javascript:`, `mailto:`, `tel:`; dedupe; top-level first (links whose nearest list ancestor is the outermost list in that nav come before nested dropdown links, preserving document order within each level). Pure: no fetching, no logging.
2. Build the candidate order **before** `normalizeAndDedupeUrls` / `filterReachableUrls` (~252-254), so every nav link still goes through the private, asset, attachment and reachability checks:
   `homeUrl` → nav links (menu order) → remaining sitemap entries in a **spread order**.
   Nav links count whether or not they appear in the sitemap. `priorityPaths` injection (~259) is unchanged and still takes precedence.
3. Spread order: take the remaining entries sorted by the existing `compareEntries`, then emit a stride permutation of the whole list: with `n` entries and cap `k`, stride `s = max(1, floor(n / k))`, emit indices `0, s, 2s, …`, then `1, 1+s, …`, and so on until every entry is emitted once. It is a permutation of the whole list, not a subset, so a rejected URL is replaced by later ones. Pure exported helper with its own test.
4. Menus built by JavaScript are not in the fetched HTML; then the nav list is empty and the order is home → spread. Note this in one comment.

## Tests (write first; confirm they fail on unchanged code) - `lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts`
1. `extractNavigationUrls`: header/nav links in document order, top-level before nested dropdown links, external/mailto/`#` dropped, deduped.
2. Spread helper: permutation of the whole list; first `k` items spaced across the list; `n <= k` returns the input order.
3. Discovery end to end with mocked fetches (follow the file's existing mocking): sitemap of 100 machine-named pages sorting first alphabetically (`/08-01/`, `/08-02/`…) plus 5 article pages; home HTML with a nav linking 3 of the articles; cap 6 → result is home + the 3 nav articles first, and none of the first 6 is from a contiguous alphabetical run.
4. No nav in home HTML → home + spread order.
5. A nav link that is an asset or attachment page is still rejected.

## Verify (quote raw jest summary lines in your final message)
- `npx tsc --noEmit -p tsconfig.json` → 0 errors.
- `SKIP_DB_SETUP=true npx jest lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts --runInBand --forceExit`
- `SKIP_DB_SETUP=true npx jest lib/studio/import/utils --runInBand --forceExit` (the script's `prioritizeUrls` must still pass).
- `npm run test:import` - report pass/fail counts.
- Revert check: temporarily restore the old ordering line, confirm test 3 fails, restore.

Final message: plain English - each change with file:line, each test name, the raw jest summary lines.
