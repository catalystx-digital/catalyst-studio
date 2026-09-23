# Brief: fix8 review round 1 - footer links, duplicate spellings, header utility links

Same rules as `docs/import/briefs/fix8-menu-first-page-picking.md` (read it). Amend the uncommitted change in this working copy; smallest correct change, no dead code.

The reviewer reproduced, in `lib/studio/import/services/sitemap-discovery.service.ts`:
1. **Footer links fill the cap** (~line 72). A `<nav>` inside `<footer>` makes `/privacy/`, `/terms/`, `/contact/`, `/cookies/` fill a 6-page cap ahead of content. Fix: `extractNavigationUrls` ignores anything inside a `<footer>` element.
2. **Spelling variants take separate slots** (~line 313). Nav `/About/` and `/about` plus sitemap `/about/` yield three candidates. Fix: compare by one key - host + pathname lowercased with the trailing slash removed (match the case-insensitive convention the file already uses for sitemap keys and priority paths) - when deduping nav links, when removing nav links from the sitemap remainder, and when building the final ordered candidate list. Keep the first spelling seen.
3. **Header utility links fill the cap.** Reachable `/login/`, `/account/`, `/cart/`, `/search/`, `/fr/` in the header take all five non-home slots. Fix, applied to menu-sourced links only (they may still be picked later from the sitemap spread like any page): drop links whose first path segment is one of a short named constant list - `login`, `log-in`, `signin`, `sign-in`, `logout`, `register`, `signup`, `sign-up`, `account`, `my-account`, `cart`, `basket`, `checkout`, `search`, `wp-login.php`, `wp-admin` - and links that are language switches: an `<a>` with an `hreflang` attribute, or a path that is only a language code (`/fr`, `/en-au/`, regex `^/[a-z]{2}(-[a-z]{2})?/?$` case-insensitive). One short comment saying this is a heuristic for menu links only.

Tests first (confirm they fail before the fix), in `lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts`: footer nav ignored; `/About/` + `/about` + sitemap `/about/` → one candidate; header with login/cart/search/`/fr/` + two content links → content links chosen, utility links not from the menu.

Verify, quoting raw jest summary lines: `npx tsc --noEmit -p tsconfig.json`; `SKIP_DB_SETUP=true npx jest lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts --runInBand --forceExit`; `npm run test:import`.

Final message: plain English - each fix with file:line, each new test, raw jest summary lines.
