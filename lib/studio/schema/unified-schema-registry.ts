import crypto from 'node:crypto'

import { cmsComponentFactory } from '@/lib/studio/components/cms/_factory/factory'
import { initializeCMSComponents } from '@/lib/studio/components/cms/_factory/initialize'
import { listComponentContracts, type ComponentContract } from '@/lib/studio/components/catalog/component-contracts'
import { getDirectives } from '@/lib/studio/components/cms/_core/definition-loader'
import {
  ComponentCategory,
  ComponentType,
  type AIComponentMetadata,
  type ComponentRegistryEntry
} from '@/lib/studio/components/cms/_core/types'
import {
  clearSchemaCache,
  getFieldsForComponentTypes,
  getFieldsForComponentType,
  type ComponentField
} from '@/lib/services/universal-types/component-schema-adapter'
import { normalizeFieldType as normalizeFieldTypeUnified } from '@/lib/services/universal-types/field-type-normalizer'
import { cacheCoordinator } from '@/lib/services/cache-coordinator'

/**
 * Unified Schema Registry
 *
 * This module consolidates the two parallel bundle builders:
 * - PromptContractBundle (for AI prompt generation)
 * - DetectionSchemaBundle (for schema validation)
 *
 * Both bundles traverse the same component registry, so this unified
 * implementation performs a single traversal and maintains a single cache.
 *
 * The original modules delegate to this unified registry for backward compatibility.
 */

// ============================================================================
// TYPES - Unified Schema Bundle
// ============================================================================

type FieldSource = 'propsMeta' | 'aiMetadata' | 'contract'
type SchemaFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'select' | 'unknown'

export interface UnifiedField {
  name: string
  type: string
  required: boolean
  description?: string
  rawType?: string
  allowedTypes?: string[]
  source: FieldSource
  // For select/enum fields
  options?: Array<{ label: string; value: string | number }>
  // For object fields
  fields?: UnifiedField[]
  // For array fields
  items?: UnifiedArrayItem
}

export interface UnifiedArrayItem {
  kind: 'primitive' | 'object' | 'component'
  type?: SchemaFieldType
  fields?: UnifiedField[]
  allowedTypes?: string[]
  options?: Array<{ label: string; value: string | number }>
}

export interface UnifiedComponentSchema {
  type: string
  canonicalType: string
  category: ComponentCategory
  summary: string
  description?: string
  // From PromptContractBundle
  keywords: string[]
  patterns: string[]
  confidence: number
  metadata?: AIComponentMetadata
  // LLM directives from component definition (*.def.ts)
  directives?: string[]
  // From DetectionSchemaBundle
  defaultRegion?: string
  // Unified fields
  fields: UnifiedField[]
  subOnly?: boolean
  propsSource: FieldSource
}

export interface UnifiedSchemaBundle {
  version: number
  generatedAt: string
  integrity: {
    algorithm: string
    hash: string
    componentCount: number
  }
  registrySize: number
  // Components organized by type
  components: UnifiedComponentSchema[]
  subcomponents: UnifiedComponentSchema[]
  // Index: canonicalType -> schema
  componentsIndex: Record<string, UnifiedComponentSchema>
  // Warnings from both systems
  warnings: string[]
  // Subcomponent usage tracking
  subcomponentUsage: Record<string, Array<{ component: string; fields: string[] }>>
}

// ============================================================================
// CACHE
// ============================================================================

let cachedBundle: UnifiedSchemaBundle | null = null
let bundlePromise: Promise<UnifiedSchemaBundle> | null = null

const BUNDLE_VERSION = 1

// Register with cache coordinator
cacheCoordinator.register({
  name: 'unified-schema-registry',
  clearCache: () => {
    cachedBundle = null
    bundlePromise = null
    clearSchemaCache()
  }
})

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Builds the unified schema bundle by traversing the component registry once
 * and collecting all metadata needed by both AI prompts and validation systems.
 */
