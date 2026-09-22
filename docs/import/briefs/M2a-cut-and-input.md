# Brief M2a: cut a fetched page into visual blocks and build each block's model input - production code

You are a coder with one bounded task. You are not an orchestrator: do not run any engine, preflight or front-door tooling. Do not commit, stage, push or branch. No internet and no paid calls from anything you run. Never read `.env*` files. Read `docs/import/block-detection-plan.md` first (decisions D2, D3, D4, D11 and milestone M2). This brief is the first half of M2. Do NOT wire anything into `web-detection.ts`, do NOT add decision-model questions, config keys or model calls - that is the next brief.

The owner's standing rules: no over-engineering, no slop, deliver exactly what is asked - no more, no less; clean up after yourself; no dead code; as simple as possible. Match the style, naming and comment density of the surrounding production code. No new dependency.

## Source to port from
The experiment lab has working, tested reference code: `scripts/experiments/import-lab/block-proposal.ts` (the pure cutting rule and anchor resolution), `propose-blocks.ts` + `lab-browser.ts` (rendering the saved HTML at its final URL through request interception, the scroll sweep, the styling check, the geometry capture), `block-input.ts` (a block's DOM subtree -> production's node list, CSS enrichment aligned by document order) and `production-access.ts` (which lists, at its top, every non-exported production function the lab reaches). Port the logic; do not import from `scripts/` in production code. Leave the lab files untouched in this brief.

## Build, all under `lib/studio/import/detection/blocks/`
1. `block-cutter.ts`
   - `cutRenderedPage(geometry): Block[]` - the pure rule, ported as is: ignore empty/tiny children; group children into rows by vertical overlap; cut a node taller than 700 px that has two or more rows; a row of side-by-side children is one block unless it is taller than 700 px with a column at least twice as wide as the others; heading-only rows merge forward; consecutive rows with the same column layout merge (up to 1,500 px); header capped at 300 px; footer only when the element is a footer; blocks over 1,500 px are kept and flagged. Constants named and exported once.
   - `renderAndCut({ html, finalUrl, javascript }): Promise<CutResult>` - launches through the single launch function from M1 (`lib/studio/design-system/dom-probe/`), serves `html` as the document at `finalUrl` via interception while other requests go to the network, viewport 1440 wide, bounded scroll sweep (10 s budget), measures geometry in ONE browser evaluate that returns only what the cutting rule needs (tag, id, classes, box, own-text length, visibility, child links) - NOT every element's outerHTML and NOT a screenshot, closes the browser in `finally`. Returns blocks (each with order, region, anchor path into the fetched html, box), the share of anchors that resolve against the fetched html, and issues.
   - Decision D3: if fewer than 80% of anchors resolve with JavaScript on, render once more with JavaScript off and use that result; record which was used.
   - Decision D4: browser launch failure, or stylesheets declared but none applied, throws a `BlockCutError` with a plain message; no fallback.
2. `block-input.ts`
   - `buildBlockInput({ html, outlineSections, block })` - resolves the block's anchor in the fetched html and returns the block's content in exactly the node-list form production sends to the model today, reusing production's own traversal and enrichment functions. CSS-derived enrichment is taken from the already-computed production nodes for the page by aligning node sequences in document order (k-th occurrence for repeated identical runs); nodes with no match proceed without enrichment and the counts are returned. An unresolved anchor throws.
   - A block too large for one call is split at its child-block boundaries, never at a byte midpoint.
3. **Exports.** Turn the non-exported production functions this needs into real exports, exactly the ones listed at the top of the lab's `production-access.ts` that these two modules use (in `lib/studio/import/services/web-tools.ts` and wherever else they live). Add the `export` keyword only - do not move, rename or restyle them. List each one in your final message.
4. **Tests** beside the code, ported and trimmed from the lab's `block-proposal.test.ts` and the block-input tests: every cutting rule from invented geometry trees; anchor resolution; the 80% JavaScript rule; the two `BlockCutError` cases with the browser mocked; block input equals production's node list for a fixture section; alignment with repeated identical runs; unmatched nodes proceed; unresolved anchor throws; split at child boundary. One browser-backed test on a local fixture served through interception, skipped with a clear message when no Chromium executable is configured. Invented example.com fixtures only.

## Out of scope (do not do)
Decision-model questions, picking rule, prompts, model calls, retries, the harness, `web-detection.ts`, `import-config.ts`, `import-result-handler.ts`, the lab, README files, any refactor of `web-tools.ts` beyond adding `export`.

## Verify yourself
- `npm run typecheck`: 0 errors.
- The new tests pass: `SKIP_DB_SETUP=true npx jest lib/studio/import/detection/blocks --runInBand` (browser test with `CHROMIUM_EXECUTABLE_PATH` set to `C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe`).
- `SKIP_DB_SETUP=true npx jest lib/studio/import/detection --silent`: no new failures (baseline: 124 tests, 4 failing in `response-parser.test.ts` before your change).
- Offline equivalence on real saved pages (git-ignored data, read-only, never copy names or text out of it): for every page under `.import-lab/labels/*/geometry.json`, `cutRenderedPage` returns the same blocks (same anchors, same order, same regions) as the lab's saved `blocks.json`; and for every block, `buildBlockInput` returns the same node list as the lab's `block-input.ts` does. Report per page: blocks, identical yes/no. Do this with a throwaway script you delete afterwards.
- `git status` shows only files this brief needs.

## Final message
Plain English: files added; every `export` keyword added (file:line); the equivalence table; what could not be verified offline; anything in this brief you judged unnecessary and did not do, with the reason.
