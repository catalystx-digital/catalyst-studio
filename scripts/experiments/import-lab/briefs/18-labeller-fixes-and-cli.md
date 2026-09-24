# Task: finish the labeller — fewer rejected replies, all pages, and a subscription route

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls: verify with fake clients and a fake process runner. Never read `.env*`. Work only in `scripts/experiments/import-lab/`; `lib/**` and `app/**` are read-only. Real lab data may be READ from `C:/projects/catalystx/import-lab-data`; never copy real site names, URLs or page text into code, tests, fixtures, README or briefs. Existing label files must not be rewritten except by the resume path.

## Why (measured on the first labelling pass)
Two labellers ran over the 20 pages that have a version-1 key: 237/259 and 238/259 blocks labelled. Rejections:
- 35 × "Name the item collection when specifying its count" — the v2 schema requires `itemKind` whenever `itemCount` is given; models often give a count alone.
- 5 × "Choose a family and include it among acceptable families" — the best family was missing from the model's own acceptable list.
- 1 × placement value outside the allowed set; 1 × `TypeError: Cannot read properties of undefined (reading '0')`; 1 × provider 400.
Also, the batch never labelled the 18 pages that have block proposals but no version-1 key (they were silently skipped). And lab labelling should be able to run on the founder's Claude subscription instead of paid API calls.

## Changes
1. **itemKind optional.** A v2 label may give `itemCount` without `itemKind`. When scoring today's 50 types needs an `itemKind` and it is absent, C6 is `structure-unknown` (not a failure, not a crash). Keep asking for `itemKind` in the prompt.
2. **Best family always acceptable.** If `family` is valid but missing from `acceptableFamilies`, add it and record `normalised: ["acceptableFamilies"]` on the entry. Invalid families still fail.
3. **One corrective retry.** When a reply fails schema validation, send one retry in the same conversation with the exact validation message and "Reply again with valid JSON only". Record both attempts. A second failure marks the block failed.
4. **Find and fix the TypeError** (it is in the draft path; reproduce it from the saved failed entry's error record under the data root, without copying page text) and add a regression test.
5. **Batch covers every page.** `eval.ts draft` selects every page in `pages.json` that has `labels/<page>/blocks.json` and a screenshot. Pages with a version-1 `answer-sheet.json` keep using its block boundaries (brief 16); others use `blocks.json`. Report the page and block count per source in the dry run. `--only-failed` resumes failed or unfinished blocks across the whole batch.
6. **Subscription route for Anthropic models: `--provider claude-cli`.** Default provider stays `openrouter`.
   - Run the installed `claude` command in print mode for each block, sending the SAME prompt text and the SAME block crop as the API path. Send the image as a base64 image content block via `--input-format stream-json` and read the result with `--output-format json` (check `claude --help` locally for the exact flags; do not guess).
   - **No tools:** the page text is untrusted input, so the call must run with every tool disabled (no Read, no Bash, no web, no MCP servers) and must not load project instructions. Confirm the exact flags with `claude --help` and state them in the RUNBOOK. Never use a skip-permissions or bypass flag.
   - `--model` accepts a Claude model alias or id and is passed through.
   - Record each call like the API path: request (prompt hash and image hash, not the image bytes), reply, model, latency, `provider: "claude-cli"`, `billing: "subscription"`, `cost: null`. Parse the JSON reply exactly as the API path does, including the corrective retry.
   - Add `--concurrency <n>` (default 1, max 4) for blocks within a page, for both providers.
   - A fake process runner in tests; the real `claude` binary is never started by tests.
7. Do not add a Codex CLI provider (running it on untrusted page text would need its sandbox disabled).

## Tests (write first; invented fixtures only)
Run with `$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit`.
- Count without item kind is accepted; C6 is structure-unknown for today's types in that case.
- Best family missing from acceptable families is normalised and recorded.
- A reply failing validation triggers exactly one corrective retry containing the validation message; a second failure marks the block failed.
- The TypeError regression.
- Batch selection includes a proposal-only page and a v1-key page with their correct block sources.
- claude-cli: the spawned command has every tool disabled and no bypass flag; the image goes as a base64 block; the reply is parsed; the call record has `billing: "subscription"` and no image bytes; concurrency never exceeds the limit.

## Verify (offline, free)
- `eval.ts draft --provider claude-cli --model opus --out dry --dry-run` over `IMPORT_LAB_ROOT=C:/projects/catalystx/import-lab-data`: prints the planned calls per page (38 pages) and writes nothing.
- Both typechecks 0 errors.
- README/RUNBOOK: provider option, the no-tools flags, concurrency, `--only-failed` across the batch. `briefs/README.md`: add this brief as number 18.

## Final message
Plain English: each change; the exact `claude` flags used and how you confirmed them; the dry-run plan (pages, blocks, per source); test and typecheck output lines.
