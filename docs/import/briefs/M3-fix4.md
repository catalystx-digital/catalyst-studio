# Brief M3 fix round 4: navigation links without `pageId` must be completed by code, not rejected

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files. Memory discipline: one Node process at a time, Jest with `--runInBand --forceExit`, leave no process running. The owner's standard: no over-engineering, no slop, smallest correct change, no dead code. Fix exactly this one defect.

## Evidence (two measured runs of the `blocks` harness on 20 real pages)
About 60 blocks per run are dropped because the fill model's answer fails validation. The largest cluster, 21 of them, is the navigation bar: `menuItems.N.href.pageId:invalid_type`, `utilityNav.N.href.pageId:invalid_type`, `menuItems.N.children.N.href.pageId:invalid_type`. In the raw replies the model writes internal links as `{ "type": "internal", "path": "/about" }` - 174 such links in one run - omitting `pageId`. The navigation bar is then rejected whole, so most pages lose their navigation.

`pageId` is not information the model has: the prompt itself defines it as the path slug. The importer already derives it in code elsewhere: `pageIdFromPath` in `lib/studio/import/services/page-builder/component-helpers/normalizers/content-normalizers.ts` (around line 305, used at 317 and 349) and a copy in `cta-normalizers.ts` (around line 22) fill a missing `pageId` from `path`. The navigation normalisation (`nav-normalizers.ts` in the same folder, and whatever the detection parser applies to navbar link fields before validating) does not.

## Fix
1. Make internal links in navigation components (`menuItems`, their `children`, `utilityNav`, `cta`, and any other SmartLink field of navbar / sidemenu / footer link lists that goes through the same normaliser) get `pageId` derived from `path` when it is missing or empty, using the SAME function the content normaliser uses. There are already FIVE private copies of `pageIdFromPath` in that normalizers folder (content, cta, hero, nav, social-proof) - do not add a sixth: reuse the one already in `nav-normalizers.ts` if the fix belongs there, otherwise export one and import it where you need it. Do NOT consolidate the five copies in this task; list them in your final message as a separate clean-up proposal. Note that `nav-normalizers.ts` already has the function, so first find out WHY navigation links still reach validation without a `pageId` on the detection path (which normalisation runs before `parseSectionDetectionResponse` validates, and whether the navigation normaliser is part of it) and fix it at that point.
2. It must take effect before validation on the detection path (`parseSectionDetectionResponse` and the normalisation it runs), so both the `blocks` harness and the existing paths benefit. It only turns a rejected answer into an accepted one; it must not change any link that already has a `pageId`.
3. Tests: a navbar answer whose internal links lack `pageId` now validates and gets the derived ids (top-level, children, utility links, CTA); links that already have a `pageId` are untouched; external and anchor links untouched; the root path `/` derives whatever `pageIdFromPath` already returns for it.

## Out of scope
Every other validation failure (unknown fields on contact-info, missing body on text-block, enum values, image gallery sources). Do not touch prompts.

## Verify
`npm run typecheck` 0 errors; `SKIP_DB_SETUP=true npx jest lib/studio/import/detection --runInBand --forceExit --silent` (same 4 pre-existing failures, no new ones) and `... lib/studio/import/services/page-builder ...` (report before/after) - one at a time.

## Final message
Plain English: where the fallback now lives, which copy of the function survived, test counts before and after.
