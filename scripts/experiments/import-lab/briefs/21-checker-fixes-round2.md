# Task: two checker fixes from the founder's second check

The founder's second spot-check agreed with the measuring stick on 13 of 30 blocks. The evidence showed the checker was right in most disagreements, with two exceptions:

1. **Logo text is not a heading.** When a source `h1`–`h6` or `role="heading"` gets its apparent text only from a nested image's alt text, C3 does not require a heading. C5 still checks the image, and its alt text remains source text for C7. A heading with real visible text still counts.
2. **The stick-check queue never shows unsettled blocks.** Draw only blocks with a real stick verdict. Read the latest scores on each page load and use the latest verdict when the founder answers, so an earlier draw cannot preserve an obsolete verdict.

Keep changes inside `scripts/experiments/import-lab/`. Use invented fixtures only; do not inspect held-out page data. Verify with `$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit` and both typechecks.
