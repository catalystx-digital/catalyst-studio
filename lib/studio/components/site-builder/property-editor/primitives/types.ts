/**
 * Primitive Editor Types
 *
 * Common interfaces and types for all primitive editors.
 */

import type { FieldSchema } from '../schema/types'

/**
 * Base props interface for all primitive editors.
 * Generic type T represents the value type for the field.
 */
export interface EditorProps<T = unknown> {
  /** Current field value */
  value: T

  /** Change handler - called when value changes */
  onChange: (value: T) => void

  /** Field schema with configuration */
  schema: FieldSchema

  /** Error message if validation failed */
  error?: string

  /** Whether the field is disabled */
  disabled?: boolean

  /** Path in the data tree (for nested fields, e.g., 'overlay.color') */
  path?: string

  /** Additional CSS class for the editor wrapper */
  className?: string

  /** ID for the input element (for label association) */
  id?: string

  /** Website ID for API calls (e.g., media library, content references) */
  websiteId?: string | null
}

/**
 * Editor component type with generic value
 */
export type EditorComponent<T = unknown> = React.ComponentType<EditorProps<T>>

/**
 * Props for the base PrimitiveEditor wrapper component
 */
export interface PrimitiveEditorWrapperProps {
  /** Field schema */
  schema: FieldSchema

  /** Error message */
  error?: string

  /** Whether the field is required */
  required?: boolean

  /** Additional wrapper class */
  className?: string

  /** Children (the actual editor input) */
  children: React.ReactNode

  /** ID for label association */
  htmlFor?: string
}

/**
 * Debounce options for editors that need debounced onChange
 */
export interface DebounceOptions {
  /** Debounce delay in milliseconds */
  delay?: number

  /** Whether to call onChange on blur regardless of debounce */
  flushOnBlur?: boolean
}

/**
 * Character count display options
 */
export interface CharacterCountOptions {
  /** Maximum character limit */
  maxLength?: number

  /** Current character count */
  count: number

  /** Whether to show warning when near limit */
  showWarning?: boolean

  /** Threshold percentage for warning (default: 90) */
  warningThreshold?: number
}
