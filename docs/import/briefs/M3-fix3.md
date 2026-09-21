# Brief M3 fix round 3: a page whose stylesheets fail to load must not be cut as if it were styled

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files. Memory discipline: one Node process at a time, Jest with `--runInBand --forceExit`, leave no process running. The owner's standard: no over-engineering, no slop, smallest correct change, no dead code.

## Evidence from the first real measurement (20 saved pages, two runs)
On nine of the ten original pages the production `blocks` harness reproduces the lab: the right component on 63-64% of blocks (lab with the same fill model: 67%; old path: 42%), median 19-24 seconds per page. One page failed completely: the cutter returned 43 blocks (the lab had 14) and the page hit the per-page cap. Cause, verified by running `renderAndCut` on it: every external stylesheet request failed (`net::ERR_ABORTED`) because the site has redeployed since the page was saved and its hashed stylesheet files no longer exist. The page rendered unstyled, yet the styling check passed because inline `<style>` rules had applied. So decision D4 ("a page that renders with no styling fails") has a hole, and saved evaluation pages decay as soon as a site redeploys.

## Fix
1. **Close the hole in the styling check** (`lib/studio/import/detection/blocks/block-cutter.ts`): when the fetched html declares external stylesheets and NONE of them loaded, throw `BlockCutError` naming how many were declared and that none loaded - regardless of inline styles. When some load and some fail, keep cutting and record the failures as issues, as today.
2. **Give the browser the stylesheets the importer already downloaded.** `fetchOutline` (`lib/studio/import/services/web-tools.ts`, around lines 1420-1435) already downloads the page's same-origin stylesheets to build the styling map. Keep each one's URL and text in the cache entry beside the map (released with it), expose them through the accessor M2a added, and let `renderAndCut` take an optional `stylesheets` list: a request whose URL matches one is fulfilled from that text instead of going to the network; everything else goes to the network as now. The harness passes them through. This makes the render consistent with what the importer read, saves requests, and lets a saved page be rendered after its site has changed.
3. **Lab replay** (`scripts/experiments/import-lab/`): when it rebuilds a saved page's styling map, also supply the saved stylesheet texts with the URLs it paired them to (or saved URLs when present), in the same cache entry. Pages whose stylesheets could not be paired get none, and say so in the run output.
4. Tests: all-external-stylesheets-failed with inline styles present -> `BlockCutError`; some failed -> issues recorded, no error; a supplied stylesheet is served without a network request (browser-backed test on the local fixture; skipped without Chromium); cache entry releases the texts on `release(handle)`.

## Out of scope
Images, fonts and scripts are not saved or served. No change to the cutting rule, the decision questions, the fill, or the old path.

## Verify
`npm run typecheck` 0 errors; `SKIP_DB_SETUP=true npx jest lib/studio/import/detection/blocks --runInBand --forceExit` (with `CHROMIUM_EXECUTABLE_PATH=C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe`), `... lib/studio/import/services/__tests__ ...`, `... scripts/experiments/import-lab ...` - one at a time, counts reported. `git diff -w lib/studio/import/web-detection.ts` unchanged by this round.

## Final message
Plain English: what changed, line counts added per file, test counts, anything not done and why.