export async function buildUnifiedSchemaBundle(forceRefresh = false): Promise<UnifiedSchemaBundle> {
  if (cachedBundle && !forceRefresh) {
    return cachedBundle
  }
  if (bundlePromise && !forceRefresh) {
    return await bundlePromise
  }

  bundlePromise = (async () => {
    await initializeCMSComponents()
    clearSchemaCache()

    const registry = cmsComponentFactory.getComponentCatalog()
    const contracts = listComponentContracts()
    const warnings: string[] = []
    const components: UnifiedComponentSchema[] = []
    const subcomponents: UnifiedComponentSchema[] = []
    const usageIndex = new Map<string, Map<string, Set<string>>>()

    // Gather all component types for batch field fetching
    const componentTypes: string[] = []
    const typeToCanonical = new Map<string, string>()

    for (const [type, entry] of registry.entries()) {
      componentTypes.push(type)
      typeToCanonical.set(type, canonicalKey(type) || type)
    }

    // Batch fetch all fields
    const fieldsMap = await getFieldsForComponentTypes(componentTypes)

    // Build unified schemas for all components
    for (const [type, entry] of registry.entries()) {
      const contract = contracts.find(c => c.componentType === type || c.canonicalType === canonicalKey(type))
      const fields = fieldsMap.get(type) || []

      const schema = buildUnifiedComponentSchema(
        type,
        entry,
        contract,
        fields,
        warnings,
        usageIndex
      )

      if (entry.subOnly) {
        subcomponents.push(schema)
      } else {
        components.push(schema)
      }
    }

    // Sort for deterministic output
    components.sort((a, b) => a.type.localeCompare(b.type))
    subcomponents.sort((a, b) => a.type.localeCompare(b.type))

    // Build components index
    const componentsIndex: Record<string, UnifiedComponentSchema> = {}
    for (const schema of [...components, ...subcomponents]) {
      componentsIndex[schema.canonicalType] = schema
    }

    // Ensure allowed types have schemas
    await ensureAllowedTypesSchemas(componentsIndex, registry, warnings)

    // Build subcomponent usage
    const subcomponentUsage = buildUsageIndex(usageIndex)

    // Compute integrity hash
    const integrity = computeIntegrityHash(componentsIndex)

    const bundle: UnifiedSchemaBundle = {
      version: BUNDLE_VERSION,
      generatedAt: new Date().toISOString(),
      integrity,
      registrySize: registry.size,
      components,
      subcomponents,
      componentsIndex,
      warnings,
      subcomponentUsage
    }

    cachedBundle = bundle
    bundlePromise = null
    return bundle
  })()

  return await bundlePromise
}

/**
 * Clears the unified schema cache. Both legacy cache-clear functions delegate to this.
 */
