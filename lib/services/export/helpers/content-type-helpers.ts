import { prisma } from '@/lib/prisma'
import type { ICMSProvider } from '@/lib/cms-export/types'
import { buildUniversalContentType, pickTypeKey } from './content-type-builder'

export { buildUniversalContentType, pickTypeKey } from './content-type-builder'

import FieldShapeDetector from '../detection/field-shape-detector'
import TypeDependencyPlanner, { type DetectionInput } from '../detection/type-dependency-planner'
import type { ContentItemExport, ContentTypeExport } from '../types'


/**
 * Extract mayContainTypes from fields configuration.
 * Most page types return ['*'] (allow any component) by default.
 */
const extractContainmentConfig = (fields: unknown): string[] | null => {
  if (fields === null || fields === undefined) return null

  const normalizeList = (value: unknown): string[] | null => {
    if (!Array.isArray(value)) return null
    const filtered = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    return filtered.length > 0 ? filtered.map(v => v.trim()) : null
  }

  // Check direct mayContainTypes property
  if (typeof fields === 'object' && !Array.isArray(fields)) {
    const obj = fields as Record<string, unknown>
    if ('mayContainTypes' in obj) {
      return normalizeList(obj.mayContainTypes)
    }
    // Check metadata sub-objects
    for (const key of ['__metadata', 'metadata', 'meta']) {
      const meta = obj[key] as Record<string, unknown> | undefined
      if (meta?.mayContainTypes) {
        return normalizeList(meta.mayContainTypes)
      }
    }
  }

  return null
}

