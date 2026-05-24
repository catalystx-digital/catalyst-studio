/**
 * Component Schema Adapter
 *
 * Builds universal field definitions for component content types
 * from the CMS component factory's propsMeta. This centralizes
 * component schema knowledge so all providers (Optimizely, Contentful, etc.)
 * can consume a consistent, rich schema.
 */

import { cmsComponentFactory } from '@/lib/studio/components/cms/_factory/factory'
import { initializeCMSComponents } from '@/lib/studio/components/cms/_factory/initialize'
import { canonicalizeComponentType } from '@/lib/studio/components/cms/_core/canonicalization'
import { getSchema, type ValueObjectName } from '@/lib/studio/components/cms/_core/value-objects/registry'
import { getAllValueObjectNames } from '@/lib/studio/components/cms/_core/value-objects/registry-lookup'
import { zodToFieldSchema } from '@/lib/studio/components/cms/_core/value-objects/utils/zod-to-field-schema'
import { normalizeFieldType } from './field-type-normalizer'
import { cacheCoordinator } from '@/lib/services/cache-coordinator'

export type ComponentField = {
  name: string
  type: string
  required: boolean
  description?: string
  // Optional enumeration/options for select-like fields
  options?: Array<{ label: string; value: string | number }>
  // Preserve original meta type for downstream mappers
  rawType?: string
  // Optional: explicit allowed sub-component types for content[] fields
  allowedTypes?: string[]
  // Nested object fields (when type === 'object')
  fields?: ComponentField[]
  // Array item descriptor (when type === 'array')
  items?: {
    kind: 'primitive' | 'object' | 'component'
    // primitive type or select
    type?: string
    options?: Array<{ label: string; value: string | number }>
    // for object arrays
    fields?: ComponentField[]
    // for component arrays
    allowedTypes?: string[]
  }
}

const initOnce = (() => {
  let initialized = false
  let initializing: Promise<void> | null = null
  return async () => {
    if (initialized) return
    if (!initializing) {
      initializing = (async () => {
        try {
          await initializeCMSComponents()
        } finally {
          initialized = true
          initializing = null
        }
      })()
    }
    await initializing
  }
})()

// Best-effort mapping from propsMeta type strings → universal field type strings
function normalizeType(typeStr: string | undefined): { type: string; options?: Array<{ label: string; value: string | number }> } {
  return normalizeFieldType(typeStr || '', { layer: 'universal' })
}

// Parse object field list in a very lightweight way: { key?: Type; other: Type }
function parseObjectFields(body: string): Array<{ name: string; type: string }> {
  // Remove outer braces if present
  const trimmed = body.trim().replace(/^\{/, '').replace(/\}$/, '')
  const fields: Array<{ name: string; type: string }> = []
  const segments: string[] = []
  let buffer = ''
  let depth = 0

  const pushSegment = () => {
    const segment = buffer.trim()
    if (segment) {
      segments.push(segment)
    }
    buffer = ''
  }

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i]
    if (char === '{' || char === '[' || char === '(' || char === '<') {
      depth += 1
      buffer += char
      continue
    }
    if (char === '}' || char === ']' || char === ')' || char === '>') {
      depth = Math.max(0, depth - 1)
      buffer += char
      continue
    }
    if ((char === ';' || char === ',') && depth === 0) {
      pushSegment()
      continue
    }
    buffer += char
  }

  pushSegment()

  for (const part of segments) {
    const m = part.match(/^(\w+)\??\s*:\s*(.+)$/)
    if (m) {
      const [, name, t] = m
      fields.push({ name, type: t.trim() })
    }
  }

  return fields
}

function getRegisteredValueObjectFields(typeName: string): ComponentField[] | undefined {
  if (!getAllValueObjectNames().includes(typeName as ValueObjectName)) {
    return undefined
  }

  const field = editorFieldToComponentField(zodToFieldSchema(typeName, getSchema(typeName as ValueObjectName)))
  return field.fields ?? []
}

