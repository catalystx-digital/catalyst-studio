# Task: fold four families into collection (15 → 11 families, set D)

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls. Never read `.env*`. Work in `scripts/experiments/import-lab/` and `docs/import/accuracy/`; `lib/**` and `app/**` are read-only. Offline scoring may write NEW score files under `C:/projects/catalystx/import-lab-data`; a repair run is being written there right now — never modify or delete runs, labels or existing scores. Never copy real site names, URLs or page text into code, tests, fixtures, README or briefs.

**Held-out rule:** never open, print or inspect held-out pages' blocks, labels, components or per-block results.

## Why
At gate G3 (2026-09-26) the founder decided GO on the families and to fold `stats`, `testimonials`, `pricing` and `logo-strip` into `collection`: Jev confused them with collection only 0–1.7% of the time and the folded re-score was 33.2% against 32.9%, so four fewer kinds cost nothing. Later runs use the 11-family catalogue.

## Do
1. `component-families.json`: add set `D` — set C with `statistics`, `testimonials`, `reviews`, `quote-block`, `pricing-table`, `pricing-card`, `logo-cloud` mapped to `collection`. Keep set C unchanged (history and the G3 comparison use it).
2. `family-schemas.ts`: an 11-family schema set for set D. `collection` absorbs the four: items keep the shared Item shape (a stat is `title` = value + `body` = label; a quote is `body` + `title` = name + `subtitle` = role; a price uses `meta` price/period and `links`; a logo is `media` only). Add `settings.itemKind: card | stat | quote | price | logo` (optional) alongside the existing collection settings; keep strictness and every equal-mechanics rule from 0173cec. The family-fill arm takes `--family-set C|D` (default D from now on); run records store the set.
3. Answer key: scoring under set D maps any label family in the folded four to `collection` (for `family`, `acceptableFamilies` and `familiesInOrder`), exactly like the folded re-score in compare.ts — reuse that mapping, one implementation.
4. `docs/import/accuracy/catalogue.md`: record the G3 decision and the 11 families with their one-line rules (collection's rule now covers numbers, quotes, prices and logos via `itemKind`); keep the research text.
5. `eval.ts accuracy` and `compare` accept `--family-set D`.

## Tests (write first; invented fixtures only)
Run with `$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit`.
- Set D validates; exactly 11 families; all 50 types mapped.
- A stat, a quote, a price and a logo each validate as collection items; `itemKind` is enumerated.
- A label with family `stats` scores as `collection` under set D and as `stats` under set C.
- family-fill defaults to set D and records it.

## Verify (offline, free)
Both typechecks 0. Re-score the existing `family-fill` c-r1/c-r2 development runs under set D into new score files and report development accuracy (it should equal the folded re-score, 33.2%, since those runs used 15 families). README/RUNBOOK updated; `briefs/README.md`: add this brief as number 29.

## Final message
Plain English: what changed; the set-D re-score number; test and typecheck output lines.
