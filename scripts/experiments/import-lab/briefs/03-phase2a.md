# Task: Phase 2a of the import lab - the answer sheet and the per-block scorer

You are a coder with one bounded task. You are not an orchestrator. Do not commit, stage, push or branch. Leave work uncommitted.

## Hard limits

- NO paid model calls and NO internet access from anything you run. (A local `127.0.0.1` server and a local headless browser loading only local files/fixtures are allowed for your own verification.)
- Do NOT read, print, copy or create any `.env*` file.
- Paid detection runs are executing RIGHT NOW from `snapshot.ts`, `detect.ts`, `replay.ts`, `runtime.ts`, `storage.ts` in `scripts/experiments/import-lab/`. Do NOT edit those five files. If you need different behaviour, add a new module that wraps them. You may add new files in that folder and edit `metrics.ts`, `report.ts`, `README.md` and tests.
- Nothing outside `scripts/experiments/import-lab/`. No production code changes at all in this task.
- Real page data is under `.import-lab/` at the repo root (git-ignored). You may READ it to understand real shapes. Never copy real site names, URLs or page text into code, tests, fixtures or README - fixtures are invented example.com HTML.
- No silent fallbacks: anything that fails or is skipped must be recorded in the output files and shown in the report.

## Context

Phase 1 (already built, read its README first) saves pages to disk, replays today's AI detection, and measures how much page text/images/links survive. It cannot say whether a component is the RIGHT component. The owner's standing instruction is: "for us important is if that component is correct or not, is that page type correct or not" - per block, not averaged scores.

Phase 2a builds the missing yardstick: a human-approved **answer sheet** per saved page, and a **scorer** that judges any set of imported components against it, block by block. Later tasks (not yours) will add new detection variants and score them with your scorer, so the scorer must take "a list of components for a page" from any source.

Plain-language terms used below: a **block** is one visual band of the page a visitor would point at as one thing (the big banner, a row of cards, a news list, the footer). The **answer sheet** lists a page's blocks and, for each, which component type(s) are acceptable and what key content it must carry.

The component catalogue is `lib/studio/components/cms/_generated/component-manifest.json` (verify its real shape; it lists every registered component type with a summary). Component definitions with longer descriptions live beside it under `lib/studio/components/cms/` - find them by glob.

Playwright with Chromium is already installed in `node_modules` (`playwright`, `@playwright/test`); do not add dependencies.

## What to build (all in `scripts/experiments/import-lab/`, data under `.import-lab/labels/<slug>/`)

### 1. `propose-blocks.ts` (needs internet at run time - the orchestrator runs it on real pages; you test on local fixtures only)
`tsx .../propose-blocks.ts --page <slug> [--no-js]`
Render the SAVED `page.html` in headless Chromium at 1440px wide with a `<base href>` pointing at the page's final URL so images and CSS load, and produce:
- `screenshot.png` (full page) and the page's rendered height,
- `blocks.json`: an ordered list of proposed blocks. Propose blocks from RENDERED GEOMETRY plus DOM structure, not from byte counts: a block is an element whose box is a full-width (or near full-width) horizontal band of meaningful height, found by descending from `header` / `main` / `footer` (or body children when those are missing) through wrapper elements that have a single meaningful child, stopping where children stack as separate bands. Skip invisible and zero-size elements. Explain the exact rule in the README.
- For each block: `id`, `order`, `region` (header/main/footer), a **stable anchor** that resolves against the saved `page.html` when parsed with parse5 WITHOUT a browser (an index path from `body`, plus tag/id/class for humans), the bounding box on the screenshot, the block's own normalised text, its image URLs and link URLs (reuse `metrics.ts` extraction), heading texts, and counts of repeated child structures.
- Record whether JavaScript was enabled. Default: JS enabled, but anchors must be computed so they still resolve against the un-mutated saved HTML; any block whose anchor does not resolve is kept and flagged `anchorResolved: false`, and the share of unresolved anchors is printed.

