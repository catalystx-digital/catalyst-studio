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
  SchemaArrayItem,
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

function convertUnifiedFieldToSchemaField(field: UnifiedField): SchemaField {
  if (field.fields) {
    // Object field
    return {
      name: field.name,
      type: 'object',
      required: field.required,
      description: field.description,
      rawType: field.rawType,
      fields: field.fields.map(convertUnifiedFieldToSchemaField)
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
        fields: (field.items.fields ?? []).map(convertUnifiedFieldToSchemaField)
      }
    } else {
      schemaField.items = {
        kind: 'primitive',
        type: field.items.type ?? 'unknown',
        ...(field.items.options ? { options: field.items.options } : {})
      }
    }

    return schemaField
  }

  // Scalar field
  return {
    name: field.name,
    type: field.type as SchemaFieldType,
    required: field.required,
    description: field.description,
    rawType: field.rawType,
    ...(field.options ? { options: field.options } : {})
  }
}

function convertUnifiedToDetectionBundle(unified: UnifiedSchemaBundle): DetectionSchemaBundle {
  const components: Record<string, ComponentSchema> = {}

  for (const [canonicalType, schema] of Object.entries(unified.componentsIndex)) {
    components[canonicalType] = {
      canonicalType: schema.canonicalType,
      componentType: schema.type,
      summary: schema.summary,
      description: schema.description,
      defaultRegion: schema.defaultRegion,
      fields: schema.fields.map(convertUnifiedFieldToSchemaField),
      propsSource: schema.propsSource as 'propsMeta' | 'contract'
    }
  }

  return {
    version: SCHEMA_VERSION,
    generatedAt: unified.generatedAt,
    components,
    integrity: unified.integrity,
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
