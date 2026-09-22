# Task: add a retry rule for stalled and truncated calls to the import-lab arms

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*`. Work only in `scripts/experiments/import-lab/`; no production code changes. Paid runs may be executing from this folder right now: make your edits small and keep every existing command-line flag and default behaviour exactly as it is.

## Why
Measured on ten real pages: in the `jev-then-llm-blocks` arm, 12 of 19 missed blocks were infrastructure failures - 6 calls that returned nothing until the 300-second timeout and 6 replies cut off mid-JSON - while completed extraction calls take a median of 26 s (90th percentile 95 s). Today the arms retry only on validation failure.

## What to add (opt-in, default off so existing runs stay comparable)
New flags on `run-arm.ts`: `--stall-timeout-ms <n>` and `--infrastructure-retries <n>`.
- When `--infrastructure-retries` is above 0, a block extraction call that ends in `timeout` or in a truncated / incomplete reply is retried with the SAME request, up to n more times, each attempt using `--stall-timeout-ms` (when given) instead of the long timeout. Validation-failure retry keeps working as it does now and does not count against this budget.
- Every attempt is its own saved call file with `attempt` number and `retryReason` (`timeout` | `truncated`). `run.json` records the two settings under `rules`, plus counts: infrastructure retries attempted, recovered, exhausted.
- The end-of-run per-block line shows attempts.
- Works for every LLM arm; decision-model calls get the same treatment for timeouts.
Tests with fake clients: timeout then success (recovered); truncated then success; exhausted after n; default (flag absent) behaves exactly as before; validation retry still independent. `SKIP_DB_SETUP=true npx jest scripts/experiments/import-lab/comparison-arms` (plus any new test file) passes; scoped typecheck clean. Add a short README paragraph.

Final message: plain English, what changed, exact example command.
