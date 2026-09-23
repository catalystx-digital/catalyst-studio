# Brief: fix8 - do not read image, video or attachment sitemaps as page lists

Same rules as `docs/import/briefs/fix8-menu-first-page-picking.md`. Amend the uncommitted change; smallest correct change, no dead code.

Evidence (checked live on a real WordPress/Jetpack magazine): its `sitemap.xml` is an index of `sitemap-1.xml` (280 real pages), `image-sitemap-index-1.xml` (-> `image-sitemap-1.xml` ...) and `video-sitemap-1.xml` (96 entries). A real 6-page import picked `/image3/`, which is not in `sitemap-1.xml`: it came from the image/video sitemaps, whose entries are media attachment pages. Yoast names the equivalent `attachment-sitemap.xml`.

Fix: in `expandUrlsForImport`'s `fetchSitemapUrls` (`lib/studio/import/services/sitemap-discovery.service.ts`, where an index's child sitemaps are followed, ~`parsed.sitemaps.slice(0, 5)`), skip a child sitemap whose file name (last path segment, lowercased) starts with `image-sitemap`, `video-sitemap` or `attachment-sitemap`. Apply the filter before the `slice(0, 5)` so skipped children do not use up the five-child limit. One short comment naming the reason.

Test (first, confirm it fails) in `lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts`, with the file's existing fetch mocking: a sitemap index of `sitemap-1.xml` (article pages), `image-sitemap-index-1.xml` and `video-sitemap-1.xml` (attachment-like pages without extensions, e.g. `/image3/`) -> no URL from the image/video sitemaps is returned and the image/video sitemap URLs are never fetched.

Verify, quoting raw jest summary lines: `npx tsc --noEmit -p tsconfig.json`; `SKIP_DB_SETUP=true npx jest lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts --runInBand --forceExit`; `npm run test:import`.
