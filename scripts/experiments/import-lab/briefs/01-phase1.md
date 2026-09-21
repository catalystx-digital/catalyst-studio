# Task: build the Phase 1 import experiment harness ("import lab")

You are a coder with one bounded task. You are not an orchestrator. Do not run any preflight or front-door scripts. Do not commit, stage, push, or create branches. Leave your work uncommitted in this working copy.

## Hard limits

- NO network access and NO paid model calls. Do not run anything that fetches a URL or calls an LLM. Everything you execute must be offline (typecheck, unit tests on local fixtures).
- Do NOT read, print, copy or create any `.env*` file.
- Write only inside `scripts/experiments/import-lab/` plus ONE added line in `.gitignore` (`.import-lab/`). 
- Production code under `lib/**` and `app/**` must not change behaviour. If, and only if, a run cannot be replayed from disk without a seam, you may add an OPTIONAL parameter whose default is exactly today's behaviour. Keep it minimal and list every such change, with file:line and reason, in your final message. Prefer wrapping/injecting from the experiment side first.
- Follow AGENTS.md and CLAUDE.md in this repo. Use `@/lib/studio/...` imports. Do not mask failures with silent fallbacks: a failure must be recorded in the output, never swallowed.
- No real customer or site names anywhere in committed-able files (code, tests, fixtures, README). Fixtures must be invented HTML using example.com.

## Why this exists (context)

The website importer (`lib/studio/import`) turns a web page into a list of CMS components. Today: plain code cuts the page into sections (`lib/studio/import/services/web-tools.ts`, `fetchOutline` / `getSection`), one LLM call per section picks component types and extracts all fields (`lib/studio/import/web-detection.ts`, class `DetectionService`, section path, prompt built via `lib/studio/import/detection/prompt-builder.ts` -> `lib/studio/ai/component-catalog/prompt-builders.ts`), the reply is parsed and validated (`lib/studio/import/detection/response-parser.ts`), then ~27 repair steps run (`lib/studio/import/services/detection-post-processor.ts`, `adjustDetectedComponents`, which takes an optional `domSnapshot`).

The owner wants to know, with measurements rather than opinions:
1. Does the repair code actually improve the result, and by how much?
2. How much content is lost or invented by an import?
3. How much do two identical runs differ (noise)?

Phase 1 must answer these WITHOUT any hand-labelled answer sheet, using only checks that compare the import output to the page itself. Later phases (not your task) will add a labelled answer sheet and new detection variants, so keep the pieces separable: snapshot -> detect -> repair arms -> measure -> report.

An older script shows how to use the production web tools without a database: `scripts/eval/jev/build-pagemaps.ts`. `scripts/standalone-import.ts` shows the env-loading pattern (dynamic imports after dotenv) - config modules read `process.env` at module load, so any script that needs env must load it before importing application modules.

## What to build

All under `scripts/experiments/import-lab/`. Data lives under `.import-lab/` at the repo root (git-ignored): `.import-lab/pages/<slug>/`, `.import-lab/runs/<slug>/<runId>/`, `.import-lab/reports/`.

### 1. `snapshot.ts` (network; the orchestrator runs it, not you)
`tsx scripts/experiments/import-lab/snapshot.ts <url> [url...]`
Fetch each page ONCE with the production web tools and save everything needed to replay detection later with no network: the raw HTML, the full `fetchOutline` result, and every section payload returned by `getSection` for every section key, plus a manifest (url, finalUrl, fetchedAt, byte counts, section keys, sha256 of the HTML). Slugs must not be reversible into anything sensitive beyond the hostname+path the user supplied. Fail loudly per URL and continue with the rest.

### 2. `detect.ts` (paid; the orchestrator runs it, not you)
`tsx scripts/experiments/import-lab/detect.ts --page <slug> --run <runId> [--dry-run] [--max-sections N]`
Replay today's detection, unchanged, against a saved snapshot - the web tools it uses must be served from disk, not the network. Find the cleanest way to give `DetectionService` disk-backed web tools; investigate before choosing. The goal is "exactly what production detection does on this page, minus the network fetch".
Save per run:
- the exact prompt text sent for every section (system + user), with character counts,
- the raw model reply for every section,
- per-call model id, latency, token usage and cost if the client exposes them,
- the parsed components as they are BEFORE `adjustDetectedComponents` runs,
- every diagnostic, dropped section, repair-call and salvage event.
`--dry-run` must make NO model call: it builds and saves every prompt, prints the number of calls it would make and total prompt characters, and exits. This must work offline from a snapshot.
Load env the way `scripts/standalone-import.ts` does; never print env values.

