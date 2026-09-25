# Block audit runbook

Run from the repository root. Supply credentials through the calling environment; never load environment files. Real addresses belong only in ignored .import-lab/pages.json. Dry plans are **FREE**.

## 1. Saved pages and labels

Keep the existing ten reviewed answer sheets unchanged for M3. New-page work remains available:

~~~powershell
node --import tsx scripts/experiments/import-lab/eval.ts snapshot --dry-run
node --import tsx scripts/experiments/import-lab/eval.ts snapshot
node --import tsx scripts/experiments/import-lab/eval.ts blocks
node --import tsx scripts/experiments/import-lab/eval.ts draft --catalogue scripts/experiments/import-lab/component-families.json --set C --model MODEL --out vendor-a --dry-run
node --import tsx scripts/experiments/import-lab/eval.ts draft --catalogue scripts/experiments/import-lab/component-families.json --set C --model MODEL --out vendor-a --yes-spend
node --import tsx scripts/experiments/import-lab/review-server.ts --arm blocks-production --run RUN
~~~

Snapshots and labelling renders are **INTERNET**. OpenRouter drafting is **INTERNET + PAID**; Claude CLI drafting uses subscription billing. Review is **FREE** and binds to `127.0.0.1` only; open the printed address and stop the server with Ctrl+C. The page has three queues: held-out then development disputes; 30 seeded agreed held-out blocks for a sample check; and 30 seeded scored development blocks for a stick check. Use `--port PORT` for another local port and set `--arm`/`--run` to the saved stick score to inspect. The source crop appears first, with 20 decisions per batch. Answers resume after a reload. The sample rule is **2 or more wrong out of 30: fix labelling instructions and relabel**. The stick rule is **28 or more agreements out of 30**. The page shows both results on its start screen.

pages.ts --init initializes an absent manifest; pages.ts --add URL accepts --site-kind, --kind, --held-out, --no-js and --notes. The proposal and screenshot are for labelling only. Saved geometry can be re-proposed offline with propose-blocks.ts --page PAGE --from-geometry. Retry failed or unfinished drafts with --only-failed; reviewed corrections are preserved.

## 2. Production block detection

The new blocks-production arm calls production DetectionService with the blocks harness. The lab adds recording and snapshot replay. Production owns cutting, evidence, questions, selection, filling, retry policy and final assembly. The post-detection repair step is not run.

**INTERNET + PAID:** the cutter renders saved HTML at the original final URL and serves saved stylesheet texts from disk only when their URLs were saved with them. Other stylesheets, images and render resources are fetched from the network. Everything supplied by the web tools and model catalogue is replayed from disk. Resource failures remain visible. Offline fixture tests replace the cutter and both clients; they do not demonstrate current live-site styling or paid accuracy.

Replay rebuilds the styling map with production’s HTML parser and its three external-CSS parsers, then seeds the production cache. Saved stylesheet URLs in manifest.stylesheetUrls take precedence. Older snapshots guess CSS bases from the first five same-origin stylesheet links selected by production, excluding print-only links, for the styling map only; no saved stylesheet texts are supplied to the browser. Fetch-completion order can differ from document order. If counts differ, all saved CSS uses the page’s final URL as its base. This uncertainty affects relative background-image URLs; hidden selectors and background colours need no URL. run.json records stylingReplay: rebuilt, stylesheetsSaved, stylesheetsPaired, baseUsed (saved-urls, stylesheet-links or page-url), hiddenSelectors and backgroundImages; stylesheetIssues records older snapshots as "map only". Dry plans rebuild the map too. Keep the ten reviewed snapshots and labels unchanged.

Use production defaults: Mercury 2.5 fills, eight blocks concurrently, a fixed 120-second stall limit, two infrastructure retries and one validation retry. Decisions use typesafe/jev-1.13 with the default 15-second timeout, enabled and live. No lab retry, fill-model or saved-pick override exists.

