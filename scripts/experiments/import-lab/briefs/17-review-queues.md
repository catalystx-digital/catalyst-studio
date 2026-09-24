# Task: a one-click review page for the founder

You are a coder with one bounded task. Not an orchestrator. Do not commit, stage, push or branch. No internet and no paid calls. Never read `.env*`. Work only in `scripts/experiments/import-lab/`; `lib/**` and `app/**` are read-only. Real lab data may be READ from `C:/projects/catalystx/import-lab-data`; never copy real site names, URLs or page text into code, tests, fixtures, README or briefs. Saved runs, labels and scores must not be rewritten except through the review actions this brief defines.

## Why
Brief 16 produces `labels/<page>/answer-sheet-v2.json`, where each block is `agreed` or `disputed` (a disputed field is `{disputed: true, a, b, c?}`). The founder has little review time and ADHD: the review must be short batches, one click per decision, source first, progress always visible. Today's `review-server.ts` / `review.html` is a 50-type edit form built for version-1 labels. Replace it with three queues. The version-1 edit form is removed, not kept beside the new page.

## The page
`review-server.ts` serves `review.html` on localhost (keep the existing local-only binding, revision-conflict handling and `reviewedBy` recording). Three queues, chosen from a small start screen that shows each queue's remaining count and an estimate in minutes (20 seconds per item):

1. **Disputes.** Every block with a disputed field. Held-out pages first, then development. For each block: the block's screenshot crop first (large), then one button per distinct labeller answer (showing the family and, when relevant, the disputed item count, placement or decoration choice in plain words), plus **Other** (a family dropdown, and number or placement inputs only for the fields that are disputed). One click on an answer saves it and moves to the next block. The founder never sees which vendor gave which answer.
2. **Sample.** 30 randomly chosen agreed blocks from held-out pages (seeded, so the same 30 come back after a reload). Buttons: **Right** / **Wrong** (Wrong opens the family dropdown and saves the correction).
3. **Stick check.** 30 randomly chosen scored development blocks (seeded) from the latest stick scores of a given arm and run (`--arm`, `--run` server options). Show the crop beside a plain list of what was imported for that block: headings, text (first 300 characters), image thumbnails, link labels with their targets. The stick's verdict is hidden. Buttons: **Right** / **Wrong**. Save the founder's answer next to the stick's verdict.

Rules for all queues:
- Batches of 20 with a plain counter ("7 of 20") and a "done for now" button; reloading resumes at the next unanswered item.
- Keyboard: `1`/`2`/`3` choose the answers in order, `Enter` confirms Right, `Esc` goes back one item.
- Saving a dispute answer writes the chosen value into `answer-sheet-v2.json` for that field, sets `status: "reviewed"` and `reviewedBy: "founder"` on the block when no disputed field remains, and keeps the losing options in a `history` array.
- Sample and stick-check answers are written to `labels/review-sample.json` and `labels/stick-check.json` (one file each, append-only records with block id, page, answer and time). Wrong sample answers also correct the block in `answer-sheet-v2.json`.
- A summary endpoint and a line on the start screen report: sample wrong count out of 30 and the rule "2 or more wrong: fix labelling instructions and relabel"; stick-check agreement out of 30 and the rule "28 or more must agree".

## Tests (write first; invented fixtures only)
Run with `$env:IMPORT_MODEL_CHAIN='test/dummy'; $env:SKIP_DB_SETUP='true'; npx --offline jest scripts/experiments/import-lab --runInBand --forceExit`.
- Queue order: held-out disputes before development disputes.
- A dispute answer saves the chosen value, clears the dispute, sets `reviewedBy: "founder"`, keeps history; an invalid family is refused (400).
- Revision conflict still returns 409.
- Sample and stick-check selections are the same after a restart (seeded) and never include ignored blocks; stick check never exposes the stick's verdict in the item payload.
- The summary applies both rules correctly at their boundaries (1 vs 2 wrong; 27 vs 28 agree).
- Vendor names never appear in any payload sent to the page.
- The server still binds only to localhost.

## Verify (offline, free)
With `IMPORT_LAB_ROOT` pointing at a temporary COPY of `C:/projects/catalystx/import-lab-data` containing a hand-made `answer-sheet-v2.json` for one page (write it in the temp copy only), start the server, fetch each queue's first item through the HTTP API, answer it, and fetch again to show it advanced. Report the payloads (no page text; ids and field names only).

## Also
- Both typechecks 0 errors.
- README/RUNBOOK: how to start the review page, the three queues, the two rules. `briefs/README.md`: add this brief as number 17.
- No dead code: the version-1 edit form and its endpoints are removed.

## Final message
Plain English: what was built; the verification results; test and typecheck output lines.
