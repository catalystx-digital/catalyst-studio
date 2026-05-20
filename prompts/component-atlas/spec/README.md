# Component Atlas Specification

This directory defines the synthetic component atlas used by the detection evaluation pipeline. Each JSON artifact is grounded in the canonical CMS contracts exported via `initializeCMSComponents()` + `listComponentContracts()` so the dataset tracks the authoritative schema.

## Structure

- `components/<canonicalType>.json` &mdash; deterministic sample props for every canonical component. Entries mirror the contract sample content (fields under `content` or nested lists) and include metadata used by the automation script.
- `pages/*.json` &mdash; atlas page layouts. Each file outlines the regions rendered on a synthetic page plus the ordered components that belong to that region. Region identifiers (`header`, `hero`, `main`, `sidebar`, `footer`) map directly to importer regions.
- `../metadata/components.json` &mdash; contract index (summary, cues, fragments, default region) captured at generation time for traceability.

## Page Groupings

| Page ID | Focus | Coverage Notes |
| --- | --- | --- |
| `navigation-heroes` | Header chrome, navigation primitives, and all hero variants. | Includes both `breadcrumbs` and the `breadcrumb` alias so importer canonicalization is exercised. Sidebar contains `sidemenu`; footer closes page. |
| `content-features-cta` | General content blocks, media modules, feature layouts, and CTA surfaces. | Ensures nested collections (`card-grid`, `tabs`, `accordion`) and CTA variants all render in one run. |
| `social-contact-about` | Trust/validation, contact workflows, and about/storytelling components. | Covers testimonial/review artefacts plus contact + mission templates. |
| `blog-pricing-data` | Editorial/blog structures, pricing matrices, and data visualizations. | Aggregates structured tables/charts and pricing contracts to monitor schema alignment. |

Regenerate fixtures with `pnpm tsx scripts/eval/build-component-atlas-fixtures.ts --build-fixtures` after updating any spec component or layout. The CLI script reads these definitions to render DOM, assemble `context.json`, and (optionally) rebuild `expected.json`. Set `COMPONENT_ATLAS_BASE_URL=http://127.0.0.1:<port>` before running when you need detector recordings against a local server; omit the variable to reset fixtures to the canonical `https://component-atlas.local/<page>` URLs for commits.
