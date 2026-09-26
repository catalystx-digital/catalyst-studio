# Task: one targeted repair call for each incomplete section (hypothesis H-D1)

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls from anything you run: the paid path gets `--dry-run` and is verified with fake clients. Never read `.env*`. Work only in `scripts/experiments/import-lab/`; `lib/**` and `app/**` are read-only. Offline work may write NEW files under `C:/projects/catalystx/import-lab-data`; never modify existing labels or runs. Never copy real site names, URLs or page text into code, tests, fixtures, README or briefs.

**Held-out rule:** never open, print or inspect held-out pages' blocks, labels, components or per-block results (`heldOut: true`). Held-out may only pass through code paths that output one overall number.

## Why (the ledger entry, in site-kind terms)
On the 28 development pages, today's importer gets 25.0% of sections fully right. 38.9% of sections have the right kind, headings and item count and fail only because text, links or pictures were dropped, or text was invented. The fill model gets one pass and nothing tells it what it missed. Hypothesis: one second, targeted call that lists exactly what is missing restores most of it. Prediction: +8 to +15 points on the arm it is applied to; text-kept and links-kept failures fall; section kind unchanged; invented text does not rise.

## Build — a repair step over saved runs
`eval.ts repair --arm <arm> --runs <runs> [--dry-run | --yes-spend]` reads each saved development run of `<arm>` and writes a new arm `<arm>+repair` with the same run ids (`arms/<page>/<arm>+repair/<run>/`), never overwriting. For each block:
1. Build source evidence (`source-evidence.ts`) and run `verifyBlock` (brief 26) on the block's saved components.
2. Verified → copy the components unchanged (no call).
3. Not verified → ONE repair call with the same fill model, client, request settings and response parsing as the arm's own fill step (reuse production's LLM client creation and the arm's recorded settings; for `family-fill` validate with `family-schemas.ts`, for `blocks-production` with production's component validation). The prompt contains: the block's original input, the saved component JSON, and a plain list — "These items are on the page but missing from your output: <text runs>, <links as label → address>, <picture addresses>" and "This output text is not on the page; remove it or replace it with the page's own words: <invented fields>" — plus "Return the same component type with the missing items added; do not change anything else."
4. Re-verify. Keep the repaired component only if it has strictly fewer missing items AND no more invented text AND the same component type(s); otherwise keep the original. Record the decision per block.
5. Record every call (request, reply, model, usage, cost, latency) with the existing call recorder; `run.json` records the source arm/run, the repair prompt hash and totals (blocks checked, repaired, kept, cost).
Held-out pages: `--held-out` repairs the held-out runs the same way but reports nothing per block.

`eval.ts compare` must accept `--candidate <arm>+repair` and `--baseline <arm>`, mapping old types through set C on BOTH sides when the arm is `blocks-production`.

## Tests (write first; invented fixtures only)
Run with `$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit`.
- A verified block is copied with no call.
- An incomplete block gets exactly one call whose prompt lists the missing text, links (label → address) and pictures, and the invented fields.
- A repair that adds the missing items is kept; one that changes the type, adds invented text, or fixes nothing is rejected and the original kept.
- Never overwrites; held-out produces no per-block output; dry-run makes no call and writes nothing.
- compare works for `blocks-production` vs `blocks-production+repair` (set C mapping on both sides) and for `family-fill` vs `family-fill+repair`.

## Verify (offline, free)
- Dry-run on the real data root for `--arm blocks-production --runs a-r1`: report blocks checked and repair calls planned (development only). Write nothing.
- Both typechecks 0 errors. README/RUNBOOK: the repair command and how to compare. `briefs/README.md`: add this brief as number 27.

## Final message
Plain English: what was built; the dry-run counts; test and typecheck output lines.
