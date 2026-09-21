# Task: fix the measuring code in the import lab (round 2)

You are a coder with one bounded task. You are not an orchestrator. Do not commit, stage, push or branch. No network, no paid model calls, do not read any `.env*` file.

**You may edit ONLY these files** in `scripts/experiments/import-lab/`: `metrics.ts`, `metrics.test.ts`, `measure.ts`, `report.ts`, `fixtures.ts`, `README.md`. Do NOT touch `snapshot.ts`, `detect.ts`, `replay.ts`, `runtime.ts`, `storage.ts` - paid runs are executing from them right now. Do not touch anything outside that folder. Do not delete or modify anything under `.import-lab/` at the repo root except by re-running `measure.ts` / `report.ts`.

## What the orchestrator found on the first real page

A real run is saved at `.import-lab/runs/<page-slug>/run-1/` with its page at `.import-lab/pages/<page-slug>/`. You may read these local files to reproduce the problems (they are git-ignored; never copy their content, site name or text into code, tests, fixtures or README - write invented example.com fixtures that reproduce the same shape).

The report said 50.4% of text was "without source support" (113 of 224). That figure is wrong, for two verified reasons:

1. **Catalogue boilerplate is being counted as page content.** Most flagged strings come from each component's `metadata` subtree - `metadata.keywords[n]`, `metadata.commonNames[n]`, `metadata.patterns[n]`, `metadata.accessibility.ariaLabel` - which is static text from the component catalogue, not something the model extracted from the page. 
2. **Real page text is being flagged as invented.** Excerpts such as the carousel captions are present verbatim in `page.html` (inside elements like `<div class="item"> ... <div class="example-carousel-text">`), and were present in the section payloads the model was shown, yet they are flagged. The checker's hidden-element rule removes them from the source text, so text that exists in the page counts as "not in the page".

## Required changes

A. **Only measure extracted content.** Text/image/link measurements must walk the part of a component that holds page content (`content`, and `props` if present), never `metadata`, `type`, ids, region/location or other catalogue/bookkeeping fields. Verify against the real saved `pre-repair.json` what the top-level keys of a component actually are, and state in the README exactly which subtrees are measured and why.

B. **"Invented" must mean "appears nowhere in the page".** The source for the invented-text check is ALL text in the saved HTML, hidden or not, plus the attribute text already collected (alt, title, aria-label, placeholder, value, meta content) plus `<title>`. Hidden text is still real text. Rename the measure in code and report to plain words: "Text not found anywhere on the page".

C. **"Text kept" needs two yardsticks, reported side by side**, because they answer different questions:
   - against the page's VISIBLE text (what a visitor sees) - today's behaviour, keep it;
   - against the text the model was actually SHOWN: the text inside the saved section payloads (`sections.json` in the page folder - inspect its real shape). This separates "lost before the AI ever saw it" from "lost by the AI".
   Also report one line per page: how much of the visible text never reached the model at all.

D. **Do not punish a correct split.** Today a page piece only counts as kept if one single component string contains the whole piece, so `<div><span>Title</span><span>Description</span></div>` imported correctly into two fields counts as lost. Replace whole-piece containment with word-shingle coverage: split each page piece into overlapping 5-word shingles (pieces shorter than 5 words: the whole piece), and count a shingle as kept if it occurs in the normalised text of ANY measured component string, or across the concatenation of adjacent string fields of the same component in document order. A piece is "kept" when at least 90% of its shingles are kept; also report the raw shingle-level share. Apply the mirror-image rule for the invented check: a component string is "not found" only when fewer than 90% of its shingles occur in the page source. Keep the 90% figure as one named constant and explain it in the README.

E. **Count each distinct page piece once.** The page repeats identical blocks (desktop and mobile copies). De-duplicate page pieces by normalised text within a region before scoring, and report how many duplicates were removed.

F. **Normalise typographic variants** before comparing: curly vs straight quotes and apostrophes, en/em dashes vs hyphen, non-breaking and zero-width spaces, ellipsis character vs three dots.

G. **Make the report readable.** It was 41 KB for one page. 
   - Start with a summary of at most 12 lines in plain English: pages, runs, and for each of the two arms (`off`, `on-own-page`) the overall kept / not-found figures with counts, plus which arm is better on each measure.
   - Drop the `on-as-production` column entirely from tables; mention once, in one sentence, that it is skipped and why.
   - Per page: ONE compact table (rows = measures, columns = arms) for `overall`, then `header` / `main` / `footer` tables only where the region has at least one eligible item.
   - For every figure where the two arms differ, the report must list WHAT differs: the text pieces, images and links that one arm has and the other lacks, and which repair step(s) made the change when telemetry allows. The owner's question is "does the repair code help or hurt, and which step" - the first real page showed repair-on LOSING links (94.1% -> 84.3% kept) and adding 5 links not on the page, so this list matters.
   - Move long lists (all missing pieces, all not-found pieces) to a per-page appendix file and link to it.
   - Add per-run cost, call count, repair-call count, total latency and prompt characters from the saved `calls/*.json` to the per-page section.

H. **Tests.** Add a unit test for every rule above (A-F), each with a small invented fixture that fails on the old code. Keep all existing tests passing or update them with a one-line reason in the test name/comment when the definition legitimately changed.

## Verify (all offline)

- `SKIP_DB_SETUP=true npx jest scripts/experiments/import-lab` - all pass.
- `npm run typecheck` - 0 errors (generated Prisma types are now linked, so the baseline really is 0).
- Re-run `measure.ts` for page `<page-slug>` run `run-1`, then `report.ts`. `measure.ts` needs no model call; if it needs env variable NAMES, say which. If it cannot run without env, say so and the orchestrator will run it.
- In your final message give the old and new headline figures for that run side by side, and spot-check by hand 10 strings still flagged "not found anywhere on the page": say for each whether it is a true finding (really absent / reworded) or still a checker error. Be honest: if the checker is still wrong, say so.
Redirect long command output to a file and read the file; do not pipe through grep/tail.

## Final message

Plain English. Files changed; old vs new figures; the 10 spot-checks; anything you could not verify; anything in this brief you believe is wrong, with evidence.
