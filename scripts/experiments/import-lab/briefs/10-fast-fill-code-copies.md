# Brief 10: fast fill and the decision model points, code copies

Bounded lab-only task. Do not stage, commit, push or branch. Do not use the internet, paid calls or environment files. Every new runnable command needs --dry-run. Use fake clients and invented fixtures. Real saved data may be read; never embed real page names, URLs or text in source, tests, docs or briefs. Follow the existing RUNBOOK arm artifact contract so scoring and summaries discover variants normally.

## Motivation

The supplied measurements were 10 pages / 127 reviewed blocks: 48% correct components today versus 69% when code proposes blocks, the decision model picks, and an LLM fills one block per call. Fill reasoning reportedly consumed 63–87% of output, with a 26-second median and occasional minute-long stalls. The largest remaining error family was correct component with incomplete content. These historical measurements are inputs to this brief, not new verified measurements.

The pattern comes from browser-use/jev-ultrafast, identified as MIT-licensed: number source elements; ask independent speculative decision heads together; use the relevant pointers; let code act on exact elements. Import copies content instead of writing new text. Do not fetch upstream or use its license claim as evidence of a locally inspected license.

## Family A

Add --fill-model <openrouter-id> and --reasoning off|default to all LLM arms. Default follows current production configuration. Inspect getReasoningConfig and saved supported_parameters; record the exact payload and returned reasoning-token usage, including unknown values. Off disables or minimises according to supported capabilities; do not promise zero reasoning. Separate arm names by model/reasoning variant. Extend --picks-run to block fills so variants share observed picks.

## Family B: jev-points-code-copies

1. For each code-proposed block, build a document-order table from its saved HTML subtree: headings, own-text containers, paragraphs, links, buttons, images and saved CSS backgrounds, videos/iframes, controls and list items. Include index, kind, heading level, 160-character text, href/src presence, depth and repeated-group ID. Cap at 250 rows, dropping deepest duplicate text first, and retain cap evidence.
2. Detect sibling groups by matching tag/class signatures and similar inner structure, with counts, samples and parent IDs for nested groups. One decision request asks component plus compatible heading, subheading, body, image, primaryAction, secondaryAction and itemsGroup heads. Heads are independent and speculative; field/group heads allow NONE. Preserve all distributions.
3. Only when a group is selected, ask itemTitle, itemText, itemImage, itemLink and itemMeta about the first item. Apply chosen relative paths to every sibling. An unresolved path falls back to the first compatible element and is recorded. Copy normalized source text, linked rich HTML, absolute image URLs with alt, and absolute links with labels.
4. Read production prompt contracts and schema summaries. Use one generic field-name/type mapper with a small synonym table, production SmartLink/MediaReference helpers, and the ordinary production parser/validator. Record unmapped required fields. On validation failure, fail explicitly unless --llm-fallback requests the existing fill for that one block with only the picked type allowed. Mark fallback output. Uncertain picks use the existing two-to-one dominance rule and assemble only the top choice while preserving alternatives.
5. Save tables, groups, all head distributions, template paths, fallbacks, unmapped fields, validation and filledBy per block. run.json adds code/fallback/failed counts, decision request count and summed latency. Default code-copy arm makes no LLM fill calls; decision requests are still paid.

## Acceptance

Fake-client/invented-fixture tests cover tables and caps, cards and nested menus, a structural false positive, compatible head options, template replication and unresolved paths, rich links, six real catalogue families (hero, cards, navbar, footer, CTA, text), fallback, variant names and reasoning payloads. Run all lab Jest tests with SKIP_DB_SETUP=true and project typecheck with zero errors. Dry-run both families. Offline, inspect every real proposed block and report slug-only counts, median/max rows, caps and groups; report unresolved anchors rather than inventing DOM evidence.

Update README, RUNBOOK and the brief index with flags, call counts and the reference. Final handoff includes built behavior, real-page statistics, PAID orchestrator commands for reasoning off, inception/mercury-2.5, code copies and fallback, offline limits and evidence-backed corrections to the brief.