function editorFieldToComponentField(field: any): ComponentField {
  const normalized = normalizeType(field.type)
  const componentField: ComponentField = {
    name: field.name,
    type: normalized.type === 'externalUrl' ? 'url' : normalized.type,
    required: field.required === true,
    description: field.description || field.label,
    rawType: field.type,
    ...(normalized.options ? { options: normalized.options } : {})
  }

  if (field.type === 'object' && Array.isArray(field.fields)) {
    componentField.type = 'object'
    componentField.fields = field.fields.map(editorFieldToComponentField)
  }

  if (field.type === 'array' && field.items) {
    componentField.type = 'array'
    if (field.items.type === 'object' && Array.isArray(field.items.fields)) {
      componentField.items = {
        kind: 'object',
        fields: field.items.fields.map(editorFieldToComponentField)
      }
    } else {
      const itemType = normalizeType(field.items.type)
      componentField.items = {
        kind: 'primitive',
        type: itemType.type === 'externalUrl' ? 'url' : itemType.type,
        ...(itemType.options ? { options: itemType.options } : {})
      }
    }
  }

  return componentField
}

function mergeNestedFieldMetadata(componentField: ComponentField, zodType: any): void {
  const editorField = editorFieldToComponentField(zodToFieldSchema(componentField.name, zodType))

  if (componentField.type === 'object' && !componentField.fields && editorField.fields) {
    componentField.fields = editorField.fields
  }

  if (
    componentField.type === 'array' &&
    componentField.items?.kind === 'object' &&
    !componentField.items.fields &&
    editorField.items?.kind === 'object' &&
    editorField.items.fields
  ) {
    componentField.items.fields = editorField.items.fields
  }
}

// Recursive parser for meta type strings -> ComponentField shape
function parseTypeStringToField(
  name: string,
  metaType: string | undefined,
  metaAllowedTypes?: string[]
): ComponentField {
  const rawType = (metaType || '').trim()
  const lowered = rawType.toLowerCase()

  // content[] shorthand or Array<content>
  if (lowered === 'content[]' || /array\s*<\s*content\s*>/.test(lowered)) {
    return {
      name,
      type: 'array',
      required: false,
      rawType,
      items: { kind: 'component', allowedTypes: metaAllowedTypes || [] },
      ...(Array.isArray(metaAllowedTypes) && metaAllowedTypes.length > 0 ? { allowedTypes: metaAllowedTypes } : {})
    }
  }

  // Array<T> or T[]
  const arrayGeneric = rawType.match(/^Array\s*<\s*(.+)\s*>$/i)
  const arraySuffix = rawType.endsWith('[]') ? rawType.slice(0, -2) : null
  const arrayInner = arrayGeneric ? arrayGeneric[1].trim() : (arraySuffix ? arraySuffix.trim() : null)
  if (arrayInner) {
    // Array of object: Array<{ ... }>
    if (/^\{[\s\S]*\}$/.test(arrayInner)) {
      const objectFields = parseObjectFields(arrayInner)
      const nested = objectFields.map(f => parseTypeStringToField(f.name, f.type))
      return {
        name,
        type: 'array',
        required: false,
        rawType,
        items: { kind: 'object', fields: nested }
      }
    }
    // Array of union primitives: Array<'a'|'b'> or ('a'|'b')[]
    if (/(?:'[^']+'|\d+)(\s*\|\s*(?:'[^']+'|\d+))+/.test(arrayInner)) {
      // Build select options
      const parts = arrayInner
        .split('|')
        .map(s => s.trim().replace(/^'+|'+$/g, ''))
      const options = parts.map(v => {
        const isNum = /^\d+$/.test(v)
        return { label: v, value: isNum ? Number(v) : v }
      })
      return {
        name,
        type: 'array',
        required: false,
        rawType,
        items: { kind: 'primitive', type: 'select', options }
      }
    }
    // Array of primitives or content
    const norm = normalizeType(arrayInner)
    if (norm.type === 'object') {
      const fields = getRegisteredValueObjectFields(arrayInner)
      return {
        name,
        type: 'array',
        required: false,
        rawType,
        items: { kind: 'object', ...(fields ? { fields } : {}) }
      }
    }
    if (arrayInner.toLowerCase() === 'content') {
      return {
        name,
        type: 'array',
        required: false,
        rawType,
        items: { kind: 'component', allowedTypes: metaAllowedTypes || [] },
        ...(Array.isArray(metaAllowedTypes) && metaAllowedTypes.length > 0 ? { allowedTypes: metaAllowedTypes } : {})
      }
    }
    return {
      name,
      type: 'array',
      required: false,
      rawType,
      items: { kind: 'primitive', type: norm.type, ...(norm.options ? { options: norm.options } : {}) }
    }
  }

  // Object literal: { ... }
  if (/^\{[\s\S]*\}$/.test(rawType)) {
    const objectFields = parseObjectFields(rawType)
    const nested = objectFields.map(f => parseTypeStringToField(f.name, f.type))
    return { name, type: 'object', required: false, rawType, fields: nested }
  }

  // Primitive or select
  const norm = normalizeType(rawType)
  if (norm.type === 'object') {
    const fields = getRegisteredValueObjectFields(rawType)
    return {
      name,
      type: 'object',
      required: false,
      rawType,
      ...(fields ? { fields } : {})
    }
  }

  return {
    name,
    type: norm.type,
    required: false,
    rawType,
    ...(norm.options ? { options: norm.options } : {})
  }
}

