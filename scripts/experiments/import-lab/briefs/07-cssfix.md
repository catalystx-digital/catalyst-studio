# Task: unblock block extraction on real pages (CSS enrichment matching)

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*`. Work only in `scripts/experiments/import-lab/`; no production code changes. Real data under `.import-lab/` may be READ (never copy real names/URLs/text into code, tests, fixtures, README).

## What happened on the first real run
`run-arm.ts --arm jev-then-llm-blocks` on a real saved page: 8 of 9 blocks failed at stage `decision` with
`Cannot faithfully recover external CSS enrichment from saved production nodes: <blockId>/<nodeId>`.
Saved run: `.import-lab/arms/<page-slug>/jev-then-llm-blocks/run-1/` (run.json failures, inputs.json). The page snapshot is `.import-lab/pages/<page-slug>/` (`page.html`, `outline.json`, `sections.json` = the production node lists per byte-slice, `stylesheets.json` = the text of every stylesheet production fetched, without URLs).

Your "fail rather than guess" rule is right in spirit, but it currently rejects almost every real block, so nothing can be measured. Make recovery deterministic instead of giving up:

1. Production's node list for the whole page (all saved sections concatenated in order: header, main slices in byte order, footer) and your per-block node list are both pre-order traversals of the same saved HTML with the same preprocessing. So a block's nodes correspond to a CONTIGUOUS run of the saved production nodes. Locate that run by aligning on document order - e.g. match the sequence of (tag, id, class, text, attributes-without-enrichment) for the block's nodes against the saved nodes, requiring the whole sequence to match in order; when a single node's identity is ambiguous, the sequence alignment disambiguates it. Copy the CSS-derived enrichment fields from the aligned saved nodes.
2. If the sequence aligns at more than one place (truly repeated identical blocks, e.g. desktop and mobile copies), use the occurrence index: the k-th identical block in document order maps to the k-th matching run. Record `enrichment: "aligned-by-order"` on the block input.
3. If nodes exist in the block but not in the saved sections (production dropped them, or the section was omitted), or alignment still fails, do NOT fail the block: proceed WITHOUT CSS enrichment for the unmatched nodes and record per block how many nodes were enriched / unenriched and why. Failing a whole block is reserved for an anchor that does not resolve.
4. The same applies to every arm and to `jev-pick` (all use the shared block-input code).
5. Print at the end of each run one line per block: blockId, region, allowed types, status, seconds, and a final line with wall-clock, calls, retries, failures.

Tests: invented fixtures for unique alignment, repeated identical blocks (k-th occurrence), nodes missing from saved sections (proceeds unenriched and records it), unresolved anchor (still fails). `SKIP_DB_SETUP=true npx jest scripts/experiments/import-lab/comparison-arms` (and any new test file) pass; scoped typecheck clean.

Then verify offline against the REAL saved page above: build block inputs for all 9 blocks with a dry run (`--dry-run`, supplying assumed picks if your dry run needs them) and report per block: nodes, enriched, unenriched, alignment mode. All 9 must build.

Final message: plain English - what changed, the real-page table, anything still failing.
