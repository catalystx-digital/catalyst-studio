# Task: fix the assembly step of `jev-points-code-copies`, using saved decisions (no new paid calls)

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*`. Work only in `scripts/experiments/import-lab/`; no production code changes. Real data under `.import-lab/` may be READ; never copy real site names, URLs or page text into code, tests, fixtures, README or briefs.

## What the first real run showed (10 pages, 116 scored blocks)

| Arm | Component right | Missed |
|---|---|---|
| today | 50 | 35 |
| decision model picks, LLM fills, with retry | 79 | 12 |
| `jev-points-code-copies` (no LLM) | 30 | 76 |
| same with `--llm-fallback` | 65 | 25 |

A whole page took 4-10 seconds with no LLM - the speed is real. But 83 blocks failed at stage `copy`: the decision model answered, and the ASSEMBLED component was rejected by the production validator. The failures are concentrated and mechanical (component, field, reason, count):

- navbar `menuItems.N.label` invalid_type 30; navbar `menuItems` invalid_type 5; navbar `menuItems.N.children.N.label` invalid_type 4
- sidemenu `content.items.N` invalid-subcomponent 25
- text-block `body` missing-required-field 17
- cta-simple `primaryButton` missing-required-field 16
- html-block `bodyHtml` missing 6; image-gallery `images` missing 5; testimonials `testimonials` missing 5; footer `columns.N.links.N` missing 5
- hero-video `videoUrl` missing 3; hero-with-image `heading` missing 3; accordion `items.N.question` / `answer` invalid_type 5; contact-info `body` missing 2; single cases for statistics `stats`, feature-list `items`, card-grid `cards`, logo-cloud `logos`, timeline `events.N.id`, cta-with-form `heading` invalid_type, about-section / hero-simple / cta-simple `heading` missing.

Saved runs to reproduce from: `.import-lab/arms/<slug>/jev-points-code-copies/copies-r1/` on every page (element tables, groups, every head's answer, template paths, the rejected component and the validator message).

## Required changes

1. **Re-assemble offline.** Add `--reassemble-from <runId>` to the arm: reuse the saved element tables and decision answers of that run, run ONLY the assembly + validation again, write a new run folder (`--run <newId>`), make zero decision or LLM calls, and record `decisionsReusedFrom`. `eval.ts arms` passes the flag through and treats it as FREE.
2. **Never leave a required field empty when the block has content for it.** After the pointed-at elements are mapped, fill each still-missing REQUIRED field from block-level evidence, by field meaning and declared type, recording `filledFrom: "block-fallback"`:
   - rich text / body / bodyHtml / content / description: the whole block's rich text in document order, minus anything already placed in heading or action fields (a text block with a `NONE` body head is still a text block);
   - heading-like: the first heading row, else the first short text row;
   - button / action / link: the first link or button row not already used;
   - image / media / background: the first content image; video fields: the first video or iframe source; image arrays (gallery, logos): every content image in the block, in order;
   - the required item array: if `itemsGroup` was `NONE` or mapped to nothing, use the largest repeated group in the block; if there is none, build a single item from the block itself.
3. **Emit exactly the value shapes the validator accepts.** For every failure above, read the production contract / Zod schema / normaliser for that component and emit that shape: plain strings where a string is required (menu labels, accordion question and answer, headings) - never an object; sub-component wrappers where an array holds sub-components (sidemenu items, navbar children, footer column links), using the production sub-component types and required keys (ids as strings where an id is required). Do this through the generic mapper driven by the contract's declared types - if a special case is truly unavoidable, keep it to a small table keyed on declared type, not on component name, and justify each entry in a comment.
4. **Nested repeated groups** (menu with sub-menus, footer columns with links): map the parent group to the outer array and each nested group to the inner array named by the contract.
5. **Report assembly quality without the scorer.** Per run: blocks assembled and valid, blocks invalid (grouped by component / field / reason), required fields filled from pointed elements vs from block fallback vs still missing, share of the block's visible text that ended up in the component (reuse the Phase 1 shingle measure). Print this table at the end of the run and store it in `run.json`.

## Verify (all offline)
- Unit tests, invented fixtures: one per failure family above (each must fail on the old mapper), the block-fallback rules, nested groups, `--reassemble-from` making zero calls.
- `SKIP_DB_SETUP=true npx jest scripts/experiments/import-lab --runInBand` passes; `npm run typecheck` 0 errors.
- Then re-assemble from `copies-r1` on ALL ten real pages into run `copies-r1-fix1` and report: valid blocks before -> after per page (slug only), remaining invalid blocks grouped by component / field / reason, and the text-kept share. Iterate until the remaining failures are ones you can explain as genuinely not fixable by assembly (say which and why). Do not tune on the answer sheet: you may read validator messages and page HTML, not `answer-sheet.json` or scores.

## Docs
README / RUNBOOK: `--reassemble-from`. `briefs/README.md`: add this brief (number 11).

## Final message
Plain English: what changed; the before -> after table; what still fails and why; exact orchestrator commands (all FREE) to re-assemble and score.