export const fetchContentTypes = async (
  params: {
    websiteId: string
    componentUsage?: Set<string>
    provider?: ICMSProvider
  }
): Promise<ContentTypeExport[]> => {
  const { websiteId, componentUsage } = params

  const { getFieldsForComponentType } = await import('@/lib/services/universal-types/component-schema-adapter')
  const { cmsComponentFactory } = await import('@/lib/studio/components/cms/_factory/factory')
  const { initializeCMSComponents } = await import('@/lib/studio/components/cms/_factory/initialize')
  await initializeCMSComponents()

  const [contentTypes, rawRegisteredComponentTypes] = await Promise.all([
    prisma.contentType.findMany({ where: { websiteId } }),
    Promise.resolve(cmsComponentFactory.getRegisteredTypes())
  ])

  const registeredComponentTypes = Array.isArray(rawRegisteredComponentTypes)
    ? rawRegisteredComponentTypes
    : Array.from((rawRegisteredComponentTypes ?? []) as Iterable<string>)

  // Pass-through: use keys exactly as provided, no transformation
  // Alias resolution should happen in UCS, not here
  const usageLookup = componentUsage
    ? new Set(Array.from(componentUsage).map(value => String(value).trim()))
    : undefined

  const filteredComponentTypes = usageLookup
    ? registeredComponentTypes.filter(type => usageLookup!.has(String(type).trim()))
    : registeredComponentTypes

  // Add any used component types that aren't registered in the factory
  // This ensures all components being exported have corresponding content types
  if (usageLookup) {
    const filteredSet = new Set(filteredComponentTypes.map(t => String(t).trim()))
    for (const usedType of usageLookup) {
      if (!filteredSet.has(usedType)) {
        // Pass through as-is - no key transformation
        filteredComponentTypes.push(usedType)
        console.log(`[ContentTypeHelper] Adding missing component type: ${usedType} (from usage)`)
      }
    }
  }

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

  const normalizeTemplateField = (
    field: any,
    index: number,
    schema?: Record<string, any>
  ) => {
    if (!field || typeof field !== 'object') {
      return null
    }

    const rawName = typeof field.name === 'string' && field.name.trim() ? field.name.trim() : `field_${index}`
    const schemaMeta = schema?.[rawName] as Record<string, unknown> | undefined
    const type = typeof field.type === 'string' && field.type.trim() ? field.type.trim() : (typeof schemaMeta?.type === 'string' ? String(schemaMeta.type) : 'string')
    const required = Boolean(field.required ?? schemaMeta?.required ?? false)
    const description = typeof field.description === 'string' && field.description.trim()
      ? field.description
      : (typeof schemaMeta?.description === 'string' ? String(schemaMeta.description) : rawName)
    const allowedComponentTypes = Array.isArray(field.allowedComponentTypes)
      ? field.allowedComponentTypes
      : Array.isArray(schemaMeta?.allowedComponentTypes)
        ? (schemaMeta?.allowedComponentTypes as string[])
        : undefined
    const defaultValue = field.defaultValue ?? schemaMeta?.defaultValue

    const properties: Record<string, unknown> = {}
    if (Array.isArray(field.allowedValues) && field.allowedValues.length > 0) {
      properties.allowedValues = field.allowedValues
    }
    if (allowedComponentTypes && allowedComponentTypes.length > 0) {
      properties.allowedTypes = allowedComponentTypes
    }
    if (field.properties && typeof field.properties === 'object') {
      Object.assign(properties, field.properties)
    }

    if (type === 'content[]') {
      properties.itemType = properties.itemType || 'content'
      if (!properties.allowedTypes && allowedComponentTypes) {
        properties.allowedTypes = allowedComponentTypes
      }
    }

    const result: Record<string, unknown> = {
      name: rawName,
      type,
      required,
      description,
      ...(defaultValue !== undefined ? { defaultValue } : {}),
      ...(allowedComponentTypes && allowedComponentTypes.length ? { allowedComponentTypes } : {}),
      ...(Object.keys(properties).length ? { properties } : {})
    }

    if (field.options) {
      result.options = field.options
    }

    if (field.metadata) {
      result.metadata = field.metadata
    }

    return result
  }

  const derivePageFields = (ct: typeof contentTypes[number]) => {
    const rawValue = ct.fields as unknown
    const contentSchema = isPlainObject(rawValue) && isPlainObject((rawValue as any).contentSchema)
      ? ((rawValue as any).contentSchema as Record<string, any>)
      : undefined

    const normalizedFields: any[] = []
    let metadata: Record<string, unknown> | undefined
    let exported: any = []

    const pushNormalized = (field: any, index: number) => {
      const normalized = normalizeTemplateField(field, index, contentSchema)
      if (!normalized) return
      const key = typeof normalized.name === 'string' ? normalized.name.toLowerCase() : `field_${index}`
      if (normalizedFields.some(existing => typeof existing?.name === 'string' && existing.name.toLowerCase() === key)) {
        return
      }

      const allowedTypes = Array.isArray((normalized as any).allowedComponentTypes)
        ? (normalized as any).allowedComponentTypes
        : Array.isArray((normalized as any)?.properties?.allowedTypes)
          ? ((normalized as any).properties.allowedTypes as string[])
          : undefined

      // No valueType mapping - use field.type directly (UCS is source of truth)
      const platformSpecific = {
        ...(normalized.platformSpecific || {}),
        ...(allowedTypes && allowedTypes.length ? { allowedTypes } : {})
      }

      normalizedFields.push({
        ...normalized,
        ...(Object.keys(platformSpecific).length ? { platformSpecific } : {}),
      })
    }

    if (Array.isArray(rawValue)) {
      rawValue.forEach((field, index) => pushNormalized(field, index))
      exported = rawValue.map(entry => (isPlainObject(entry) ? { ...entry } : entry))
    } else if (isPlainObject(rawValue)) {
      const rawFieldsArray = Array.isArray((rawValue as any).fields) ? ((rawValue as any).fields as any[]) : []
      rawFieldsArray.forEach((field, index) => pushNormalized(field, index))
      metadata = { ...(rawValue as Record<string, unknown>) }
      delete metadata.fields
      exported = {
        __fields: [...normalizedFields],
        __metadata: metadata
      }
    }

    return { exported, normalizedFields, metadata }
  }

  // Page templates in UCS already define 'components' field - no fallback needed here
  const pageTypes: ContentTypeExport[] = contentTypes.map(ct => {
    const { exported, normalizedFields, metadata } = derivePageFields(ct)

    const mayContainTypes = (() => {
      const explicit = extractContainmentConfig(ct.fields)
      if ((ct.category || '').toLowerCase() !== 'page') {
        return explicit ?? []
      }

      if (explicit !== null) {
        const set = new Set<string>(explicit)
        return Array.from(set)
      }

      return ['*']
    })()

    const existingMetadata = (isPlainObject((ct as any)?.metadata) ? (ct as any).metadata : {}) as Record<string, unknown>
    const mergedMetadata = {
      ...existingMetadata,
      ...(metadata ? { templateMetadata: metadata } : {}),
      ...(ct.category === 'page' ? { templateFields: exported } : {})
    }

    return {
      id: ct.id,
      key: ct.key,
      name: ct.name,
      pluralName: ct.pluralName,
      category: ct.category,
      mayContainTypes,
      fields: normalizedFields,
      metadata: mergedMetadata
    }
  })

  const componentTypeExports: ContentTypeExport[] = []
  for (const compType of filteredComponentTypes) {
    let fieldsArray: any[] | undefined
    try {
      const factoryFields = await getFieldsForComponentType(compType as any)
      if (factoryFields && factoryFields.length > 0) {
        // Pass through UCS fields as-is - no type inference needed
        // UCS provides items.kind/items.type for arrays, rawType for debugging
        fieldsArray = factoryFields.map(f => {
          const raw = (f as any).rawType as string | undefined
          const base: any = {
            name: f.name,
            type: f.type,
            required: f.required,
            description: f.description,
            ...(f.options ? { options: f.options } : {}),
            ...(raw ? { rawType: raw } : {})
          }
          // Preserve nested object fields (e.g., CTAButton { label, href, variant })
          if (f.fields && f.fields.length > 0) {
            base.fields = f.fields
          }
          // Preserve array item structure (e.g., Array<MenuItem>)
          if (f.items) {
            base.items = f.items
          }
          const allowed = (f as any).allowedTypes as string[] | undefined
          if (Array.isArray(allowed) && allowed.length > 0) {
            base.platformSpecific = { ...(base.platformSpecific || {}), allowedTypes: allowed }
          }
          return base
        })
      }
    } catch (e) {
      // Non-fatal fallback handled below
    }
    if (!fieldsArray) fieldsArray = []

    componentTypeExports.push({
      id: compType as any,
      key: compType as any,
      name: compType as any,
      pluralName: `${String(compType)}s`,
      category: 'component',
      fields: fieldsArray
    })
  }

  // Pass-through dedup: keep original keys, no transformation
  const dedupMap = new Map<string, ContentTypeExport>()
  ;[...pageTypes, ...componentTypeExports].forEach(ct => {
    const key = pickTypeKey(ct.key, ct.name, ct.id)
    if (!dedupMap.has(key)) {
      dedupMap.set(key, ct)
    }
  })

  const combined = Array.from(dedupMap.values())
  const usageCount = usageLookup?.size ?? 0
  console.log(`BundleExporter: fetchContentTypes -> pages=${pageTypes.length}, components=${componentTypeExports.length}/${registeredComponentTypes.length}, usage=${usageCount}, total=${combined.length} (deduped)`)

  return combined
}