### 2. `draft-labels.ts` (PAID at run time - the orchestrator runs it; you only run `--dry-run`)
`tsx .../draft-labels.ts --page <slug> --model <openrouter model id> [--dry-run]`
For each proposed block, ask a strong vision-capable model (through the project's existing OpenRouter client, the same way `detect.ts` reaches it; the model id is a required argument, never hard-coded) to DRAFT a label from: the cropped screenshot of the block, the block's text/headings/image+link counts, and the list of all catalogue component types with their summaries. One call per block, saved one file per call like Phase 1 (`calls/`), with usage, cost and latency.
The draft for a block is: `bestType`; `acceptableTypes` (every type that a careful human would accept as correct for this block - usually 1-3, never padded); `containsMultipleComponents` with the list when one block really is two components; `ignore` with a reason for things that should not be imported (cookie banners, skip links, hidden duplicates); `expected`: `{ headings: string[], itemCount: number|null, itemKind: string|null, hasImage: boolean, ctaLabels: string[] }`; and a one-sentence `reason` in plain English. Validate the reply against a schema; an invalid reply is saved as a failed draft, not guessed.
`--dry-run` builds and saves every request (with image bytes replaced by a size note) and makes no call.
Output: `draft.json`. Every block has `status: "draft"`.

### 3. `review-server.ts` + a single static review page (free, local only)
`tsx .../review-server.ts [--port 4777]` binds to 127.0.0.1 only and serves one page listing all saved pages and their label progress, and per page a side-by-side review:
- left: the full-page screenshot, scrollable, with every block outlined and numbered; clicking a block selects it;
- right: the selected block's draft - best type (dropdown of all catalogue types, each showing its summary so a non-developer can choose), acceptable types (multi-select), the `expected` fields (editable), ignore toggle with reason, the model's reason, and the block's own text for reference;
- block surgery with three plain buttons: **Merge with next block**, **Split into its child blocks** (replaces the block by its proposed children; keep this working from data computed in step 1 - so step 1 must also store one level of child candidates per block), **Ignore this block**;
- **Approve** (status `approved`) or **Save correction** (status `corrected`), keyboard shortcuts for approve/next, a visible progress count ("14 of 23 blocks done"), and nothing is ever auto-approved.
- Saves go to `.import-lab/labels/<slug>/answer-sheet.json` through a POST to the local server, written atomically, with a timestamped backup of the previous file. The review page must work with plain HTML/CSS/JS served by the script - no build step, no framework install.
The reviewer is a non-developer with ADHD: one block at a time, the next action always obvious, no jargon, large click targets, progress always visible.

### 4. `score.ts` + pure functions in `scoring.ts` (free, offline)
`tsx .../score.ts --page <slug> --components <path to a JSON array of components> --name <arm name>`
Also a convenience mode that scores every existing Phase 1 run and arm for a page.
Only blocks with status `approved` or `corrected` count; if a page has unreviewed blocks, say how many and score only reviewed ones.
- **Match components to blocks by content**, since imported components carry no DOM anchor: assign each component to the block with which it shares the most text shingles / image URLs / link URLs (reuse the Phase 1 shingle logic and its named threshold constant). Report components that match no block (**extra**), blocks with no component (**missed**), one component spanning several blocks (**merged**), and several components inside one block (**split** - not an error when the answer sheet says the block contains multiple components).
- **Per-block verdict**, exactly one of: `correct` (acceptable type AND content checks pass), `right type, content incomplete` (list which checks failed), `wrong type` (say what was produced and what was acceptable), `missed`, `should have been ignored` (a component was produced for an ignored block).
- **Content checks** per block: every expected heading present; item count equal to expected (report produced vs expected); image present when expected; every expected CTA label present; text coverage of the block at the Phase 1 threshold. Each check reported separately - never folded into one number.
- Output `scores/<arm>.json` and extend `report.ts` with a Phase 2 section: per page, ONE table with a row per block (block number, short description, acceptable types, and one column per arm showing the verdict in words), then counts of each verdict per arm with the number of blocks behind them. Every page shown individually before any overall count. No percentages without the counts beside them.

### 5. Tests and README
Unit tests for anchor resolution, the block-proposal rule (on invented fixtures rendered locally), matching, every verdict, and every content check. `SKIP_DB_SETUP=true npx jest scripts/experiments/import-lab` must pass fully offline; browser-based tests must use only local fixture files, and be clearly separated so they can be skipped if Chromium cannot launch in your sandbox (say so if that happens - do not fake a pass).
README: add a "Phase 2" part - the commands in order, which need internet, which cost money, how the owner does the review, the exact definition of every verdict and check.

## Verify yourself (offline)

- jest as above; `npm run typecheck` = 0 errors.
- End to end on an invented fixture page: propose-blocks -> draft-labels --dry-run -> hand-write a small draft.json -> start review-server, fetch the page and POST one approval with a local HTTP request, confirm `answer-sheet.json` and its backup are written -> score an invented components file -> report.
- Open the review page in headless Chromium against the fixture and save a screenshot to `.import-lab/labels/_fixture/review-ui.png` so the orchestrator can inspect the layout.
Redirect long outputs to files and read the files; do not pipe through grep/tail.

## Final message

Plain English: files created; how blocks are proposed; how anchors stay stable; what you could not verify (browser launch, real pages, paid drafting); the exact commands for the orchestrator in order with internet/paid marked; anything in this brief you think is wrong, with evidence.
