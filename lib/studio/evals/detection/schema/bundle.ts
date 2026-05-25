import {
  buildUnifiedSchemaBundle,
  clearUnifiedSchemaCache,
  type UnifiedSchemaBundle,
  type UnifiedField
} from '@/lib/studio/schema/unified-schema-registry'

import type {
  ComponentSchema,
  DetectionSchemaBundle,
  SchemaArrayField,
  SchemaField,
  SchemaFieldType
} from './types'

/**
 * DEPRECATED: This module now delegates to the unified schema registry.
 * Use @/lib/studio/schema/unified-schema-registry for new code.
 *
 * This backward-compatible wrapper is maintained for existing consumers.
 */

const SCHEMA_VERSION = 1 as const
const DETECTION_PRIMITIVE_FIELD_TYPES = new Set<SchemaFieldType>([
  'string',
  'number',
  'boolean',
  'url',
  'richText',
  'media',
  'json',
  'select',
  'reference'
])

function mapUnifiedFieldType(type: string | undefined, path: string): SchemaFieldType {
  switch (type) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'url':
    case 'richText':
    case 'media':
    case 'json':
    case 'select':
    case 'reference':
    case 'array':
    case 'object':
      return type
    case 'date':
      return 'string'
    default:
      throw new Error(`Unsupported unified schema field type "${type ?? 'undefined'}" at ${path}`)
  }
}

function convertUnifiedFieldToSchemaField(field: UnifiedField, path = field.name): SchemaField {
  if (field.fields) {
    // Object field
    return {
      name: field.name,
      type: 'object',
      required: field.required,
      description: field.description,
      rawType: field.rawType,
      fields: field.fields.map(child => convertUnifiedFieldToSchemaField(child, `${path}.${child.name}`))
    }
  }

  if (field.items) {
    // Array field
    const schemaField: SchemaArrayField = {
      name: field.name,
      type: 'array',
      required: field.required,
      description: field.description,
      rawType: field.rawType,
      allowedTypes: field.allowedTypes
    }

    if (field.items.kind === 'component') {
      schemaField.items = {
        kind: 'component',
        allowedTypes: field.items.allowedTypes ?? []
      }
    } else if (field.items.kind === 'object') {
      schemaField.items = {
        kind: 'object',
        fields: (field.items.fields ?? []).map(child => convertUnifiedFieldToSchemaField(child, `${path}[].${child.name}`))
      }
    } else {
      const itemType = mapUnifiedFieldType(field.items.type, `${path}[]`)
      if (!DETECTION_PRIMITIVE_FIELD_TYPES.has(itemType)) {
        throw new Error(`Unified schema array field "${path}" has non-primitive item type "${itemType}"`)
      }
      schemaField.items = {
        kind: 'primitive',
        type: itemType,
        ...(field.items.options ? { options: field.items.options } : {})
      }
    }

    return schemaField
  }

  // Scalar field
  const type = mapUnifiedFieldType(field.type, path)
  if (type === 'array' || type === 'object') {
    throw new Error(`Unified schema field "${path}" is missing nested ${type} metadata`)
  }

  return {
    name: field.name,
    type,
    required: field.required,
    description: field.description,
    rawType: field.rawType,
    ...(field.options ? { options: field.options } : {})
  }
}

function convertUnifiedToDetectionBundle(unified: UnifiedSchemaBundle): DetectionSchemaBundle {
  const components: Record<string, ComponentSchema> = {}
  if (unified.integrity.algorithm !== 'sha256') {
    throw new Error(`Unsupported unified schema integrity algorithm "${unified.integrity.algorithm}"`)
  }

  for (const [canonicalType, schema] of Object.entries(unified.componentsIndex)) {
    components[canonicalType] = {
      canonicalType: schema.canonicalType,
      componentType: schema.type,
      summary: schema.summary,
      description: schema.description,
      defaultRegion: schema.defaultRegion,
      fields: schema.fields.map(field => convertUnifiedFieldToSchemaField(field)),
      propsSource: schema.propsSource as 'propsMeta' | 'contract'
    }
  }

  return {
    version: SCHEMA_VERSION,
    generatedAt: unified.generatedAt,
    components,
    integrity: {
      algorithm: unified.integrity.algorithm,
      hash: unified.integrity.hash,
      componentCount: unified.integrity.componentCount
    },
    warnings: unified.warnings
  }
}

export async function buildDetectionSchemaBundle(forceRefresh = false): Promise<DetectionSchemaBundle> {
  const unified = await buildUnifiedSchemaBundle(forceRefresh)
  return convertUnifiedToDetectionBundle(unified)
}

export function clearCachedSchemaBundle(): void {
  clearUnifiedSchemaCache()
}