// Cache to avoid repeated registry traversal
const fieldCache = new Map<string, ComponentField[]>()

// Register with cache coordinator
cacheCoordinator.register({
  name: 'component-schema-adapter',
  clearCache: () => {
    fieldCache.clear()
  }
})

const canonicalize = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  const str = String(value);
  // Use canonical component type resolution to handle aliases like nav-bar -> navbar
  return canonicalizeComponentType(str) || str;
};

/**
 * Clear the internal schema cache. Useful for hot-reload in dev or tests
 * where propsMeta may change between runs.
 */
export function clearSchemaCache(): void {
  fieldCache.clear()
}

/**
 * Build component fields from the CMS component factory schema for a given type
 *
 * @deprecated For UI purposes, use getSchemaForContent() from lib/services/universal-types/schema-builder.ts instead.
 * This function is preserved for LLM prompt generation and export operations only.
 */
export async function getFieldsForComponentType(componentType: string): Promise<ComponentField[]> {
  if (!componentType) return []
  const canonicalType = canonicalize(componentType)
  if (fieldCache.has(canonicalType)) return fieldCache.get(canonicalType) as ComponentField[]

  await initOnce()

  // Registry entries include schema when components are registered via register modules
  const catalog = cmsComponentFactory.getComponentCatalog()
  let entry = catalog.get(componentType as any)
  if (!entry) {
    for (const [rawKey, candidate] of catalog.entries()) {
      if (canonicalize(rawKey) === canonicalType) {
        entry = candidate
        break
      }
    }
  }

  if (!entry?.schema) {
    fieldCache.set(canonicalType, [])
    return []
  }

  // Use Zod introspection directly on schema.shape
  const { zodSchemaToTypeString } = require('@/lib/studio/components/cms/_core/component-definition')
  const fields: ComponentField[] = []

  for (const [name, zodType] of Object.entries(entry.schema.shape)) {
    const field = zodType as any
    const typeString = zodSchemaToTypeString(field)
    const isRequired = !(field.isOptional() || field instanceof (await import('zod')).z.ZodOptional)
    const description = field._def?.description || undefined

    // Parse type string to ComponentField (reuse existing logic)
    const componentField = parseTypeStringToField(name, typeString, undefined)
    mergeNestedFieldMetadata(componentField, field)
    componentField.required = isRequired
    componentField.description = description
    fields.push(componentField)
  }

  fieldCache.set(canonicalType, fields)
  return fields
}

/**
 * Batch load fields for many component types
 */
export async function getFieldsForComponentTypes(types: string[]): Promise<Map<string, ComponentField[]>> {
  await initOnce()
  const map = new Map<string, ComponentField[]>()
  for (const t of types) {
    const f = await getFieldsForComponentType(t)
    map.set(canonicalize(t), f)
  }
  return map
}
