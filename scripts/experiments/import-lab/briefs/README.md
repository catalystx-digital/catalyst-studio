Use briefs 01 through 16 in order to rebuild this lab. Keep the originals unchanged; add a new numbered brief for later work.

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
