# Brief M3 fix round 1: replay must rebuild the page's styling map from what the snapshot holds

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files. The uncommitted M3 work is in this working copy (`docs/import/briefs/M3-lab-uses-production.md` is its brief). The owner's standard: no over-engineering, no slop, no over- or under-delivery, no dead code, as simple as possible. Memory discipline: at most one Node process at a time, Jest with `--runInBand --forceExit` one path at a time, leave no process running.

## Problem
You stopped the paid evaluation because the saved snapshots hold no styling map: the replay serves `fetchOutline` from disk, so the cache entry production fills with its `BackgroundImageMap` is empty, and the blocks harness needs that map. Re-snapshotting is not an option - the pages have changed since they were labelled, and the answer sheets are tied to the saved html.

Everything needed to rebuild the map is already saved per page: `page.html` and `stylesheets.json` (the text of each external stylesheet production fetched, in fetch order). Only each stylesheet's own URL is missing, and it matters for one thing: resolving relative `url(...)` values of background images. The hidden-by-class / hidden-by-id selectors and background colours - the parts that affect which content the model sees - need no URL.

## Fix (in the lab's replay only; no production change unless a function needs `export`)
1. When the replay answers `fetchOutline` for a saved page, rebuild the map with production's own functions: inline styles from `page.html` exactly as `fetchOutline` does, then each saved stylesheet text parsed with the same three parsers production applies to fetched CSS (background images, background colours, hidden selectors).
2. Base URL for a saved stylesheet's relative `url(...)`: pair the saved texts with the `<link rel="stylesheet">` URLs of `page.html` in document order, the way production chooses which stylesheets to fetch (same-origin, its limit on how many); when the counts do not line up, use the page's final URL as the base. Record in the run output which was used and how many stylesheets were paired. Do not invent anything beyond that.
3. Put the rebuilt map where production expects it (the cache entry read by the accessor M2a added), so the harness runs unmodified.
4. Remove the "missing maps" pre-spend check you added, or turn it into a check that the map was rebuilt. `snapshot.ts`: if you changed it to save stylesheet URLs for FUTURE snapshots, keep that (one field), and prefer saved URLs over pairing when present.
5. Test with an invented fixture: a snapshot with one linked stylesheet that hides a class and sets a relative background image -> the replayed page's map hides that class and resolves the image against the stylesheet link's URL; a snapshot whose counts do not line up falls back to the page URL and says so.

## Verify
`npm run typecheck` 0 errors; `SKIP_DB_SETUP=true npx jest scripts/experiments/import-lab --runInBand --forceExit` passes (`CHROMIUM_EXECUTABLE_PATH` as in the README for the browser tests); offline on the ten reviewed real pages (read-only data, never copy names or text out): the map rebuilds for every page - report per page by number: stylesheets saved, paired, base used, hidden selectors found, background images found; a dry run of `blocks-production` on one page still plans the expected calls.

## Final message
Plain English: what changed; the per-page table; the exact PAID commands for two runs on the ten reviewed pages; anything not done and why.
