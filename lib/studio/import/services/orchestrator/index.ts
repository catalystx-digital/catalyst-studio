/**
 * Orchestrator Module
 *
 * Re-exports all orchestrator utilities and stages.
 *
 * @module orchestrator
 */

// Context
export { OrchestrationContext } from './context'

// Shared component management
export { persistSharedComponentsAndUpdatePages } from './shared-component-manager'

// Component type stage
export {
  registerSimpleComponentTypes,
  registerFullComponentTypes,
  ensureCoreComponentTypes,
  resolveContentTypeConfiguration,
  type ComponentTypeStageInput,
  type ContentTypeConfiguration
} from './component-type-stage'

// Page creation stage
export {
  createPages,
  countTotalComponents,
  type PageCreationInput
} from './page-creation-stage'

// Validation utilities
export {
  validateImportIntegrity,
  rollbackImport,
  calculateStatistics,
  generateImportSummary,
  verifyDatabaseConsistency
} from './validation-utils'

// Processing utilities
export {
  processInChunks,
  checkMemoryUsage,
  forceGarbageCollection,
  handleImportError,
  executeInTransaction,
  type ChunkProcessorOptions,
  type TransactionResult
} from './processing-utils'

// Reference resolution stage
export {
  resolveReferencesStage,
  type ReferenceResolutionInput
} from './reference-resolution-stage'
