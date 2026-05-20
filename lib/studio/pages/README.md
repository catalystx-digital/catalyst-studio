# Page Template Registry

The page template registry provides a studio-only catalog of structured page layouts. Templates are registered code-first and mirror the CMS component registry so the import pipeline, AI prompts, and provider adapters can rely on consistent metadata.

## Location
- Factory: `lib/studio/pages/_factory/page-factory.ts`
- Initial templates: `lib/studio/pages/**/register.ts`
- Catalog helper: `lib/studio/pages/catalog.ts`

## Registration Basics
Register templates by importing `pageTemplateFactory` inside a `register.ts` module that lives under `lib/studio/pages/<category>/<template>/register.ts`.

```ts
pageTemplateFactory.registerTemplate({
  templateKey: 'marketing/home-default',
  name: 'Marketing Home',
  category: PageTemplateCategory.Marketing,
  isHomeEligible: true,
  description: 'High-level summary',
  requiredRegions: [
    { region: 'header', allowedComponents: [ComponentType.NavBar], min: 1 }
  ],
  optionalRegions: [
    { region: 'main', allowedComponents: [ComponentType.FeatureGrid] }
  ],
  propsMeta: {
    exampleProp: {
      type: 'string',
      required: false,
      description: 'Optional page-level metadata'
    }
  },
  aiMetadata: {
    keywords: ['home'],
    layoutGuidelines: ['Keep navigation above hero']
  }
})
```

- `requiredRegions`/`optionalRegions` enumerate which CMS component types may appear in each layout region.
- `propsMeta` describes structured page-level properties (scalars or component references).
- `contentSchema` defines the persisted page content fields (e.g., `components` list) that AI/import/export workflows must populate.
- `aiMetadata` surfaces prompt guidance (keywords, layout rules, suggested components).

## Catalog Access
Use `getPageCatalogSummary()` for a cached snapshot of all registered templates. The helper ensures the registry is initialized and applies a 60-second TTL, mirroring the component catalog cache.

```ts
import { getPageCatalogSummary } from '@/lib/studio/pages/catalog'

const summary = await getPageCatalogSummary()
```

Reset the cache with `clearPageCatalogCache()` when running tests or forcing a refresh.
