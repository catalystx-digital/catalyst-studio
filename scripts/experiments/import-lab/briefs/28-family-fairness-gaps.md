# Task: close two fairness gaps in the family arm

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls (use saved run records and fake clients). Never read `.env*`. You may change `scripts/experiments/import-lab/**` and, only on the catalogue-override path, `lib/studio/import/**` (founder-approved hook; production behaviour without the override must stay byte-identical — the existing no-override request-hash tests must pass). Never write into `C:/projects/catalystx/import-lab-data`. Never copy real site names, URLs or page text into code, tests, fixtures, README or briefs.

**Held-out rule:** never open, print or inspect held-out pages' data (`heldOut: true`).

## Evidence (paid comparison runs c-r1/c-r2, 28 development pages)
- Whole-page failures: today's importer 0; family arm 5 — four with "Selected template core/generic-default is incompatible with detected component regions" and one navigation timeout (network; not a code issue).
- Sections dropped by content validation: today's importer 49 (required fields its types demand); family arm 44, of which 36 are family schema rejections, almost all on links: a link given as a plain string instead of an object (items[].links[], links[]), or a link object using keys the schema does not know (typically `href`, `text`, `title`, `target`, `rel`), plus one empty picture address.
- Today's importer passes model output through its per-type normalizers (`lib/studio/import/services/page-builder/component-helpers/normalizers/` and the content validation path) before validation; the family override's validator has no equivalent, so it rejects output production would repair. That makes the comparison unfair to the families.

## Do
1. **Family normaliser before validation** (in the override's `validateContent`, lab side): convert a string link to `{url}` (and `{label, url}` when it is "label → url"-shaped only if unambiguous); map `href`→`url`, `text`/`title`/`name`→`label` on links; drop link keys with no content meaning (`target`, `rel`, `id`, `className`); drop a media object whose `url` is empty instead of rejecting the section; apply recursively to nested `children` and to item links. Anything else stays strict. This mirrors the kind of repair production's normalizers do; do not add a normaliser for any other field unless you show a saved rejection of that kind in the development run records.
   Tests: each conversion with an invented fixture; an unknown non-link key still rejects; normalisation never invents text.
2. **Template incompatibility:** reproduce from a saved development run record that failed with "incompatible with detected component regions", find the exact cause (file:line) — e.g. a family whose template equivalent or placement lands in a region the generic template does not allow — and fix it on the override path only, so a page of valid family components is assembled exactly as the equivalent production components would be. Regression test with an invented page.
3. Report, from the saved development records, how many of the 36 rejections and 4 template failures each fix would have prevented (count by re-running the new validator/assembly offline on the saved replies).
Verify: lab Jest passes; `npm run test:import` passes; both typechecks 0; no-override request-hash tests pass. Write this brief as `briefs/28-family-fairness-gaps.md` (already present — keep it) and add it to `briefs/README.md`.

## Final message
Plain English: root cause of the template failure (file:line); the normaliser rules; counts prevented; output lines of all checks.
