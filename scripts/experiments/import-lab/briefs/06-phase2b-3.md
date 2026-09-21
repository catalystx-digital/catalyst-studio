# Task: Phase 2b and Phase 3 of the import lab - the comparison arms

You are a coder with one bounded task. You are not an orchestrator. Do not commit, stage, push or branch. Leave work uncommitted.

## Hard limits

- NO paid model calls and NO internet from anything you run. Every new command needs a `--dry-run` that builds and saves every request it WOULD send and makes no call; verify with dry runs, fake clients and invented fixtures only. The orchestrator runs the paid commands.
- Do NOT read, print, copy or create any `.env*` file. Scripts read configuration from the inherited process environment, like `detect.ts`.
- Work only inside `scripts/experiments/import-lab/`. NO production code changes (`lib/**`, `app/**`). Do not flip or depend on production feature flags (for example `DECISION_MODEL_ENABLED`) and never write to the production decision shadow log under `reports/`.
- Existing lab files may be extended, but existing saved data under `.import-lab/` must stay readable; never delete or rewrite saved runs.
- Real page data under `.import-lab/` may be READ to learn real shapes. Never copy real site names, URLs or page text into code, tests, fixtures or README.
- No silent fallbacks. Every failure, skip, retry and truncation is recorded in the run output and shown in the report.

## Context (read the lab README first - Phase 1 and Phase 2a are built)

Today's importer, measured by this lab on real pages: the page is cut into ~12,000-byte slices by byte count (not by visual block); each slice is one LLM call carrying ~85,000 characters of rules for ~22 component types at once, with every worked example deleted and long instructions cut at 260 characters (`lib/studio/ai/component-catalog/prompt-builders.ts:295-345`); 63-87% of the model's output is hidden reasoning; a page takes 11-35 minutes; roughly 1 call in 8 fails validation and is retried.

The owner's idea to test: **a decision model picks the component type for each block first, then the LLM is given only that component's rules and fills it in.** The decision model ("Jev", `typesafe/jev-1.13` via OpenRouter `/api/alpha/decisions`) answers typed questions - yes/no, a choice among up to 255 options, or a graded score - with probabilities and writes no text. The project's client for it is `lib/studio/decisions/client.ts` (`createDecisionClient`, and `createFakeDecisionClient` for tests); `lib/studio/decisions/state.ts` builds the text evidence; an older benchmark in `scripts/eval/jev/arena.ts` shows a richer evidence renderer (`richState`) and how questions were phrased. Read these; call the client directly from the lab.

Phase 2a gives you: proposed blocks per page (`blocks.json`), a human-reviewed answer sheet (`answer-sheet.json`, blocks with `acceptableTypes`, `bestType`, `expected`, `ignore`), and `score.ts`, which judges any list of components block by block. Phase 1 gives you `measure` (text / images / links kept, text not found on the page).

## What to build

Every arm below writes to `.import-lab/arms/<slug>/<arm>/<runId>/`: `components.json` (the final component list for the page, in page order), `calls/` (one file per model call: full request, raw reply, usage incl. reasoning tokens, cost, latency, status), `run.json` (arm, page, model ids, wall-clock seconds for the whole page, call count, retry count, failures, the exact rules/thresholds used). Every arm has `--dry-run`. Every LLM arm uses the SAME extraction model that `detect.ts` uses today (from the inherited configuration) so that only the pipeline differs, the production reply parser/validator (`parseSectionDetectionResponse` and the normalisation it applies), and NO repair step (`adjustDetectedComponents` is not called) unless stated.

### Shared library: `extract-block.ts`
Given one block (resolved from the saved `page.html` by its anchor) and a list of allowed component types, build the model input and return validated components.
- The block's content must be given to the model in the SAME node-list representation production uses, produced by production code, so arms differ only in what is intended. Investigate how `web-tools.ts` flattens and slices (`fetchOutline` / `getSection`) and find the most faithful way to obtain that representation for a single block's DOM subtree without cutting it by bytes (for example by replaying a synthetic document that contains only that block, with the byte budget lifted through its existing configuration if it is configurable). If a block is too large for one call, split it at its child-block boundaries (Phase 2a stores child candidates) - never at a byte midpoint - and record that it was split.
- Two rule styles, selectable: `today-rules` = exactly what production would put in the prompt for those types (examples stripped, 260-character cut - reuse the production builder); `full-rules` = every directive for those types from `getDirectives(type)` in full, including worked examples, plus the same field contracts. Keep all the generic prompt sections production sends (output shapes, forbidden fields, return format) identical in both.
- Optional one-line page outline (block number, region and picked type of every block on the page) prepended as context.
- Concurrency-limited runner (default 8 at once), per-call timeout, ONE retry on validation failure using production's repair-prompt approach, everything recorded.

### Arm `oracle-blocks`  (isolates the page-cutting)
Blocks = the reviewed answer-sheet blocks (not ignored). Allowed types per block = whatever production's own candidate selection would offer for that content (reuse `section-plan.ts` / `candidate-types.ts` / the taxonomy the way `web-detection.ts` does). Rules = `today-rules`. One call per block.

