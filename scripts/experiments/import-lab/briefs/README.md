Use briefs 01 through 25 in order to rebuild this lab. Keep the originals unchanged; add a new numbered brief for later work.

These briefs were given to a coding agent with no internet, no paid calls and no secrets. The agent could read saved local evidence, use invented fixtures and run offline checks. Real site names and page content must stay out of source files and new briefs. The owner runs any internet or paid evaluation stages separately.

| Order | Brief | What it built | Finding that triggered it |
| --- | --- | --- | --- |
| 1 | [Phase 1](01-phase1.md) | Saved snapshots, detection replay, repair arms, content measurements and reports. | The owner needed evidence of whether repair helps and how repeated runs differ. |
| 2 | [Measurement fixes](02-phase1-fix1.md) | Content-only checks, hidden-source support, word-group coverage, duplicate removal and smaller reports. | Catalogue metadata looked like invented page text; hidden carousel captions were wrongly rejected; correct text split across fields looked lost; repair lost links. |
| 3 | [Answer sheet](03-phase2a.md) | Proposed visual blocks, draft labels, a review page and per-block scores. | Source-retention checks could not tell whether the component choice was acceptable. |
| 4 | [Block finder fixes](04-blockfix.md) | Saved geometry, row-based cuts, wrapper descent, region inference and offline replay. | A page with about nine visible blocks became only two because a small spacer and narrow centred containers stopped descent. |
| 5 | [Rendering and grouping fixes](05-blockfix2.md) | Correct-origin rendering, styling checks, bounded lazy scrolling, region limits and grouped grid rows. | A page had no styling; lazy content stayed empty; a banner entered the header; news entered the footer; one grid became several blocks. |
| 6 | [Comparison arms](06-phase2b-3.md) | Known-block and known-type comparisons, full instructions, decision picks and block/whole-page extraction. | Large mixed-type prompts, shortened rules, heavy reasoning usage and slow runs motivated a measured alternative. |
| 7 | [CSS matching](07-cssfix.md) | Ordered saved-node matching with explicit partial enrichment. | Eight of nine real blocks failed because external CSS fields could not be recovered through the earlier matching rule. |
| 8 | [Infrastructure retries](08-retry.md) | Opt-in retries for timeouts and cut-short replies, with every attempt saved. | Twelve of nineteen missed blocks came from stalled or truncated calls; completed calls were much faster. |
| 9 | [Durability](09-hardening.md) | The short summary, page manifest, stage commands, runbook, faster preparation and safe recovery. | Reports were too large to read; preparation exceeded fifteen minutes; draft credits ran out; dry runs broke bulk scoring; visible carousel slides gave wrong item counts. |

| 10 | [Fast fill and code copies](10-fast-fill-code-copies.md); [original proposal](10-fast-fill-and-jev-points.md) | Fill-model/reasoning variants and speculative element pointers followed by generic contract-based copying. | Slow reasoning-heavy fills and missing copied content motivated the numbered-element pattern from browser-use/jev-ultrafast (MIT, as identified in the brief). |

| 11 | [Code-copy assembly fixes](11-code-copy-assembly-fix.md) | Free saved-decision reassembly, typed block fallbacks, nested arrays, and assembly quality reporting. | Saved code-copy runs failed production validation despite successful decisions. |

| 12 | [Component families](12-component-families.md) | Free family scoring, summed-probability picks, optional family choice requests and paired summary tables. | Overlapping page-level types made acceptable labels ambiguous and near-twin decisions look wrong. |

| 13 | [Cleanup](13-cleanup.md) | Keep the repeatable block audit and remove finished experiments. | The winning path was decided; unused machinery and large reports obscured it. |

