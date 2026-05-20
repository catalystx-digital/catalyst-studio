# CSPD Why-Us Page Eval Fixture

- Source import: `_output2.txt`, runId `9e586595-3183-4c3f-87c3-329b39549933` (2025-10-29T22:59:30Z); refreshed 2025-10-31 alongside the region-free prompt change so the detector payload stays contract-shaped without auxiliary normalization.
- Opening hero-with-image + supporting hero blocks emit full copy/media payloads and only surface `ctaButtons` where the DOM renders CTAs; the importer now leaves these hero payloads untouched apart from warning on junk entries.
- Card grids enumerate values-based education cards and Instagram feed promos with stable IDs, flattened link/linkText pairs, and trimmed copy—container `heading`/`columns` keys were dropped per contract guidance.
- CTA simple blocks surface canonical heading/body plus primary button targets, so the importer passes them through unchanged.
- Testimonials now arrive with canonical `testimonial-item` entries (id/quote/author/avatar) aligning with the prompt update captured on 2025-10-31.
- Footer/social/nav IDs align with canonical prefixes so importer diff count is zero.
- Latest strict-pass: `reports/eval/detection/2025-10-31T07-26-41-109Z.json`.
- Regenerate fixtures after any prompt change with:
  - `pnpm run eval:detection run --dataset cspd --case why-us --report --fail-on-importer-fix --record`
  - Promote the latest capture to `prompts/evals/cspd/why-us/raw.json`
  - `pnpm exec tsx scripts/eval/build-expected-from-raw.ts prompts/evals/cspd/why-us/raw.json prompts/evals/cspd/why-us/expected.json`
