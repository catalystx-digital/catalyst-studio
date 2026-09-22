# Brief M6b: delete the old detection path and the repair step

**Do not start this until the owner has approved milestone 6b.** M6a deleted the parts nothing reached; this deletes the parts that still run today, and it is only safe once the owner has accepted the new path's imported pages.

You are a coder with one bounded task. You are not an orchestrator: do not run any engine, preflight or front-door tooling. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files (editing `.env.example` is allowed), never run `scripts/standalone-import.ts` or anything touching a database. Memory discipline: at most one Node process at a time, Jest with `--runInBand --forceExit` on one path at a time, never the whole suite at once, leave no process running.

The owner's standing rules: no over-engineering, no slop, deliver exactly what is asked; no dead code; as simple as possible. This task is DELETION. Do not refactor, rename or "improve" anything that stays. When in doubt whether something is still used, it STAYS and you list it in your final message.

## Context

`docs/import/block-detection-plan.md`, milestone M6. The `blocks` path is now the only path that should remain. Record the baseline test counts FIRST, before deleting anything.

## Delete

### 1. The `section` detection path
- In `lib/studio/import/web-detection.ts` (2,211 lines): the `section` arm of the harness switch, `processSectionTask`, and every helper only they call. After the change there is no switch left - the blocks path is the only path - so remove the branch entirely rather than leaving a switch with one arm.
- The modules only the section path uses, each only after confirming by search that nothing else reads them: `detection/section-plan.ts` (105), `detection/section-summarizer.ts` (140), `detection/section-aggregation.ts` (86), `detection/navbar-row-style-enrichment.ts` (291), `detection/section-taxonomy.ts` (155), `detection/global-section-cache.ts` (280), `detection/candidate-types.ts` (17), and their tests. **Check each one against `detection/blocks/**` and `lib/studio/evals/**` before deleting:** `candidate-types.ts` and `section-taxonomy.ts` in particular are small and may be shared.
- The byte-slicing helpers and `getSection` in `lib/studio/import/services/web-tools.ts`. The rest of that file stays - the blocks path uses `getPageStyling` and the fetch/cache helpers.
- The `IMPORT_DETECTION_HARNESS` setting itself, in `config/import-config.ts` and `.env.example`, including the start-up validation M6a added. With one path left the setting has nothing to select. The `blocks` behaviour becomes unconditional.

### 2. The repair step
`lib/studio/import/services/detection-post-processor.ts` (332) and the whole `detection-post-processor/` folder: 26 production files (about 9,900 lines) and 18 test files (about 7,200 lines). Also delete its caller path - `adjustDetectedComponents` is already skipped for blocks results at both call sites (`services/import-result-handler.ts` and `import-pipeline.ts`), so remove those guards and the calls together, and the DOM-snapshot hand-off that exists only to feed it (confirm by search that nothing else consumes the snapshot).

### 3. The lab's replay of the old path
`scripts/experiments/import-lab/` must keep working and keep measuring the blocks path. Delete only its replay of the `section` path and any arm that runs it; saved results stay as history in the git-ignored `.import-lab/` data. If a lab file imports something you delete, fix the reference minimally and say so.

## Do NOT delete
Anything under `lib/studio/import/detection/blocks/`, `lib/studio/decisions/`, `response-parser.ts`, `prompt-builder.ts`'s `buildDetectionPromptFromCatalog`, `lib/studio/ai/component-catalog/prompt-builders.ts`, the page-builder and region code, the eval runner (`lib/studio/evals/detection/`, `scripts/eval/`), `prompts/evals/**`, the shared browser launcher.

## Verify
1. `npm run typecheck`: 0 errors.
2. One at a time, counts before and after: `SKIP_DB_SETUP=true npx jest lib/studio/import/detection --runInBand --forceExit --silent` (4 pre-existing failures), `... lib/studio/import/__tests__/web-detection.test.ts ...`, `... lib/studio/import/services/__tests__ ...` (about 54 pre-existing failures - the number must not grow), `... lib/studio/decisions ...`, `... scripts/experiments/import-lab ...` with `CHROMIUM_EXECUTABLE_PATH` set.
3. `npx next build` completes (needs `IMPORT_MODEL_CHAIN` set to any value, or it throws while collecting page data).
4. A search for every deleted file name and every deleted exported symbol returns nothing outside `docs/` and the lab's `briefs/`.
5. Report lines removed against lines added.

The orchestrator runs the end-to-end import afterwards; do not run it yourself.

## Final message
Plain English: a table of what was deleted (file or symbol, production lines, test lines) with totals; everything you were unsure about and therefore kept, with the evidence; test counts before and after; follow-ups.
