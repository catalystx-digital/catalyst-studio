# Task: score against the new answer key and retire the old one

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls. Never read `.env*`. Work only in `scripts/experiments/import-lab/`; `lib/**` and `app/**` are read-only. Real lab data may be READ from `C:/projects/catalystx/import-lab-data`; offline scoring may write NEW stick score files there; never copy real site names, URLs or page text into code, tests, fixtures, README or briefs.

**Held-out rule:** never open, print or inspect held-out pages' labels, blocks, screenshots, components or per-block scores (`heldOut: true` in `pages.json`). Held-out data may only pass through code paths that output overall numbers. Use development pages or invented fixtures for any inspection.

## Why
Briefs 16–18 produced `labels/<page>/answer-sheet-v2.json` for all 38 pages: family labels agreed by two labellers from different vendors, with development disputes settled by a third and held-out disputes settled by the founder on the review page. The measuring stick (briefs 14–15) still reads the version-1 `answer-sheet.json` (50 types, AI-drafted, unreviewed). Switch the stick to version 2 and remove version-1 label handling from the scoring path.

## Changes
0. **Merge first (merge-labels.ts):** the third labeller (`--c`) is optional per block. A block with no complete C label is merged from A and B alone (its disputes stay disputed); only A and B must be complete. Test: a development page where C failed on one disputed block keeps that dispute, and C settles the others. Then, in the verify step below, run `eval.ts merge --a vendor-a --b vendor-b --c vendor-c` on the real data root FIRST (it writes answer-sheet-v2.json files, none exist now) and report agreement.json (kappa, disputed blocks per split).
1. **Scoring reads v2.** `score.ts`/`scoring.ts` read `answer-sheet-v2.json`. C1 compares each produced component's family (set C mapping of its type, or its family directly when the component type is already a family name) with the block's `acceptableFamilies`; `multiple` blocks compare the produced family multiset with `familiesInOrder`. `ignore` blocks are not scored. C5 excludes `decorativeImages`. C6 uses `itemCount` (and `itemKind` when present for today's types; otherwise structure-unknown as now). A block whose label still has any disputed field is **not scored** and is counted as `unsettled` in the score and in ACCURACY.md; it never silently counts as correct or wrong.
2. **Version bump.** Bump `STICK_VERSION` (`'stick2'`), so new scores never mix with stick1 files.
3. **Retire version 1 from scoring.** Remove the version-1 label schema and conversion from the scoring path, `pick-score.ts`, `jev-pick.ts`, `summary.ts` and `family-summary.ts` wherever they only served v1 scoring. If a module still needs v1 for a live purpose, name it in your final message instead of deleting it. A v1 sheet passed to the v2 scorer is rejected with a clear message.
4. **ACCURACY.md line 2** reads, when every scored block's label is settled: "The answer key was checked by two AI models from different companies; a third settled most disagreements and the founder settled the rest." While unsettled blocks remain it reads: "Answer key not finished: N sections still await a decision." (N = unsettled count). Held-out rules unchanged.
5. **Archive step (documented, not automatic):** RUNBOOK tells the operator to move version-1 sheets to `archive/labels-v1/<page>/` once stick2 scores exist; do not move data yourself.

## Tests (write first; invented fixtures only)
Run with `$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit`.
- A v2 fixture scores: family match, multiple blocks, ignore, decoration exclusion, item count.
- A block with a disputed field is `unsettled`, excluded from the denominator, and counted.
- A v1 sheet is rejected with a clear message.
- Line 2 of ACCURACY.md in both states.
- stick1 and stick2 files never collide.

## Verify (offline, free)
With `IMPORT_LAB_ROOT=C:/projects/catalystx/import-lab-data`: score arm `blocks-production` runs `a-r1,a-r2,a-r3,a-r4` into stick2 files and run `eval.ts accuracy --arm blocks-production --runs a-r1,a-r2,a-r3,a-r4 --family-set C`. Report the first 8 lines of ACCURACY.md and the unsettled count per split. (The 18 newer pages have no production runs yet; the report must say which pages were skipped for lack of runs rather than failing.)

## Also
- Both typechecks 0 errors.
- README/RUNBOOK updated; `briefs/README.md`: add this brief as number 19.
- No dead code.

## Final message
Plain English: what changed; which v1 code was removed and anything kept (with the reason); the ACCURACY.md lines; test and typecheck output lines.
