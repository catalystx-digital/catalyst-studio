# Task: fix the block finder in the import lab (it under-cuts real pages)

You are a coder with one bounded task. You are not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, do not read any `.env*` file.

**Another coder is working in this same folder right now on other files.** You own ONLY: `block-proposal.ts`, `propose-blocks.ts`, `phase2-browser.test.ts`, any `block-proposal*.test.ts`, and block-related fixtures in `phase2-fixtures.ts` (append only). Do NOT edit `README.md`, `report.ts`, `score.ts`, `scoring.ts`, `labels.ts`, `draft-labels.ts`, `review*.`, or anything else - put README notes in your final message instead. If typecheck or jest shows errors in files you do not own, they are the other coder's half-finished work: ignore them, and re-run only your own tests (`npx jest scripts/experiments/import-lab/block-proposal scripts/experiments/import-lab/phase2-browser`). Set `IMPORT_LAB_CHROMIUM_EXECUTABLE=C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe` for browser tests.

## What the orchestrator found on a real page

`propose-blocks.ts` was run on a real saved home page (rendering was fine: 1440 x 2645 px). A person looking at the screenshot sees about nine blocks: a logo + small utility menu row; a main menu bar; a large image carousel with a caption; a row of four coloured link tiles; a 2 x 2 group of four illustrated feature items; a news strip with a heading; a "support us" strip with a heading; and a footer.

The finder returned **2 blocks**: one 2,025-px-tall block for everything above the footer, and the footer. Its saved children were: a 116-px header row, a 48-px menu row, a 1,832-px content container, and an EMPTY 21-px spacer row. The cause, verified in `block-proposal.ts` `proposeGeometry`: `noOwnContent` demands that every visible meaningful child is at least 48 px high, so ONE small spacer child stops all descent; and descent also demands every child be at least 80% of the parent's width. The site uses no `<header>` / `<main>` tags, only nested `div` containers about 1,170 px wide centred in the 1,440 px viewport.

## Required changes

1. **Save the rendered geometry.** `propose-blocks.ts` must write the full geometry tree it measured (every visible element: anchor key, tag, id/class, box, own-text length, visibility, children) to `.import-lab/labels/<slug>/geometry.json`, and block proposal must be a PURE function of that file. Add `--from-geometry` so blocks can be re-proposed offline with no browser and no internet. (The orchestrator will render the real pages; you can then only test on fixtures, so make the pure function easy to unit test with hand-written geometry trees.)

2. **A sturdier cutting rule.** Replace the all-or-nothing rule with this, and document the named constants:
   - Children that are empty, invisible, or tiny (under 48 px high AND without meaningful content) are ignored; they never block descent. A small child that does carry content (a heading row, a breadcrumb line) is attached to the band that follows it, or to the previous band if it is last.
   - Group a node's remaining children into horizontal **rows** by vertical overlap (children whose vertical ranges overlap by more than half of the shorter one belong to the same row). 
   - A node is cut into its rows when it is taller than `TALL_BLOCK` (700 px) and has at least two rows, regardless of how wide the children are relative to the viewport. A node with a single meaningful child is a wrapper: descend into it.
   - A row made of several side-by-side children is ONE block (a row of tiles or cards is one thing) - do not descend into its columns - UNLESS the row is itself taller than `TALL_BLOCK` and one column is at least twice as wide as the others (a main column beside a sidebar): then cut the wide column by the same rule and emit each other column as its own block.
   - A row at or under `TALL_BLOCK` tall is a leaf block. A row consisting of only a heading (under 120 px, heading element, little other text) merges into the block that follows.
   - Recurse until every block is at most `TALL_BLOCK` tall or cannot be cut further (a single element with its own text, an image, a list). A block that stays taller than 1,500 px is kept but recorded in `issues` as "probably under-cut".
   - **Regions without semantic tags:** when the page has no `header` / `main` / `footer` elements, mark as `header` the leading blocks that lie in the top 300 px and consist mainly of links / logo image (or carry `role=banner`, or id/class containing `header`, `nav`, `masthead`), and as `footer` the trailing blocks with `role=contentinfo` or id/class containing `footer`. Adjacent header blocks merge into one header block; same for footer. Everything else is `main`.
   - Each block still stores one level of child candidates for the review page's "Split" button, computed with the same row grouping.
   - Print, per page: number of blocks, tallest block height, number of "probably under-cut" issues, share of resolved anchors.

3. **Tests** (pure, from hand-written geometry trees, plus the existing local-browser fixtures): the spacer-child case above must now yield the expected bands; centred narrow container; a row of four tiles stays one block; 2 x 2 grid inside a 550-px container stays one block; main column + sidebar; heading-only row merges forward; small content-bearing child attaches; no semantic tags -> header/footer regions detected and adjacent header rows merged; a 3,000-px single-text article stays one block and is flagged; `--from-geometry` reproduces the same blocks as the browser path on a fixture.

## Verify
Your own jest files pass; `npx tsc --noEmit -p scripts/experiments/import-lab/tsconfig.json` shows no errors in files you own. Redirect long output to files.

## Final message
Plain English: what changed, the constants and why, the README text the other coder should add for this rule, what you could not verify without real pages.
