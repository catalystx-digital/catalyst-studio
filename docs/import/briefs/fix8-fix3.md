# Brief: fix8 - attachment pages for video and documents

Same rules as `docs/import/briefs/fix8-menu-first-page-picking.md`. Amend the uncommitted change; smallest correct change, no dead code.

Evidence: a real 6-page import of a WordPress magazine picked `/fig-15-osx-fullscreen-696px-mp4/`, a WordPress attachment page for a video. `isLikelyAttachmentPageUrl` in `lib/studio/import/services/sitemap-discovery.service.ts` (~52-59) only recognises image endings (`-jpg`, `-png`, ...), while `ASSET_EXTENSIONS` (~11) in the same file already lists every asset type, including `mp4` and `pdf`.

Fix: make `isLikelyAttachmentPageUrl` match a last segment ending in `-<ext>` for any `ext` in `ASSET_EXTENSIONS`, replacing the hardcoded image list. Update its comment if it names only images.

Test (first, confirm it fails): `/fig-15-osx-fullscreen-696px-mp4/` and `/annual-report-pdf/` are attachment pages; `/about-us/` and `/mp4-guide/` are not.

Verify, quoting raw jest summary lines: `npx tsc --noEmit -p tsconfig.json`; `SKIP_DB_SETUP=true npx jest lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts --runInBand --forceExit`; `npm run test:import`.
