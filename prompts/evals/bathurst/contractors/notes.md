# Bathurst Contractors Page Eval Fixture

- Recorded via `_output.txt`, runId `5d4d0205-e614-4e05-a432-45e70b4f7d5c` (2025-10-29T22:56:05Z); refreshed 2025-10-31 after updating the detection prompt to drop `content.region`/`summary` filler fields.
- Navbar continues to emit contract-compliant `menuItems[]` entries with stable IDs/external flags while leaving `region` metadata to the importer.
- Footer columns/legal/social links remain flattened into canonical `columnItem` → `nav-menu-item` structures; social IDs follow the `socialLinkItem-<slug>` convention and newsletter metadata is intentionally omitted (no form on this page).
- `raw.json`/`expected.json` strict-pass `pnpm run eval:detection run --dataset bathurst --fail-on-importer-fix` (latest report: `reports/eval/detection/2025-10-31T04-30-53-391Z.json`).
- Regenerate after prompt tweaks with:
  - `pnpm run eval:detection run --dataset bathurst --case contractors --report --fail-on-importer-fix --record`
  - Promote the newest capture to `prompts/evals/bathurst/contractors/raw.json`
  - `pnpm exec tsx scripts/eval/build-expected-from-raw.ts prompts/evals/bathurst/contractors/raw.json prompts/evals/bathurst/contractors/expected.json`
