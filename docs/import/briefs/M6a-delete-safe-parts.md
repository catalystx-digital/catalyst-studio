# Brief M6a: delete the parts of the old importer nothing needs any more

You are a coder with one bounded task. You are not an orchestrator: do not run any engine, preflight or front-door tooling. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files (editing `.env.example` is allowed). Memory discipline: at most one Node process at a time, Jest with `--runInBand --forceExit` on one path at a time, never the whole suite at once, leave no process running.

The owner's standing rules: no over-engineering, no slop, deliver exactly what is asked; no dead code; as simple as possible. This task is DELETION. Do not refactor, rename or "improve" anything that stays. When in doubt whether something is still used, it STAYS and you list it in your final message.

## Context
`docs/import/block-detection-plan.md` (milestone M6) and an independent inventory of what the old import paths use. The owner approved deleting the SAFE parts now. Two things must keep working exactly as today, because the owner still needs them for a side-by-side comparison of real imports: the default `section` detection path, and the repair step (`adjustDetectedComponents`, `lib/studio/import/services/detection-post-processor.ts` and its folder). Do NOT touch them.

## Delete

### 1. The `page-map` detection path (never the default; superseded by `blocks`)
- In `lib/studio/import/web-detection.ts`: the `page-map` arm of the harness switch (near line 1810; the arm is roughly lines 1823-2447) and everything only it uses. After the change the switch has two arms: `blocks` and the existing `section` arm, whose body must stay textually unchanged.
- `lib/studio/import/detection/page-map-harness.ts` and its test `detection/__tests__/page-map-harness.test.ts`.
- `buildFillPromptFromCatalog` in `lib/studio/import/detection/prompt-builder.ts` (the rest of that file stays - `buildDetectionPromptFromCatalog` is used by the blocks path and the eval runner).
- Settings only the page-map path reads, in `lib/studio/import/config/import-config.ts` and `.env.example`: the fill-batch keys (`fillBatchMaxPromptTokens`, `fillBatchMaxSections`, `fillBatchMaxComponents`, `fillBatchConcurrency`, `fillEvidenceSiblingWindow`) and the version keys (`pageMapVersion`, `planSchemaVersion`, `fillSchemaVersion`, `stagedPromptVersion`) - each ONLY after you have confirmed by search that nothing else reads it. Narrow the `detectionHarness` type to `'section' | 'blocks'`; an unknown value in the environment must fail clearly at start, not silently behave as `section`.
- In `web-detection.ts`: the unused import of `parseDetectionResponse`, and any helper that after the above has no caller (verify each by search; helpers the `section` arm or the blocks modules still call STAY).

### 2. The template-generation and review cluster (nothing in the app reaches it)
- `lib/studio/import/template-generator.ts`, `template-library.ts`, `template-customizer.ts`, `lib/studio/import/services/template-storage-service.ts`.
- The review screens that import only each other: `lib/studio/import/components/review-interface.tsx`, `template-preview.tsx`, `comparison-view.tsx`, `error-boundary.tsx`, `lib/studio/import/hooks/use-review-state.ts`, `lib/studio/import/services/review-service.ts` - verify each path and that nothing in `app/**`, `components/**`, `lib/**` or `scripts/**` imports it (including dynamic imports and string references) before deleting; if one IS used elsewhere it stays.
- `app/api/studio/templates/import/route.ts` (no caller anywhere).
- `lib/studio/import/index.ts` if, as the inventory found, nothing imports it; otherwise only its template re-exports.
- In `lib/studio/import/import-pipeline.ts`: the `TemplateGenerator` construction (constructor, near line 104), the `generateTemplates` option and its block (near lines 443-489), and the related imports and types. `lib/studio/import/services/reimport-service.ts` passes `generateTemplates: false` - remove the argument. `scripts/standalone-import.ts` passes `generateTemplates: true` (near line 708) and documents a flag for it - remove both; the script must otherwise behave as before.
- Their tests: `template-generator.test.ts`, `template-library.test.ts`, `template-customizer.test.ts`, `template-storage-service.test.ts`, `template-integration.test.ts`, `use-review-state.test.ts`, `review-interface.test.tsx` (find them by name).
- If a database model or migration exists only for stored templates, do NOT touch the schema - list it in your final message as a follow-up.

### 3. The experiment lab
`scripts/experiments/import-lab/` must keep working. If any lab file references what you delete (it should not - it replays the `section` path and measures `blocks`), fix the reference minimally and say so.

## Do NOT delete
The `section` path (`processSectionTask` and everything it uses, `section-summarizer.ts`, `navbar-row-style-enrichment.ts`, byte slicing and `getSection` in `web-tools.ts`, `buildDetectionSectionPlan`), the repair code, `candidate-types.ts`, `section-taxonomy.ts`, `global-section-cache.ts`, `response-parser.ts`, `section-aggregation.ts`, `lib/studio/ai/component-catalog/prompt-builders.ts`, anything under `lib/studio/import/detection/blocks/`, `lib/studio/decisions/`, the eval runner (`lib/studio/evals/detection/`, `scripts/eval/`), `prompts/evals/**`.

## Verify
1. `npm run typecheck`: 0 errors.
2. One at a time, with counts before and after (record the baseline FIRST, before deleting anything): `SKIP_DB_SETUP=true npx jest lib/studio/import/detection --runInBand --forceExit --silent` (baseline has 4 pre-existing failures; the deleted page-map tests disappear from the total), `... lib/studio/import/__tests__/web-detection.test.ts ...`, `... lib/studio/import/services/__tests__ ...` (baseline has about 54 pre-existing failures - the number must not grow), `... lib/studio/decisions ...`, `... scripts/experiments/import-lab ...` with `CHROMIUM_EXECUTABLE_PATH=C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe`.
3. `npm run build:components` if component definitions were touched (they should not be).
4. A search for every deleted file name and every deleted exported symbol returns nothing outside `docs/` and `scripts/experiments/import-lab/briefs/`.
5. `git diff -w lib/studio/import/web-detection.ts`: the `section` arm and `blocks` arm bodies unchanged.

## Final message
Plain English: a table of what was deleted (file or symbol, production lines, test lines) with totals; everything you were unsure about and therefore kept, with the evidence; test counts before and after; follow-ups (for example database models that only stored templates).