~~~powershell
$env:CHROMIUM_EXECUTABLE_PATH = 'C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe'
$env:IMPORT_MODEL_CHAIN = 'inception/mercury-2.5'
$env:IMPORT_BLOCK_FILL_MODEL = 'inception/mercury-2.5'
$env:IMPORT_BLOCK_CONCURRENCY = '8'
$env:DECISION_MODEL_ENABLED = 'true'
$env:DECISION_MODEL_SHADOW = 'false'
# Empty enables only import.block.component and import.block.multiple.
$env:DECISION_MODEL_QUESTIONS = ''
$env:DECISION_MODEL_ID = 'typesafe/jev-1.13'
$env:DECISION_MODEL_TIMEOUT_MS = '15000'
$env:DECISION_MODEL_WEBSITE_ALLOWLIST = ''
node --import tsx scripts/experiments/import-lab/run-arm.ts --page PAGE --arm blocks-production --run m3-preview --dry-run
node --import tsx scripts/experiments/import-lab/eval.ts arms --arms blocks-production --run m3-r1 --dry-run
~~~

The direct dry run requires geometry.json matching the saved snapshot. It runs production's pure cutter over that geometry and plans one decision panel and one fill per block. Fill requests depend on decision replies; up to two page-level decisions and any retries depend on extraction outcomes. No browser or client is called. The paid render can produce a different count. eval.ts dry-run is only a batch estimate based on history/proposals, not a production render.

The manifest now includes ten reviewed held-out pages as well. These exact **INTERNET + PAID** commands select the ten fully reviewed non-held-out M3 pages and run two repetitions sequentially. Existing provider credentials must already be present. Keep the settings above; clear the offline guard only for these paid commands:

~~~powershell
Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
$labRoot = if ($env:IMPORT_LAB_ROOT) { $env:IMPORT_LAB_ROOT } else { '.import-lab' }
$pageManifest = Get-Content -LiteralPath (Join-Path $labRoot 'pages.json') -Raw | ConvertFrom-Json
$labelledPages = @(Get-ChildItem -LiteralPath (Join-Path $labRoot 'labels') -Directory | Where-Object {
  $sheetFile = Join-Path $_.FullName 'answer-sheet.json'
  $entry = $pageManifest.PSObject.Properties[$_.Name]
  if ($entry -and -not $entry.Value.heldOut -and (Test-Path -LiteralPath $sheetFile)) {
    $sheet = Get-Content -LiteralPath $sheetFile -Raw | ConvertFrom-Json
    $sheet.entries.Count -gt 0 -and @($sheet.entries | Where-Object { $_.status -eq 'draft' -or -not $_.label }).Count -eq 0
  }
} | Select-Object -ExpandProperty Name | Sort-Object)
if ($labelledPages.Count -ne 10) { throw 'M3 requires exactly ten fully reviewed non-held-out pages.' }
foreach ($run in @('m3-r1', 'm3-r2')) {
  foreach ($page in $labelledPages) {
    node --import tsx scripts/experiments/import-lab/run-arm.ts --page $page --arm blocks-production --run $run
    if ($LASTEXITCODE -ne 0) { throw "Failed: $page / $run. Inspect run.json; use a fresh run ID after failure." }
  }
}
~~~

For other page sets, eval.ts arms --arms blocks-production --run RUN --yes-spend runs the manifest. eval.ts --concurrency controls pages, defaults to one; production's IMPORT_BLOCK_CONCURRENCY controls blocks. Every attempt is recorded under arms/PAGE/blocks-production/RUN/. run.json contains timing, counts, failures and settings; components.json is the scorer input; calls/ contains request/reply records. Failed runs remain inspectable. Never overwrite a run.

## 3. Picking and families

To measure family filling on one development page, dry plan both arms first. Each plan saves its call list and `run.json`. A run without `--dry-run` uses paid decision and fill calls; use a fresh run ID for each attempt.

