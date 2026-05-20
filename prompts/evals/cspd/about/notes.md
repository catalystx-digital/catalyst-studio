# CSPD About Page Eval Fixture

- Source import: `_output2.txt`, runId `a0d6196a-85b4-4d3f-b3cc-b56cb99432cd` (2025-10-29T22:59:29Z); refreshed 2025-10-31 after updating the prompt to drop `content.region`/`summary` filler fields.
- Navbar `menuItems[]` carry stable IDs/external flags with no legacy summary/search helpers.
- Eight consecutive `hero-with-image` sections surface canonical `heading`/`subheading`/`body` fields plus media; CTA buttons only appear where the page renders actions (none for the initial hero at capture time), and the importer now preserves these payloads without additional normalization.
- Footer payload ships canonical columns/legal/social arrays, including social IDs, and mirrors importer description text so zero field edits occur.
- Header still exposes only the magnifier link; the detector continues to skip a structured `search-bar` payload until we capture a page with the expanded form visible.
- `raw.json` + `expected.json` strict-pass `pnpm run eval:detection run --dataset cspd --fail-on-importer-fix` (latest report: `reports/eval/detection/2025-10-31T07-26-41-109Z.json`).
- Regenerate after prompt tweaks with:
  - `pnpm run eval:detection run --dataset cspd --case about --report --fail-on-importer-fix --record`
  - Promote the latest recording to `prompts/evals/cspd/about/raw.json`
  - `pnpm exec tsx scripts/eval/build-expected-from-raw.ts prompts/evals/cspd/about/raw.json prompts/evals/cspd/about/expected.json`