export function clearUnifiedSchemaCache(): void {
  cachedBundle = null
  bundlePromise = null
  clearSchemaCache()
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function buildUnifiedComponentSchema(
  type: string,
  entry: ComponentRegistryEntry,
  contract: ComponentContract | undefined,
  componentFields: ComponentField[],
  warnings: string[],
  usageIndex: Map<string, Map<string, Set<string>>>
): UnifiedComponentSchema {
  const metadata = sanitizeMetadata(entry.metadata)
  const category = inferCategory(type as ComponentType)
  const description = entry.description || metadata?.description || contract?.description
  const summary = truncateSummary(description || '', metadata?.keywords || [])
  const canonicalType = canonicalKey(type) || type

  // Convert ComponentField[] to UnifiedField[]
  const fields = componentFields.map(f => toUnifiedField(f, type, usageIndex))

  // Check for missing metadata
  if (!metadata) {
    warnings.push(`Missing AI metadata for ${type}`)
  }
  if (!description) {
    warnings.push(`No description registered for ${type}`)
  }
  if (fields.length === 0 && (!entry.schema || Object.keys(entry.schema.shape).length === 0)) {
    warnings.push(`Schema missing for ${type}; falling back to AI metadata properties`)
  }

  // Determine props source
  let propsSource: FieldSource = 'contract'
  if (entry.schema && Object.keys(entry.schema.shape).length > 0) {
    propsSource = 'propsMeta'  // Keep the same label for compatibility
  } else if (metadata?.properties && metadata.properties.length > 0) {
    propsSource = 'aiMetadata'
  }

  // Get directives from component definition
  const directives = getDirectives(type)

  return {
    type,
    canonicalType,
    category,
    summary,
    description,
    keywords: sanitizeStringArray(metadata?.keywords),
    patterns: sanitizeStringArray(metadata?.patterns),
    confidence: typeof metadata?.confidence === 'number' ? metadata.confidence : 0.7,
    metadata,
    directives: directives.length > 0 ? directives : undefined,
    defaultRegion: contract?.defaultRegion,
    fields,
    ...(entry.subOnly ? { subOnly: true } : {}),
    propsSource
  }
}

function toUnifiedField(
  field: ComponentField,
  ownerType: string,
  usageIndex: Map<string, Map<string, Set<string>>>
): UnifiedField {
  const type = field.type || 'unknown'
  const normalizedType = normalizeType(field.type)

  // Track allowed types for usage index
  const allowedTypes = sanitizeStringArray(field.allowedTypes)
  allowedTypes.forEach(allowed => registerUsage(allowed, ownerType, field.name, usageIndex))

  const base: UnifiedField = {
    name: field.name,
    type,
    required: field.required,
    description: field.description,
    rawType: field.rawType,
    allowedTypes: allowedTypes.length > 0 ? allowedTypes : undefined,
    source: 'propsMeta'
  }

  // Handle object fields
  if (normalizedType === 'object' && field.fields) {
    return {
      ...base,
      fields: field.fields.map(f => toUnifiedField(f, ownerType, usageIndex))
    }
  }

  // Handle array fields
  if (normalizedType === 'array' && field.items) {
    return {
      ...base,
      items: toUnifiedArrayItem(field.items, ownerType, usageIndex)
    }
  }

  // Handle select/enum fields
  if (field.options) {
    return {
      ...base,
      options: field.options.map(opt => ({ label: opt.label, value: opt.value }))
    }
  }

  return base
}

function toUnifiedArrayItem(
  item: Required<ComponentField>['items'],
  ownerType: string,
  usageIndex: Map<string, Map<string, Set<string>>>
): UnifiedArrayItem {
  if (item.kind === 'component') {
    const allowedTypes = sanitizeStringArray(item.allowedTypes)
    return {
      kind: 'component',
      allowedTypes
    }
  }

  if (item.kind === 'object') {
    return {
      kind: 'object',
      fields: (item.fields || []).map(f => toUnifiedField(f, ownerType, usageIndex))
    }
  }

  return {
    kind: 'primitive',
    type: normalizeType(item.type),
    ...(item.options ? { options: item.options.map(opt => ({ label: opt.label, value: opt.value })) } : {})
  }
}

function normalizeType(type: string | undefined): SchemaFieldType {
  const normalized = normalizeFieldTypeUnified(type || '', { layer: 'validation' })
  return normalized.type as SchemaFieldType
}

function canonicalKey(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value.trim().toLowerCase()
}

function sanitizeMetadata(metadata: AIComponentMetadata | undefined): AIComponentMetadata | undefined {
  if (!metadata) return undefined
  try {
    return JSON.parse(JSON.stringify(metadata)) as AIComponentMetadata
  } catch {
    return metadata
  }
}

function sanitizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return Array.from(
    new Set(
      values
        .map(value => (typeof value === 'string' ? value.trim() : String(value)))
        .filter(Boolean)
    )
  )
}

function truncateSummary(description: string, keywords: string[]): string {
  const source = description?.trim().length ? description.trim() : keywords.join(', ')
  if (!source) return ''
  if (source.length <= 120) return source
  return `${source.slice(0, 117).trimEnd()}…`
}

function inferCategory(type: ComponentType): ComponentCategory {
  const factory = cmsComponentFactory as unknown as {
    getComponentCategory(value: ComponentType): ComponentCategory
  }

  try {
    const category = factory.getComponentCategory(type)
    return category ?? ComponentCategory.Content
  } catch {
    return ComponentCategory.Content
  }
}

function registerUsage(
  allowedType: string,
  componentType: string,
  fieldName: string,
  usageIndex: Map<string, Map<string, Set<string>>>
): void {
  if (!allowedType) return
  const normalizedType = allowedType.trim()
  if (!normalizedType) return

  if (!usageIndex.has(normalizedType)) {
    usageIndex.set(normalizedType, new Map())
  }
  const componentMap = usageIndex.get(normalizedType)!
  if (!componentMap.has(componentType)) {
    componentMap.set(componentType, new Set())
  }
  componentMap.get(componentType)!.add(fieldName)
}