| 14 | [Accuracy stick](14-accuracy-stick.md) | Derive per-block content expectations from source HTML and score seven checks. | Label-drafted expectations and page-wide invented-text checks could hide content loss or movement. |
| 15 | [Accuracy report and leak check](15-accuracy-report.md) | Summarise development and held-out stick scores with page ranges and check added code for site names. | The measuring stick needed a one-screen result and a guard against site-specific rules. |
| 16 | [Two-labeller family key](16-family-labels.md) | Add site kinds, independent family labelling, field-level merge and agreement reports. | Most blocks in the first answer key had not received block review. |
| 17 | [Founder review queues](17-review-queues.md) | Replace the version-1 edit form with short dispute, sample and stick-check queues. | The founder needed source-first decisions in short batches and visible review thresholds. |
| 18 | [Labeller fixes and subscription CLIs](18-labeller-fixes-and-cli.md) | Accept count-only labels, normalise family lists, retry invalid replies, cover proposal-only pages and add Claude and read-only Codex subscription routes. | The first labelling pass rejected valid counts and skipped 18 pages. |
| 19 | [Score on the new answer key](19-score-on-new-key.md) | Make C optional per block, score version-2 family labels with stick2 and report unsettled sections. | The measuring stick still used the unreviewed version-1 answer key. |
| 20 | [Founder's first check fixes](20-founder-check-fixes.md) | Exclude screen-reader-only text, accept content-preserving splits, show full review previews, version and refine labelling instructions, preserve founder decisions during relabel, and draw round-two checks. | The founder found four wrong sample labels and nine stick disagreements. |
| 21 | [Checker fixes from the second check](21-checker-fixes-round2.md) | Keep image-alt-only logo headings out of C3 and draw stick checks only from settled verdicts, using current scores when answers are saved. | The founder's second spot-check agreed on 13 of 30; evidence supported the checker in most cases, with these two exceptions. |
| 22 | [Family schemas and fill arm](22-family-fill-arm.md) | Add strict schemas for 15 families and a lab-only family fill arm using production cutting and picking. | Compare generic family filling with production's overlapping component fills on the same saved pages. |
| 23 | [Fair family comparison](23-fair-family-comparison.md) | Use one production blocks path with an optional catalogue override in `lib/studio/import/detection/blocks/` and minimum web-detection wiring. | The first family fill arm had different execution and acceptance rules, so its comparison was uncontrolled. |
| 24 | [Family go / no-go screen](24-go-no-go.md) | Compare paired family and production stick scores with site, check, noise and held-out gates. | The founder needs one decision screen for the 15 families. |
| 25 | [Family required-section fix](25-family-drop-fix.md) | Apply the override's production-equivalent type when checking required header and footer blocks. | A valid family header was parsed but rejected by a production-only type check. |
| 26 | [Automatic block verification](26-block-verification.md) | Check imported development sections for missing text, links and images or invented text using source evidence alone. | A runtime check is needed before a targeted repair call can list missing content. |

## Removed after the decisions

- Whole-page extraction: most blocks were missed.
- Element-pointer copying and assembly: lost on content kept; the owner chose deletion.
- Expanded prompt-rule experiment: measured no difference from today's rules.
- Reasoning override: measured no change because production already sends the minimal setting.
- Giant reports and one-off proof/profiling scripts: the summary is the reporting path; useful checks remain in tests. No additional performance result is claimed for this maintenance deletion.

The last commit containing each removed implementation is on this branch's history. Briefs remain a historical record, including superseded commands and names; use the current runbook for reruns.

## Rebuild

1. Start from the matching production importer revision and installed dependencies. Record that revision. These briefs specify behavior; they do not freeze future production APIs or provider results.
2. Give each brief to the coding agent in order, with the repository rules and its write boundary. Do not supply environment files or secrets. Inspect the diff and run that brief's offline tests before the next brief.
3. Use invented pages first. Restore real snapshots, labels and runs only into ignored data storage; do not embed them in fixtures. Set aside held-out pages before changing any rule.
4. Follow [RUNBOOK.md](../RUNBOOK.md) for the evaluation. Read the saved short summary before choosing further work. Paid and internet stages require separate execution; rebuilding code does not require them.

## Extend

Write the next brief around a measured failure, the exact desired behavior, permitted files and a small invented reproduction. Include the command that proves the fix and the output the owner needs. Preserve old runs and scores; record new model, prompt, rule or label versions in new runs. Use design pages for choices and held-out pages only for the final check.

The source briefs include historical paths, costs and findings. Recheck those against the current code and saved evidence before repeating an old experiment. Do not treat a previous result as a promise about a new model or page set.

M3: the lab now measures production code; removed lab files: arm-runtime.ts, block-input.ts, extract-block.ts, picks.ts and production-access.ts; labelling-only proposals and historical scoring remain.
