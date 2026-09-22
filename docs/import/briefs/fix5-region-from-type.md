# Brief: replace the substring rule that infers a component's page region

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files, never run `scripts/standalone-import.ts` or anything touching a database. Memory discipline: one Node process at a time, Jest with `--runInBand --forceExit` on one path at a time, leave no process running. Smallest correct change. Other uncommitted changes in this working copy must be kept. Do not touch any page template.

## The decision has been made - implement it, do not ask again
`inferLocationFromType` in `lib/studio/import/detection/response-parser.ts` (around line 576) infers a region from substrings in the type name ("nav"/"header" -> header, "hero" -> hero, "footer" -> footer, else main). On a real import, `article-header` (an article's title block) was sent to `header`, which no template allows, and every article page failed with "Selected template ... is incompatible with detected component regions".

Replace the substring rule with this exact mapping over registered types:
- the hero types from `getHeroComponentTypes()` (`lib/studio/components/cms/_core/definition-loader.ts`) -> `hero`
- `navbar`, `sidemenu`, `breadcrumbs`, `breadcrumb` -> `header`
- `footer` -> `footer`
- everything else, INCLUDING `article-header`, `nav-menu-item` and `sidebar-nav` -> `main`

`main` is the region every template accepts; where a template wants `article-header` elsewhere, the page builder's region manager already moves a single-bound type into its template's region later. Keep the function's signature and export. Delete the substring logic; no fallback to it.

## Tests (in the existing response-parser test file)
- `article-header` -> `main`; each hero type -> `hero`; `navbar`/`sidemenu`/`breadcrumbs` -> `header`; `footer` -> `footer`; `card-grid` -> `main`.
- Invariant: for every registered page-level component type, the inferred region is one in which the generic template (`lib/studio/pages/core/generic/register.ts`) allows that type.

## Verify
`npm run typecheck` 0 errors; one at a time: `SKIP_DB_SETUP=true npx jest lib/studio/import/detection/__tests__/response-parser.test.ts --runInBand --forceExit --silent` (3 pre-existing failures expected, none new), `... lib/studio/import/detection/blocks ...` (with `CHROMIUM_EXECUTABLE_PATH=C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe`), `... lib/studio/import/__tests__/web-detection.test.ts ...`.

## Final message
Plain English: the change (file:line), the list of types whose region changed (expected: article-header header->main; breadcrumbs and sidemenu main->header; nav-menu-item and sidebar-nav header->main), test counts.
