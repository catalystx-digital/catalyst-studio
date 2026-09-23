# Brief: carousel slides are stripped before the fill model sees a block

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files, never run `scripts/standalone-import.ts` or anything touching a database. One Node process at a time; Jest with `SKIP_DB_SETUP=true --runInBand --forceExit`. Smallest correct change, no dead code. **Find and state the root cause with evidence before changing code.**

## Evidence
A measurement of 18 imported pages found 15 visible images lost before the fill model ever saw them, all in carousel/slider rows. Example: the home page of a charity site has an "Our impact" icon row built with the slick carousel (`IconRow-slider` > `slick-slider slick-initialized` > `slick-list` > `slick-track` > slides, each `IconRowItem` with an `<img class="IconRowItem-img" src="/globalassets/.../vest_dark-red_rgb.png">` and a title). The recorded fill request for that block (block:5) contained only these nodes:

```
div.container, div.IconRow-title-container, h3.IconRow-title "Our impact", div.IconRow-slider,
div.slick-slider.slick-initialized, div.slick-list, div.slick-track
```
and `resourcesSummary.images: []` - every slide, icon and title under `slick-track` was removed. The same happens to a three-item icon row on the site's contact page.

A saved copy of the page is at `.import-lab/pages/www-redcross-org-au-f07eb1aeb2b486b8/page.html` (with `stylesheets.json` and `manifest.json` beside it). It is a real third-party page: use it only to find the cause; do not copy it into the repository. Build a small synthetic fixture for the test.

Block input is built by `buildBlockInput` in `lib/studio/import/detection/blocks/block-input.ts`, which calls `traverseToNodes` in `lib/studio/import/services/web-tools.ts`; hidden-node rules live there (~150-215: hidden classes, `hidden` attribute, `aria-hidden`?, inline styles, CSS-derived `hiddenByClass`/`hiddenById` from `parseCssForHiddenSelectors` ~861). Likely suspects, unverified: slick marks off-screen slides `aria-hidden="true"` / `tabindex="-1"` or the page CSS hides `.slick-slide` until JS runs, and the node filter drops every slide including the visible ones; or cloned slides (`slick-cloned`) handling removes all.

## Task
1. Reproduce with the saved page: run the production block input for that block (the lab's replay in `scripts/experiments/import-lab/replay.ts` / `blocks-production.ts` shows how production is fed from a snapshot) and show which rule removes the slides. State it with file:line.
2. Fix so that visible slides of a carousel reach the fill model once each: keep real slides; still drop slick's duplicate `slick-cloned` slides and anything genuinely hidden (the fill prompt already tells the model to ignore inactive duplicates). Do not weaken hidden-content filtering in general.
3. Tests first (confirm they fail): a synthetic slick-style carousel fixture (initialised markup with `slick-track`, real slides some with `aria-hidden="true"`, and `slick-cloned` copies) → every real slide's image and title appear once in the block input; clones do not; a genuinely hidden element (`display:none` / `hidden`) still does not.

## Verify (quote raw jest summary lines)
- `npx tsc --noEmit -p tsconfig.json`
- `SKIP_DB_SETUP=true npx jest lib/studio/import/detection/blocks --runInBand --forceExit`
- `SKIP_DB_SETUP=true npx jest lib/studio/import/services/__tests__ --runInBand --forceExit`
- `npm run test:import`
- Show the block:5 input nodes for the saved page after the fix (list of image URLs it now contains).

Final message: plain English - the root cause with file:line and evidence, the change, the tests, the raw jest summary lines, and the after-fix image list.
