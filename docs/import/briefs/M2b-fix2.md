# Brief M2b fix round 2: the repair step still runs on `blocks` results in the import pipeline

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files. Memory discipline: one Node process at a time, Jest with `--runInBand --forceExit` on one path at a time, leave no process running. Smallest correct change; nothing else.

## Evidence
Decision D10 of `docs/import/block-detection-plan.md`: the repair step `adjustDetectedComponents` is skipped when the detection result says it came from the `blocks` harness. M2b gated ONE of its two production call sites: `lib/studio/import/services/import-result-handler.ts` (around line 548, `if (detection.detectionHarness !== 'blocks')`). The other, `lib/studio/import/import-pipeline.ts` (around lines 186-201), maps over every detection result and runs `adjustDetectedComponents` unless `result.postProcessed` is already true - with no check of the harness. So a real import through the pipeline repairs `blocks` results, which is not the path that was measured.

## Fix
In `import-pipeline.ts`, skip the repair for results whose `detectionHarness` is `'blocks'`, conditioned on that result field only (never on the global setting), and leave `postProcessed` semantics sensible for both cases so the later pass in `import-result-handler.ts` behaves the same as today. Results without the field (older checkpoints, the two existing harnesses) are repaired exactly as before.

Test: in the existing pipeline or result-handler tests' style, a `blocks` result passes through the pipeline step unrepaired and a `section` result (and a result with no `detectionHarness`) is repaired as before. Note: `lib/studio/import/__tests__/import-pipeline.test.ts` currently cannot start (missing `TransformStream` in its environment, a pre-existing problem) - if that blocks a pipeline-level test, extract nothing and restructure nothing: test the smallest exported unit that contains the condition, or say plainly that it could not be tested there and why.

Verify: `npm run typecheck` 0 errors; `SKIP_DB_SETUP=true npx jest lib/studio/import/services/__tests__/import-result-handler.test.ts --runInBand --forceExit --silent` still passes, plus your new test.

Final message: plain English - the change (file:line), the test, anything not done and why.
