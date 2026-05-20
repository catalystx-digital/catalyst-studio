# Bathurst Directory Page Eval Fixture

- Recorded via `_output.txt`, runId `059ec9bc-4fd5-4de7-a570-5e6cb3f55467` (2025-10-29T22:56:30Z); refreshed 2025-10-31 with the region-free prompt update to keep the raw payload contract-aligned.
- Navbar/menu items carry stable IDs and external flags without `summary` or `region` noise.
- `hero-simple` exposes canonical `ctaButtons[]` entries (`label`/`href`/`variant`) so importer fixups stay at zero, and the empty `summary` copy from earlier captures is gone.
- Footer columns/legal/social blocks stay flattened into `columnItem`/`nav-menu-item`, social IDs follow the `socialLinkItem-<slug>` pattern, and the unused newsletter slot is intentionally absent.
- Fixture strict-passes `pnpm run eval:detection run --dataset bathurst --fail-on-importer-fix` (see `reports/eval/detection/2025-10-31T04-30-53-391Z.json`).
- To regenerate after edits:
  - `pnpm run eval:detection run --dataset bathurst --case directory --report --fail-on-importer-fix --record`
  - Promote the latest recording to `prompts/evals/bathurst/directory/raw.json`
  - `pnpm exec tsx scripts/eval/build-expected-from-raw.ts prompts/evals/bathurst/directory/raw.json prompts/evals/bathurst/directory/expected.json`