~~~powershell
node --import tsx scripts/experiments/import-lab/run-arm.ts --page PAGE --arm family-fill --run family-preview --dry-run
node --import tsx scripts/experiments/import-lab/run-arm.ts --page PAGE --arm blocks-production --run production-preview --dry-run
node --import tsx scripts/experiments/import-lab/run-arm.ts --page PAGE --arm family-fill --run family-r1
node --import tsx scripts/experiments/import-lab/score.ts --page PAGE --all-runs
~~~

Compare `family-fill--family-r1--stick2-family-C.json` and the matching `blocks-production` stick2 score in `labels/PAGE/scores-stick/`. The family arm passes set C descriptions, schema contract, validator and location function into the production blocks harness. Paid runs re-render the saved HTML. The family arm rejects held-out pages. `run.json` records the effective configuration, source and prompt hashes, and override identity; `comparisonKey` changes with the override.

~~~powershell
node --import tsx scripts/experiments/import-lab/eval.ts arms --arms jev-pick --run pick-r1 --dry-run
node --import tsx scripts/experiments/import-lab/eval.ts arms --arms jev-pick --run family-r1 --families scripts/experiments/import-lab/component-families.json --family-set A --dry-run
~~~

Picking uses production's block input, evidence, registered questions and choice handling. It needs the live decision settings above; replace --dry-run with --yes-spend for **INTERNET + PAID** decisions. Family mode substitutes family options and type/family wording in the production question. Repeat with B. jev-pick.ts --page PAGE --run RUN accepts the same family flags directly. Family scoring groups saved probabilities for **FREE**; it does not make new choices.

## 4. Targeted repair over saved runs

The repair command checks each saved section against source evidence. Verified sections are copied. Each incomplete section gets one call using the source arm's saved fill request and model; only a reply with fewer missing items, no more invented text, and the same component types is kept. The new arm uses the original run ID. Existing repair run directories are never overwritten.

~~~powershell
$env:IMPORT_LAB_ROOT = 'C:/projects/catalystx/import-lab-data'
node --import tsx scripts/experiments/import-lab/eval.ts repair --arm blocks-production --runs a-r1 --dry-run
# Only after reviewing the plan and supplying credentials in the calling environment:
node --import tsx scripts/experiments/import-lab/eval.ts repair --arm blocks-production --runs a-r1 --yes-spend
~~~

Use `--arm family-fill` for `family-fill+repair`. `--held-out` selects held-out runs; its command output is aggregate only. Compare paired runs with set C on both sides:

~~~powershell
node --import tsx scripts/experiments/import-lab/eval.ts compare --baseline blocks-production --candidate blocks-production+repair --runs a-r1,a-r2 --held-out-runs a-r1 --family-set C
node --import tsx scripts/experiments/import-lab/eval.ts compare --baseline family-fill --candidate family-fill+repair --runs a-r1,a-r2 --held-out-runs a-r1 --family-set C
~~~

## 5. Offline scoring and summaries

~~~powershell
$env:NODE_OPTIONS = '--require=./scripts/experiments/import-lab/offline-guard.cjs'
node --import tsx scripts/experiments/import-lab/eval.ts score
node --import tsx scripts/experiments/import-lab/eval.ts score --arm blocks-production --runs a-r1,a-r2,a-r3,a-r4 --family-set C
node --import tsx scripts/experiments/import-lab/eval.ts summary
~~~

These commands are **FREE**. Summary regeneration writes reports/SUMMARY.md and reports/summary.json. Historical figures remain included. Run the README's offline checks before paid evaluation. M3 acceptance still requires both paid runs: at least 60% component right, at most 20 missed blocks and median page time at most 60 seconds, with no calls exceeding production's stall handling.

## Accuracy stick

