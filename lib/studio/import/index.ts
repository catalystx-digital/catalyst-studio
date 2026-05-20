/**
 * Import Pipeline - Web-Based Component Detection
 * 
 * Main entry point for the import functionality.
 * Uses LLM analysis to detect website structure.
 * 
 * @module import
 */

// Export the web-based pipeline as the main implementation
export { importPipeline } from './import-pipeline'
export type { ImportPipelineOptions, ImportPipelineResult } from './import-pipeline'

// Export core services (web-based only)
export { getDetectionService } from './web-detection'
export type { DetectionService, ImportDetectionResult, DetectedComponent } from './web-detection'

// Export template generation services
export { TemplateGenerator } from './template-generator'
export type { CMSTemplate, TemplateField, TemplateGeneratorOptions } from './template-generator'

// TemplateCustomizer is internal-only (not exported, kept for future use)

export { TemplateLibrary } from './template-library'
export type { TemplateSearchCriteria, TemplateExportData } from './template-library'

// Export shared types
export type { 
  NavigationHierarchy, 
  NavigationPage, 
  NavigationSection,
  Template, 
  TemplateRegion,
  DesignTokens,
  ComponentUsagePattern 
} from './types'

// Re-export pipeline types for convenience
export * from './import-pipeline'
