# Task: the go / no-go screen for the 15 families

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls. Never read `.env*`. Work only in `scripts/experiments/import-lab/`; `lib/**` and `app/**` are read-only. Offline scoring may write NEW stick score files and reports under `C:/projects/catalystx/import-lab-data`; never modify labels or runs. Never copy real site names, URLs or page text into code, tests, fixtures, README or briefs.

**Held-out rule:** held-out pages (`heldOut: true`) may only pass through code paths that output one overall number per arm. Never print or inspect their blocks, labels, per-check or per-family results.

## Why
Both arms now run through the same production block path (brief 23): `blocks-production` (today's 50 types) and `family-fill` (the 15 approved families via the catalogue override). Runs `c-r1` and `c-r2` exist for both arms on the 28 development pages, and `c-r1` for both arms on the 10 held-out pages. The founder decides go / no-go on moving the app to the families from one screen (plan gate G3, method.md section 3).

## Build — `eval.ts compare`
`eval.ts compare --baseline blocks-production --candidate family-fill --runs c-r1,c-r2 --held-out-runs c-r1 --family-set C` scores both arms with the stick (set C family mode for the baseline; the candidate's types are already families) and writes `reports/COMPARE.md` (≤ 30 lines) and `reports/compare.json`.

`COMPARE.md` opens with three plain-words lines, then `---`:
```
GO | NO-GO: the 15 section families import <X> in 10 sections correctly, against <Y> in 10 today (development pages).
The difference is <D> points (likely range <L> to <U>); it <holds | does not hold> when any one website is left out.
Held-out pages: families <H1> in 10, today <H0> in 10.
---
```
**GO** only when all hold (method.md section 3, keep rule): (a) the page-bootstrap 95% interval of the development gain (mean of the two runs per arm, paired by page) is entirely above 0; (b) the point gain stays above 0 when each development site is left out in turn (site = hostname in `pages.json`); (c) no check C1–C7 falls with its paired interval entirely below 0; (d) extra plus junk components rise by no more than the noise band (use the stick noise band from the baseline's own two runs, page-bootstrap half-width of mean-run difference is not available with two runs, so use the half-width of r1 − r2 labelled "single-run, conservative"); and held-out does not fall below the baseline by more than that noise band. Otherwise **NO-GO**, and the report names which condition failed.

Below the divider, one line each (counts beside shares): development accuracy per arm with intervals; the paired gain with interval; the leave-one-site-out gains (min, max, and the site kind — not name — of the minimum); per-check failure rates per arm and their paired change; sections dropped per arm (blocks with no component because the fill failed validation — read from run records); extra and junk per arm; cost and wall-clock per arm (from call records and run records); the same gain restricted to pages where both arms produced the same number of blocks; **Jev family choice:** top-1 and any-of-top-3 agreement with the answer key's acceptable families for the candidate arm; **fold measurement:** how often Jev's choice flips between `collection` and each of `stats`, `testimonials`, `pricing`, `logo-strip` (share of blocks whose key family is one of the pair and whose pick is the other), and the development accuracy re-scored for free with those four folded into `collection`.

## Tests (write first; invented fixtures only)
Run with `$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit`.
- A synthetic clear win → GO with all conditions listed as met; a win that disappears when one site is left out → NO-GO naming condition (b); a check that clearly falls → NO-GO naming (c); a held-out drop beyond the band → NO-GO.
- Leave-one-site-out groups pages by hostname, never by page.
- Held-out output contains only the overall line per arm.
- Fold re-score: a block whose key is `stats` and pick is `collection` counts as right only in the folded mapping.
- Byte-identical output for the same input (seeded bootstrap).
- The first three lines contain no statistics words (interval, bootstrap, kappa, percentile) and no check codes.

## Verify (offline, free)
The paid runs may still be in progress while you work. Verify with invented fixtures. Only if every c-r1/c-r2 run directory for both arms on development pages and c-r1 on held-out pages already exists, run the command on the real data root; print `COMPARE.md` in full in your final message (it contains only development aggregates, site kinds and overall held-out numbers). Both typechecks 0 errors. README/RUNBOOK: the compare command; `briefs/README.md`: add this brief as number 24.

## Final message
Plain English: what was built; the full COMPARE.md; test and typecheck output lines.
