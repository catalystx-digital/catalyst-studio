# Brief: switch on only the decision-model questions that are asked for, and stop an outage from emptying an import

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files other than `.env.example`, never run `scripts/standalone-import.ts` or anything touching a database. Memory discipline: one Node process at a time, Jest with `--runInBand --forceExit` on one path at a time, always with `SKIP_DB_SETUP=true`, leave no process running. Smallest correct change, no dead code, match the surrounding style and comment density.

## Evidence
1. One switch turns on every question. `isDecisionModelEnabledFor` (`lib/studio/decisions/config.ts:77-91`) checks only `enabled`, the API key and the website allowlist. `resolve()` in `lib/studio/decisions/ask.ts:236-262` uses it for every question. The blocks importer needs the model on (`lib/studio/import/web-detection.ts:1024` throws otherwise), which also switches on `page.isInternal` (asked from `lib/studio/import/services/sitemap-discovery.service.ts` `isLikelyPrivate`, ~line 555), `page.type` (`web-detection.ts` ~590), `page.isInternalFromContent` (`web-detection.ts` ~647/677) and `workflow.isImport` (`app/api/studio/workflow-route/route.ts` ~133).
2. `page.isInternal` is `failSafe: true` with `whenUnanswered: 'failSafe'` (`lib/studio/decisions/questions/page.ts`). With shadow off, a timeout or transport error answers "private" (`ask.ts` `recordUnanswered`). In `filterReachableUrls` (`sitemap-discovery.service.ts` ~402-458) the private branch `continue`s before the `reachable.length >= maxUrls` exit, so during an outage every discovered URL is asked in turn (each waiting up to the 15 s timeout, `config.ts:68`), all are skipped, and `expandUrlsForImport` (~line 293) quietly returns only `[inputUrl]`.

## Changes
A. **Question list.** In `config.ts` add `questions: string[]` to `DecisionConfigShape`, read from `DECISION_MODEL_QUESTIONS` with the existing `readList`. When unset or empty it means exactly `['import.block.component', 'import.block.multiple']` (the founder's decision: safe default). Ids carry no version suffix (see `lib/studio/decisions/questions/import-block.ts`).
   - Change `isDecisionModelEnabledFor` so the question ids are a **required** first argument (e.g. `isDecisionModelEnabledFor(questionIds: string[], websiteId?: string, options?)`). It returns false unless every id is in the list. An id in the list that is not a registered question (`hasQuestion` in the registry) must throw with a clear message naming the id - do this where the list is read or checked, not at module load (config must never throw at load; see the module comment).
   - `ask.ts` `resolve()`: pass the panel's ids; the panel is on only if every member is listed (same "strictest member decides" rule as `tenantScoped`). Unlisted → the existing `disabled` fallback path.
   - `web-detection.ts:647` passes `['page.isInternalFromContent']`; `:1024` passes `['import.block.component', 'import.block.multiple']`. Add a one-line comment at `:1024` that requiring shadow off globally is safe because unlisted questions never reach the model.
   - Update the export in `lib/studio/decisions/index.ts` if the signature needs it, and every other caller (grep).
B. **Outage.** `isLikelyPrivate` also reports whether the answer came from the model or was a failure (`answer.source === 'error'`). Within one `expandUrlsForImport` run, after the first failed `page.isInternal` answer, stop asking the model and use the question's own fallback (the old address rule) for the remaining URLs; record that URL's skip reason as `private-check-failed` instead of `private-path`. Keep `failSafe: true` on the question - a failed answer still excludes that one URL. Where `expandUrlsForImport` falls back to `[inputUrl]` because nothing survived, log one `console.warn` naming the counts per skip reason so it is visible.
C. **Settings text.** Add `DECISION_MODEL_QUESTIONS` with a one-line explanation to `.env.example` next to the other `DECISION_MODEL_*` entries, and to `scripts/experiments/import-lab/RUNBOOK.md` and `docs/import/block-detection-plan.md` where the decision-model settings are listed (one line each).

## Tests (write them first, confirm they fail on the unchanged code)
In `lib/studio/decisions/__tests__/decisions.test.ts` (follow its existing env setup; set `DECISION_MODEL_API_KEY` explicitly in each test, as `lib/studio/import/__tests__/web-detection.test.ts:408` does):
1. Model on, list unset: `page.isInternal` gets source `disabled` (fallback), the two block questions reach the client.
2. List names only `import.block.component`: the block panel is off (both fall back / harness gate false).
3. Unknown id in the list → throws naming it.
4. `page.type` and `workflow.isImport` fall back when unlisted.
In `lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts`:
5. `page.isInternal` listed, client throws on every call: the client is called once, not per URL; all non-asset sitemap URLs up to the cap survive; the first URL's reason is `private-check-failed`.

## Verify (quote the raw jest summary lines in your final message)
- `npx tsc --noEmit -p tsconfig.json` → 0 errors.
- `SKIP_DB_SETUP=true npx jest lib/studio/decisions --runInBand --forceExit`
- `SKIP_DB_SETUP=true npx jest lib/studio/import/services/__tests__/sitemap-discovery.service.test.ts --runInBand --forceExit`
- `npm run test:import` - report pass/fail counts.
- Revert check: temporarily undo change A in `config.ts`, confirm test 1 fails, restore.

Final message: plain English - each change with file:line, each test name, the raw jest summary lines.
