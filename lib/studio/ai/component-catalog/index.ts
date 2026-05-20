// Public API exports - maintains backward compatibility with original component-catalog.ts

export type {
  ComponentPropertyInfo,
  ComponentCatalogComponent,
  ComponentCatalogCategory,
  SubComponentCatalogEntry,
  ComponentCatalogSummary,
  ComponentCatalogOptions,
  BuildDetectionPromptOptions,
  BuildChatPromptOptions
} from './types'

export { getComponentCatalogSummary } from './catalog-builder'
export { buildDetectionPrompt, buildChatPrompt, buildTemplateComplianceSection } from './prompt-builders'
export { clearComponentCatalogCache } from './cache'
