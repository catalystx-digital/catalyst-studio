# Task: one written definition of accuracy, scored by code (the measuring stick)

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls from anything you run. Never read `.env*`. Work only in `scripts/experiments/import-lab/`; no production code changes (`lib/**`, `app/**` are read-only). Real lab data may be READ from the data root given below; never copy real site names, URLs or page text into code, tests, fixtures, README or briefs. Saved runs, labels and existing scores must not be rewritten.

## Why
The importer's goal is 95% content accuracy, but "accuracy" has never been written down, and today's per-block checks take their expected headings and button labels from AI-drafted labels. Tracing showed:
- the invented-text check compares against the whole page, so text moved into the wrong block counts as found (`metrics.ts`, `measureTextNotFound`);
- every srcset size is recorded as a separate image, so "every image kept" would demand all sizes (`metrics.ts`, image collection);
- a run marked `failed` in `run.json` usually means one fill call failed; the rest of the page's components are still in `components.json`;
- three labelled blocks have no anchor (`resolveRoots` resolves 261 of 264).

Build a scorer whose expected content (text, headings, links, images) is derived from the source page by code, so labels only need a family, acceptable families, an ignore flag, an item count and decoration marks.

## Definition to implement

### Evidence per block — new file `source-evidence.ts`, `blockEvidence(html, stylesheets, block, geometry)`
**One visibility rule for text, headings, links and images.** An element is hidden when the existing hidden test in `extractPageEvidence` says so, given the page's saved stylesheets (`pages/<page>/stylesheets.json`) plus the page head's `<style>` tags, passed in explicitly because a serialised fragment has no head. Also hidden: any element whose class contains `cloned`, `slick-cloned` or `swiper-slide-duplicate` (case-insensitive substring), and its descendants. Do NOT use geometry's `visible` flag (it marks inactive carousel slides as not visible). Reuse the existing hidden logic; do not write a second one.

- **Text runs:** `extractPageEvidence` on the serialised block roots (from `resolveRoots`, `lib/studio/import/detection/blocks/block-input.ts`). Runs under 12 characters are already dropped (`metrics.ts`); keep that.
- **Headings:** h1–h6 and `role=heading` passing the visibility rule; exclude `aria-hidden="true"` and classes containing `sr-only`, `visually-hidden` or `screen-reader`.
- **Links:** from the page HTML. Normalise with `absoluteUrl(…,'link')` against the page's final URL; remove tracking parameters `utm_*`, `gclid`, `fbclid`, `msclkid`, `mc_cid`, `mc_eid`, `_ga`, `_gl`; compare `mailto:`/`tel:` as the lower-cased address without query; skip `#` and `javascript:`; dedupe within the block; keep each link's visible label.
- **Image groups:** one per `img`/`picture` holding every address it uses (`src`, `data-src`, `srcset`, `data-srcset`, `<source srcset>`, plus the addresses geometry records for that node); one per CSS background image (the node's own images minus its children's). Size = the larger of the rendered geometry box and the `width`/`height` attributes. Match geometry nodes to the block by anchor path prefix.
- **Word count.**

A block with no anchor: build its evidence from `blocks.json` (its `text`, `links`, one group per `images` address) and record an issue on the score. Throw only when `geometry.json` is missing.

### Checks — replace `checkContent` in `scoring.ts`
Checks run on the components that the existing `matchComponents` assigns to the block; a component spanning several blocks is checked against their union. Text normalisation for C2, C3 and C4 labels: NFKC, collapsed whitespace, case-insensitive, trailing punctuation ignored. Output links are normalised exactly like source links.

| # | Check | Rule |
|---|---|---|
| C1 | Found, right family | ≥1 matched component, and every produced type's family is in the block's acceptable families. Existing multi-component rule kept. Raw-type mode (no family option) compares types exactly as today. Merges/splits reported, not failed. |
| C2 | Text kept | Each text run: ≥90% of its 5-word sequences found in one component's joined text (reuse `measureTextKept`/`fieldCorpus`). A run under 5 words must appear whole. In a block under 12 words, every run must be found. |
| C3 | Headings exact | Every counted heading appears as a whole value or phrase in a field whose last key is `title`, `heading`, `headline`, `subheading`, `subtitle`, `eyebrow`, `name` or `question`. List these keys once, in one constant. |
| C4 | Links kept | Every counted link target appears in the output; every link label of ≥1 word, other than one already checked in C3, appears exactly. |
| C5 | Content images kept | Every content image group has ≥1 of its addresses in the output. Excluded: 1x1 pixels; groups under 16 px on both sides; hidden or cloned groups; duplicate groups; groups labelled decoration (none exist yet in v1 labels). A group with no size information at all IS counted. |
| C6 | Item count | Existing `countItems` with the label's `itemKind`. No count label → does not apply. |
| C7 | No invented text | Unit: characters of the component's human-text fields after normalisation. A field is "not found" when <90% of its 5-word sequences occur in this block's own source (text plus alt, title, aria-label). Fails when not-found characters exceed 5% of the block's output human-text characters. Only fields whose key is `alt` are exempt (count them separately). Text found elsewhere on the page is reported as "moved" and still counts as not found. `measureTextNotFound` takes the source as an argument; update its caller in `measureArm`. |

