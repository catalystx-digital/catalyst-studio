/**
 * Schema Migration Utility
 *
 * Converts existing propsMeta string types to FieldSchema format.
 * Handles all current patterns found in the codebase:
 * - 'string' → { type: 'string' }
 * - "'left'|'center'|'right'" → { type: 'select', options: [...] }
 * - '{ enabled: boolean; color?: string }' → { type: 'object', fields: [...] }
 * - 'content[]' → { type: 'componentArray', allowedTypes: [...] }
 * - 'CTAButton[]' or 'Array<CTAButton>' → { type: 'array', items: { type: 'object', fields: [...] } }
 */

import type { FieldSchema, FieldType, SelectOption } from './types'
import {
  getFieldSchema,
  type ValueObjectName,
} from '@/lib/studio/components/cms/_core/value-objects/registry'
import { normalizeFieldType } from '@/lib/services/universal-types/field-type-normalizer'

// Existing PropertyMeta interface from _core/propsmeta.ts
export interface PropertyMeta {
  type: string
  required: boolean
  description?: string
  allowedTypes?: string[]
}

export type PropsMeta = Record<string, PropertyMeta>

// Migration result with warnings
export interface MigrationResult {
  schema: FieldSchema[]
  warnings: MigrationWarning[]
}

export interface MigrationWarning {
  fieldName: string
  message: string
  originalType: string
  suggestedType?: FieldType
}

/**
 * Get field schema for a known value object type from the registry
 */
function getKnownArrayItemSchema(typeName: string): FieldSchema[] | undefined {
  // Check if the type name is a known value object in the registry
  const registeredSchemas: Record<string, ValueObjectName> = {
    CTAButton: 'CTAButton',
    Logo: 'Logo',
    Image: 'Image',
    Link: 'Link',
    MenuItem: 'MenuItem',
    SocialLink: 'SocialLink',
    ContactInfo: 'ContactInfo',
    Address: 'Address',
    PhoneNumber: 'PhoneNumber',
    Testimonial: 'Testimonial',
    TeamMember: 'TeamMember',
    PricingTier: 'PricingTier',
    FAQ: 'FAQ',
    VideoSource: 'VideoSource',
    FormField: 'FormField',
    Badge: 'Badge',
    Rating: 'Rating',
    Author: 'Author',
    Tag: 'Tag',
    Category: 'Category',
  }

  const registryName = registeredSchemas[typeName]
  if (!registryName) return undefined

  const fieldSchema = getFieldSchema(registryName)
  // getFieldSchema returns a FieldSchema for an object type, extract its fields
  if (fieldSchema.type === 'object' && fieldSchema.fields) {
    return fieldSchema.fields
  }

  return undefined
}

/**
 * Migrate a propsMeta object to FieldSchema array
 */
export function migratePropsMeta(
  propsMeta: PropsMeta,
  options?: {
    /** Known array item schemas for custom types (overrides registry) */
    knownSchemas?: Record<string, FieldSchema[]>
    /** Whether to include warnings for ambiguous types */
    verbose?: boolean
  }
): MigrationResult {
  const warnings: MigrationWarning[] = []
  const schema: FieldSchema[] = []

  for (const [fieldName, meta] of Object.entries(propsMeta)) {
    try {
      const fieldSchema = migratePropertyMeta(
        fieldName,
        meta,
        options?.knownSchemas,
        warnings
      )
      schema.push(fieldSchema)
    } catch (error) {
      warnings.push({
        fieldName,
        message: `Failed to migrate: ${error instanceof Error ? error.message : 'Unknown error'}`,
        originalType: meta.type,
      })
      // Add fallback schema as JSON
      schema.push({
        name: fieldName,
        type: 'json',
        required: meta.required,
        description: meta.description,
        label: fieldNameToLabel(fieldName),
      })
    }
  }

  return { schema, warnings }
}

/**
 * Migrate a single PropertyMeta to FieldSchema
 */