function buildUsageIndex(
  usageIndex: Map<string, Map<string, Set<string>>>
): Record<string, Array<{ component: string; fields: string[] }>> {
  const result: Record<string, Array<{ component: string; fields: string[] }>> = {}
  for (const [subType, componentMap] of usageIndex.entries()) {
    const entries = Array.from(componentMap.entries()).map(([component, fields]) => ({
      component,
      fields: Array.from(fields).sort()
    }))
    if (entries.length > 0) {
      entries.sort((a, b) => a.component.localeCompare(b.component))
      result[subType] = entries
    }
  }
  return result
}

async function ensureAllowedTypesSchemas(
  componentsIndex: Record<string, UnifiedComponentSchema>,
  registry: Map<string, ComponentRegistryEntry>,
  warnings: string[]
): Promise<void> {
  const needed = collectAllowedComponentTypes(componentsIndex)

  for (const allowedType of needed) {
    const key = canonicalKey(allowedType)
    if (!key || componentsIndex[key]) continue

    const fields = (await getFieldsForComponentType(allowedType)).map(f => toUnifiedField(f, allowedType, new Map()))
    const registryEntry = findRegistryEntry(registry, key)

    if (!registryEntry && fields.length === 0) {
      warnings.push(`Missing props metadata for subcomponent "${allowedType}". Validator cannot enforce nested schema.`)
      componentsIndex[key] = {
        type: allowedType,
        canonicalType: key,
        category: ComponentCategory.Content,
        summary: allowedType,
        keywords: [],
        patterns: [],
        confidence: 0.7,
        fields: [],
        propsSource: 'contract'
      }
      continue
    }

    const description = registryEntry?.entry.description
    componentsIndex[key] = {
      type: registryEntry?.type || allowedType,
      canonicalType: key,
      category: registryEntry?.entry ? inferCategory(registryEntry.type as ComponentType) : ComponentCategory.Content,
      summary: description || allowedType,
      description,
      keywords: sanitizeStringArray(registryEntry?.entry.metadata?.keywords),
      patterns: sanitizeStringArray(registryEntry?.entry.metadata?.patterns),
      confidence: typeof registryEntry?.entry.metadata?.confidence === 'number' ? registryEntry.entry.metadata.confidence : 0.7,
      metadata: registryEntry?.entry.metadata,
      fields,
      propsSource: fields.length > 0 ? 'propsMeta' : 'contract'
    }

    if (fields.length === 0) {
      warnings.push(`Subcomponent "${allowedType}" lacks props metadata. Schema enforcement may be incomplete.`)
    }
  }
}

function collectAllowedComponentTypes(componentsIndex: Record<string, UnifiedComponentSchema>): Set<string> {
  const collected = new Set<string>()

  const visitField = (field: UnifiedField) => {
    if (field.fields) {
      field.fields.forEach(visitField)
    }
    if (field.items) {
      if (field.items.kind === 'component' && field.items.allowedTypes) {
        field.items.allowedTypes.forEach(t => collected.add(t))
      } else if (field.items.kind === 'object' && field.items.fields) {
        field.items.fields.forEach(visitField)
      }
    }
    if (field.allowedTypes) {
      field.allowedTypes.forEach(t => collected.add(t))
    }
  }

  Object.values(componentsIndex).forEach(schema => {
    schema.fields.forEach(visitField)
  })

  return collected
}

function findRegistryEntry(
  registry: Map<string, ComponentRegistryEntry>,
  canonicalType: string
): { type: string; entry: ComponentRegistryEntry } | null {
  for (const [type, entry] of registry.entries()) {
    if (canonicalKey(type) === canonicalType) {
      return { type, entry }
    }
  }
  return null
}

function computeIntegrityHash(componentsIndex: Record<string, UnifiedComponentSchema>): UnifiedSchemaBundle['integrity'] {
  const sortedKeys = Object.keys(componentsIndex).sort()
  const payload = sortedKeys.map(key => [key, componentsIndex[key]] as const)
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  return {
    algorithm: 'sha256',
    hash,
    componentCount: sortedKeys.length
  }
}
