/**
 * Composable Primitive Editor Schema Types
 *
 * This module defines the canonical field types and schema interface
 * for the primitive-based property editor system.
 */

// ============================================================================
// Primitive Type Definitions
// ============================================================================

/** Text-based primitive types */
export type TextPrimitiveType =
  | 'string'
  | 'text'
  | 'richText'
  | 'markdown'
  | 'slug'
  | 'code'

/** Numeric primitive types */
export type NumericPrimitiveType = 'number' | 'integer'

/** Boolean primitive type */
export type BooleanPrimitiveType = 'boolean'

/** Date/Time primitive types */
export type DateTimePrimitiveType = 'date' | 'datetime' | 'time'

/** Selection primitive types */
export type SelectionPrimitiveType = 'select' | 'radio' | 'multiSelect' | 'tags'

/** Media primitive types */
export type MediaPrimitiveType = 'image' | 'file' | 'video' | 'externalImage'

/** Link primitive types */
export type LinkPrimitiveType =
  | 'externalUrl'
  | 'internalLink'
  | 'email'
  | 'phone'
  | 'link'

/** Reference primitive types */
export type ReferencePrimitiveType = 'contentReference' | 'mediaReference'

/** Special primitive types */
export type SpecialPrimitiveType = 'color' | 'icon' | 'geopoint' | 'json'

/** All primitive types combined */
export type PrimitiveType =
  | TextPrimitiveType
  | NumericPrimitiveType
  | BooleanPrimitiveType
  | DateTimePrimitiveType
  | SelectionPrimitiveType
  | MediaPrimitiveType
  | LinkPrimitiveType
  | ReferencePrimitiveType
  | SpecialPrimitiveType

/** Structural (composite) types */
export type StructuralType = 'object' | 'array' | 'componentArray'

/** All field types */
export type FieldType = PrimitiveType | StructuralType

// ============================================================================
// Option Types
// ============================================================================

/** Option for select/radio/multiSelect fields */
export interface SelectOption {
  /** Display label */
  label: string
  /** Stored value */
  value: string | number
  /** Optional icon identifier */
  icon?: string
  /** Optional description shown below label */
  description?: string
  /** Whether this option is disabled */
  disabled?: boolean
}

// ============================================================================
// Value Types for Storage
// ============================================================================

/** Internal link value with page reference (aligned with PageReferenceSchema) */
export interface InternalLinkValue {
  type: 'internal'
  pageId: string
  path: string
  label?: string
}

/** External URL value (aligned with ExternalLinkSchema) */
export interface ExternalLinkValue {
  type: 'external'
  url: string
  label?: string
  openInNewTab?: boolean
}

/** Email link value (aligned with EmailLinkSchema) */
export interface EmailLinkValue {
  type: 'email'
  href: string
  label?: string
}

/** Phone link value (aligned with PhoneLinkSchema) */
export interface PhoneLinkValue {
  type: 'phone'
  href: string
  label?: string
}

/** Anchor link value (aligned with AnchorLinkSchema) */
export interface AnchorLinkValue {
  type: 'anchor'
  href: string
  label?: string
}

/** Union of all link value types */
export type LinkValue =
  | InternalLinkValue
  | ExternalLinkValue
  | EmailLinkValue
  | PhoneLinkValue
  | AnchorLinkValue

/** Media library image value */
export interface MediaImageValue {
  mediaId: string
  url: string
  alt?: string
  width?: number
  height?: number
}

/** External image value (URL only) */
export interface ExternalImageValue {
  url: string
  alt?: string
}

/** File value from media library */
export interface MediaFileValue {
  mediaId: string
  url: string
  filename: string
  size?: number
  mimeType?: string
}

/** Video value */
export interface MediaVideoValue {
  mediaId?: string
  url: string
  poster?: string
}

/** Content reference value */
export interface ContentReferenceValue {
  contentId: string
  contentType: string
}

/** Media reference value */
export interface MediaReferenceValue {
  mediaId: string
  mediaType: 'image' | 'video' | 'file'
}

/** Geopoint value */
export interface GeopointValue {
  lat: number
  lng: number
}

// ============================================================================
// Field Schema Interface
// ============================================================================

/**
 * Complete field schema definition for the property editor.
 * This is the canonical format for defining component properties.
 */
export interface FieldSchema {
  /** Unique field identifier (used as key in data object) */
  name: string

  /** Field type - determines which editor to render */
  type: FieldType

  /** Human-readable label (defaults to name if not provided) */
  label?: string

  /** Whether field is required */
  required?: boolean

  /** Help text shown below field */
  description?: string

  /** Placeholder text for input fields */
  placeholder?: string

  /** Default value when field is empty */
  defaultValue?: unknown

  // ========== Type-specific options ==========