Run `node --import tsx scripts/experiments/import-lab/score.ts --page PAGE --all-runs` with `IMPORT_LAB_ROOT` set to saved data. It reads the version-2 answer key and uses set C by default. C1 checks family, C2 text, C3 headings, C4 links, C5 content images after labelled decorations, C6 item count and C7 invented text. Unsettled labels are counted but excluded from accuracy. Immutable stick2 files are saved in `labels/<page>/scores-stick/` without colliding with stick1 files.

## Accuracy report

~~~powershell
node --import tsx scripts/experiments/import-lab/eval.ts score --arm blocks-production --runs a-r1,a-r2,a-r3,a-r4 --family-set C
node --import tsx scripts/experiments/import-lab/eval.ts verify --arm blocks-production --runs a-r1,a-r2
node --import tsx scripts/experiments/import-lab/eval.ts accuracy --arm blocks-production --runs a-r1,a-r2 --family-set C
~~~

These saved-data commands are **FREE**. Use set C for both score and accuracy. Pages without the requested runs are skipped; the report names skipped development pages and counts skipped held-out pages. The report stays under `IMPORT_LAB_ROOT/reports/`; previous copies are archived.

The verify command reads development pages only, saves one file per arm and run without overwriting it, and exits 1 on any mismatch with the stick's C2, C4, C5 by code rule, and C7 checks. Rerun accuracy with the same arm and verified runs to show the two automatic-check counts.

After stick2 score files exist, move each version-1 `labels/<page>/answer-sheet.json` into `archive/labels-v1/<page>/answer-sheet.json` as a separate operator step. Do not move the version-2 sheet or stick scores.

## Family go / no-go comparison

After both development runs and the held-out run are saved for both arms, run `node --import tsx scripts/experiments/import-lab/eval.ts compare --baseline blocks-production --candidate family-fill --runs c-r1,c-r2 --held-out-runs c-r1 --family-set C`. This is offline and free. Read `reports/COMPARE.md` under `IMPORT_LAB_ROOT`; it contains development aggregates and only overall held-out accuracy per arm. Missing stick files are scored into new files.

## Two-labeller family key

Fill the required site kinds before paid labelling. Use `pages.ts --set-site-kind PAGE KIND` for existing pages or `pages.ts --add URL --site-kind KIND --kind PAGE_KIND` for a new page. Valid `KIND` values are listed in [README.md](README.md). The page manifest has no inferred site kind.

1. Run `node --import tsx scripts/experiments/import-lab/eval.ts draft --catalogue scripts/experiments/import-lab/component-families.json --set C --model openai/gpt-4.1 --out vendor-a --dry-run` to see the batch call count and cost estimate without writing labels.
2. Run `node --import tsx scripts/experiments/import-lab/draft-labels.ts --page PAGE --catalogue scripts/experiments/import-lab/component-families.json --set C --model openai/gpt-4.1 --out vendor-a --dry-run` to check one page's source evidence. Add `--yes-spend` in place of `--dry-run` to write its first label file. Repeat with a model from another vendor and `--out vendor-b`.
3. Run `node --import tsx scripts/experiments/import-lab/merge-labels.ts --page PAGE --a vendor-a --b vendor-b`; use `eval.ts merge --a vendor-a --b vendor-b --c vendor-c` for every page. Inspect `labels/agreement.json` and review development disputes. A complete C label may settle a development block; a failed or absent C block leaves its A/B dispute. Held-out disputes go to founder review.

The batch draft covers every `pages.json` entry with `blocks.json` and a screenshot. A version-1 `answer-sheet.json` supplies block boundaries when present; other pages use `blocks.json`. The dry plan prints pages and blocks by source and writes nothing. `--provider openrouter` is the default paid API route and requires `--yes-spend` to run. `--provider codex-cli` uses subscription billing and does not require `--yes-spend`. `--provider claude-cli` uses subscription billing and runs only when none of the four organisation-managed Claude policy files described below exists. All three routes accept `--concurrency 1` through `4` for blocks within each page, defaulting to 1. `--only-failed` with the same model and output name resumes failed or unfinished blocks across the batch, starts all blocks on pages without that output, and preserves complete entries. Keep the version-1 answer sheets and saved scores intact.

