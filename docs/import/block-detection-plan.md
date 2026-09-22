# Plan: block-based page detection for the website importer

Status: approved by the owner on 21 September 2026. Milestones 1-4 are done (section 6); 5 and 6 need the owner. Route: hand-driven Codex on a separate working copy; the orchestrating session writes each brief, verifies the result itself, and the owner approves each milestone. Nothing is pushed without the owner saying so.

## 1. What is being built, in one paragraph

Today the importer cuts a page every 12,000 bytes and sends each slice to one AI call that must choose among about 22 component types and fill everything in, then about 27 repair steps patch the result. Measured on 10 real pages (116 scored blocks): the right component on 43% of blocks, 11-35 minutes per page, and page pieces lost whenever a call exceeds five minutes. The new path: a headless browser renders the fetched page and plain code cuts it into the visual blocks a visitor sees; a decision model picks the component for each block; a small fast model fills one block per call, all blocks at once; stalled calls are retried; no repair code runs. Measured in the lab: the right component on 65-68% of blocks in 10-30 seconds per page. This plan puts that path into the real importer behind the existing harness setting, proves it, then deletes the old path.

## 2. Decisions already made (not open for the implementer)

| # | Decision |
|---|---|
| D1 | The switch is the existing setting `IMPORT_DETECTION_HARNESS` (`lib/studio/import/config/import-config.ts:414`). A third value `blocks` is added. Default stays `section`. No other on/off switch is introduced. |
| D2 | The new code branches at the existing harness switch in `lib/studio/import/web-detection.ts` (the ternary near line 1805) and returns the same `SectionProcessingResult[]` the other two branches return, so everything after it (aggregation, page metadata from the head, page template choice, checkpoints, progress, telemetry, cost) is reused unchanged. |
| D3 | Block cutting reuses the browser the importer already ships: `playwright-core` + `@sparticuz/chromium` as launched by `lib/studio/design-system/dom-probe/`. No second browser stack. It renders the FETCHED html served at the page's final URL (request interception), not a fresh visit to the live site, so blocks map onto the html the importer holds. JavaScript on by default; if fewer than 80% of block anchors resolve against the fetched html, the page is cut again with JavaScript off. |
| D4 | If the browser cannot start, or the page renders with no styling applied, the page import FAILS with a clear diagnostic. It does not fall back to the old path (the old path is going away) and nothing is hidden. |
| D5 | The decision model is asked through the existing registry (`lib/studio/decisions`): a new question `import.block.component@1`, type choice, options = every page-level component type with its catalogue summary, plus the yes/no `import.block.multiple@1`, both in one request per block. |
| D6 | Fixed rule, not configurable: if the top choice is at least twice as likely as the second, the fill model is offered that one type; otherwise the top three; if "more than one component" is at least 0.5, the top three. |
| D7 | `blocks` needs the decision model live. If `IMPORT_DETECTION_HARNESS=blocks` while the decision model is disabled or in shadow mode, detection stops at start with a configuration error naming the two variables. It never runs quietly on fallback answers. If a single decision call fails or times out, that block is offered the component types production's own candidate selection gives (`candidate-types.ts` / section taxonomy) and the answer's `source` is recorded as it is today. |
| D8 | Fill model: new setting `IMPORT_BLOCK_FILL_MODEL`, default `inception/mercury-2.5`. Concurrency: new setting `IMPORT_BLOCK_CONCURRENCY`, default 8. Stall timeout 120 seconds and 2 infrastructure retries (same request re-sent after a timeout or a cut-off reply) are constants in code. One validation-repair retry, as today. |
| D9 | A block that still fails after retries is dropped and reported through the existing section-error checkpoint and diagnostics; the rest of the page survives; a page with zero surviving components still fails - the same policy the section path has today. |
| D10 | The repair step `adjustDetectedComponents` (`lib/studio/import/services/import-result-handler.ts` near line 548) is skipped when the detection result says it came from `blocks`. The result carries the harness name; the skip is conditioned on that field, never on a global. |
| D11 | New code lives in `lib/studio/import/detection/blocks/`. The production functions the lab currently reaches by rewriting source text become real exports (public exports in `services/web-tools.ts`, `web-detection.ts` and `detection/prompt-builder.ts`). |
| D13 | Blocks cover what a visitor sees, including content the old path never looked at. The old path reads only the `header`, `main` and `footer` elements; on the 20 evaluation pages 15 blocks (a navigation bar beside `main`, a form in a section outside `main`) lie outside them. The block path imports these blocks. This is a deliberate difference, already present in the lab measurements the plan rests on, and the reason block content is compared with the old path per node, not by position. |
| D12 | "Proven" means: the lab shows the new path better than the old on a wider page set, and three full real site imports the owner looks at come out better. Then the old path is deleted in one step (milestone 6). |

