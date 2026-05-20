/**
 * Property Editor Module - Barrel Export
 *
 * Composable primitive-based property editor system for the Site Builder.
 */

// Schema types and utilities
export * from './schema'

// Primitive editors
export * from './primitives'

// Structural editors
export * from './structural'

// Data migration utilities
export * from './migrations'

// Field dispatcher
export { FieldDispatcher, FieldList, EDITOR_REGISTRY } from './FieldDispatcher'
export type { FieldDispatcherProps, FieldListProps } from './FieldDispatcher'

// Error boundary
export { FieldErrorBoundary, withFieldErrorBoundary } from './FieldErrorBoundary'

// Schema field renderer (bridge between old and new systems)
export { SchemaFieldRenderer, SchemaFieldListRenderer, isFieldSchema } from './SchemaFieldRenderer'
export type { SchemaFieldRendererProps, SchemaFieldListRendererProps } from './SchemaFieldRenderer'

// Main panel component
export { PropertyEditorPanel } from './PropertyEditorPanel'
export type { PropertyEditorPanelProps } from './PropertyEditorPanel'
