# Import lab

Measure production detection against saved snapshots and reviewed blocks. Start with [RUNBOOK.md](RUNBOOK.md); [briefs/README.md](briefs/README.md) preserves historical decisions.

## Arms and retained tools

| Arm | Measurement |
| --- | --- |
| blocks-production | Production DetectionService with the blocks harness: production cutting, decisions, fills, retries and assembly. No post-detection repair. |
| jev-pick | Production block input, questions, evidence and selection against reviewed labels, including family mode. |

Removed arms remain visible in summaries as “arm removed from the tool”; their saved runs and scores stay readable. Production helpers are imported normally; no source text is rewritten.

The labelling renderer remains only for screenshots, content evidence and child candidates used by label drafting and the review page. Production's cutter does not return that review contract. Detection never consumes the labelling proposal. Dry production plans apply the production cutter to saved geometry; the paid run renders the saved HTML again, so live resource changes can change the block count.

Replay rebuilds the production styling map from saved HTML and stylesheet text. New snapshots save stylesheet URLs in the manifest; older snapshots pair texts with eligible HTML links in document order, using the page’s final URL when counts differ. Run records report the base choice and counts. Existing reviewed snapshots and answer sheets stay unchanged.

Snapshot, replay, labels, review, scoring, family scoring, evaluation, summaries and the page manifest remain. Family picking changes only the production component question's options and its type/family wording; it uses the same production evidence and selection.

## Accuracy stick

`score.ts --page PAGE --all-runs` derives expected text, headings, links and image groups from saved HTML and geometry. C1 checks the component family; C2 text runs; C3 heading fields or HTML headings; C4 link targets and labels; C5 content images; C6 counts a found collection against its label; C7 checks invented human text within each block. An absent collection records `structureUnknown` on C6 and does not fail it. Scores go to `labels/<page>/scores-stick/` as `<arm>--<run>--<stick version>[-family-<set>].json`; add `--families scripts/experiments/import-lab/component-families.json --family-set C` for set-C family scoring. Existing score folders are retained. A component spanning blocks is checked against the union of those blocks' source evidence, so content in the wrong one of those blocks can still pass a content check.

## Accuracy report

Run `node --import tsx scripts/experiments/import-lab/eval.ts accuracy --arm blocks-production --runs m4-r1,m4-r2 --family-set C` after scoring. It writes the latest `reports/ACCURACY.md` and `reports/accuracy.json` under `IMPORT_LAB_ROOT` and archives previous copies.

## Site-name leak check

Run `node --import tsx scripts/experiments/import-lab/eval.ts leak-check` before sharing changes. Repeat `--root PATH` to include other lab data roots. A hit prints `file:line: part` and exits with status 1.

## Family answer key

Every manifest entry needs a site kind. For an existing entry, run `node --import tsx scripts/experiments/import-lab/pages.ts --set-site-kind PAGE saas` with the appropriate kind. New entries use `node --import tsx scripts/experiments/import-lab/pages.ts --add https://invented.example/ --site-kind saas --kind home`. Allowed site kinds are `saas`, `shop`, `hospitality-local`, `professional-services`, `government`, `health`, `education`, `charity`, `magazine-news`, and `docs-portfolio-events`.

Run two independent vision models from different vendors, giving each a distinct output name. The direct dry run reads source evidence without writing a label file. The batch dry run plans calls and estimates cost from cached model prices without writing labels. Paid commands require `--yes-spend`.

~~~powershell
node --import tsx scripts/experiments/import-lab/eval.ts draft --catalogue scripts/experiments/import-lab/component-families.json --set C --model openai/gpt-4.1 --out vendor-a --dry-run
node --import tsx scripts/experiments/import-lab/draft-labels.ts --page PAGE --catalogue scripts/experiments/import-lab/component-families.json --set C --model openai/gpt-4.1 --out vendor-a --dry-run
node --import tsx scripts/experiments/import-lab/draft-labels.ts --page PAGE --catalogue scripts/experiments/import-lab/component-families.json --set C --model openai/gpt-4.1 --out vendor-a --yes-spend
node --import tsx scripts/experiments/import-lab/draft-labels.ts --page PAGE --catalogue scripts/experiments/import-lab/component-families.json --set C --model google/gemini-2.5-flash --out vendor-b --yes-spend
node --import tsx scripts/experiments/import-lab/merge-labels.ts --page PAGE --a vendor-a --b vendor-b
node --import tsx scripts/experiments/import-lab/eval.ts merge --a vendor-a --b vendor-b
~~~

`--only-failed` resumes failed blocks of that same output name. `--c NAME` on merge uses a third labeller for development-page family ties; held-out pages always leave ties disputed. The merge creates `answer-sheet-v2.json` once per page and updates `labels/agreement.json`. Version-1 answer sheets remain readable and unchanged.

## Data and cost

- **FREE:** dry plans, saved-data reads, scoring, summaries, local review and offline tests.
- **INTERNET:** snapshots and labelling renders.
- **INTERNET + PAID:** production block runs and model calls. The production cutter loads stylesheets, images and other render resources from the network, exactly as production does; web-tool inputs and the model catalogue replay from disk.

Data lives in ignored repo-root .import-lab/ or IMPORT_LAB_ROOT. Real addresses and page content belong there, never in source or fixtures. Existing folders are never overwritten; use fresh run IDs. No command loads environment files: supply settings and credentials through the calling environment.

Each new arm writes components.json, run.json and one calls/*.json per model/decision invocation. Calls contain request, response, raw reply, usage, cost, latency and status; unknown usage/cost stays null. Transport attempts are attached to that call. Run records include wall-clock seconds, calls, retries, failures, settings and source hashes. Conditional page-level decisions and retries are identified in dry plans.

## Offline checks (PowerShell; FREE)

Use installed dependencies and Chromium. The preload blocks environment-file reads and outbound connections, allowing explicit loopback requests for local tests. Tests use invented inputs and fake clients and clean their temporary directories. Run one Jest path at a time.

~~~powershell
$env:SKIP_DB_SETUP = 'true'
$env:STUDIO_DISABLE_WORKFLOW_PLUGIN = 'true'
$env:NODE_OPTIONS = '--require=./scripts/experiments/import-lab/offline-guard.cjs'
$env:CHROMIUM_EXECUTABLE_PATH = 'C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe'
npx --offline jest scripts/experiments/import-lab --runInBand --forceExit --cacheDirectory "$env:TEMP/import-lab-jest"
npm run typecheck -- --incremental false
npx --offline tsc --noEmit -p scripts/experiments/import-lab/tsconfig.json
~~~

Use an installed Chromium path on other machines; no browser is downloaded. Clear NODE_OPTIONS only before deliberately running an INTERNET + PAID command.
