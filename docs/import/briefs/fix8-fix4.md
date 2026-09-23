# Brief: fix8 - attachment rule must not reject real pages like /site-map/

Same rules as `docs/import/briefs/fix8-menu-first-page-picking.md`. Amend the uncommitted change; smallest correct change, no dead code.

The previous step made `isLikelyAttachmentPageUrl` (`lib/studio/import/services/sitemap-discovery.service.ts` ~52) match any `ASSET_EXTENSIONS` suffix. That list includes `map`, `js`, `css`, `json`, `sql`, `dat`, `tar` etc., so real pages such as `/site-map/`, `/road-map/`, `/learn-node-js/`, `/intro-to-sql/` are now rejected.

Publishing systems create attachment pages only for uploaded media. Fix: split `ASSET_EXTENSIONS` so the image, document and audio/video groups form one named set (e.g. `MEDIA_EXTENSIONS`), `ASSET_EXTENSIONS` is that set plus the remaining groups (behaviour of `isAssetUrl` unchanged), and `isLikelyAttachmentPageUrl` uses only the media set.

Test (first, confirm it fails): `/site-map/`, `/road-map/`, `/learn-node-js/`, `/intro-to-sql/` are not attachment pages; `/fig-15-osx-fullscreen-696px-mp4/`, `/annual-report-pdf/`, `/photo-jpg/` still are; `isAssetUrl` for `/app.js` and `/style.css` still true.

Verify, quoting raw jest summary lines: `npx tsc --noEmit -p tsconfig.json`; `SKIP_DB_SETUP=true npx jest lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts --runInBand --forceExit`; `npm run test:import`.
