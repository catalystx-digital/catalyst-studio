# Import accuracy: definition, loop and site panel

Goal: import a website's content with 95%+ accuracy, through a small researched catalogue ([catalogue.md](catalogue.md)), code checks against the source page, and a decision model (Jev) for judgement calls. This document says what "accuracy" means, how changes are decided, and which pages they are judged on.

Every threshold below is a **default the founder can overturn**. Real site addresses never appear in committed files; they live only in the git-ignored lab data.

## 1. What counts as accurate

The unit is a **block**: one visual section of a source page (a banner, a row of cards, a footer). A block is **accurate** when every check that applies to it passes. The expected content is read from the source page by code; labels only supply the block's acceptable families, an ignore flag, an item count and which images are decoration.

| Check | Passes when |
|---|---|
| C1 Found, right family | At least one imported component matches the block, and its family is one of the block's acceptable families. |
| C2 Text kept | Each run of visible text keeps at least 90% of its 5-word sequences in one component. A run under 5 words must appear whole. In a block under 12 words, every run must be found. |
| C3 Headings exact | Every visible heading appears exactly, in a heading-type field (title, heading, headline, subheading, subtitle, eyebrow, name, question). |
| C4 Links kept | Every visible link target appears, and every link label appears exactly. |
| C5 Content images kept | Every content image appears (any one of its sizes is enough). Not counted: tracking pixels, images under 16 px on both sides, cloned carousel copies, images marked decoration. |
| C6 Item count | The number of repeated items (cards, logos, stats, slides) equals the source's. |
| C7 No invented text | At most 5% of the block's output text is not found in the block's own source. Text moved from another block counts as not found. Image alt text written by the model is exempt, but counted. |

Details the checks rely on:
- **Visible** means not hidden by the page's own styles, not marked `aria-hidden`, not screen-reader-only, and not a cloned carousel copy. Inactive slides and tabs are visible content.
- Text is compared after Unicode normalisation (NFKC), with whitespace collapsed, case ignored and trailing punctuation ignored. Runs shorter than 12 characters are not text-checked; C3 and C4 cover short headings and labels.
- Links are compared as absolute addresses with tracking parameters (`utm_*`, `gclid`, `fbclid` and similar) removed.
- A block with no matched component is **missed**. A page's blocks are all missed only when its run aborted as a whole.
- Blocks labelled "ignore" are not scored; importing one anyway counts as junk. Imported components matching no block count as extra.

Scored content is **what the importer stores**. Before any accuracy claim is made to customers, a separate render check must confirm the stored fields are displayed.

## 2. Headline numbers

- **Accuracy** = accurate blocks ÷ scored blocks, averaged over runs.
- **Likely range**: a 95% interval from resampling pages (2,000 draws, fixed seed, so reruns give identical numbers).
- **Noise band**: how much two sets of runs of identical code differ. Any claimed gain is compared with it.
- **Clean pages**: the share of pages where every block is accurate.
- Development pages also get per-check failure rates and, per check, an upper bound: the share of blocks whose *only* failure is that check.

Limits stated up front:
- Development and held-out numbers carry label error; only a founder-checked claim set is label-exact.
- Comparing two arms on the same labels is relative, so it is robust to label error that affects both equally.
- With few development pages, intervals are wide.

## 3. The loop: fact, hypothesis, evidence, run

No change is made by trial and error. Every change starts as one row in the hypothesis ledger (kept in the git-ignored lab data because it names pages and runs):

1. **Fact**: a measured number on development pages, with run ids.
2. **Mechanism**: why it fails, stated so it can be tested.
3. **Offline evidence**: a free check on saved data showing the mechanism is real, and the **upper bound** of the possible gain.
4. **Prediction**: which check moves, by how much, and which must not fall.
5. **Run**: two runs per side.
6. **Decision**: keep, park or drop, with the reason.

Rules:
- One change per cycle; small fixes with the same mechanism may be bundled.
- **Park** an idea whose upper bound is below 1.4 × the noise band (it could not be detected reliably), unless it is deterministic and provable by re-scoring saved outputs.
- **Keep** only when the gain's interval is entirely above zero, the gain stays positive when any one development site is left out, no check falls clearly, and extra or junk components do not rise beyond the noise band. One extra pair of runs is allowed if the interval straddles zero; a third pair raises the false-keep rate from about 2.5% to about 4% per cycle, which the held-out gates catch.
- A result that misses its prediction by more than the noise band is recorded as "mechanism wrong".
- No site-specific code: no hostnames, site class names or one-site rules. A leak check runs before every pull request.
- **Stall rule:** five ideas in a row parked or dropped, or $50 spent, stops the loop and goes to the founder as a one-screen report.
- Each kept change is documented in a numbered lab brief (`scripts/experiments/import-lab/briefs/`), described in site kinds only.

## 4. The site panel

| Split | Contents | Used for |
|---|---|---|
| Development | Pages from about 8 sites across kinds (local business, education, government, health, insurance, magazine, SaaS, charity) | Studying failures and keep decisions |
| Held-out | Pages from 5 other sites (SaaS, shops, professional services, hospitality) | Overfitting check at gates only; overall number only |
| Claim set | At least 30 unseen pages from at least 10 new sites across at least 8 kinds, at most 3 pages per site | Only for a public 95% claim |

- Splits are always by **site**, never by page.
- Site kinds: SaaS/software; shop; hospitality/local business; professional services/finance; government; health; education; charity; magazine/blog/news; documentation/portfolio/events.
- **Overfitting signal:** at a gate, the gap between development and held-out has grown by more than the noise band since the baseline. At that gate, the two development sites most cited in the ledger are retired and two fresh sites of under-represented kinds join.
- Held-out results show one overall number; nobody designing a change reads held-out labels or block results.

## 5. Claiming 95%

A public claim needs all of: at least 350 scored blocks on the claim set; three runs; every claim-set label reviewed by the founder; observed accuracy of at least 95% with the site-resampled lower bound at least 93%; and a render check. A claim set that fails becomes ordinary development or held-out data, and the next attempt needs a new one.
