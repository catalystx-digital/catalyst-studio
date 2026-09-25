# Task: make the family comparison fair — one shared importer path with a small hook

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls: paid paths get `--dry-run` and are verified with fake clients and fake transports. Never read `.env*`. Never write into `C:/projects/catalystx/import-lab-data`. Never copy real site names, URLs or page text into code, tests, fixtures, README or briefs.

**Held-out rule:** never open, print or inspect held-out pages' labels, blocks, screenshots, components or per-block scores (`heldOut: true` in `pages.json`).

**App change permitted (founder approval, 2026-09-25):** you may make ONE small change inside `lib/studio/import/detection/blocks/` (and the minimum wiring it needs in `lib/studio/import/web-detection.ts`): an optional hook, described below. With the hook absent, production behaviour must be byte-for-byte unchanged. No other `lib/**` or `app/**` change.

## Why
Brief 22 built a lab `family-fill` arm, but a read-only review found the comparison with today's importer is not controlled: the lab arm cut pages from saved geometry instead of re-rendering, built the page outline differently, and did not share production's token/reasoning settings, 120-second abort, timeout/truncation and provider-error retries, repair-JSON cap, response parsing tolerance, confidence and taxonomy gates, required-region and empty-page rules, section keys or placement. Any measured difference could come from those, not from the 15 families. The review is at `C:/projects/catalystx/codex-runs/b22-astra.md` — read it.

## 1. The hook (app, minimal)
Add an optional `catalogueOverride` that production's block path accepts, carrying only:
- the allowed type names and their one-line descriptions (used where production builds the candidate list and the decision question's options),
- the prompt contract text for those types (used where production inserts the component catalogue and contract rules into the fill prompt), plus a list of harness rules to omit (rules that name old component types and the old image shape),
- a content validator/normaliser for a returned component (used where production validates the reply against its registry contracts),
- a location function mapping a returned component to `header | main | sidebar | footer` (used where production derives location from the type).
Everything else — cutting (re-render of saved HTML), block input, scheduling, page outline, section keys, token/reasoning settings, abort, retries, repair cap, JSON parsing tolerance, confidence gate, required regions, empty-page rule, block limit, metadata assembly — stays production's own code, used unchanged by both arms. Thread the override through the existing call chain as an optional parameter; no globals, no module-cache swapping.
- Test: with no override, recorded requests and outputs for an invented page are identical to before the change (snapshot the request bodies).
- Test: with an override, the candidate list, the fill prompt catalogue/contract and the validator are the override's; every other request setting is identical to the no-override run.

## 2. The family arm uses the hook
Rewrite `family-fill.ts` as the `blocks-production` arm plus a `catalogueOverride` built from `family-schemas.ts` and set C: same entry point, same recording (`replayTransport` / `CallRecorder`), same settings, same run record fields. Delete the lab's own cut/pick/fill/repair/parse pipeline (no dead code). The Jev question uses the family options through the same override (retire the separate `withFamilyQuestion` swap if the override now covers it; keep `jev-pick.ts` working).

## 3. Schemas (review finding 2)
Only defining fields are required (collection `items`, form `fields`, table `rows` or `chartImage`). Make media `alt`, link `label`/`emphasis`, field `label` and every other nested field optional. Encode the table alternative structurally so the exported JSON Schema carries it; state HTML-subset and icon-as-image rules in the exported schema descriptions. Add sparse realistic examples to the tests.

## 4. Scoring family shapes (review finding 3)
- C6 counts family `content.items` whenever the component is a family, regardless of the label's `itemKind`.
- C2/C7 treat `eyebrow`, `heading`, `intro`, `title`, `subtitle`, `body`, `label`, `caption` and `meta[].value` as human text even when one word long.
- C4 classifies section, item and nested `links[].url` as links before any image-extension heuristic.
- `settings` are excluded from all text scoring.

## 5. Accounting and identity (review finding 4)
Both arms record usage and cost through the same transport recorder; `run.json` records the full effective configuration, the geometry/block and HTML hashes, the lab source hashes (including `family-schemas.ts` and `family-fill.ts`) and the complete prompt identity (system prompt, contract, override hash); `comparisonKey` includes the override hash. Test accounting through the non-fixture path with a local fake transport.

## Tests (write first)
Run with `$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit`, and also `npm run test:import` (production importer tests must still pass).
One test per numbered item above, plus the reviewer's reproductions for findings 2–4.

## Verify (offline, free)
- `npm run typecheck` and the lab typecheck: 0 errors. `npm run test:import`: all pass.
- `run-arm.ts --page <one development page> --arm family-fill --run dry --dry-run` and the same for `blocks-production`: report both planned call lists and show they differ only in the override.
- README/RUNBOOK updated; `briefs/README.md`: add this brief as number 23 and note the app hook.

## Final message
Plain English: the exact app lines changed (file:line, and a one-line reason each); proof that production is unchanged without the hook; what was deleted from the lab; test, test:import and typecheck output lines.
