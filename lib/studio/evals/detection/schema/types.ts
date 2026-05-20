import type { ComponentField } from '@/lib/services/universal-types/component-schema-adapter'

export type SchemaFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'url'
  | 'richText'
  | 'media'
  | 'select'
  | 'reference'
  | 'array'
  | 'object'

export interface SchemaFieldBase {
  name: string
  type: SchemaFieldType
  required: boolean
  description?: string
  rawType?: string
}

export interface SchemaPrimitiveField extends SchemaFieldBase {
  type: Exclude<SchemaFieldType, 'array' | 'object'>
  options?: Array<{ label: string; value: string | number }>
}

export interface SchemaObjectField extends SchemaFieldBase {
  type: 'object'
  fields: SchemaField[]
}

export type SchemaArrayItem =
  | {
      kind: 'primitive'
      type: SchemaFieldType
      options?: Array<{ label: string; value: string | number }>
    }
  | {
      kind: 'object'
      fields: SchemaField[]
    }
  | {
      kind: 'component'
      allowedTypes: string[]
    }

export interface SchemaArrayField extends SchemaFieldBase {
  type: 'array'
  items?: SchemaArrayItem
  allowedTypes?: string[]
}

export type SchemaField = SchemaPrimitiveField | SchemaObjectField | SchemaArrayField

export interface ComponentSchema {
  canonicalType: string
  componentType?: string
  summary: string
  description?: string
  defaultRegion?: string
  fields: SchemaField[]
  propsSource?: 'propsMeta' | 'contract'
}

export interface DetectionSchemaBundle {
  version: 1
  generatedAt: string
  components: Record<string, ComponentSchema>
  integrity: {
    algorithm: 'sha256'
    hash: string
    componentCount: number
  }
  warnings: string[]
}

export interface SchemaFieldContext {
  field: SchemaField
  parentType: string
  path: string
}

export interface BuildSchemaOptions {
  includeComponents?: string[]
}

export type FieldTransform = (field: ComponentField) => SchemaField