## 3. Milestones

Each milestone is one or more Codex briefs. The orchestrator re-runs typecheck and tests itself and checks real output before reporting. Estimates are working days.

### M1 - Prove the browser works where the importer is deployed (1-2 days) - biggest risk first
- Work: make Chromium start in the deployed container. `Dockerfile` (node:24-bookworm-slim) installs no browser and no system libraries, and `isServerless()` (`lib/studio/design-system/dom-probe/serverless-config.ts:22`) is false there, so the launcher looks for a bundled browser that is not present. Choose the smaller fix after testing both: set `SERVERLESS=true` in the image so `@sparticuz/chromium` is used, or install Chromium's system libraries. Extract the launch code the DOM probe uses into one shared function used by both the probe and the block cutter.
- Acceptance: a script in the built image launches the browser, renders a local fixture page served at a fake URL through interception, and prints block boxes; documented memory use for one page; the existing DOM-probe tests still pass.
- Verification checklist: [ ] image builds; [ ] launch succeeds inside the container; [ ] launch failure produces the D4 diagnostic; [ ] no new dependency added.

### M2 - The `blocks` harness behind the setting (4-6 days)
Files (all under `lib/studio/import/detection/blocks/`): `block-cutter.ts` (browser render + the pure cutting rule ported from the lab's `block-proposal.ts`), `block-input.ts` (a block's DOM subtree -> the production node list, with CSS enrichment aligned by document order), `block-pick.ts` (the two questions + rule D6), `block-extract.ts` (prompt for the allowed types only, fill model, stall retry, validation repair), `block-harness.ts` (runs a page: cut -> pick all blocks -> extract all blocks with the concurrency limit -> `SectionProcessingResult[]`). Plus: the two questions in `lib/studio/decisions/questions/import-block.ts`; config keys in `import-config.ts`; the third branch in `web-detection.ts`; the harness name on `ImportDetectionResult`; the skip in `import-result-handler.ts`.
- Each block becomes one task in the page plan (`savePagePlan`) with key `block:<order>` and the block's region as its role, so checkpoints, resume, progress and aggregation work as they do for sections. The "header must yield a navigation bar, footer must yield a footer" rule in `detection/section-aggregation.ts` is evaluated per region, not per block.
- Header and footer blocks use the existing per-import reuse cache (`detection/global-section-cache.ts`), keyed as today by content hash, candidate types and model.
- Acceptance: with the setting unset, behaviour is identical to today - proven by (a) a test that the default is `section`, (b) a test that no module under `detection/blocks/` is loaded and no browser launches on the `section` path, (c) the two existing branches of the switch unchanged in the diff; with `blocks`, a fixture page imports end to end offline with fake model clients, including: one block timing out then recovering, one truncated reply then recovering, one block exhausted and dropped with a diagnostic, decision failure falling back to candidate types (D7), shadow-mode start error (D7), unstyled render failure (D4), resume from checkpoint after a crash mid-page.
- Verification checklist: [ ] `npm run typecheck` 0 errors; [ ] new unit tests pass; [ ] `lib/studio/import/detection` suite: no new failures against the recorded baseline (today: 124 tests, 4 failing in `response-parser.test.ts`); [ ] no file outside the listed ones changed except the ~14 added exports.

