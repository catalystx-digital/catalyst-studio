# TIO Home Page Eval Fixture

- Source import: `_output.txt`, runId `1bc26770-b8f4-4f89-ba31-99f01b3dc33c` (2025-10-29T07:59:56Z); re-recorded 2025-10-31 after the search-bar prompt update (runId `9febf321-401e-4c6e-8335-cb4dcf137036`).
- Captures the header search form rendered inline (no toggle), yielding a detector `search-bar` payload (placeholder currently surfaces as an empty string because the DOM omits a value) alongside the canonical navbar/navigation content.
- Fixture also validates hero, feature list, CTA, and footer payloads without relying on importer normalizers.
- Strict-pass verification: `pnpm run eval:detection run --dataset tio --fail-on-importer-fix` (`reports/eval/detection/2025-10-31T04-34-03-274Z.json`).
- `raw.json` mirrors the detector output; regenerate `expected.json` with `pnpm exec tsx scripts/eval/build-expected-from-raw.ts prompts/evals/tio/home/raw.json prompts/evals/tio/home/expected.json` after any raw adjustments.