function migratePropertyMeta(
  fieldName: string,
  meta: PropertyMeta,
  customSchemas: Record<string, FieldSchema[]> | undefined,
  warnings: MigrationWarning[]
): FieldSchema {
  const baseSchema: Partial<FieldSchema> = {
    name: fieldName,
    required: meta.required,
    description: meta.description,
    label: fieldNameToLabel(fieldName),
  }

  const type = meta.type.trim()

  // Check for simple primitive types first
  const simpleType = parseSimpleType(type)
  if (simpleType) {
    return { ...baseSchema, type: simpleType } as FieldSchema
  }

  // Check for union of string literals: "'left'|'center'|'right'"
  const stringUnion = parseStringUnion(type)
  if (stringUnion) {
    return {
      ...baseSchema,
      type: 'select',
      options: stringUnion,
    } as FieldSchema
  }

  // Check for union of numeric literals: '2|3|4'
  const numericUnion = parseNumericUnion(type)
  if (numericUnion) {
    return {
      ...baseSchema,
      type: 'select',
      options: numericUnion,
    } as FieldSchema
  }

  // Check for content[] (componentArray)
  if (type === 'content[]') {
    return {
      ...baseSchema,
      type: 'componentArray',
      allowedTypes: meta.allowedTypes,
    } as FieldSchema
  }

  // Check for typed array: 'Type[]' or 'Array<Type>'
  const arrayType = parseArrayType(type)
  if (arrayType) {
    // First check custom schemas, then fall back to registry
    const itemSchema =
      customSchemas?.[arrayType] ?? getKnownArrayItemSchema(arrayType)
    if (itemSchema) {
      return {
        ...baseSchema,
        type: 'array',
        items: {
          name: 'item',
          type: 'object',
          fields: itemSchema,
        },
      } as FieldSchema
    } else {
      warnings.push({
        fieldName,
        message: `Unknown array item type "${arrayType}". Using JSON editor.`,
        originalType: type,
        suggestedType: 'json',
      })
      return {
        ...baseSchema,
        type: 'array',
        items: { name: 'item', type: 'json' },
      } as FieldSchema
    }
  }

  // Check for inline object type: '{ prop: type; prop2?: type2 }'
  const objectFields = parseInlineObjectType(type, customSchemas, warnings)
  if (objectFields) {
    return {
      ...baseSchema,
      type: 'object',
      fields: objectFields,
    } as FieldSchema
  }

  // Unknown type - add warning and use json
  warnings.push({
    fieldName,
    message: `Could not parse type "${type}". Using JSON editor.`,
    originalType: type,
    suggestedType: 'json',
  })

  return { ...baseSchema, type: 'json' } as FieldSchema
}

/**
 * Parse simple primitive types
 */
function parseSimpleType(type: string): FieldType | null {
  const normalized = normalizeFieldType(type, { layer: 'ui' })

  // Return null if it's a complex type (array, object, select with options)
  if (normalized.type === 'array' || normalized.type === 'object' || normalized.options) {
    return null
  }

  return normalized.type as FieldType
}

/**
 * Parse union of string literals: "'left'|'center'|'right'"
 */