### M3 - Measure the real implementation with the lab (1 day)
- Work: the lab's `blocks-production` arm calls the production harness; remove duplicate input, extraction and picking implementations and all production-source rewriting. Retain historical results and labelling-only proposals.
- Acceptance (same 10 pages, same answer sheet, two runs): component right on at least 60% of scored blocks in both runs (lab copy: 65-68%); at most 20 missed blocks; median page time at most 60 seconds; no call left hanging past the stall rule; summary regenerated.

### M4 - A wider page set (2 days + about 30 minutes of the owner's time)
- Work: add 10 pages the current set lacks - articles, listing pages, a form page, a pricing page, a non-English site - using the lab runbook; labels drafted by the labelling model and spot-checked by the owner on the review page (the owner may accept without block-by-block review; the summary records who reviewed what).
- Acceptance: on the 20 pages the new path beats the old on "component right" by at least 10 points and misses fewer blocks; results reported per page, held-out pages separately.

### M5 - Three real imports (1 day + the owner looking at the results)
- Work: three complete site imports with `IMPORT_DETECTION_HARNESS=blocks` in a staging environment, each also imported with the old path for comparison; a one-page side-by-side per site: pages imported, time, cost, blocks dropped, and screenshots of three pages each.
- Acceptance: the owner says the new imports are better on all three.

### M6 - Delete the old path (2-3 days) - the cleanup this plan exists for
Split in two, because the owner still needs the old path for the M5 comparison. **M6a (done, commit `53fbaad`):** the parts nothing reaches - the `page-map` branch and its settings, the template-generation and review cluster, the template import API route, the pipeline's template step. 10,952 lines removed, 39 added. **M6b (waiting on the owner's M5 verdict):** the rest of the list below.

Delete, in one change: the `section` and `page-map` branches and everything only they use (byte slicing in `web-tools.ts`, the page-map harness, the multi-type prompt assembly, candidate regex expansion if unused); the repair code `lib/studio/import/services/detection-post-processor/` and its caller path (about 10,600 lines) including the DOM-snapshot hand-off that exists only to feed it; the template-generation and review cluster the earlier audit found unused (about 4,900 lines plus about 2,400 lines of tests); the `IMPORT_DETECTION_HARNESS` setting itself; the old benchmark folder `scripts/eval/jev/`; the lab's replay of the old path (its saved results stay as history in the git-ignored data).
- Acceptance: typecheck 0 errors; test suites pass with the deleted tests removed; an import works end to end; a search for each deleted symbol returns nothing; the change reports lines removed against lines added.

Total: about 11-15 working days plus the owner's review time.

## 3a. Getting the work onto main

The repository is public. The two local work branches carry, in earlier commits, a removed folder that named real sites, so they are never pushed. After M3 the orchestrator builds a fresh branch from the latest remote main holding the same final files as a handful of clean commits in which that folder never appears; the owner pushes it and opens the pull request; CI runs, including the container browser check from M1; the owner merges. M4-M6 then run from main on short-lived branches, and the two local work branches and the separate working copy are deleted.

## 4. Not part of this plan
- Simplifying the component list (measured separately: 16 families would lift "component right" from 64% to about 72%). It is its own project; this plan works with the 50 types as they are.
- Improving "right component, content incomplete", the largest remaining loss (about 45% of blocks). The "decision model points, code copies" approach was tested and lost for now (54% right, 32% of text kept); revisit after the component list is simpler.
- Calling the decision model vendor directly instead of through OpenRouter.

## 5. Risks

| Risk | Handling |
|---|---|
| The browser does not run in the deployed image | M1 exists to settle this before anything else is built. |
| Memory: one Chromium per page import | M1 records the footprint; the cutter closes the browser in `finally`; pages are cut one at a time per import job. |
| The decision model endpoint is an early-access path from one vendor, 15-second timeout, no retry | D7: a failed decision degrades that block to production's own candidate types, recorded honestly. A contract test pins the request and reply shape; a version change fails the test. |
| Rate limits with 8 blocks at once across several pages | `IMPORT_BLOCK_CONCURRENCY`; 429 replies back off and retry inside the infrastructure-retry budget. |
| Twenty pages is still a small sample | M5's real imports are the second proof; the lab stays available to re-measure at any time. |
| The branch this work sits on has 37 unpushed commits and is behind the remote main | Before M2: fetch, decide with the owner whether to rebase, and take the customer-naming benchmark folder out (M6 deletes it anyway). |

