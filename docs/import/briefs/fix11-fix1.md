# Brief: fix11 - make the hidden-class rule general instead of slick-specific

Same rules as `docs/import/briefs/fix11-keep-carousel-slides.md`. Rework the uncommitted change in this working copy; smallest correct change, no dead code.

Your root cause is right: `parseCssForHiddenSelectors` (`lib/studio/import/services/web-tools.ts` ~935) marks `.slick-slide` hidden from `.slick-slide{display:none}` and ignores the later `.slick-initialized .slick-slide{display:block}`. But the fix is written for slick only (`initializedSlickSlide`, `inInitializedSlickSlider`, `slick-cloned`). The same pattern is common elsewhere: `.swiper-slide`, Bootstrap `.carousel-item{display:none}` + `.carousel-item.active{display:block}`, tab panels, dropdown menus.

Fix in the parser, generally, and remove the slick-specific code from `traverseToNodes` / `isExplicitlyHiddenDomNode` / `classListContainsHiddenSelector`:
- A class is recorded as hidden only if the page CSS has a bare `.class{...display:none...}` (as today) **and no rule re-shows it**: no other selector whose last compound contains `.class` (e.g. `.x .class`, `.class.active`, `.parent > .class`) declares `display` with a value other than `none`, or `visibility: visible`. Apply the same rule to ids.
- Rules inside `@media` blocks do not count as re-showing (keep the existing `@media` handling as it is).
- Keep dropping slick's `slick-cloned` duplicates only if that can be done without framework-specific code; if not, leave clones in (the fill prompt already tells the model to represent repeated items once) and say so.

Tests (update yours, confirm they fail on main's parser): slick fixture from before still yields every real slide once; a Bootstrap-style `.carousel-item{display:none}` + `.carousel-item.active{display:block}` fixture keeps the items; a plain `.is-hidden{display:none}` with no re-show still hides; inline `display:none` and the `hidden` attribute still hide.

Verify (quote raw jest summary lines): `npx tsc --noEmit -p tsconfig.json`; `SKIP_DB_SETUP=true npx jest lib/studio/import/detection/blocks --runInBand --forceExit`; `npm run test:import`; and re-list the block:5 image URLs for the saved page.
