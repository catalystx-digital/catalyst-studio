# Task: an "is anything missing?" check for every imported section

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls. Never read `.env*`. Work only in `scripts/experiments/import-lab/`; `lib/**` and `app/**` are read-only. Offline scoring may write NEW files under `C:/projects/catalystx/import-lab-data`; never modify labels or runs. Never copy real site names, URLs or page text into code, tests, fixtures, README or briefs.

**Held-out rule:** never open, print or inspect held-out pages' blocks, labels, components or per-block results (`heldOut: true`).

## Why
The plan (method.md; plan step D1) commits to a check that runs after a section is imported and says, from the source page alone, whether anything a visitor sees is missing: text, links, pictures. It needs no answer key, so it can later run inside the importer. It is the runtime twin of the measuring stick's content checks, and it is the basis for the first improvement idea (one targeted repair call listing what is missing).

## Build
1. `verify.ts`: `verifyBlock(evidence, components)` returning `{ verified: boolean, missing: { text: string[], links: {url,label}[], images: string[][] }, invented: string[] }`. It must REUSE the stick's existing functions for C2 (text kept), C4 (links kept), C5 (content images kept) and C7 (no invented text) from `scoring.ts` / `metrics.ts` / `source-evidence.ts` — no copied logic. It takes no label: decoration marks are not available at run time, so C5 uses the code rule only (1x1, under 16 px, cloned, hidden), and headings are checked as text (C3 needs heading fields, so C3 is reported separately as `headingsKept` but does not decide `verified`).
2. `eval.ts verify --arm <arm> --runs <runs>`: for every development page and run, compute `verifyBlock` per scored block and write `labels/<page>/verify/<arm>--<run>.json` (never overwrite). Add to `ACCURACY.md` (when that arm is reported) one line: "Sections the automatic check calls complete: N of M", and one line: "Agreement between the automatic check and the measuring stick's content checks: K of M".
3. **Proven identity:** for every scored development block, `verified === true` exactly when the stick's C2, C4, C5 (with decoration marks removed) and C7 all pass. Any mismatch is a bug in reuse; the command prints mismatches and exits 1.

## Tests (write first; invented fixtures only)
Run with `$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit`.
- Reuse the stick's mutation fixture F1 (brief 14): M1 → verified; M4 → missing text listed; M6 → missing link listed; M7 → missing image group listed; M9 → invented text listed; M2 → headings not kept but decided through text.
- The identity holds on every F1 mutation (verified ⇔ C2, C4, C5-by-rule, C7 pass).
- Never overwrites a verify file; held-out pages are skipped.

## Verify (offline, free)
Run `eval.ts verify --arm blocks-production --runs a-r1,a-r2` on the real data root (development pages only) and report the two new ACCURACY lines and that the identity check found 0 mismatches. Both typechecks 0 errors. README/RUNBOOK: the verify command; `briefs/README.md`: add this brief as number 26.

## Final message
Plain English: what was built; the two numbers from the real run; identity mismatches (must be 0); test and typecheck output lines.
