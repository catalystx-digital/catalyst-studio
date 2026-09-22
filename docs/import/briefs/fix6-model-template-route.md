# Brief: a template chosen by the decision model must be route-eligible for the page

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files, never run `scripts/standalone-import.ts` or anything touching a database. Memory discipline: one Node process at a time, Jest with `--runInBand --forceExit` on one path at a time, leave no process running. Smallest correct change. Other uncommitted changes in this working copy must be kept.

## Evidence
A real 6-page import with `IMPORT_DETECTION_HARNESS=blocks` (which requires `DECISION_MODEL_ENABLED=true`) failed at page building: `Template marketing/home-default is not route-eligible for path /act` (thrown by `lib/studio/import/services/page-builder/template-resolver.ts`, around line 221, via `isTemplateRouteEligible`). The saved detection result for that inner page says: `templateKey: marketing/home-default, source: model, reason: "Selected by the decision model from page content (p=0.90)"`. Three different sites failed the same way on their first inner page.

Cause: `selectPageTemplateWithModel` in `lib/studio/import/web-detection.ts` (around lines 796-832) asks the `page.type` decision question and accepts its answer after checking only `templateAllowsDetectedComponents`. It never checks route eligibility, so a home-eligible template can be accepted for a non-root path. The deterministic scorer next to it (`selectPageTemplate`, around line 926) does filter home-eligible templates out for non-root paths. The `page.type` question was built earlier with the decision model switched off by default, so this path never ran in a real import until the blocks harness switched the model on.

## Fix
In `selectPageTemplateWithModel`, treat a model answer that is not route-eligible for the page's path exactly like an unknown template: return `deterministic`. Reuse the existing rule - `isTemplateRouteEligible` from `template-resolver.ts` (export it if needed) or the same home-eligibility rule the scorer applies - do not write a new one. No other behaviour change.

Test: with a fake decision client answering a home-eligible template for `/about`, the result is the deterministic template; for `/` the model's home template is accepted; a non-home template for `/about` is accepted as before.

Verify: `npm run typecheck` 0 errors; `SKIP_DB_SETUP=true npx jest lib/studio/import/__tests__/web-detection.test.ts --runInBand --forceExit --silent` and `... lib/studio/import/services/page-builder ...` - counts before and after.

Final message: plain English - the change (file:line), the test.
