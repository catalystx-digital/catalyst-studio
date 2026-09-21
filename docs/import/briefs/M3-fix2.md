# Brief M3 fix round 2: the block cutter's browser script breaks under esbuild-based runtimes

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files. Memory discipline: one Node process at a time, Jest with `--runInBand --forceExit`, leave no process running. The owner's standard: no over-engineering, no slop, smallest correct change.

## Evidence
The first real run of the `blocks-production` arm failed on every page before any model call:
`Web detection failed: page.evaluate: ReferenceError: __name is not defined`.
Cause: `renderAndCut` in `lib/studio/import/detection/blocks/block-cutter.ts` passes a function containing named inner functions to `page.evaluate`. Runtimes built on esbuild with names kept (this repo's `tsx` scripts, including the real command-line importer `scripts/standalone-import.ts`) wrap such functions in a helper `__name(...)` that does not exist inside the browser page. Jest does not do this, so the tests passed. The experiment lab had already met this and solved it in `scripts/experiments/import-lab/lab-browser.ts` (line 11): it evaluates a string that defines a local no-op `__name` and then calls the function's source. That guard was lost in the port.

## Fix
1. In `block-cutter.ts`, make every `page.evaluate` that passes a function with inner functions immune to this - the same way the lab did, in one small local helper used by those calls. Keep it minimal and explain the reason in one comment line.
2. Test that would have caught it: run the existing browser-backed test's evaluate path with a function whose source contains a `__name(` call (as esbuild would emit) and assert it still returns the geometry; skipped with the existing message when no Chromium is configured.
3. Check `lib/studio/design-system/dom-probe/` for the same exposure (functions with inner named functions passed to `page.evaluate`). Report what you find; fix only if it is the identical defect and the fix is the same helper.

## Verify
`npm run typecheck` 0 errors; `SKIP_DB_SETUP=true npx jest lib/studio/import/detection/blocks --runInBand --forceExit` with `CHROMIUM_EXECUTABLE_PATH=C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe`; then prove it under the runtime that failed: with that variable set, run a throwaway `tsx` script (delete it afterwards) that calls `renderAndCut` on a small inline html document served through its own interception (no network) and prints the number of blocks.

## Final message
Plain English: the change, the proof under `tsx`, what you found in the DOM probe.
