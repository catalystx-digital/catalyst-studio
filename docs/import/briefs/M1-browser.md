# Brief M1: one way to start the headless browser, proven where the importer runs

You are a coder with one bounded task. You are not an orchestrator: do not run any engine, preflight or front-door tooling. Do not commit, stage, push or branch. No internet and no paid calls from anything you run. Never read `.env*` files. Read `docs/import/block-detection-plan.md` first (decisions D3, D4 and milestone M1) - this brief implements M1 only. Do not start M2 work.

The owner's standing rules: no over-engineering, no slop, deliver exactly what is asked - no more, no less; clean up after yourself; no dead code; as simple as possible. Prefer changing three lines to adding a file. No new dependency.

## Facts already verified
- Production deploys to Vercel (`.github/workflows/deploy.yml`). There `isServerless()` is true and the browser comes from `@sparticuz/chromium` (`lib/studio/design-system/dom-probe/serverless-config.ts`). This path already exists and stays as it is.
- The importer already launches Chromium for the design-system capture: `lib/studio/design-system/dom-probe/service.ts` (launch near line 147) with `playwright-core`. Both packages are runtime dependencies.
- The Docker image (`Dockerfile`, `node:24-bookworm-slim`) installs no browser and no browser system libraries, and `isServerless()` is false inside it, so a launch there looks for a Playwright-managed browser that does not exist. CI has a job that verifies the Docker quickstart (`.github/workflows/ci.yml`, step "Verify Docker quickstart").
- Neither you nor the orchestrator can run Docker on this machine. The container check therefore has to run in CI; say so plainly in your final message rather than claiming it was verified.

## Work
1. **One launch function.** Extract the Chromium launch that `dom-probe/service.ts` performs today (executable path resolution, launch options, the serverless arguments) into ONE exported function next to it (for example `launchHeadlessChromium()` in the dom-probe folder), and make `service.ts` use it. Behaviour of the design-system capture must not change. The block cutter in M2 will call the same function - do not build the block cutter now.
   - Local development on a machine whose Playwright browser revision does not match `playwright-core` needs an explicit path. If an environment variable for an explicit Chromium executable already exists in the code, reuse it; only if none exists, add exactly one, `CHROMIUM_EXECUTABLE_PATH`, documented in `.env.example`.
   - Launch failure must throw ONE clear error that says what was tried (which source, which path) and what to do - this is the diagnostic decision D4 refers to. No silent fallback chain beyond what exists today.
2. **A check script**, `scripts/check-headless-browser.ts`: launches through that function, serves a small inline HTML document (header, a banner, a row of three cards, a footer, one linked stylesheet served the same way) at a made-up `https://` address via request interception, confirms the stylesheet applied, prints the bounding boxes of the four top-level blocks as JSON plus elapsed milliseconds, closes the browser in `finally`, exits 0. On any failure it prints the clear error and exits non-zero. No network access beyond the interception. Keep it under about 80 lines.
3. **Docker image.** In the `runner` stage, before `USER nextjs`, install Playwright's Chromium with its system dependencies using the `playwright-core` CLI that is already in `node_modules` (`npx playwright-core install --with-deps chromium`), into a fixed `PLAYWRIGHT_BROWSERS_PATH` readable by the `nextjs` user; clean apt lists in the same layer. No change to `isServerless()` and no fake `SERVERLESS=true`.
4. **CI.** In the existing Docker verification job, add ONE step that runs the check script inside the built image and fails the job if it fails. Look at how that job builds and runs the image and follow its style. If the image cannot run TypeScript scripts as built (dev dependencies are pruned), make the smallest honest adjustment - for example compile the check to plain JavaScript as part of the step or write the check as a `.mjs` file that imports the built launcher - and explain the choice.
5. **Tests.** A unit test for the launch function's path resolution (serverless source, explicit path, default) with the browser mocked; the existing dom-probe tests keep passing unchanged.

## Out of scope (do not do)
Block cutting, decision-model questions, config keys for the blocks harness, anything under `lib/studio/import/`, refactors of the dom-probe service beyond swapping in the launch function, README rewrites.

## Verify yourself
- `npm run typecheck`: 0 errors.
- `SKIP_DB_SETUP=true npx jest lib/studio/design-system --silent` and the new test pass (report counts before and after; if some were failing before your change, list them as pre-existing).
- Run the check script locally with `CHROMIUM_EXECUTABLE_PATH=C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe` (or the existing variable if there is one) and paste its JSON output.
- `git status` shows only the files this brief needs.

## Final message
Plain English: files changed and why each; the check script output; what is verified locally and what can only be verified in CI after a push; anything in this brief you judged unnecessary and did not do, with the reason.