**Missed and failed pages.** A block is missed when no component matches it (existing behaviour). A page's blocks are all missed only when `run.json` is absent, `components.json` is absent, or `run.json` records a failure at stage `run`.

Blocks labelled "ignore" are not scored; if imported, count as junk. Unmatched components count as extra. Keep the existing verdict names.

### Families
- `families.ts`: accept any named set in the file, not only `A`/`B`.
- `component-families.json`: add set `C` mapping exactly the 50 page-content types (from `.import-lab/_page-types.json`) to these 15 families: site-header [navbar]; site-footer [footer]; local-nav [breadcrumbs, sidemenu]; hero [hero-banner, hero-simple, hero-minimal, hero-with-image, hero-video, hero-carousel, hero-split, article-header]; content [text-block, html-block, two-column, about-section, feature-showcase, author-bio, blog-post, contact-info]; collection [card-grid, feature-grid, feature-list, team-grid, content-feed, blog-list, related-posts, timeline]; logo-strip [logo-cloud]; stats [statistics]; testimonials [testimonials, reviews, quote-block]; pricing [pricing-table, pricing-card]; disclosure [accordion, tabs]; cta [cta-banner, cta-simple, cta-button-group]; form [cta-with-form, contact-form, simple-form]; table [data-table, chart, feature-comparison]; media [image-gallery, video-player, video-embed, location-map]. Give each family a one-line description. If a type in `_page-types.json` is not in this list, stop and report it.
- Version-1 labels map to families through the existing `acceptableFamilies(label.acceptableTypes, set)` call in `scoring.ts`. Do not write a label converter.

### Output location
`score.ts` writes stick scores to `labels/<page>/scores-stick/` (a new folder, never overwriting). Existing `scores/` and `scores-family-*/` are untouched.

## Tests — write first, invented fixtures only
Run with a dummy model chain, because `lib/studio/import/config` throws without one:
`$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit`

**Mutation tests** on one invented fixture F1: an h2 "Our services for families"; a paragraph of at least 20 words; three `<li><h3>Item title N here</h3><p>…12+ words…</p></li>` items; one content img 300x200 with a two-size srcset; `<p><a href="/stories/one?utm_source=x">Read the full story</a></p>`. Each mutation must fail EXACTLY these checks:

| Mutation | Failing checks |
|---|---|
| M1 exact copy (uses the other srcset size; link without utm) | none (accurate) |
| M2 drop the h2 | C2, C3 |
| M3 h2 text stored in a body field | C3 |
| M4 drop half the paragraph | C2 |
| M5 keep link label as plain text, drop the URL | C4 |
| M6 drop the link entirely | C2, C4 |
| M7 drop the image | C5 |
| M8 drop item 3 | C2, C3, C6 |
| M9 add 30 invented words | C7 |
| M10 wrong family | C1 |
| M11 no component | missed; no other check applies |

If a listed expectation turns out to be impossible under the definition above, do not bend the definition silently: report it in your final message with the reason.

**Other tests:** srcset variants, lazy `data-src` and a CSS background each form one group; an aria-hidden slide image with a 0x0 box and no size attributes is counted, `width=12 height=12` is excluded, a `slick-cloned` slide is excluded; a `display:none` element from a saved stylesheet rule is excluded; a screen-reader-only heading is excluded; a heading in different letter case passes; a relative output link matches an absolute source link; `tel:`/`mailto:` comparison; duplicate links and tracking/trailing-slash variants; text moved to another block fails the receiving block and is reported as moved, `alt` exempt; a run with one failed section leaves only its blocks missed, a stage-`run` failure makes all blocks missed; a no-anchor block is scored from `blocks.json` with an issue; all 50 types map to exactly one set-C family and an unmapped produced type throws; the same input gives a byte-identical score file; missing `geometry.json` throws.

## Verify on real data (offline, free)
A copy of the labelled lab data is at `C:/projects/catalystx/import-lab-data` (20 pages; runs `arms/<page>/blocks-production/m4-r1` and `m4-r2`). Set `IMPORT_LAB_ROOT` to it. Then:
1. Raw-type mode (no family option) must reproduce component-right (correct + content incomplete) of **156/239** for m4-r1 and **155/239** for m4-r2.
2. Family mode with set C: report the numbers; they must be ≥ the raw-type ones.
3. Report per check how many blocks fail it, and how many blocks fail ONLY that check, for both runs.
4. Report the no-anchor blocks and how they were scored.

## Also
- `npm run typecheck -- --incremental false` and `npx --offline tsc --noEmit -p scripts/experiments/import-lab/tsconfig.json`: 0 errors.
- Remove code made dead by replacing `checkContent` (e.g. label-driven heading and button checks). No leftovers, no commented-out code.
- README/RUNBOOK: one short section on the stick (what each check means, where scores go). `briefs/README.md`: add this brief as number 14 with its finding.

## Final message
Plain English: what was built; the real-data numbers from "Verify"; any mutation expectation that could not hold and why; anything in the definition that looked wrong to you, with evidence; the exact test and typecheck output lines.
