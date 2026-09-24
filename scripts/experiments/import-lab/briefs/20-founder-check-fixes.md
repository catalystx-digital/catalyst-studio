# Task: fixes from the founder's first checks

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls; never start the real claude or codex binaries (tests use fakes). Never read `.env*`. Work only in `scripts/experiments/import-lab/`; `lib/**` and `app/**` are read-only. Never write into `C:/projects/catalystx/import-lab-data` (use a temporary copy outside the repository for checks, removed with an exact-path delete afterwards). Never copy real site names, URLs or page text into code, tests, fixtures, README or briefs.

**Held-out rule:** never open, print or inspect held-out pages' labels, blocks, screenshots, components or per-block scores (`heldOut: true` in `pages.json`).

## Why
The founder reviewed all 77 labeller disputes, a 30-block sample of agreed labels and a 30-block check of the measuring stick.
- Sample: 4 of 30 agreed labels wrong (rule: 2 or more → fix the labelling instructions and relabel). Three were a section that is mostly one large product screenshot, which the founder calls "media"; the labellers did not. The hero boundary is underspecified.
- Stick check: 21 of 30 agree (rule: 28 or more). In all 9 disagreements the founder said "right" and the stick said "wrong". Asked afterwards, the founder's standard is **"everything a visitor sees is there"**, including dates and filter tabs; a header split into two sections is right if nothing is lost. Causes found:
  1. The stick demands screen-reader-only text (e.g. hidden "about X" suffixes inside "Learn more" links).
  2. The stick fails C1 when one source section is imported as two sections even though nothing is lost.
  3. The review preview truncates imported text to 300 characters, so the founder could not see losses further down (missing links, dates, tabs, wrong link domains).

## Changes
1. **Screen-reader-only text is not required.** In `source-evidence.ts`, apply the heading exclusion to ALL evidence: text runs, link labels and C7's source text exclude elements (and descendants) with `aria-hidden="true"` or a class containing `sr-only`, `visually-hidden`, `screen-reader`. Keep links themselves (their targets still count). Test: a "Learn more" link with a hidden "about X" span passes C2 and C4 when "Learn more" and the target are imported.
2. **Split rule (founder ruling).** C1 passes when a block is matched by two or more components, at least one produced family is in the block's acceptable families, and the block is not labelled `multiple`; the content checks judge any loss. Record `split: true` as today. Test: header imported as site-header + local-nav with all content passes C1; a split where no produced family is acceptable fails.
3. **The review preview shows everything.** In the stick-check queue, show ALL imported headings, the FULL imported text (no truncation; the panel scrolls), every picture thumbnail, and every link as label → full address. Keep the stick's verdict hidden. Update the test that asserted the 300-character cut.
4. **Clearer labelling instructions (hero boundary).** In the family labeller's prompt add these rules, in this order, before the precedence list:
   - "Opening banner (hero): only the section that holds the page's main heading (usually the only h1) near the top, with an intro or a primary button. Without the page's main heading it is not a hero."
   - "A section that is mostly one large picture, screenshot or video, with at most a caption or one short line, is media."
   - "A short prompt with at most two sentences and one to three prominent buttons or links, and no main heading, is a call to action."
   Bump a `LABEL_PROMPT_VERSION` constant (new) and record it in each label file; merge refuses to combine label files with different prompt versions.
5. **Relabel without losing the founder's decisions.** The founder has settled 81 blocks (`reviewedBy: "founder"` in `answer-sheet-v2.json`, with `history`). Merging new labeller outputs must carry every founder decision forward unchanged: for each block, if the previous `answer-sheet-v2.json` has a founder-settled value for a field, that value wins over any labeller or majority, and the block keeps `reviewedBy: "founder"`. Sample corrections in `review-sample.json` also win. Implement as: merge reads the previous sheet (when present) and writes the new one to `answer-sheet-v2.json` after moving the previous one to `answer-sheet-v2.<timestamp>.json` (never delete it). Tests: a founder-settled family survives a relabel where both labellers now say something else; a sample correction survives; the previous sheet is kept.
6. **Fresh checks.** Add a server option `--round 2` that draws a NEW seeded sample of 30 agreed held-out blocks and a NEW 30 development blocks for the stick check, excluding blocks used in round 1, and writes `review-sample-round2.json` / `stick-check-round2.json`. The start screen shows which round is active.

## Tests (write first)
Run with `$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit`. One test per change above, as listed.

## Verify
- Both typechecks 0 errors.
- Dry run: `eval.ts draft --provider claude-cli --model claude-opus-5-5 --out vendor-a2 --dry-run` over `IMPORT_LAB_ROOT=C:/projects/catalystx/import-lab-data` prints 573 planned calls and writes nothing.
- README/RUNBOOK updated (relabel procedure with new output names `vendor-a2`, `vendor-b2`, `vendor-c2`; round 2 checks). `briefs/README.md`: add this brief as number 20.

## Final message
Plain English: each change; test and typecheck output lines; the dry-run count.
