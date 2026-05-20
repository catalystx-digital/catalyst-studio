# Catholic Schools Parramatta Diocese — Home

- Source import: `docs/issues/import-issue.md` (LLM RAW OUTPUT) captured on 2025-09-19; refreshed 2025-10-31 with the region-free prompt update so the raw payload stays contract-shaped without offline sanitizers.
- Fixture covers hero carousel, multiple card grids, testimonials/social feed, CTA banner, newsletter CTA, and footer/navigation.
- Card grids emit stable IDs, flattened link/linkText pairs, trimmed descriptions, and promo-item IDs/images that align with importer expectations; container-level `heading`/`columns` keys were dropped per contract guidance to avoid importer diffs.
- Hero carousel slides retain full copy/media/CTA payloads, and promo CTA cards use the canonical `promo-item` schema.
- Two-column sections emit contract `leftColumn[]`/`rightColumn[]` arrays with nested text/CTA/image components, so the importer preserves them without fallback coercion.
- Testimonials include detector-supplied IDs, role/company metadata, and flattened avatar URLs, aligning with the testimonial-item contract.
- Footer/logo/social IDs follow the contract conventions and match importer output verbatim.
- `raw.json` + `expected.json` strict-pass `pnpm run eval:detection run --dataset cspd --fail-on-importer-fix` (latest report: `reports/eval/detection/2025-10-31T04-31-41-073Z.json`).
- Regenerate after prompt tweaks with:
  - `pnpm run eval:detection run --dataset cspd --case home --report --fail-on-importer-fix --record`
  - Promote the freshest capture to `prompts/evals/cspd/home/raw.json`
  - `pnpm exec tsx scripts/eval/build-expected-from-raw.ts prompts/evals/cspd/home/raw.json prompts/evals/cspd/home/expected.json`