  /** For select/radio/multiSelect - available options */
  options?: SelectOption[]

  /** For number/integer - minimum value */
  min?: number

  /** For number/integer - maximum value */
  max?: number

  /** For number - step increment */
  step?: number

  /** For string/text - minimum length */
  minLength?: number

  /** For string/text - maximum length */
  maxLength?: number

  /** For string - regex pattern for validation */
  pattern?: string

  /** For string - pattern error message */
  patternMessage?: string

  /** For code - language hint (e.g., 'javascript', 'css', 'html') */
  language?: string

  /** For link - allowed link types */
  linkTypes?: ('external' | 'internal' | 'email' | 'phone' | 'anchor')[]

  /** For contentReference/componentArray - allowed content types */
  allowedTypes?: string[]

  /** For object - nested field definitions */
  fields?: FieldSchema[]

  /** For array - item schema */
  items?: FieldSchema

  /** For array - minimum items */
  minItems?: number

  /** For array - maximum items */
  maxItems?: number

  /** For number - whether to show as slider */
  slider?: boolean

  /** For number - unit suffix (e.g., 'px', '%', 'ms') */
  unit?: string

  /** For slug - field to generate from */
  generateFrom?: string

  /** For color - allowed formats */
  colorFormat?: 'hex' | 'rgb' | 'hsl' | 'any'

  /** For color - whether to allow transparency */
  allowAlpha?: boolean

  /** For text - whether to auto-resize */
  autoResize?: boolean

  /** For text - number of rows */
  rows?: number

  // ========== UI options ==========

  /** Group name for field grouping in UI */
  group?: string

  /** Display order within group */
  order?: number

  /** Conditional visibility - hide field based on data */
  hidden?: boolean | ((data: Record<string, unknown>) => boolean)

  /** Read-only mode - disable editing */
  readOnly?: boolean | ((data: Record<string, unknown>) => boolean)

  /** Collapsed by default (for object/array fields) */
  collapsed?: boolean

  /** Width hint for field layout */
  width?: 'full' | 'half' | 'third'

  /** Custom CSS class for the field wrapper */
  className?: string
}

// ============================================================================
// Validation Types
// ============================================================================

/** Validation result from field validation */
export interface FieldValidationResult {
  valid: boolean
  message?: string
  severity?: 'error' | 'warning'
}

/** Validation function signature */
export type FieldValidator = (
  value: unknown,
  schema: FieldSchema,
  data: Record<string, unknown>
) => FieldValidationResult

// ============================================================================
// Schema Helpers
// ============================================================================

/**
 * Type guard to check if a type is a primitive type
 */
export function isPrimitiveType(type: FieldType): type is PrimitiveType {
  const primitives: PrimitiveType[] = [
    'string',
    'text',
    'richText',
    'markdown',
    'slug',
    'code',
    'number',
    'integer',
    'boolean',
    'date',
    'datetime',
    'time',
    'select',
    'radio',
    'multiSelect',
    'tags',
    'image',
    'file',
    'video',
    'externalImage',
    'externalUrl',
    'internalLink',
    'email',
    'phone',
    'link',
    'contentReference',
    'mediaReference',
    'color',
    'icon',
    'geopoint',
    'json',
  ]
  return primitives.includes(type as PrimitiveType)
}

/**
 * Type guard to check if a type is a structural type
 */
export function isStructuralType(type: FieldType): type is StructuralType {
  return type === 'object' || type === 'array' || type === 'componentArray'
}

/**
 * Get the display label for a field
 */
export function getFieldLabel(schema: FieldSchema): string {
  if (schema.label) return schema.label
  // Convert camelCase/snake_case to Title Case
  return schema.name
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
}

/**
 * Get default value for a field type
 */
export function getDefaultValue(schema: FieldSchema): unknown {
  if (schema.defaultValue !== undefined) return schema.defaultValue

  switch (schema.type) {
    case 'string':
    case 'text':
    case 'richText':
    case 'markdown':
    case 'slug':
    case 'code':
    case 'externalUrl':
    case 'email':
    case 'phone':
      return ''
    case 'number':
    case 'integer':
      return schema.min ?? 0
    case 'boolean':
      return false
    case 'select':
    case 'radio':
      return schema.options?.[0]?.value ?? ''
    case 'multiSelect':
    case 'tags':
    case 'array':
    case 'componentArray':
      return []
    case 'object':
      return {}
    case 'date':
    case 'datetime':
    case 'time':
      return null
    case 'image':
    case 'file':
    case 'video':
    case 'externalImage':
    case 'internalLink':
    case 'link':
    case 'contentReference':
    case 'mediaReference':
    case 'geopoint':
      return null
    case 'color':
      return '#000000'
    case 'icon':
      return ''
    case 'json':
      return null
    default:
      return null
  }
}
