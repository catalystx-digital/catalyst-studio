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

`score.ts --page PAGE --all-runs` reads `answer-sheet-v2.json` and derives expected text, headings, links and image groups from saved HTML and geometry. C1 accepts a split when any produced family is acceptable for a non-multiple block; content checks still judge losses. C2 text runs; C3 headings; C4 links; C5 content images after excluding labelled decorations; C6 labelled item count when the collection can be found; C7 invented human text. Screen-reader-only and `aria-hidden="true"` text is excluded from source text and link labels, but link targets still count. Ignored and unsettled labels stay outside the accuracy denominator, with unsettled sections counted separately. Scores go to `labels/<page>/scores-stick/` as `<arm>--<run>--stick2-family-C.json`. Old stick1 files remain separate. A component spanning blocks is checked against the union of those blocks' source evidence, so content in the wrong one of those blocks can still pass a content check.

## Accuracy report

Run `node --import tsx scripts/experiments/import-lab/eval.ts score --arm blocks-production --runs a-r1,a-r2,a-r3,a-r4 --family-set C`, then `node --import tsx scripts/experiments/import-lab/eval.ts accuracy --arm blocks-production --runs a-r1,a-r2,a-r3,a-r4 --family-set C`. The report names development pages skipped for missing runs and gives only an aggregate held-out skip count. It writes the latest `reports/ACCURACY.md` and `reports/accuracy.json` under `IMPORT_LAB_ROOT` and archives previous copies.

## Site-name leak check

Run `node --import tsx scripts/experiments/import-lab/eval.ts leak-check` before sharing changes. Repeat `--root PATH` to include other lab data roots. A hit prints `file:line: part` and exits with status 1.

## Family answer key

Every manifest entry needs a site kind. For an existing entry, run `node --import tsx scripts/experiments/import-lab/pages.ts --set-site-kind PAGE saas` with the appropriate kind. New entries use `node --import tsx scripts/experiments/import-lab/pages.ts --add https://invented.example/ --site-kind saas --kind home`. Allowed site kinds are `saas`, `shop`, `hospitality-local`, `professional-services`, `government`, `health`, `education`, `charity`, `magazine-news`, and `docs-portfolio-events`.

Run two independent vision models from different vendors, giving each a distinct output name. The direct dry run reads source evidence without writing a label file. The batch dry run plans calls without writing labels; API cost estimates use saved call history where available. OpenRouter calls require `--yes-spend`.

~~~powershell
node --import tsx scripts/experiments/import-lab/eval.ts draft --catalogue scripts/experiments/import-lab/component-families.json --set C --model openai/gpt-4.1 --out vendor-a --dry-run
node --import tsx scripts/experiments/import-lab/draft-labels.ts --page PAGE --catalogue scripts/experiments/import-lab/component-families.json --set C --model openai/gpt-4.1 --out vendor-a --dry-run
node --import tsx scripts/experiments/import-lab/draft-labels.ts --page PAGE --catalogue scripts/experiments/import-lab/component-families.json --set C --model openai/gpt-4.1 --out vendor-a --yes-spend
node --import tsx scripts/experiments/import-lab/draft-labels.ts --page PAGE --catalogue scripts/experiments/import-lab/component-families.json --set C --model google/gemini-2.5-flash --out vendor-b --yes-spend
node --import tsx scripts/experiments/import-lab/merge-labels.ts --page PAGE --a vendor-a --b vendor-b
node --import tsx scripts/experiments/import-lab/eval.ts merge --a vendor-a --b vendor-b
~~~

`--provider openrouter` is the default API route. `--provider codex-cli --model gpt-6-sol` uses the installed subscription command and requires no `--yes-spend`. `claude-cli` refuses real calls on the installed Claude version because managed hooks and built-in plugins cannot be verifiably disabled. All three routes support `--concurrency 1` through `4` within each page; the default is `1`. A batch draft includes every manifest page with a block proposal and screenshot. Version-1 answer sheets supply block boundaries where present; other pages use `blocks.json`. The dry plan prints the page and block count for each source. `--only-failed` resumes failed or unfinished blocks across existing outputs and starts all blocks on pages without an output. Labels already complete are preserved. A count may be saved without an item kind; C6 reports `structure-unknown` when today's type scorer cannot locate the collection. Valid best families omitted from the acceptable list are added and marked `normalised` on the draft entry. One invalid reply gets one corrective retry, with both attempts recorded.

Subscription calls send the same text and PNG crop as the API route. Each call record includes provider, subscription billing, model, prompt and image hashes, a sanitized reply, latency, and `cost: null`; image bytes are not saved in call records. Codex runs with `-s read-only --skip-git-repo-check -C` in a fresh temporary directory, attaches the crop with `-i`, reads only the `-o` reply file, and deletes the directory after each call. See [RUNBOOK.md](RUNBOOK.md) for the exact flags and Claude limitation. `--c NAME` on merge uses a third labeller for development-page family ties; held-out pages always leave ties disputed. Each label file records `labelPromptVersion`; merge rejects differing versions. Relabel with new names `vendor-a2`, `vendor-b2`, and optionally `vendor-c2`. Merge carries founder decisions and sample corrections forward, renames the previous sheet to `answer-sheet-v2.<timestamp>.json`, then writes the new `answer-sheet-v2.json`. Version-1 answer sheets remain readable and unchanged.

## Founder review page

Start the local page with `IMPORT_LAB_ROOT` set to saved lab data:

~~~powershell
node --import tsx scripts/experiments/import-lab/review-server.ts --arm blocks-production --run RUN
~~~

Open the printed `http://127.0.0.1:4777` address. `--port PORT` selects another local port. `--arm` and `--run` select the saved development stick scores and imported components; the newest matching stick score file is used for each page. No model call runs.

Choose **Disputes** for held-out disagreements first, then development disagreements. The source crop leads; one labeller answer resolves all disputed fields in the block, or **Other** lets you choose values. **Sample** checks 30 seeded agreed held-out blocks with Right or a corrected family. **Stick check** checks 30 seeded scored development blocks against imported headings, text, images and links; its saved verdict stays hidden until after the answer. Each queue shows up to 20 items per batch and resumes at the next unanswered item. Press `1`/`2`/`3` for visible answers, `Enter` for Right, or `Esc` to see the previous item.

The start screen and `/api/summary` show the active round and both rules: **2 or more wrong out of 30 sample blocks: fix labelling instructions and relabel**; **28 or more out of 30 stick checks must agree**. Stick previews show every imported heading, full text, every image thumbnail, and each link label with its full address. After relabelling and rescoring, start `review-server.ts --arm blocks-production --run RUN --round 2` for fresh seeded checks excluding round-one blocks. Round one writes `labels/review-sample.json` and `labels/stick-check.json`; round two writes `labels/review-sample-round2.json` and `labels/stick-check-round2.json`.

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