## 5a. Found by real imports (22 September 2026) - open decisions

Running complete imports (detection, page building, database) found defects the lab and the tests could not, because they stop at detection. Fixed on this branch: the page builder rejected the new page-template provenance values; the old path's per-page cap was applied to blocks; region-bound components from blocks reached the page builder in the wrong region; the block cutter's geometric region was stamped on components; the substring rule that infers a region from a type name sent article headers to the header region; the decision model's page-template choice was accepted without the route check the deterministic scorer applies.

Two things need the owner:
- `IMPORT_DETECTION_HARNESS=blocks` requires `DECISION_MODEL_ENABLED=true`, and that also activates the older questions registered in `lib/studio/decisions` (`page.type`, `page.isInternal`). `page.isInternal` can exclude pages from an import. On tonight's imports it was asked 62 times and excluded none, but it is live. Recommendation: the blocks harness enables only its own two questions (per-question gating) - a small change, not made without a decision.
- The pull request's CI fails at the production dependency audit (`npm audit --omit=dev --audit-level=high`) on packages this branch did not change (an AI SDK helper, an XML library); the advisories are newer than main's last CI run. Dependency updates are outside this plan.

## 6. Results so far (21 September 2026)

| Milestone | Outcome |
|---|---|
| M1 | One shared browser launcher; the Docker image installs the headless browser; CI builds the image and runs a render check inside it. The container check has not run yet - it runs in CI on the first push. |
| M2 | The `blocks` harness is in the importer behind `IMPORT_DETECTION_HARNESS=blocks`, off by default. With the setting unset nothing new is loaded and the two existing paths are unchanged. |
| M3 | The experiment lab now measures the production code; its own copy of the logic is deleted. Running real pages found and fixed: browser functions breaking under esbuild-based runtimes, a page with no loaded stylesheets being cut as if styled, internal links rejected for a missing `pageId`, a crash on a provider reply without choices, and complete answers discarded for trailing text. |
| M4 | Evaluation set widened from 10 to 20 pages (articles, listings, contact and form pages, pricing, a restaurant; half held out). |
| M5 | Three complete imports on the blocks harness, 6 pages each, 55-149 seconds per site, all written to the database. The old path was tried on two of the same sites and aborted after 40 and 48 minutes (a header or footer produced no components, and one failed page aborts the whole import), so the comparison is new-path pages against nothing. Six defects in the hand-over to page building were found and fixed (section 5a). The owner's look at the pages is outstanding. |
| M6a | 10,952 lines deleted, 39 added: the never-default `page-map` path and its settings, the template-generation and review cluster, the template import API route, the pipeline's template step. Independently reviewed: no surviving reference, the two remaining paths byte-identical, no weakened tests. |

Measured with the final code, two runs on all twenty saved pages, about 14 cents a run, labels drafted by a labelling model and accepted by the owner without block-by-block review:

| | Original 10 pages (116 blocks) | New 10 pages (123 blocks) | All 20 |
|---|---|---|---|
| Old path: right component | 50 (43%), 34 missed | 16 (13%); it failed outright on two of the ten pages | 28% |
| Blocks harness, run 1 | 76 (65%), 16 missed | 80 (65%), 15 missed | 65% |
| Blocks harness, run 2 | 78 (67%), 18 missed | 77 (62%), 19 missed | 65% |
| Median page time | 18-21 seconds (old path: 11-35 minutes) | | |

M3 acceptance (at least 60% in both runs, at most 20 missed, median under 60 seconds) and M4 acceptance (at least 10 points better than the old path, fewer missed) are met.

Still open, recorded as separate proposals and not done: the largest remaining loss is "right component, content incomplete" (about 45% of blocks); about 28 blocks per two runs are still dropped for failed validation (unknown fields on contact blocks, missing body on text blocks, enum values); a simpler component list (16 families) would lift "right component" by about 8 points; five private copies of one small path-to-id function could be one.
