# Brief: retry a block fill call when the model provider returns an error

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet, no paid calls, never read `.env*` files, never run `scripts/standalone-import.ts` or anything touching a database. One Node process at a time; Jest with `SKIP_DB_SETUP=true --runInBand --forceExit`. Smallest correct change, no dead code, match the surrounding style.

## Evidence
- Real imports today dropped 3 to 72 sections each with `Block extraction response must include choices[0]` (thrown in `lib/studio/import/detection/blocks/block-extract.ts` ~165), and two imports failed outright because a page then lacked a required region.
- A direct probe of 16 concurrent calls to the fill model through OpenRouter returned HTTP 200 for all, but 9 had no `choices` and a body `error` of `{"message":"Upstream error from Inception: The server had an error while processing your request.","code":502,"metadata":{"error_type":"provider_unavailable"}}`. The other 7 succeeded. So these are transient provider errors reported inside a 200 response.
- `block-extract.ts` already retries timeouts and truncated replies (`INFRASTRUCTURE_RETRIES = 2`, ~24 and ~178), immediately, with `maxRetries: 0` on the client. A response without `choices` is not retried, and the provider's `error.message` is discarded.

## Fix
1. When the response has no `choices[0]`, throw an error whose message includes the provider's `error.message` and `error.code` when present (e.g. `Block extraction provider error (502): Upstream error from Inception: ...`); keep the old wording when there is no `error` object.
2. Treat that case as a retryable provider error with its own budget `PROVIDER_ERROR_RETRIES = 4` (exported next to `INFRASTRUCTURE_RETRIES`), waiting before each retry with exponential backoff starting at 1 s (1, 2, 4, 8 s). Do not change the timeout/truncation budget or the validation-repair path. Make the wait injectable or use Jest fake timers so tests do not sleep.
3. Also treat an HTTP 429 or 5xx error thrown by the client (`APIError` with `status` 429 or >= 500) as the same retryable provider error.
4. Count retries in the existing `requestCount` so telemetry stays truthful.

## Tests (write first, confirm they fail) in `lib/studio/import/detection/blocks/block-extract.test.ts`, following the file's existing fake-client pattern
- a provider error body then a valid reply → succeeds, 2 requests.
- provider error bodies on every call → fails after 1 + 4 requests, and the error message contains the provider's message and code.
- a thrown `APIError` with status 503 then success → succeeds.
- the existing "cut-off replies exhaust exactly two infrastructure retries" test still passes unchanged.

## Verify (quote raw jest summary lines)
- `npx tsc --noEmit -p tsconfig.json`
- `SKIP_DB_SETUP=true npx jest lib/studio/import/detection/blocks --runInBand --forceExit`
- `npm run test:import`

Final message: plain English - the change with file:line, each test, raw jest summary lines.