export const maybeEmitTypeDependencyPlan = async (
  params: {
    contentItems: ContentItemExport[]
    contentTypes: ContentTypeExport[]
    provider?: ICMSProvider
  }
): Promise<void> => {
  const { contentItems, contentTypes } = params

  const rawMode = String(process.env.EXPORT_DETECTION_MODE || 'off').toLowerCase()
  const mode: 'off' | 'dry-run' | 'conservative' = (rawMode === 'off') ? 'off' : (rawMode === 'conservative' ? 'conservative' : 'dry-run')
  if (mode === 'off') return

  const minConfidence = (() => {
    const v = Number(process.env.EXPORT_DETECTION_MIN_CONFIDENCE)
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.6
  })()
  const depthCap = (() => {
    const v = Number(process.env.OPTIMIZELY_MAX_NESTED_DEPTH)
    return Number.isFinite(v) && v > 0 ? Math.min(v, 16) : 4
  })()

  const typeByDbId = new Map<string, string>()
  for (const ct of contentTypes) {
    const canonical = pickTypeKey(ct.key, ct.name, ct.id)
    if (!canonical) continue
    typeByDbId.set(ct.id, canonical)
    typeByDbId.set(canonical, canonical)
    typeByDbId.set(canonical.toLowerCase(), canonical)
  }

  const detector = new FieldShapeDetector({ mode: 'dry-run', minConfidence })
  const detections: DetectionInput[] = []

  const visit = (parentId: string, parentType: string | undefined, value: any, path: string, depth: number) => {
    if (depth > depthCap) return
    try {
      const res = detector.detect(value, path)
      const cls = (res.classification || '').toLowerCase()
      if (res.meetsThreshold && (cls === 'content_reference' || cls === 'array_content_reference')) {
        const refs: string[] = []
        if (cls === 'content_reference' && value && typeof value === 'object' && typeof (value as any).id === 'string') {
          refs.push((value as any).id)
        } else if (Array.isArray(value)) {
          for (const el of value) {
            if (el && typeof el === 'object' && typeof (el as any).id === 'string') refs.push((el as any).id)
          }
        }
        detections.push({ itemId: parentId, itemType: parentType, path, classification: cls, refIds: refs })
      }

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const sub = value[i]
          visit(parentId, parentType, sub, `${path}[${i}]`, depth + 1)
        }
      } else if (value && typeof value === 'object') {
        for (const k of Object.keys(value)) {
          visit(parentId, parentType, (value as any)[k], `${path}.${k}`, depth + 1)
        }
      }
    } catch (_) {
      // Non-fatal: continue traversal
    }
  }

  for (const item of contentItems) {
    const parentType = typeByDbId.get(item.contentTypeId) || undefined
    visit(item.id, parentType, (item as any).content, 'content', 0)
  }

  if (detections.length === 0) return

  try {
    const planner = new TypeDependencyPlanner()
    const plan = planner.planDependencies(detections, { byKey: {}, all: [] })
    if (plan.kind === 'error') {
      console.warn('[PLAN] TypeDependency CycleDetected', { cycles: plan.error.cycles })
      return
    }
    for (const node of plan.nodes) {
      console.log(`[PLAN] TypeDependency id=${node.id} type=${node.type || 'unknown'} deps=[${node.deps.join(',')}] order=${node.order} path=${node.path || 'content'}`)
    }
  } catch (e) {
    console.warn('TypeDependency planning failed (non-fatal):', (e as Error)?.message)
  }
}
