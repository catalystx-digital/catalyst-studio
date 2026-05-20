'use client'

/**
 * FieldDispatcher - Universal Field Routing Component
 *
 * Features:
 * - Maps FieldSchema.type to appropriate editor component
 * - Single entry point for all field rendering
 * - Handles all primitives and structural types
 * - Error boundary per field
 * - Fallback to JSON editor for unknown types
 */

import * as React from 'react'
import type { FieldSchema, FieldType } from './schema/types'
import { FieldErrorBoundary } from './FieldErrorBoundary'

// Import primitive editors
import {
  StringEditor,
  TextEditor,
  RichTextEditor,
  MarkdownEditor,
  SlugEditor,
  CodeEditor,
  NumberEditor,
  BooleanEditor,
  CheckboxEditor,
  SelectEditor,
  RadioEditor,
  MultiSelectEditor,
  TagsEditor,
  DateEditor,
  DateTimeEditor,
  TimeEditor,
  ColorEditor,
  ExternalUrlEditor,
  InternalLinkEditor,
  EmailEditor,
  PhoneEditor,
  LinkEditor,
  ImageEditor,
  ExternalImageEditor,
  FileEditor,
  VideoEditor,
  ContentReferenceEditor,
  MediaReferenceEditor,
  IconEditor,
  GeopointEditor,
  JsonEditor,
} from './primitives'

// Import structural editors
import { ObjectEditor, ArrayEditor, ComponentArrayEditor } from './structural'

// Type for editor component
type EditorComponent = React.ComponentType<{
  value: unknown
  onChange: (value: unknown) => void
  schema: FieldSchema
  error?: string
  disabled?: boolean
  path?: string
  className?: string
  id?: string
  websiteId?: string | null
  FieldDispatcher?: React.ComponentType<FieldDispatcherProps>
  // Additional props for structural editors
  fieldErrors?: Record<string, string>
  itemErrors?: Record<number, string | Record<string, string>>
  componentRegistry?: Map<string, FieldSchema[]>
}>

// Editor registry mapping types to components
const EDITOR_REGISTRY: Record<FieldType, EditorComponent> = {
  // Text primitives
  string: StringEditor as EditorComponent,
  text: TextEditor as EditorComponent,
  richText: RichTextEditor as EditorComponent,
  markdown: MarkdownEditor as EditorComponent,
  slug: SlugEditor as EditorComponent,
  code: CodeEditor as EditorComponent,

  // Numeric primitives
  number: NumberEditor as EditorComponent,
  integer: NumberEditor as EditorComponent,

  // Boolean primitive
  boolean: BooleanEditor as EditorComponent,

  // Date/Time primitives
  date: DateEditor as EditorComponent,
  datetime: DateTimeEditor as EditorComponent,
  time: TimeEditor as EditorComponent,

  // Selection primitives
  select: SelectEditor as EditorComponent,
  radio: RadioEditor as EditorComponent,
  multiSelect: MultiSelectEditor as EditorComponent,
  tags: TagsEditor as EditorComponent,

  // Media primitives
  image: ImageEditor as EditorComponent,
  externalImage: ExternalImageEditor as EditorComponent,
  file: FileEditor as EditorComponent,
  video: VideoEditor as EditorComponent,

  // Link primitives
  externalUrl: ExternalUrlEditor as EditorComponent,
  internalLink: InternalLinkEditor as EditorComponent,
  email: EmailEditor as EditorComponent,
  phone: PhoneEditor as EditorComponent,
  link: LinkEditor as EditorComponent,

  // Reference primitives
  contentReference: ContentReferenceEditor as EditorComponent,
  mediaReference: MediaReferenceEditor as EditorComponent,

  // Special primitives
  color: ColorEditor as EditorComponent,
  icon: IconEditor as EditorComponent,
  geopoint: GeopointEditor as EditorComponent,
  json: JsonEditor as EditorComponent,

  // Structural types
  object: ObjectEditor as EditorComponent,
  array: ArrayEditor as EditorComponent,
  componentArray: ComponentArrayEditor as EditorComponent,
}

// Structural types that need FieldDispatcher passed
const STRUCTURAL_TYPES: FieldType[] = ['object', 'array', 'componentArray']

export interface FieldDispatcherProps {
  /** Field schema */
  schema: FieldSchema
  /** Current value */
  value: unknown
  /** Change handler */
  onChange: (value: unknown) => void
  /** Path in the data tree (for nested fields) */
  path?: string
  /** Disabled state */
  disabled?: boolean
  /** Error message */
  error?: string
  /** Additional CSS classes */
  className?: string
  /** Website ID for API calls */
  websiteId?: string | null
  /** Field-level errors for object type */
  fieldErrors?: Record<string, string>
  /** Item-level errors for array type */
  itemErrors?: Record<number, string | Record<string, string>>
  /** Component registry for componentArray type */
  componentRegistry?: Map<string, FieldSchema[]>
  /** Callback for field errors */
  onFieldError?: (path: string, error: Error) => void
}

