# Task: block finder, round 3 - problems seen on ten real pages

You are a coder with one bounded task. You are not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, do not read any `.env*` file.

**Another coder is working in this same folder right now on other files.** You own ONLY: `block-proposal.ts`, `propose-blocks.ts`, `phase2-browser.test.ts`, `block-proposal*.test.ts`, and block fixtures you append to `phase2-fixtures.ts`. Do NOT edit anything else (README notes go in your final message). Errors in files you do not own are the other coder's unfinished work: ignore them and run only your own tests by path. Browser tests need `IMPORT_LAB_CHROMIUM_EXECUTABLE=C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe`.

The orchestrator rendered ten real saved pages with your last version and looked at every screenshot with the blocks drawn on it. Real `geometry.json` and `blocks.json` files now exist under `.import-lab/labels/<slug>/` - you may READ them offline to reproduce problems 2-4 with `--from-geometry` (never copy real names, URLs or text into code, tests or fixtures; build invented geometry trees with the same shape). The hospital pages now cut well (9 blocks and 5 blocks, matching what a person sees). Four problems remain:

## 1. One page rendered with NO styling, so its 42 blocks are meaningless
Every stylesheet failed with reason `csp`: the page carries a Content-Security-Policy that only allows its own origin, and the saved HTML is loaded into a blank-origin document. Fix the rendering approach so the saved HTML is served AS the page's real final URL: navigate the browser to the final URL and answer that one document request from the saved `page.html` (Playwright `page.route` + `route.fulfill`), letting every other request (CSS, images, fonts) go to the network normally. That gives the right origin for CSP, relative URLs and cookies, and makes the `<base href>` trick unnecessary. Keep the instrumentation that lets anchors resolve against the un-mutated saved HTML. Also set `bypassCSP: true` on the context as a second line of defence.
Add a **styling check**: after load, count stylesheets that actually applied (accessible `document.styleSheets` with at least one rule, plus `<style>` elements). If none applied while the HTML declares stylesheets, record a top-level issue `rendered without styling - blocks are not trustworthy` and set `status: "unstyled"` so later steps can refuse the page. Record every failed stylesheet request with its failure reason.

## 2. Lazy content never rendered
One page has a 9,578-px-tall dark empty region because content below the fold loads on scroll. Before measuring: scroll the page from top to bottom in viewport-sized steps with a short pause at each, wait for network to go quiet (bounded, e.g. 10 s total), scroll back to the top, then measure. Record how long this took. Keep `--no-js` working.

## 3. Header and footer swallow main content
On one page block 1 (region `header`) is 700 px tall and contains the logo, the menu AND the big banner carousel; and the last block (region `footer`) contains a whole "News" section of four articles plus the real footer. Rules to add:
- A `header` block is at most `MAX_HEADER_HEIGHT` (300 px). If the header-region element is taller, cut it by the normal row rule; only the leading rows that are mostly links/logo stay `header`; the rest become `main` blocks (a banner inside `<header>` is a main block).
- Only merge adjacent header rows while the merged block stays within `MAX_HEADER_HEIGHT`.
- A block is `footer` only if it is itself (or lies inside) a `footer` element / `role=contentinfo` / id-class containing `footer`. Never merge a non-footer row into the footer block. If a footer-region element is taller than `TALL_BLOCK` and its leading rows contain headings with article-like content, those rows become `main`.

## 4. One visual grid split into several blocks
A 3 x 3 grid of tiles under a single "What we offer" heading came out as three consecutive blocks (one per row). Merge consecutive rows into one block when: they are siblings under the same parent, have the same number of columns with near-identical column x-positions and widths (within 5%), no heading-only row sits between them, and the merged block stays under `UNDER_CUT_HEIGHT` (1,500 px). Keep the heading row attached to the merged block. The merged block's child candidates are the original rows, so the reviewer's "Split" button can still undo it.

## Tests
A pure test per rule in 3 and 4 from invented geometry trees (tall header containing a banner; footer preceded by a news section; 3 x 3 grid with heading; grid rows with different column counts must NOT merge). A local-browser fixture for 1: a fixture page with a `Content-Security-Policy` meta tag restricting styles to `'self'` and a linked local stylesheet must render styled through the route-fulfil approach (serve fixture files from a local 127.0.0.1 server), and a variant whose stylesheet is missing must be reported `unstyled`. A local fixture for 2 with content added on scroll.

## Verify
Your own jest files pass; no type errors in files you own (`npx tsc --noEmit -p scripts/experiments/import-lab/tsconfig.json`, ignore other files). Then re-propose offline with `--from-geometry` for every real page that has a `geometry.json` and report, per page (by slug only), block count before and after and any remaining issues - for problems 3 and 4 say whether the real geometry now cuts as described above.

## Final message
Plain English: what changed; before/after block counts per slug; README text for the other coder to add; what only the orchestrator can verify with internet.
