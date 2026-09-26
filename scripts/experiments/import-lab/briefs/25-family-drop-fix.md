# Task: retain a filled family header at the required-section check

You are a coder with one bounded task. Do not commit, stage, push or branch. Do not use the internet or paid calls, and do not read `.env*`. Never write into the saved import lab data directory. Inspect development pages only; use `pages.json` to exclude every `heldOut: true` page before opening a run record. Do not add real site names, URLs or page text to source files or briefs.

## Evidence and root cause

In the `family-fill` `c-r1` comparison, two development pages failed with `Required section block:1 produced no components` despite a high-confidence `site-header` in the extract reply. The family validator and parser can retain that component. The block harness assigns its location as `header`, but `aggregateSectionArtifacts` recognises only production type `navbar` as satisfying a required header (and only `footer` for a required footer). It rejects the populated family artifact before page assembly. The same issue applies to `site-footer`.

## Fix

Pass the catalogue override's existing `templateEquivalent` function into required-role aggregation only when an override is present. Compare its production-equivalent type to `navbar` or `footer` for the required-role check, including satisfaction by another block in the same region. Leave the no-override path unchanged. Do not weaken the confidence or content-validation gates, and do not accept an arbitrary component merely because its location says `header` or `footer`.

## Regression and verification

Add an invented `site-header` JSON reply with confidence 0.95, valid family content and header placement. Parse it through the production section parser with the family validator, assign the family location, and confirm that required-block aggregation returns the component. Run the lab Jest suite, `npm run test:import`, the root and lab typechecks, and the no-override request-hash tests. Count the same failure signature in development-only `family-fill` `c-r1` run records when those records are available. Report missing saved records explicitly rather than inferring a complete count.
