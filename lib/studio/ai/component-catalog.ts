/**
 * Component Catalog - Unified re-export for backward compatibility
 *
 * This file now re-exports from the modular component-catalog/ directory.
 * All implementation has been split into focused modules:
 * - types.ts: Type definitions
 * - cache.ts: Cache management
 * - catalog-builder.ts: Main catalog building logic
 * - directives.ts: Component-specific LLM extraction directives
 * - prompt-sections.ts: Static prompt sections and utilities
 * - prompt-builders.ts: Detection and chat prompt building
 * - index.ts: Public API exports
 */

export type {
  ComponentPropertyInfo,
  ComponentCatalogComponent,
  ComponentCatalogCategory,
  SubComponentCatalogEntry,
  ComponentCatalogSummary,
  ComponentCatalogOptions,
  BuildDetectionPromptOptions,
  BuildChatPromptOptions
} from './component-catalog/index'

export {
  getComponentCatalogSummary,
  buildDetectionPrompt,
  buildChatPrompt,
  buildTemplateComplianceSection,
  clearComponentCatalogCache
} from './component-catalog/index'