/**
 * Get the editor component for a given field type
 */
function getEditorForType(type: FieldType): EditorComponent {
  const Editor = EDITOR_REGISTRY[type]
  if (Editor) {
    return Editor
  }
  // Fallback to JSON editor for unknown types
  if (process.env.NODE_ENV === 'development') {
  console.warn(`[FieldDispatcher] Unknown field type: "${type}", falling back to JsonEditor`)
  }
  return JsonEditor as EditorComponent
}

/**
 * FieldDispatcher - Routes field types to appropriate editors
 */
export function FieldDispatcher({
  schema,
  value,
  onChange,
  path,
  disabled,
  error,
  className,
  websiteId,
  fieldErrors,
  itemErrors,
  componentRegistry,
  onFieldError,
}: FieldDispatcherProps) {
  // Debug: Log field dispatch to trace value flow
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
    console.log('[FieldDispatcher] Dispatching:', {
      fieldName: schema.name,
      fieldType: schema.type,
      value,
      valueType: typeof value,
      isObject: value !== null && typeof value === 'object',
    })
    }
  }, [schema.name, schema.type, value])

  const Editor = getEditorForType(schema.type)
  const isStructural = STRUCTURAL_TYPES.includes(schema.type)

  // Build path for nested fields
  const fieldPath = path ? `${path}.${schema.name}` : schema.name

  // Handle field error callback
  const handleFieldError = React.useCallback(
    (fieldError: Error, errorInfo: React.ErrorInfo) => {
      if (process.env.NODE_ENV === 'development') {
      console.error(`[FieldDispatcher] Error in field "${schema.name}" at path "${fieldPath}":`, fieldError)
      }
      onFieldError?.(fieldPath, fieldError)
    },
    [schema.name, fieldPath, onFieldError]
  )

  // For integer type, ensure we have integer-only mode
  const effectiveSchema = React.useMemo(() => {
    if (schema.type === 'integer') {
      return { ...schema, step: schema.step ?? 1 }
    }
    return schema
  }, [schema])

  // Build props for structural editors
  const structuralProps = isStructural
    ? {
        FieldDispatcher,
        fieldErrors: schema.type === 'object' ? fieldErrors : undefined,
        itemErrors: schema.type === 'array' ? itemErrors : undefined,
        componentRegistry: schema.type === 'componentArray' ? componentRegistry : undefined,
      }
    : {}

  return (
    <FieldErrorBoundary
      fieldName={schema.name}
      className={className}
      onError={handleFieldError}
    >
      <Editor
        value={value}
        onChange={onChange}
        schema={effectiveSchema}
        error={error}
        disabled={disabled}
        path={fieldPath}
        className={className}
        websiteId={websiteId}
        {...structuralProps}
      />
    </FieldErrorBoundary>
  )
}

/**
 * Render a list of fields from a schema array
 */
export interface FieldListProps {
  /** Array of field schemas */
  fields: FieldSchema[]
  /** Current values object */
  values: Record<string, unknown>
  /** Change handler for field values */
  onChange: (fieldName: string, value: unknown) => void
  /** Base path for nested fields */
  basePath?: string
  /** Disabled state */
  disabled?: boolean
  /** Field-level errors keyed by field name */
  errors?: Record<string, string>
  /** Website ID for API calls */
  websiteId?: string | null
  /** Component registry for componentArray types */
  componentRegistry?: Map<string, FieldSchema[]>
  /** Callback for field errors */
  onFieldError?: (path: string, error: Error) => void
}

/**
 * FieldList - Renders multiple fields from a schema array
 */
export function FieldList({
  fields,
  values,
  onChange,
  basePath,
  disabled,
  errors,
  websiteId,
  componentRegistry,
  onFieldError,
}: FieldListProps) {
  // Sort fields by order
  const sortedFields = React.useMemo(() => {
    return [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [fields])

  // Handle field change
  const handleFieldChange = React.useCallback(
    (fieldName: string) => (value: unknown) => {
      onChange(fieldName, value)
    },
    [onChange]
  )

  return (
    <div className="space-y-4">
      {sortedFields.map((field) => {
        // Check hidden condition
        if (typeof field.hidden === 'function') {
          if (field.hidden(values)) return null
        } else if (field.hidden) {
          return null
        }

        return (
          <FieldDispatcher
            key={field.name}
            schema={field}
            value={values[field.name]}
            onChange={handleFieldChange(field.name)}
            path={basePath}
            disabled={disabled}
            error={errors?.[field.name]}
            websiteId={websiteId}
            componentRegistry={componentRegistry}
            onFieldError={onFieldError}
          />
        )
      })}
    </div>
  )
}

// Export editor registry for extension
export { EDITOR_REGISTRY }
