# Brief: fix11 round 2 - a named carousel/tab exception instead of a general CSS rule

Same rules as `docs/import/briefs/fix11-keep-carousel-slides.md`. Rework the uncommitted change; smallest correct change, no dead code.

The reviewer rejected the general "re-shown class is not hidden" parser rule: CSS alone cannot tell a carousel slide from a closed modal, cookie banner, newsletter overlay or duplicate mobile menu (`.modal{display:none}` + `.modal.show{display:block}` now reaches the fill model), and the selector parsing mis-reads `:not()`, `:has()`, attribute values, `!important` and pseudo-elements.

Do this instead:
1. **Restore `parseCssForHiddenSelectors` in `lib/studio/import/services/web-tools.ts` exactly to its state on `origin/main`** (including the `@media` behaviour). Remove the re-show scanner.
2. Add one named constant list of carousel-slide and tab-panel classes that the class-based hidden rule must ignore (a class on this list never makes an element hidden by `hiddenByClass`; the `hidden` attribute, inline `display:none`, `aria-hidden` handling if any, and every other hidden class still apply): `slick-slide`, `swiper-slide`, `carousel-item`, `splide__slide`, `glide__slide`, `flickity-cell`, `owl-item`, `tab-pane`. Apply it in `classListContainsHiddenSelector` (or wherever class-hidden is decided) with one comment: these frameworks hide items with a base class and reveal them with script-added state classes, so the base class says nothing about whether the content is real.
3. Drop duplicate loop copies these libraries insert, by class: `slick-cloned`, `swiper-slide-duplicate`, `splide__slide--clone`, `cloned` when the element also has `owl-item`. Named constant, one comment.
4. Nothing for modals, overlays, cookie banners, mobile menus or dropdowns changes.

Tests (confirm the new ones fail on origin/main's code): slick fixture - every real slide once, clones dropped; Bootstrap `.carousel-item{display:none}` + `.carousel-item.active{display:block}` - items kept; `.tab-pane` - panels kept; `.modal{display:none}` + `.modal.show{display:block}`, `.cookie-banner`, `.mobile-nav` with `.is-open .mobile-nav{display:block}` - all still excluded; plain `.is-hidden{display:none}` still hides; inline `display:none` and `hidden` still hide. Remove tests that only covered the removed parser rule.

Verify (quote raw jest summary lines): `npx tsc --noEmit -p tsconfig.json`; `SKIP_DB_SETUP=true npx jest lib/studio/import/detection/blocks --runInBand --forceExit`; `SKIP_DB_SETUP=true npx jest lib/studio/import/services/__tests__/web-tools --runInBand --forceExit` if such tests exist; `npm run test:import`; re-list the block:5 image URLs for the saved page.
