# Task: clean up the import lab - no dead code, as simple as possible

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*`. Work only in `scripts/experiments/import-lab/`; no production code changes. Never touch the git-ignored data under the repo-root `.import-lab/` (saved pages, runs, labels, scores, arms, reports stay exactly as they are). Never copy real site names, URLs or page text into code, tests, fixtures, README or briefs.

The owner's rule: clean up after yourself, no dead code, simplify as much as possible. The experiments are finished and decided; the lab now has one job - re-run the same block-by-block audit in future evaluations. It has grown to 78 files and about 6,100 lines. Make it as small and plain as it can be while keeping that job. Git history keeps everything that is removed.

## Decided outcomes (do not keep code for the losers)
- KEEP: snapshot, today's detection replay, repair arms + measure (Phase 1); block proposal; label drafting; review server + page; scorer; `jev-pick`; arms `oracle-blocks`, `oracle-type-today-rules`, `jev-then-llm-blocks` (with `--fill-model`, `--picks-run`, `--stall-timeout-ms`, `--infrastructure-retries`); family scoring and family-mode picking with `component-families.json`; `eval.ts`; `summary.ts`; page list file; RUNBOOK, README, `briefs/`.
- DELETE the arm `jev-then-llm-wholepage` (lost: most blocks missed).
- DELETE the arm `jev-points-code-copies` and everything that exists only for it (element tables, repeated groups, template replication, the generic mapper, re-assembly, assembly quality, its fixtures, tests and verification scripts). It lost on content kept; the owner chose deletion.
- DELETE the `oracle-type-full-rules` arm and the "full rules" machinery, including the source-rewriting of production prompt code in `production-access.ts` that exists only for it (measured: no difference from today's rules).
- DELETE the `--reasoning` flag (measured: production already sends the minimal setting, so it changes nothing).
- DELETE every one-off verification or profiling script and "before" copy kept only to prove a past change (`verify-*.cjs`, `verify-*.ts`, `*-verification.ts`, `profile-inputs.ts`, `test-support/block-input-before.ts`, `make-fixture.ts`, and any similar file) unless a kept jest test imports it - in that case fold what the test needs into the test's own fixture file.
- DELETE the giant report generators (`comparison-report.ts`, `phase2-report.ts`, the `--full` mode of `report.ts`); `summary.ts` is the report. If `report.ts` then only forwards to the summary, delete it and point `eval.ts summary` at `summary.ts`.
- Anything else that nothing imports and no documented command runs: delete. Exports used only inside their own file: make them non-exported.

## Simplify what stays
- One module per stage where that reads better than many small ones; no wrapper that only forwards arguments; no option nobody uses; no commented-out code; no "legacy" or "deprecated" branches; comments explain why, not what.
- `production-access.ts`: keep only what the kept arms need, and list at the top, in plain words, exactly which non-exported production functions it reaches and why (this list is the to-do for making them real exports when the chain is built into the importer).
- Tests: keep tests that protect kept behaviour; delete tests of deleted code; merge tiny test files. Tests must write temporary files to the operating-system temp directory, never under `scripts/experiments/import-lab/`.
- `summary.ts` must still read saved scores of arms whose code is gone (they are history) and label them "arm removed from the tool".
- README and RUNBOOK: rewrite to match what exists - short, plain, commands in order, FREE / INTERNET / PAID marks. `briefs/README.md`: keep all briefs (including this one, number 13), and add a short list of what was removed, why (one line each, with the measured result), and that the last commit containing it is on this branch's history.

## Verify
`SKIP_DB_SETUP=true npx jest scripts/experiments/import-lab --runInBand` passes (browser tests need `IMPORT_LAB_CHROMIUM_EXECUTABLE`, path in the README); `npm run typecheck` reports 0 errors; `node --import tsx scripts/experiments/import-lab/eval.ts summary` regenerates `SUMMARY.md` offline from the saved data with the same figures for the kept arms as before (compare before and after); dry runs of `eval.ts today`, `blocks`, `arms`, `score` still plan correctly; a search for every deleted symbol and file name returns nothing in the folder.

## Final message
Plain English: files and lines before and after; a table of what was deleted and why; anything you kept that looks removable and why you kept it; confirmation that the summary figures are unchanged.
