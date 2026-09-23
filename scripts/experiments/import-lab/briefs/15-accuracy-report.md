# Task: one-screen accuracy report, and a site-name leak check

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls. Never read `.env*`. Work only in `scripts/experiments/import-lab/`; `lib/**` and `app/**` are read-only. Real lab data may be READ from the data root given below; never copy real site names, URLs or page text into code, tests, fixtures, README or briefs. Saved runs and labels must not be rewritten.

Brief 14 added the measuring stick (checks C1–C7, `source-evidence.ts`, `scoring.ts`, `score.ts`, stick scores under `labels/<page>/scores-stick/`). Read `docs/import/accuracy/method.md` sections 2–3 first: this task implements its headline numbers and one of its rules.

## 1. One naming scheme for stick scores (clean-up first)
`score.ts` (the `--all-runs` path) and `eval.ts` (the `score` command) each hard-code a `-v5` suffix, with two different name patterns (`<run>-v5` and `<arm>--<run>-v5`). Replace both with ONE exported constant `STICK_VERSION` (value `'stick1'`) and ONE name pattern: `<arm>--<run>--<STICK_VERSION>[-family-<set>]`. A future definition change bumps the constant, which gives new files instead of silently keeping old scores. No other version strings in code.

## 2. `accuracy.ts` and `eval.ts accuracy`
Command: `eval.ts accuracy --arm <arm> --runs <r1,r2[,r3,r4]> [--family-set <set>]` reads the matching stick score files for every labelled page and writes `reports/ACCURACY.md` and `reports/accuracy.json` under the data root (never overwrite: add a timestamp to the file name of older copies, or write new names; the latest is always `ACCURACY.md`). Splits come from `pages.json`: `heldOut: true` is held-out, everything else is development. A run missing a score for a page is an error naming the page (do not silently skip).

Numbers (all on scored blocks, i.e. not ignored):
- **Accuracy per split** = Σ correct ÷ Σ scored, averaged over the given runs.
- **Interval:** page bootstrap — resample the split's pages with replacement, 2,000 draws, seeded PRNG `mulberry32(1)`, percentile 2.5/97.5 of the ratio (Σ correct ÷ Σ scored over the drawn pages, run-averaged).
- **Noise band:** with 4 runs, the half-width of the 95% page-bootstrap interval of mean(r1,r2) − mean(r3,r4); with 2 runs, the half-width for r1 − r2, labelled "single-run, conservative". With 1 run: "not measured".
- **Clean pages:** share of development pages where every scored block is correct.
- **Development diagnostics:** per check C1–C7, failure rate and upper bound (share of blocks whose ONLY failure is that check); C6 structure-unknown count; accuracy per family (set given) or per type; missed, junk and extra counts.
- **Held-out:** overall accuracy and interval only. No per-check, per-block or per-family lines anywhere for held-out pages, in either file.

`ACCURACY.md` is at most 30 lines and opens with exactly three plain-words lines, then `---`:
```
About X in 10 website sections import correctly today (likely range Y–Z in 10).
Rough first number: the answer key was drafted by AI and has not been checked yet.
The three biggest losses: <plain name of check>, <…>, <…>.
---
```
X, Y, Z rounded to one decimal, from development pages. Plain names: C1 "wrong or missing section kind", C2 "text lost", C3 "headings lost or demoted", C4 "links lost", C5 "images lost", C6 "wrong number of items", C7 "invented text". "Biggest losses" ranks by failure rate. Below the divider: the numbers above, one line each, with counts beside shares, the noise band, and the line `Hypotheses: see ledger.md in the lab data folder`. The first three lines contain no statistics words (interval, bootstrap, noise, percentile, kappa).

## 3. `leak-check.ts` and `eval.ts leak-check`
Reads the hostnames of every page in the `pages.json` of each lab data root given (`IMPORT_LAB_ROOT`, plus any extra roots passed with `--root`, repeatable). From each hostname take the name parts: split on `.` and `-`, drop parts shorter than 4 characters and generic parts (`www`, `com`, `org`, `net`, `gov`, `edu`, `html`, `info`, `shop`, `site`). Scan the added lines of `git diff origin/main...HEAD` plus untracked files (not ignored) for any part as a whole word, case-insensitive. Exit 1 printing `file:line: part` for every hit; exit 0 with `No site names found` otherwise. Never print whole page addresses.

## Tests (write first; invented fixtures only)
Run with `$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit`.
- Fixed seed → byte-identical `ACCURACY.md` and `accuracy.json`.
- Synthetic identical runs (same scores in r1..r4) → noise band 0 and the interval of the difference contains 0.
- Synthetic +10-point difference on 20 pages → the difference's lower bound > 0.
- Held-out pages produce only the overall line: no check names, block ids or family names in held-out output.
- First three lines match the template and contain no statistics words.
- A missing score for a page → error naming the page.
- Upper bound counts only blocks whose single failure is that check.
- Leak check: a hit on a fixture diff; a clean pass; an ordinary word containing a site-name part (e.g. part `test` inside `fastest` is NOT a whole-word hit) does not trigger.
- `STICK_VERSION` naming used by both score routes.

## Verify on real data (offline, free)
With `IMPORT_LAB_ROOT=C:/projects/catalystx/import-lab-data`:
1. Delete the stick score files in that data root whose names contain `-v6` (they are superseded by the new naming; nothing else there is yours to delete — if a delete is refused, report the exact paths instead).
2. `eval.ts score` for arm `blocks-production` runs `m4-r1`, `m4-r2`, raw and `--family-set C`. Raw component-right must be 156/239 and 155/239.
3. `eval.ts accuracy --arm blocks-production --runs m4-r1,m4-r2 --family-set C` and print `ACCURACY.md` in full in your final message.
4. `eval.ts leak-check` on this working tree: must print `No site names found`.

## Also
- Both typechecks 0 errors (`npm run typecheck`, and `npx --offline tsc --noEmit -p scripts/experiments/import-lab/tsconfig.json`).
- README/RUNBOOK: the `accuracy` and `leak-check` commands in two short sections. `briefs/README.md`: add this brief as number 15.
- No dead code, no commented-out code, no duplication of brief 14 logic.

## Final message
Plain English: what was built; the full real-data `ACCURACY.md`; the leak-check output; test and typecheck output lines.
