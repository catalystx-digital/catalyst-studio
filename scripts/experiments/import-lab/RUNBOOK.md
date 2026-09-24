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
node --import tsx scripts/experiments/import-lab/eval.ts review
~~~

Snapshots and labelling renders are **INTERNET**. Drafting is **INTERNET + PAID**. Review is **FREE**; correct blocks and labels, approve with a reviewer name, and stop the server with Ctrl+C. pages.ts --init initializes an absent manifest; pages.ts --add URL accepts --site-kind, --kind, --held-out, --no-js and --notes. The proposal and screenshot are for labelling only. Saved geometry can be re-proposed offline with propose-blocks.ts --page PAGE --from-geometry. Retry failed or unfinished drafts with --only-failed; reviewed corrections are preserved.

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

~~~powershell
node --import tsx scripts/experiments/import-lab/eval.ts arms --arms jev-pick --run pick-r1 --dry-run
node --import tsx scripts/experiments/import-lab/eval.ts arms --arms jev-pick --run family-r1 --families scripts/experiments/import-lab/component-families.json --family-set A --dry-run
~~~

Picking uses production's block input, evidence, registered questions and choice handling. It needs the live decision settings above; replace --dry-run with --yes-spend for **INTERNET + PAID** decisions. Family mode substitutes family options and type/family wording in the production question. Repeat with B. jev-pick.ts --page PAGE --run RUN accepts the same family flags directly. Family scoring groups saved probabilities for **FREE**; it does not make new choices.

## 4. Historical results

Section replay and repair commands have been removed. Saved results remain readable for measurement, scoring and summaries.

## 5. Offline scoring and summaries

~~~powershell
$env:NODE_OPTIONS = '--require=./scripts/experiments/import-lab/offline-guard.cjs'
node --import tsx scripts/experiments/import-lab/eval.ts score
node --import tsx scripts/experiments/import-lab/eval.ts score --families scripts/experiments/import-lab/component-families.json --family-set A
node --import tsx scripts/experiments/import-lab/eval.ts summary
~~~

These commands are **FREE**. Summary regeneration writes reports/SUMMARY.md and reports/summary.json. Historical figures remain included. Run the README's offline checks before paid evaluation. M3 acceptance still requires both paid runs: at least 60% component right, at most 20 missed blocks and median page time at most 60 seconds, with no calls exceeding production's stall handling.

## Accuracy stick

Run `node --import tsx scripts/experiments/import-lab/score.ts --page PAGE --all-runs` with `IMPORT_LAB_ROOT` set to saved data. C1 checks family, C2 text, C3 headings, C4 links, C5 content images, C6 item count and C7 invented text. Add `--families scripts/experiments/import-lab/component-families.json --family-set C` for family mode. Immutable files are saved in `labels/<page>/scores-stick/` using the shared stick version.

## Accuracy report

~~~powershell
node --import tsx scripts/experiments/import-lab/eval.ts score --arm blocks-production --runs m4-r1,m4-r2
node --import tsx scripts/experiments/import-lab/eval.ts score --arm blocks-production --runs m4-r1,m4-r2 --family-set C
node --import tsx scripts/experiments/import-lab/eval.ts accuracy --arm blocks-production --runs m4-r1,m4-r2 --family-set C
~~~

These saved-data commands are **FREE**. The report stays under `IMPORT_LAB_ROOT/reports/`; previous copies are archived.

## Two-labeller family key

Fill the required site kinds before paid labelling. Use `pages.ts --set-site-kind PAGE KIND` for existing pages or `pages.ts --add URL --site-kind KIND --kind PAGE_KIND` for a new page. Valid `KIND` values are listed in [README.md](README.md). The page manifest has no inferred site kind.

1. Run `node --import tsx scripts/experiments/import-lab/eval.ts draft --catalogue scripts/experiments/import-lab/component-families.json --set C --model openai/gpt-4.1 --out vendor-a --dry-run` to see the batch call count and cost estimate without writing labels.
2. Run `node --import tsx scripts/experiments/import-lab/draft-labels.ts --page PAGE --catalogue scripts/experiments/import-lab/component-families.json --set C --model openai/gpt-4.1 --out vendor-a --dry-run` to check one page's source evidence. Add `--yes-spend` in place of `--dry-run` to write its first label file. Repeat with a model from another vendor and `--out vendor-b`.
3. Run `node --import tsx scripts/experiments/import-lab/merge-labels.ts --page PAGE --a vendor-a --b vendor-b`; use `eval.ts merge --a vendor-a --b vendor-b` for every page. Inspect `labels/agreement.json` and the disputed fields in each `answer-sheet-v2.json`. A development page may use `--c vendor-c`; a held-out page never uses it.

Use `--only-failed` with the same model and output name to resume failed blocks. Keep the version-1 answer sheets and saved scores intact.

## Site-name leak check

Run `node --import tsx scripts/experiments/import-lab/eval.ts leak-check` before sharing changes. Add repeated `--root PATH` options to check names from more data roots. A hit prints its file, line and matched name part.