### Arm `oracle-type-today-rules` and arm `oracle-type-full-rules`  (the ceiling of the owner's idea)
Blocks = reviewed answer-sheet blocks. Allowed types = the answer sheet's `bestType` only (or the listed types when the block `containsMultipleComponents`). Two variants differing ONLY in rule style, so the report can separate "fewer types in the prompt" from "full instructions restored".

### Command `jev-pick.ts`  (is the decision model good at picking? - no LLM)
For every reviewed answer-sheet block, ask the decision model ONE choice question: which catalogue component type is this block? Options = every registered page-level component type from the catalogue (verify the count from the manifest; exclude sub-components that cannot stand alone, the same way `candidate-types.ts` does), each option described by its catalogue summary. Evidence = a rendered text outline of the block (headings, counts of images/links/buttons/repeated items, indented DOM outline with truncated text - adapt `richState`), with any truncation recorded. Also ask, in the same request if the client allows it, a yes/no "does this block contain more than one component?".
Save every probability. Score against the answer sheet WITHOUT any tuning: top-1 pick acceptable?; any of top-3 acceptable?; a table of picks by stated probability band (0-0.2, ... 0.8-1.0) showing how often the pick was acceptable in each band, with counts; a confusion list (answer vs pick) for every miss; cost and latency per call.

### Arm `jev-then-llm-blocks`  (Phase 3: the full proposed pipeline)
Blocks = the CODE-PROPOSED blocks from `propose-blocks.ts` (`blocks.json`) - NOT the human-corrected ones - so the arm gets no help from the answer sheet. For each block: decision-model pick as above. Allowed types rule, fixed in advance and NOT tuned on any page: if the top option's probability is at least twice the second option's, allow only the top type; otherwise allow the top three. If the "more than one component" answer is yes with probability >= 0.5, allow the top three. Blocks the pipeline cannot know to ignore are still extracted (the scorer will report `should have been ignored`). Rules = `full-rules`. Page outline context on. All block calls in parallel (8 at once). Assemble components in block order.

### Arm `jev-then-llm-wholepage`
Same picks as above (reuse the saved picks of a `jev-then-llm-blocks` run so both arms see identical picks), but ONE LLM call for the whole page: all blocks' content in order, the `full-rules` for the distinct allowed types only, and an instruction to return components in block order tagged with the block number. Record whether the reply was truncated.

### Reporting
Extend the report with a final section, per page first, then overall, for all arms including `today-off` and `today-on-own-page` from Phase 1:
- the per-block verdict table (one row per block, one column per arm, verdict in words);
- verdict counts per arm with block counts;
- Phase 1 content measures per arm (text kept vs visible and vs shown, text not found on the page, images kept, links kept) with counts;
- wall-clock seconds per page, number of calls, retries, failed calls, total / reasoning / answer tokens, prompt characters, cost per page, per arm;
- run-to-run noise where an arm has two runs;
- the `jev-pick` tables;
- a plain-English summary of at most 15 lines at the very top that states, with counts, what changed between `today` and each arm, and explicitly lists what the data CANNOT show (small number of pages, labels drafted by AI and reviewed by whom, no visual rendering check). No percentages without counts. No overall figure before the per-page figures. Flag every figure that rests on fewer than 20 blocks.
The answer sheet records who reviewed each block (`reviewedBy`); if Phase 2a does not store that, add it (values such as `owner`, `orchestrator-provisional`), and have the report state how many scored blocks rest on provisional review.

### Tests and README
Unit tests with fake clients for: block-to-input construction (including the split-at-child-boundary rule), both rule styles (assert that `full-rules` contains a worked example that `today-rules` lacks, on an invented component fixture or a real catalogue type), the allowed-types rule (all three branches), whole-page assembly and truncation detection, pick scoring and probability bands. `SKIP_DB_SETUP=true npx jest scripts/experiments/import-lab` passes offline; `npm run typecheck` reports 0 errors.
README: add the commands in run order, marking internet / paid, with the fixed allowed-types rule and the statement that nothing was tuned on the test pages.

## Verify yourself (offline)
jest; typecheck; a dry run of EVERY new command on the invented fixture page, confirming requests are saved and no call is made; the report renders with fixture data for all arms. Redirect long outputs to files and read the files.

## Final message
Plain English: files created; how a block's content is turned into the production node-list faithfully (and proof it matches production's representation on a fixture); anything you could not make faithful; exact orchestrator commands in order with internet/paid marked and a rough call count per page per arm; what you could not verify; anything in this brief you think is wrong, with evidence.

## Working alongside another coder (important)
Another coder is working in this same folder right now, fixing the block finder. They own `block-proposal.ts`, `propose-blocks.ts`, `phase2-browser.test.ts`, `block-proposal*.test.ts` and append block fixtures to `phase2-fixtures.ts`. Do NOT edit those files (you may append your own fixtures to `phase2-fixtures.ts` or, better, use a new fixtures file). Treat `blocks.json` as an input whose shape is what Phase 2a already writes (the other coder keeps that shape and adds `geometry.json`). If typecheck or jest shows errors inside files they own, ignore them and re-run your own test files by path. You own `README.md` and `report.ts`.
Browser tests need `IMPORT_LAB_CHROMIUM_EXECUTABLE=C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe`.
