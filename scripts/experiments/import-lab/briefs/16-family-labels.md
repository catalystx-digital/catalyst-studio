# Task: an answer key two independent models can agree on

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls from anything you run: paid commands get `--dry-run` and are verified with fake clients. Never read `.env*`. Work only in `scripts/experiments/import-lab/`; `lib/**` and `app/**` are read-only. Real lab data may be READ from `C:/projects/catalystx/import-lab-data`; never copy real site names, URLs or page text into code, tests, fixtures, README or briefs. Saved runs, labels, answer sheets and scores must not be rewritten.

## Why
The accuracy stick (briefs 14–15) scores against answer sheets drafted by one AI model and accepted without block review (235 of 259 blocks). A number measured against an unchecked key cannot be trusted. The founder approved 15 section families (set `C` in `component-families.json`; decisions in `docs/import/accuracy/catalogue.md`). Build the tools for a family-level answer key made by two independent labellers from different vendors, merged by rules, with only disagreements left for the founder.

## 1. Site kinds in the page manifest (`pages.ts`)
- Add a required `siteKind` to every page entry, one of: `saas`, `shop`, `hospitality-local`, `professional-services`, `government`, `health`, `education`, `charity`, `magazine-news`, `docs-portfolio-events`. `validatePages` rejects a missing or unknown kind.
- `pages.ts --add <url>` takes `--site-kind <kind>` (required).
- Add `pages.ts --set-site-kind <page> <kind>` so existing entries can be filled in without editing JSON by hand.
- Existing callers of `validatePages` keep working once kinds are filled in; do not add a silent default.

## 2. Family labeller (`draft-labels.ts`, `labels.ts`)
Replace the 50-type drafting path with a family path (remove the old path; no dead code):
- Options: `--catalogue <families file> --set <name> --model <openrouter model id> --out <name>` plus the existing `--page`, `--dry-run`, `--yes-spend` conventions. Writes `labels/<page>/label-<out>.json` and refuses to run if that file exists. `--only-failed` resumes failed blocks of that same output file.
- Version-2 label per block:
  `family` (string|null), `acceptableFamilies` (string[], contains `family`), `multiple` (boolean), `familiesInOrder` (string[], ≥2 when `multiple`), `placement` (`header|main|sidebar|footer`), `ignore` (boolean), `ignoreReason` (string), `itemCount` (number|null), `itemKind` (string|null, kept only so today's 50-type components can still be counted), `decorativeImages` (string[] of image addresses; the labeller answers with image-group ids and the code stores all addresses of those groups), `reason` (string).
- Validation: family and every listed family must exist in the chosen set; `family` in `acceptableFamilies` unless `ignore`; `multiple` ⇔ `familiesInOrder.length >= 2`; `ignore` needs a reason; `itemCount` needs `itemKind`.
- The prompt for each block contains ONLY: the block's screenshot crop; its text runs, headings and links (from `blockEvidence` in `source-evidence.ts`); its image groups as `{id, width, height, alt, address}` (give `ImageGroup` a stable `id` — its index within the block — if it has none); code-detected repeated-child counts (existing `repeatedHtmlChildren`); and the approved families with their one-line descriptions, the precedence order and the granularity rule from `catalogue.md` section 3. It must NEVER contain importer output, decision-model picks, or another labeller's labels. State in the prompt: "Label what the source shows; do not guess what an importer would produce."
- Record every call like today (request, reply, model id, usage, cost, latency) under the page's `calls/`.

## 3. Merge and agreement (`merge-labels.ts`, new)
Command: `merge-labels.ts --page <page> --a <out-name> --b <out-name> [--c <out-name>]`, and an `eval.ts merge` batch form over all pages. Writes `labels/<page>/answer-sheet-v2.json` (never overwrites; the version-1 `answer-sheet.json` stays untouched) and `labels/agreement.json` (all pages).
Per block and field, **agreed** or **disputed**:
- family: agreed when both best families are equal; acceptable families = intersection of both lists (must contain the best family, else disputed).
- placement, ignore, multiple/familiesInOrder: agreed when equal.
- itemCount: agreed when equal, or when the code-detected count equals one labeller's count (that value wins).
- decorativeImages: agreed when the sets are equal, or when the code rule settles the difference (a group under 16 px on both sides, a 1x1 pixel, or a cloned carousel copy is decorative by rule).
- With `--c` on a development page (`heldOut: false`): a disputed family is settled by majority of a, b, c; only a three-way split stays disputed. Held-out pages never use `--c`: their disputes go to the founder.
- A disputed field is written as `{disputed: true, a: …, b: …, c?: …}` so a review page can show the options. A block with any disputed field has `status: "disputed"`; otherwise `status: "agreed"`, `reviewedBy: "model-agreed:<a-model>+<b-model>"`.
- `agreement.json` reports: per-field agreement rate, Cohen's kappa on family (development and held-out separately), ignore count per labeller, average acceptable-list width per labeller, and disputed block counts per split.
- Exit 1 with `labels untrustworthy: fix instructions and relabel` when family agreement < 85% or kappa < 0.7 (over all pages).

## Tests (write first; invented fixtures only)
Run with `$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit`.
- Manifest: missing or unknown `siteKind` rejected; `--set-site-kind` updates one entry.
- Label schema: each validation rule above, one test each.
- Prompt: built from a fake page, contains families and image-group ids, contains no importer-output, pick or other-label fields (assert on the serialised request).
- Refuses an existing output file; `--only-failed` resumes only failed blocks.
- Merge: each agree/dispute rule; majority with `--c`; held-out pages ignore `--c`; code tie-break for item count and decoration; kappa on a hand-computed fixture; the threshold exit.
- A fake-client end-to-end run: two labellers on an invented page, merge, and an `answer-sheet-v2.json` with the expected agreed and disputed blocks.

## Also
- Both typechecks 0 errors (`npm run typecheck`; `npx --offline tsc --noEmit -p scripts/experiments/import-lab/tsconfig.json`).
- `eval.ts draft ... --dry-run` on the real data root prints the planned calls and an estimated cost for one model over all labelled pages (read-only; it must not write labels).
- README/RUNBOOK: the site-kind commands, the labelling commands (dry-run and paid, with `--yes-spend`), and the merge command. `briefs/README.md`: add this brief as number 16.
- No dead code; the 50-type drafting path is removed, not left beside the new one.

## Final message
Plain English: what was built; the dry-run call count and cost estimate for one labeller over the real pages; test and typecheck output lines; anything in this brief that looked wrong, with evidence.