### Relabel after the founder's first checks

1. Dry plan the new prompt with `node --import tsx scripts/experiments/import-lab/eval.ts draft --provider claude-cli --model claude-opus-5-5 --out vendor-a2 --dry-run`. Use distinct outputs `vendor-a2`, `vendor-b2`, and, for a third development labeller, `vendor-c2` when running the actual drafts through approved provider routes. Do not resume old outputs: each new label file records `labelPromptVersion`.
2. Merge with `node --import tsx scripts/experiments/import-lab/eval.ts merge --a vendor-a2 --b vendor-b2 --c vendor-c2` after all chosen drafts finish. Merge rejects mixed prompt versions, preserves founder-settled fields and sample corrections, archives each previous sheet as `answer-sheet-v2.<timestamp>.json`, then writes the new sheet.
3. Regenerate stick2 scores for the chosen saved arm and run. Start `node --import tsx scripts/experiments/import-lab/review-server.ts --arm blocks-production --run RUN --round 2`. The start screen says Round 2. Its new seeded samples exclude round-one blocks; records go to `review-sample-round2.json` and `stick-check-round2.json`. The stick preview scrolls through full text, headings, image thumbnails and link addresses while keeping the verdict hidden.

For a Claude dry plan, set `IMPORT_LAB_ROOT` and `IMPORT_MODEL_CHAIN='test/dummy'`, then run `node --import tsx scripts/experiments/import-lab/eval.ts draft --provider claude-cli --model opus --out vendor-a --dry-run`. Before a real call, the route checks `managed-settings.json` and `managed-mcp.json` in both `C:\ProgramData\ClaudeCode` and `C:\Program Files\ClaudeCode`; if any exists, it refuses with the file path. With no managed policy file, untrusted page text can only produce a reply: the command uses `--print --input-format stream-json --output-format stream-json --verbose --safe-mode --settings '{"disableAllHooks":true}' --strict-mcp-config --tools "" --disable-slash-commands --no-chrome --permission-prompts none --model MODEL --system-prompt PROMPT --session-id UUID`; a validation retry substitutes `--resume UUID`. The reply comes from the final `type: "result"` stream event when `is_error` is false and `subtype` is `"success"`. The child environment allowlist and saved-record sanitisation remain in force. No skip-permissions or bypass flag is used.

For OpenAI subscription labelling, run `node --import tsx scripts/experiments/import-lab/eval.ts draft --provider codex-cli --model gpt-6-sol --out vendor-b --dry-run`; remove `--dry-run` after reviewing the plan. Each block attempt runs `codex exec -m MODEL -s read-only --skip-git-repo-check -C TEMP_DIR -i TEMP_DIR/crop.png -o TEMP_DIR/reply.txt -`, with the same prompt on stdin and the PNG crop attached. The directory starts empty; the crop is written there immediately before the call. Only the `-o` file is read as the reply, and the directory is deleted in `finally` even when the command fails. A validation retry uses a new directory and includes the prior reply, exact validation message and `Reply again with valid JSON only`. The CLI flags were confirmed with the locally installed `codex exec --help`. `-s read-only` is required because page text is untrusted. Never pass `--dangerously-bypass-approvals-and-sandbox`, `--full-auto`, `-s workspace-write` or `-s danger-full-access`. The child environment contains only OS/runtime variables and `CODEX_HOME` for subscription authentication; unrelated credentials are excluded. Call records use `provider: "codex-cli"`, `billing: "subscription"`, `cost: null`, prompt and image hashes, reply, attempts and latency, without image bytes.

## Site-name leak check

Run `node --import tsx scripts/experiments/import-lab/eval.ts leak-check` before sharing changes. Add repeated `--root PATH` options to check names from more data roots. A hit prints its file, line and matched name part.
