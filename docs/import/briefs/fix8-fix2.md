# Brief: fix8 review round 2 - narrow the menu rules

Same rules as `docs/import/briefs/fix8-menu-first-page-picking.md`. Amend the uncommitted change; smallest correct change, no dead code. Prefer making rules narrower over adding new ones.

The reviewer reproduced, in `lib/studio/import/services/sitemap-discovery.service.ts`:
1. ~72 `pageKey` drops the query: `/page?id=one` and `/page?id=two` collapse. Fix: key = lowercased host + lowercased path without trailing slash + the unchanged query string.
2. ~96 the language regex drops real sections `/us/` ("About us"), `/it/` ("IT services"). Fix: remove the path regex; treat a link as a language switch only when the `<a>` has an `hreflang` attribute.
3. ~93 utility names drop descendants: `/register/heritage-buildings/` disappears. Fix: exclude a menu link only when its whole path (trailing slash removed, lowercased) equals `/` + one of the names; never descendants.
4. ~83 `<header>` inside `<article>`, `<section>`, `<aside>` or `<main>` is treated as site navigation, so author links fill slots. Fix: a `<header>` counts as navigation only when it has none of those ancestors. `<nav>` and `role="navigation"` are unchanged (still excluded inside `<footer>`).
5. ~335 when a menu spelling (`/About/`) and a sitemap spelling (`/about/`) match, the menu spelling is kept and the sitemap metadata lookup (`import-result-handler.ts` ~734) misses. Fix: when a sitemap entry has the same key, use the sitemap entry's URL spelling in the ordered list.

Tests first (confirm they fail before the fix), in `lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts`, one per item above. Update the earlier header-utility test to use `hreflang` for the language link.

Verify, quoting raw jest summary lines: `npx tsc --noEmit -p tsconfig.json`; `SKIP_DB_SETUP=true npx jest lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts --runInBand --forceExit`; `npm run test:import`.

Final message: plain English - each fix with file:line, each new test, raw jest summary lines.
