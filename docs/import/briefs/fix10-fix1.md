# Brief: fix10 review round 1 - do not retry permanent provider errors

Same rules as `docs/import/briefs/fix10-fill-call-provider-retry.md`. Amend the uncommitted change; smallest correct change.

Reviewer reproduced: at `lib/studio/import/detection/blocks/block-extract.ts` ~169 every response without `choices` is retried, whatever its embedded `error.code`. `{ error: { code: 401, message: 'Permanent failure' } }` makes 5 requests and waits 15 s.

Fix: an embedded provider error is retryable only when its code is missing, 429, or >= 500 (numeric or numeric string). Other codes (400-499 except 429) fail immediately, keeping the provider's message and code in the error.

Tests first: embedded 400 and 401 → 1 request, message includes code; embedded 502 still retries; no `error` object at all still retries.

Verify, quoting raw jest summary lines: `npx tsc --noEmit -p tsconfig.json`; `SKIP_DB_SETUP=true npx jest lib/studio/import/detection/blocks --runInBand --forceExit`; `npm run test:import`.
