# Catholic Schools Parramatta Diocese — Footer Slice

- Spin-off from the `cspd/home` capture (see `docs/issues/import-issue.md`); refreshed 2025-10-31 with the updated prompt (no `content.region`/`summary`) while keeping the full navbar/hero/card-grid stack for regression coverage.
- Card grids, CTA banner, and hero sections inherit the same guidance as the home page (stable IDs, no container `heading`/`columns`, CTA buttons only where rendered).
- Footer columns/legal/social links remain contract-shaped; testimonial carousel content now lives in the home/why-us fixtures so this slice emphasises navigation + legal coverage.
- Latest strict-pass: `pnpm run eval:detection run --dataset cspd --case footer --fail-on-importer-fix` (`reports/eval/detection/2025-10-31T04-31-41-073Z.json`).
- Rebuild with:
  - `pnpm run eval:detection run --dataset cspd --case footer --report --fail-on-importer-fix --record`
  - Promote the new capture to `prompts/evals/cspd/footer/raw.json`
  - `pnpm exec tsx scripts/eval/build-expected-from-raw.ts prompts/evals/cspd/footer/raw.json prompts/evals/cspd/footer/expected.json`
