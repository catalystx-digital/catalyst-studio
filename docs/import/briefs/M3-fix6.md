# Brief M3 fix round 6: independent review findings

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files. Memory discipline: one Node process at a time, Jest with `--runInBand --forceExit` on one path at a time, leave no process running. The owner's standard: no over-engineering, no slop, smallest correct change, no dead code. An independent review confirmed the production changes are sound, the old path is safe and nothing in the briefs is missing. Fix exactly the items below.

## Must fix
1. **The replay can serve the wrong stylesheet text for a URL** (`scripts/experiments/import-lab/replay.ts`, around lines 27 and 37). Production appends downloaded stylesheet texts in fetch-COMPLETION order (`lib/studio/import/services/web-tools.ts`, inside `Promise.all`, around line 1437), not document order, so for snapshots saved without stylesheet URLs the index pairing is a guess. My earlier brief said "document order" - that was wrong. Supply `stylesheets` to the browser ONLY when the snapshot saved each stylesheet's URL. For older snapshots keep using the guessed base for the styling MAP only (where it merely affects how a relative background-image URL is resolved), supply no stylesheet texts, and record this as "map only" in the run output. Update the test accordingly.
2. **Every recorded call stores the request twice** (`scripts/experiments/import-lab/call-recording.ts`, around line 11: `payload: structuredClone(request)` beside `request`). Nothing reads `payload`. Delete it.

## Should fix
3. `lib/studio/import/utils/json-parsing.ts` / `response-parser.ts`: when trailing characters after the first complete JSON value are dropped, that is silent. Record it the way the parser already records its other repairs (one parser repair note), so it is visible in diagnostics.
4. `lib/studio/import/services/web-tools.ts` (around line 1774): the downloaded stylesheet texts are now kept for every caller, including the old section path that never reads them (up to five CSS bodies per live handle). Keep them only when the detection harness is `blocks`.
5. `lib/studio/import/detection/blocks/block-cutter.ts` (around line 71): the count of declared external stylesheets includes print-only `<link media="print">`, which the importer's own stylesheet extraction deliberately skips, so a page whose only external stylesheet is print-only would be rejected. Apply the same print-only rule (reuse the existing production function; export it if needed).
6. `block-cutter.ts` (around line 651): the all-stylesheets-failed check runs after the expensive geometry evaluate. Run it before.
7. `scripts/experiments/import-lab/replay.ts` (line 5) and `draft-labels.ts` (line 31): inline `require(...) as typeof import(...)` where the file already imports the same module's types. Make them plain top-level imports, or state the reason in one comment line if a lazy require is truly needed (for example environment loading order).
8. `scripts/experiments/import-lab/jev-pick.ts` (around lines 42-44): family mode mutates the shared production question object in place and restores it in `finally`. If production's pick function can take the option list as a parameter with a minimal change, pass it; otherwise keep it and say why in one comment line.
9. `run-arm.ts` / `jev-pick.ts` (around line 86): `record.retryCount = 0` is a constant. Record the real number or drop the field for that arm.
10. Small: `families.test.ts` (around line 59) and `family-fixtures.ts` (around lines 35, 64) still name removed arms - rename to arms that exist. RUNBOOK section 2 says the cutter fetches stylesheets from the network "exactly as production does" two paragraphs before saying saved ones are served from disk - make it one true statement. Add a one-line comment on each `lib/` export that exists only for the lab (`STALL_TIMEOUT_MS`, `INFRASTRUCTURE_RETRIES`, `resolveRoots`, `renderPickEvidence`).

## Verify
`npm run typecheck` 0 errors; one at a time: `SKIP_DB_SETUP=true npx jest lib/studio/import/detection --runInBand --forceExit --silent` (exactly the 4 pre-existing failures), `... lib/studio/import/services/__tests__ ...` (same counts as before this round), `... scripts/experiments/import-lab ...` with `CHROMIUM_EXECUTABLE_PATH=C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe`.

## Final message
Plain English, one line per item: done or not done and why.