function parseStringUnion(type: string): SelectOption[] | null {
  // Match patterns like "'left'|'center'|'right'" or "\"a\"|\"b\""
  const stringUnionPattern = /^(['"])[^'"]+\1(\|(['"])[^'"]+\3)+$/

  if (!stringUnionPattern.test(type)) {
    return null
  }

  const values = type.split('|').map((v) => {
    // Remove quotes
    return v.trim().replace(/^['"]|['"]$/g, '')
  })

  return values.map((value) => ({
    label: valueToLabel(value),
    value,
  }))
}

/**
 * Parse union of numeric literals: '2|3|4'
 */
function parseNumericUnion(type: string): SelectOption[] | null {
  const parts = type.split('|').map((p) => p.trim())

  // Check if all parts are numbers
  if (!parts.every((p) => /^-?\d+(\.\d+)?$/.test(p))) {
    return null
  }

  return parts.map((value) => ({
    label: value,
    value: parseFloat(value),
  }))
}

/**
 * Parse array type: 'Type[]' or 'Array<Type>'
 */
function parseArrayType(type: string): string | null {
  // Match 'Type[]'
  const bracketMatch = type.match(/^(\w+)\[\]$/)
  if (bracketMatch) {
    return bracketMatch[1]
  }

  // Match 'Array<Type>'
  const genericMatch = type.match(/^Array<(\w+)>$/)
  if (genericMatch) {
    return genericMatch[1]
  }

  return null
}

/**
 * Parse inline object type: '{ prop: type; prop2?: type2 }'
 */
function parseInlineObjectType(
  type: string,
  customSchemas: Record<string, FieldSchema[]> | undefined,
  warnings: MigrationWarning[]
): FieldSchema[] | null {
  // Must start with { and end with }
  if (!type.startsWith('{') || !type.endsWith('}')) {
    return null
  }

  // Extract content between braces
  const content = type.slice(1, -1).trim()
  if (!content) {
    return []
  }

  const fields: FieldSchema[] = []

  // Split by semicolon or newline
  const parts = content.split(/[;\n]/).filter((p) => p.trim())

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    // Match property: 'name?: type' or 'name: type'
    const propMatch = trimmed.match(/^(\w+)(\?)?\s*:\s*(.+)$/)
    if (!propMatch) {
      warnings.push({
        fieldName: 'inline-object',
        message: `Could not parse property "${trimmed}" in inline object`,
        originalType: type,
      })
      continue
    }

    const [, propName, optional, propType] = propMatch
    const isRequired = !optional

    // Recursively parse the property type
    const propTypeClean = propType.trim().replace(/;$/, '')
    let fieldType: FieldType = 'string'
    let options: SelectOption[] | undefined
    let nestedFields: FieldSchema[] | undefined

    // Check for simple type
    const simpleType = parseSimpleType(propTypeClean)
    if (simpleType) {
      fieldType = simpleType
    } else {
      // Check for string union
      const stringUnion = parseStringUnion(propTypeClean)
      if (stringUnion) {
        fieldType = 'select'
        options = stringUnion
      } else {
        // Check for nested object
        const nested = parseInlineObjectType(propTypeClean, customSchemas, warnings)
        if (nested) {
          fieldType = 'object'
          nestedFields = nested
        } else {
          // Unknown type
          fieldType = 'json'
          warnings.push({
            fieldName: propName,
            message: `Unknown nested property type "${propTypeClean}"`,
            originalType: propTypeClean,
            suggestedType: 'json',
          })
        }
      }
    }

    const fieldSchema: FieldSchema = {
      name: propName,
      type: fieldType,
      required: isRequired,
      label: fieldNameToLabel(propName),
    }

    if (options) {
      fieldSchema.options = options
    }

    if (nestedFields) {
      fieldSchema.fields = nestedFields
    }

    fields.push(fieldSchema)
  }

  return fields
}

/**
 * Convert field name to human-readable label
 */
function fieldNameToLabel(name: string): string {
  // Split camelCase and add spaces
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

/**
 * Convert value to human-readable label
 */
function valueToLabel(value: string): string {
  // Convert camelCase/kebab-case to Title Case
  return value
    .replace(/[-_]/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

/**
 * Batch migrate multiple propsMeta files
 */
export function batchMigratePropsMeta(
  propsMetaMap: Record<string, PropsMeta>,
  options?: {
    knownSchemas?: Record<string, FieldSchema[]>
    verbose?: boolean
  }
): Record<string, MigrationResult> {
  const results: Record<string, MigrationResult> = {}

  for (const [componentType, propsMeta] of Object.entries(propsMetaMap)) {
    results[componentType] = migratePropsMeta(propsMeta, options)
  }

  return results
}

/**
 * Generate TypeScript code for migrated schemas
 */
export function generateSchemaCode(
  componentName: string,
  schema: FieldSchema[]
): string {
  const schemaJson = JSON.stringify(schema, null, 2)
    // Remove quotes from keys that are valid identifiers
    .replace(/"(\w+)":/g, '$1:')
    // Replace "type": "xxx" with type: 'xxx'
    .replace(/type: "(\w+)"/g, "type: '$1'")

  return `import type { FieldSchema } from '@/lib/studio/components/site-builder/property-editor/schema/types'

export const ${componentName}Schema: FieldSchema[] = ${schemaJson}
`
}

/**
 * Validate a migrated schema
 */
export function validateMigratedSchema(
  schema: FieldSchema[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const field of schema) {
    // Check required properties
    if (!field.name) {
      errors.push('Field missing name')
    }
    if (!field.type) {
      errors.push(`Field "${field.name}" missing type`)
    }

    // Check structural types have required properties
    if (field.type === 'object' && (!field.fields || field.fields.length === 0)) {
      // Object without fields is valid but might be intentional
    }

    if (field.type === 'array' && !field.items) {
      errors.push(`Array field "${field.name}" missing items schema`)
    }

    if (field.type === 'select' && (!field.options || field.options.length === 0)) {
      errors.push(`Select field "${field.name}" missing options`)
    }

    // Recursive validation for nested fields
    if (field.fields) {
      const nestedResult = validateMigratedSchema(field.fields)
      errors.push(...nestedResult.errors.map((e) => `${field.name}.${e}`))
    }

    if (field.items && field.items.fields) {
      const itemResult = validateMigratedSchema(field.items.fields)
      errors.push(...itemResult.errors.map((e) => `${field.name}[].${e}`))
    }
  }

  return { valid: errors.length === 0, errors }
}
