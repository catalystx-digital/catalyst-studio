'use client'

/**
 * SchemaFieldRenderer - Renders fields using the new FieldDispatcher system
 *
 * This component acts as a bridge between PropertyEditorPanel's PropertySchema
 * and the new FieldDispatcher-based primitive editor system.
 *
 * Features:
 * - Converts PropertySchema to FieldSchema on-the-fly
 * - Uses FieldDispatcher for consistent rendering
 * - Provides backward compatibility with existing code
 */

import * as React from 'react'
import { FieldDispatcher, FieldList } from './FieldDispatcher'
import type { PropertySchema } from './types'
import type { FieldSchema } from './schema/types'

export interface SchemaFieldRendererProps {
  /** The schema to render - can be PropertySchema (legacy) or FieldSchema (new) */
  schema: PropertySchema | FieldSchema
  /** Current value */
  value: unknown
  /** Change handler */
  onChange: (value: unknown) => void
  /** Base path for nested fields */
  basePath?: string
  /** Disabled state */
  disabled?: boolean
  /** Error message */
  error?: string
  /** Additional class names */
  className?: string
}

/**
 * Check if schema is the new FieldSchema format
 */
function isFieldSchema(schema: PropertySchema | FieldSchema): schema is FieldSchema {
  // FieldSchema uses different type values than PropertySchema
  const fieldTypes = new Set([
    'string', 'text', 'richText', 'markdown', 'slug', 'code',
    'number', 'integer', 'boolean',
    'date', 'datetime', 'time',
    'select', 'radio', 'multiSelect', 'tags',
    'image', 'externalImage', 'file', 'video',
    'externalUrl', 'internalLink', 'email', 'phone', 'link',
    'contentReference', 'mediaReference',
    'color', 'icon', 'geopoint', 'json',
    'object', 'array', 'componentArray'
  ])

  // If the type is one of the new FieldSchema types that doesn't exist in PropertySchema
  const newOnlyTypes = new Set([
    'string', 'markdown', 'slug', 'code', 'integer', 'datetime',
    'multiSelect', 'tags', 'externalImage', 'file', 'video',
    'externalUrl', 'internalLink', 'email', 'phone',
    'contentReference', 'mediaReference', 'icon', 'geopoint', 'json',
    'componentArray'
  ])

  return newOnlyTypes.has((schema as FieldSchema).type)
}

/**
 * Renders a single field using the new primitive editor system
 */
export function SchemaFieldRenderer({
  schema,
  value,
  onChange,
  basePath,
  disabled,
  error,
  className,
}: SchemaFieldRendererProps) {
  // For now, assume schema is already FieldSchema
  // The adapter has been removed - callers should pass FieldSchema directly
  const fieldSchema = schema as FieldSchema

  return (
    <FieldDispatcher
      schema={fieldSchema}
      value={value}
      onChange={onChange}
      path={basePath}
      disabled={disabled}
      error={error}
      className={className}
    />
  )
}

export interface SchemaFieldListRendererProps {
  /** Array of schemas to render */
  schemas: PropertySchema[] | FieldSchema[]
  /** Current values object keyed by field name */
  values: Record<string, unknown>
  /** Change handler called with field name and new value */
  onChange: (fieldName: string, value: unknown) => void
  /** Base path for nested fields */
  basePath?: string
  /** Disabled state */
  disabled?: boolean
  /** Field-level errors keyed by field name */
  errors?: Record<string, string>
  /** Component registry for componentArray types */
  componentRegistry?: Map<string, FieldSchema[]>
}

/**
 * Renders a list of fields using the new primitive editor system
 */
export function SchemaFieldListRenderer({
  schemas,
  values,
  onChange,
  basePath,
  disabled,
  errors,
  componentRegistry,
}: SchemaFieldListRendererProps) {
  // For now, assume schemas are already FieldSchema[]
  // The adapter has been removed - callers should pass FieldSchema[] directly
  const fieldSchemas = schemas as FieldSchema[]

  // Handle field change - strip content. prefix if needed
  const handleFieldChange = React.useCallback(
    (fieldName: string) => (value: unknown) => {
      // PropertyEditorPanel expects paths like "content.title"
      // FieldSchema uses just "title"
      // We need to add the prefix back for compatibility
      const fullName = basePath ? `${basePath}.${fieldName}` : `content.${fieldName}`
      onChange(fullName, value)
    },
    [onChange, basePath]
  )

  // Extract values with content. prefix stripped
  const strippedValues = React.useMemo(() => {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(values)) {
      // Strip content. prefix if present
      const strippedKey = key.replace(/^content\./, '')
      result[strippedKey] = value
    }
    return result
  }, [values])

  // Strip content. prefix from errors
  const strippedErrors = React.useMemo(() => {
    if (!errors) return undefined
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(errors)) {
      const strippedKey = key.replace(/^content\./, '')
      result[strippedKey] = value
    }
    return result
  }, [errors])

  return (
    <FieldList
      fields={fieldSchemas}
      values={strippedValues}
      onChange={(fieldName, value) => handleFieldChange(fieldName)(value)}
      basePath={basePath}
      disabled={disabled}
      errors={strippedErrors}
      componentRegistry={componentRegistry}
    />
  )
}

export { isFieldSchema }