### 3. `repair-arms.ts` (offline, free)
From one saved run, produce these arms from the SAME pre-repair components, with no model call:
- `off`: the pre-repair components untouched.
- `on-own-page`: `adjustDetectedComponents` given this page's own saved HTML as `domSnapshot`.
- `on-as-production`: reproduce how the real pipeline calls the repair step today. Read `lib/studio/import/import-pipeline.ts` (around the `adjustDetectedComponents` call) and `lib/studio/import/services/import-result-handler.ts` (the later pass with a snapshot) and mirror it faithfully. If it cannot be reproduced faithfully offline, do NOT approximate: skip this arm and say exactly why in the README and final message.
Record, per arm, which repair steps changed anything (the post-processor has telemetry in `detection-post-processor/telemetry.ts`; `endSession()` returns a summary that production discards - capture it).

### 4. `measure.ts` (offline, free, pure functions + CLI)
Compare each arm's components with the page's own saved HTML. All metrics reported separately for header / main / footer where the data allows, and overall.
- **Text kept**: of the page's visible text pieces (exclude script/style/template/noscript and anything hidden the same way the importer treats hidden; ignore pieces under 12 characters), the share found in any string value of any component. Normalise whitespace, case, and HTML entities. Report share by count and by characters, and list the 20 longest missing pieces.
- **Text invented**: of component string values of 12+ characters that are human text (exclude URLs, ids, slugs, enum values, colour codes, CSS class names), the share NOT found in the page's visible text or in alt/title/aria-label/meta content/placeholder/value attributes. List every invented piece with its component type and field path.
- **Images kept / invented**: page content images (`img` src/srcset, `picture source`, CSS `background-image` in inline styles; ignore data URIs and images declared 1x1) against image URLs anywhere in the components, compared as absolute URLs. 
- **Links kept / invented**: anchors on the page against link URLs in components, compared as absolute URLs with trailing-slash and fragment normalisation.
- **Shape**: number of components, ordered list of component types, count per type, sections dropped, diagnostics count.
- **Noise** (between two runs of the same page and arm): whether the ordered type list is identical, Jaccard similarity of the type multiset, and absolute difference of each kept/invented share.
Write every function as a pure, exported, unit-tested function. Put the definitions of each metric, including what is excluded and why, in the README in plain English.

### 5. `report.ts` (offline, free)
Reads all measured runs and writes `.import-lab/reports/phase1.md` and `phase1.json`. The markdown must be readable by a non-developer: one table per page with the three arms side by side, one overall table, a noise table, then "repair steps that changed anything" ranked by how often they fired, then the lists of missing and invented pieces. No project jargon without a plain-English explanation at first use. State the number of pages and runs behind every figure. Never average away a page: every page is shown individually before any overall figure.

### 6. Tests
Jest unit tests beside the code for every metric function and for the snapshot-replay web tools, using small invented HTML fixtures. They must run offline with `SKIP_DB_SETUP=true npx jest scripts/experiments/import-lab`. Check the jest config actually picks the folder up; if it does not, say so in your final message rather than changing the root jest config.

### 7. `README.md`
In `scripts/experiments/import-lab/`: what each script does, exact commands in order, which ones cost money, where data is written, metric definitions, known limits.

## Verification you must run yourself (all offline)

- `npm run typecheck` - must report no new errors. Baseline on this branch is 0 errors.
- `SKIP_DB_SETUP=true npx jest scripts/experiments/import-lab` - all passing.
- Build a tiny invented snapshot fixture by hand and run `detect.ts --dry-run` against it to prove prompts are built and saved with no network and no model call. If env is required even for a dry run, say exactly which variable names (names only, never values).
- Run `repair-arms.ts`, `measure.ts` and `report.ts` end to end on an invented pre-repair components fixture and confirm a report is produced.
Do not pipe long commands through grep/tail; redirect to a file and read the file.

## Final message (required)

Plain English, no invented terms. Include: files created; every production file touched with file:line and why (or "none"); how detection is replayed from disk; whether `on-as-production` was reproduced faithfully and how you know; the exact commands the orchestrator should run next, in order, marking which cost money; everything you could NOT verify offline; anything in this brief you think is wrong or impossible, with evidence.
