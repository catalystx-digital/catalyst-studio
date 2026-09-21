# Block audit runbook

Run from the repository root. Supply credentials through the calling environment; never load environment files. Real addresses belong only in ignored .import-lab/pages.json. Dry plans are **FREE**.

## 1. Saved pages and labels

Keep the existing ten reviewed answer sheets unchanged for M3. New-page work remains available:

~~~powershell
node --import tsx scripts/experiments/import-lab/eval.ts snapshot --dry-run
node --import tsx scripts/experiments/import-lab/eval.ts snapshot
node --import tsx scripts/experiments/import-lab/eval.ts blocks
node --import tsx scripts/experiments/import-lab/eval.ts draft --model MODEL --dry-run
node --import tsx scripts/experiments/import-lab/eval.ts draft --model MODEL --yes-spend
node --import tsx scripts/experiments/import-lab/eval.ts review
~~~

Snapshots and labelling renders are **INTERNET**. Drafting is **INTERNET + PAID**. Review is **FREE**; correct blocks and labels, approve with a reviewer name, and stop the server with Ctrl+C. pages.ts --init initializes an absent manifest; pages.ts --add URL accepts --kind, --held-out, --no-js and --notes. The proposal and screenshot are for labelling only. Saved geometry can be re-proposed offline with propose-blocks.ts --page PAGE --from-geometry. Retry failed drafts with --only-failed; reviewed corrections are preserved.

## 2. Production block detection

The new blocks-production arm calls production DetectionService with the blocks harness. The lab adds recording and snapshot replay. Production owns cutting, evidence, questions, selection, filling, retry policy and final assembly. The post-detection repair step is not run.

**INTERNET + PAID:** the cutter renders saved HTML at the original final URL and serves saved stylesheet texts from disk only when their URLs were saved with them. Other stylesheets, images and render resources are fetched from the network. Everything supplied by the web tools and model catalogue is replayed from disk. Resource failures remain visible. Offline fixture tests replace the cutter and both clients; they do not demonstrate current live-site styling or paid accuracy.

Replay rebuilds the styling map with production’s HTML parser and its three external-CSS parsers, then seeds the production cache. Saved stylesheet URLs in manifest.stylesheetUrls take precedence. Older snapshots guess CSS bases from the first five same-origin stylesheet links selected by production, excluding print-only links, for the styling map only; no saved stylesheet texts are supplied to the browser. Fetch-completion order can differ from document order. If counts differ, all saved CSS uses the page’s final URL as its base. This uncertainty affects relative background-image URLs; hidden selectors and background colours need no URL. run.json records stylingReplay: rebuilt, stylesheetsSaved, stylesheetsPaired, baseUsed (saved-urls, stylesheet-links or page-url), hiddenSelectors and backgroundImages; stylesheetIssues records older snapshots as "map only". Dry plans rebuild the map too. Keep the ten reviewed snapshots and labels unchanged.

Use production defaults: Mercury 2.5 fills, eight blocks concurrently, a fixed 120-second stall limit, two infrastructure retries and one validation retry. Decisions use typesafe/jev-1.13 with the default 15-second timeout, enabled and live. No lab retry, fill-model or saved-pick override exists.

~~~powershell
$env:CHROMIUM_EXECUTABLE_PATH = 'C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe'
$env:IMPORT_MODEL_CHAIN = 'inception/mercury-2.5'
$env:IMPORT_DETECTION_HARNESS = 'blocks'
$env:IMPORT_BLOCK_FILL_MODEL = 'inception/mercury-2.5'
$env:IMPORT_BLOCK_CONCURRENCY = '8'
$env:DECISION_MODEL_ENABLED = 'true'
$env:DECISION_MODEL_SHADOW = 'false'
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

## 4. Historical section path

Keep section replay and repair until M6. Run with IMPORT_DETECTION_HARNESS=section and DECISION_MODEL_ENABLED=false:

~~~powershell
node --import tsx scripts/experiments/import-lab/eval.ts today --runs 2 --dry-run
node --import tsx scripts/experiments/import-lab/eval.ts today --runs 2 --yes-spend
node --import tsx scripts/experiments/import-lab/eval.ts repair
node --import tsx scripts/experiments/import-lab/eval.ts measure
~~~

Section detection is **INTERNET + PAID**. Repair and measurement are **FREE**. detect.ts --page PAGE --run RUN provides fresh historical IDs; --max-sections N explicitly limits a run. Removed experimental arms cannot run, but their saved scores remain in summaries and are labelled removed.

## 5. Offline scoring and summaries

~~~powershell
$env:NODE_OPTIONS = '--require=./scripts/experiments/import-lab/offline-guard.cjs'
node --import tsx scripts/experiments/import-lab/eval.ts score
node --import tsx scripts/experiments/import-lab/eval.ts score --families scripts/experiments/import-lab/component-families.json --family-set A
node --import tsx scripts/experiments/import-lab/eval.ts summary
~~~

These commands are **FREE**. Summary regeneration writes reports/SUMMARY.md and reports/summary.json. Historical figures remain included. --ignore-item-count writes a separate diagnostic score; standard and family scores retain item-count checks. Run the README's offline checks before paid evaluation. M3 acceptance still requires both paid runs: at least 60% component right, at most 20 missed blocks and median page time at most 60 seconds, with no calls exceeding production's stall handling.
