# Task: prove the 15 families offline — family schemas and a lab fill arm

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls from anything you run: paid paths get `--dry-run` and are verified with fake clients. Never read `.env*`. Work only in `scripts/experiments/import-lab/`; `lib/**` and `app/**` are read-only (you may export an existing lab helper, not change production code). Never write into `C:/projects/catalystx/import-lab-data`. Never copy real site names, URLs or page text into code, tests, fixtures, README or briefs.

**Held-out rule:** never open, print or inspect held-out pages' labels, blocks, screenshots, components or per-block scores (`heldOut: true` in `pages.json`). Use development pages or invented fixtures for any inspection.

## Why
The founder approved 15 section families (`docs/import/accuracy/catalogue.md`; set `C` in `component-families.json`). The answer key and the measuring stick now work at family level. Today's importer still fills 50 overlapping component types; 79 sections in the baseline were dropped because a type required a field the page did not have. Before touching the app, the lab must show whether filling one of 15 generic families beats today's importer on the same pages. Nothing in the app changes in this task.

## 1. Family schemas — new `family-schemas.ts`
- Zod schemas (use the installed zod; `zod/v4` is available in 3.25.76) for the 15 families on shared shapes, **strict** (unknown keys rejected), **every field optional** except what defines the family (a collection needs `items`; a form needs `fields`; a table needs `rows` or `chartImage`; everything else may be empty). No field may be required merely because a component usually has it.
- **Section** (all families): `eyebrow`, `heading`, `intro` (rich text), `media?`, `links[]`, `items[]`, `placement: header|main|sidebar|footer`, plus that family's settings from `catalogue.md` section 6.2 (look only; stored, not scored).
- **Item:** `title?`, `subtitle?`, `body?` (rich HTML subset: p ul ol li strong em a img blockquote br h3-h6), `media?: {kind: image|icon|video|embed, url, alt, poster?}`, `links[]: {label, url, emphasis: primary|secondary|plain, children?: Link[]}`, `meta[]: {key, value}` (price, date, rating, role, stat value, address line…).
- **Form** adds `fields[]: {label, type, required, options}` and `submitLabel`. **Table** adds `columns[]`, `rows[][]`, `caption`, `chartImage?`.
- Icons are always an image URL or inline SVG, never an icon-set name.
- Export one JSON Schema per family for the prompt (`toJSONSchema`).

## 2. Lab fill arm `family-fill` — new `family-fill.ts`, wired into `run-arm.ts` (`ARMS`)
Pipeline per page, all production code reused where named:
1. Production's `cutRenderedPage` on the saved `geometry.json` through the existing `adapt` in `blocks-production.ts` (export it; do not copy it).
2. Production `buildBlockInput` for each block.
3. Jev family pick through production `pickBlockTypes`, with the family options and criteria swapped in through a shared `withFamilyQuestion(set)` helper in `families.ts` (move the swap that `jev-pick.ts` already does into that helper; `jev-pick.ts` uses it too). If `pickBlockTypes` falls back to production's old-type candidates, map them to families through set C (never pass an old type on).
4. Lab fill call: `createLLMClient` with the same payload and message shape as `lib/studio/import/detection/blocks/block-extract.ts`, using production's harness rules **minus every rule that names a component type and minus the image-shape rule** (drop rules by content, not by line number), plus: the allowed families' JSON Schemas, and the rules "Copy the source's words exactly; do not summarise or invent", "Keep every link with its label and full address", "Keep every picture with its address and alt text", "Put each repeated item in `items`; keep the source's order".
5. Zod validation; on failure exactly one repair call with the validation message; a second failure drops the block and records why.
6. `CallRecorder` records every call (request, reply, model, usage, cost, latency).
7. Output `components.json` entries `{type: <family>, placement, content}`; `run.json` records the prompt hash and the note `"differs from production prompt"`.
- Fill model and settings come from the same environment variables as production (`IMPORT_BLOCK_FILL_MODEL`, `IMPORT_BLOCK_CONCURRENCY`, decision-model settings).
- `--dry-run` plans the calls and writes nothing.

## 3. Scoring family output
`scoring.ts` already accepts a component whose type is a family name (brief 19). Make sure C2–C7 read the family shapes: headings from `heading`/`eyebrow`/item `title`/`subtitle`, text from all string fields and HTML bodies, links from `links[]` (including nested `children`) and item links, images from `media.url` on the section and items, item count from `items`.

## Tests (write first; invented fixtures only)
Run with `$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit`.
- Schemas: one hand-made valid example per family; unknown key rejected; a collection without items rejected; an empty hero accepted; an icon as a URL accepted; nested menu links accepted.
- Fill arm with fake clients on an invented page: the full pipeline runs offline and writes components with family types; a Jev fallback yields families, never old types; an invalid fill triggers exactly one repair; the prompt contains no old component type names and no `mediaId`/`mediaType` image shape; no module-cache swapping.
- `jev-pick.ts` still works through the shared helper (existing tests keep passing).
- Scoring: a family-typed fixture passes C1–C7 when complete; removing an item fails C6; a nested link counts for C4; an item picture counts for C5.

## Verify (offline, free)
- Both typechecks 0 errors.
- `run-arm.ts --page <one development page> --arm family-fill --run dry --dry-run` with `IMPORT_LAB_ROOT=C:/projects/catalystx/import-lab-data`: report the planned decision and fill calls; nothing written.
- README/RUNBOOK: the family-fill arm, its paid command, how to compare it with blocks-production. `briefs/README.md`: add this brief as number 22.

## Final message
Plain English: what was built; which production helpers were reused; the dry-run plan; test and typecheck output lines; anything in this brief that looked wrong, with evidence.
