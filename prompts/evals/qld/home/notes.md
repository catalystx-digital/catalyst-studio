# Queensland Government Home Page Eval Fixture

- Source capture: `pnpm run eval:detection run --dataset qld --case home --record --raw-only --model x-ai/grok-4-fast` (runId `7cffd61e-7569-436e-a789-cb57ee9f0d67`, recorded 2025-10-31T05:03:21Z).
- Inline global search renders the concierge panel by default, yielding detector `search-bar` content with populated `suggestions[]` (popular services + browse categories) while `recentSearches` remains empty.
- Fixture also covers navbar, hero, card grid, footer, and subscription CTA components without importer backfill.
- Regenerate normalized expectations via `pnpm exec tsx scripts/eval/build-expected-from-raw.ts prompts/evals/qld/home/raw.json prompts/evals/qld/home/expected.json` after promoting fresh raw output.
- Strict-pass verification: `pnpm run eval:detection run --dataset qld --report --fail-on-importer-fix` (`reports/eval/detection/2025-10-31T05-17-47-317Z.json`).
