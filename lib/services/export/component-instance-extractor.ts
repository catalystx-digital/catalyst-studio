import { PrismaClient } from '@/lib/generated/prisma'
import { ExtractedComponent } from './content-orchestrator'
import { deepMerge } from '@/lib/services/unified-content-repository'
import { CMSComponentFactory } from '@/lib/studio/components/cms/_factory/factory'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { PropertyMeta } from '@/lib/studio/components/cms/_core/propsmeta'

export interface IComponentInstanceExtractor {
  extractFromPageContent(pageContent: any): ExtractedComponent[]
  resolveSharedComponents(components: ExtractedComponent[], websiteId: string, usage?: Set<string>): Promise<ExtractedComponent[]>
}

export class ComponentInstanceExtractor implements IComponentInstanceExtractor {
  private prisma: PrismaClient
  // Cache for shared components to avoid repeated database calls
  private sharedComponentCache = new Map<string, any>()
  // Limit for nested traversal into component properties
  private readonly maxTraversalDepth = 4
  private readonly propertyBuckets = ['properties', 'props', 'content', 'data', 'fields', 'attributes'] as const
  private propsMetaCache = new Map<string, Record<string, PropertyMeta>>()
  private propsMetaLookupCache = new Map<string, Map<string, { key: string; meta: PropertyMeta }>>()

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  // Attempt to retrieve field metadata for a given component type from the factory registry (best-effort)
  // Uses Zod schema introspection
  private getPropsMetaForType(type: string): Record<string, PropertyMeta> | undefined {
    if (this.propsMetaCache.has(type)) {
      return this.propsMetaCache.get(type)
    }
    try {
      const factory = CMSComponentFactory.getInstance() as any
      const catalog = (factory as any).registry || (factory.getComponentCatalog && factory.getComponentCatalog())
      if (!catalog) return undefined
      const entry = catalog[type]

      // Use schema to derive field metadata
      if (!entry?.schema) return undefined

      const { zodSchemaToTypeString } = require('@/lib/studio/components/cms/_core/component-definition')
      const { z } = require('zod')
      const meta: Record<string, PropertyMeta> = {}

      for (const [fieldName, zodType] of Object.entries(entry.schema.shape)) {
        const field = zodType as any
        const typeString = zodSchemaToTypeString(field)
        const isRequired = !(field.isOptional() || field instanceof z.ZodOptional)
        const description = field._def?.description || undefined
        const allowedTypes = field._def?.allowedTypes as string[] | undefined

        meta[fieldName] = {
          type: typeString,
          required: isRequired,
          description,
          ...(allowedTypes ? { allowedTypes } : {})
        }
      }

      if (Object.keys(meta).length > 0) {
        this.propsMetaCache.set(type, meta)
        this.propsMetaLookupCache.delete(type)
      }
      return meta
    } catch {
      return undefined
    }
  }

  private normalizeName(s: string): string {
    return (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '')
  }

  private getPropsMetaLookup(type: string): Map<string, { key: string; meta: PropertyMeta }> | undefined {
    if (this.propsMetaLookupCache.has(type)) {
      return this.propsMetaLookupCache.get(type)
    }
    const meta = this.getPropsMetaForType(type)
    if (!meta) return undefined
    const lookup = new Map<string, { key: string; meta: PropertyMeta }>()
    for (const [key, conf] of Object.entries(meta)) {
      lookup.set(this.normalizeName(key), { key, meta: conf })
    }
    this.propsMetaLookupCache.set(type, lookup)
    return lookup
  }

  private resolveFieldMeta(type: string, fieldName?: string): { key: string; meta: PropertyMeta } | undefined {
    if (!fieldName) return undefined
    const lookup = this.getPropsMetaLookup(type)
    if (!lookup) return undefined
    return lookup.get(this.normalizeName(fieldName))
  }

  private resolveEffectiveFieldMeta(
    parentComp: ExtractedComponent,
    fieldName?: string
  ): { key: string; meta: PropertyMeta } | undefined {
    if (!fieldName) return undefined
    const fromRegistry = this.resolveFieldMeta(parentComp.type, fieldName)
    if (fromRegistry) return fromRegistry

    const metadataProps = (parentComp.properties as any)?.metadata?.properties
    if (!Array.isArray(metadataProps)) return undefined

    const target = this.normalizeName(fieldName)
    for (const entry of metadataProps) {
      if (!entry || typeof entry !== 'object') continue
      const name = (entry as any).name
      const type = (entry as any).type
      if (typeof name !== 'string' || typeof type !== 'string') continue
      if (this.normalizeName(name) !== target) continue
      const allowedCandidate = (entry as any).allowedTypes
      const allowedTypes = Array.isArray(allowedCandidate)
        ? allowedCandidate.filter((item: unknown) => typeof item === 'string') as string[]
        : undefined
      return {
        key: name,
        meta: {
          type,
          required: Boolean((entry as any).required),
          description: typeof (entry as any).description === 'string' ? (entry as any).description : undefined,
          ...(allowedTypes && allowedTypes.length ? { allowedTypes } : {})
        }
      }
    }
    return undefined
  }

  private getContentSlotKind(metaType?: string): 'array' | 'single' | null {
    if (!metaType) return null
    const normalized = metaType.toLowerCase().replace(/\s+/g, '')
    if (normalized.includes('content[]')) return 'array'
    if (normalized === 'content') return 'single'
    return null
  }

  private extractLooseProps(source: Record<string, any>): Record<string, any> {
    const props: Record<string, any> = {}
    for (const [key, value] of Object.entries(source)) {
      const norm = this.normalizeName(key)
      if (
        norm === 'id' ||
        norm === 'type' ||
        norm === 'contenttype' ||
        norm === 'parentid' ||
        norm === 'position' ||
        norm === 'isshared' ||
        norm === 'sharedid' ||
        norm === 'sharedcomponentid'
      ) {
        continue
      }
      if (this.propertyBuckets.some(bucket => this.normalizeName(bucket) === norm)) {
        continue
      }
      props[key] = value
    }
    return props
  }

  private prepareSchemaChildCandidate(
    node: any,
    allowedTypes?: string[]
  ): { candidate: Record<string, any> } | null {
    if (!node || typeof node !== 'object') return null
    const candidate = { ...node }
    const candidateTypeValue = candidate.type || candidate.contentType
    if (!candidateTypeValue) {
      return null
    }
    const candidateType = typeof candidateTypeValue === 'string'
      ? candidateTypeValue
      : String(candidateTypeValue)
    candidate.type = this.pickAllowedChildType(candidateType, allowedTypes)
    if (candidate.contentType) {
      delete candidate.contentType
    }

    const hasBucket = this.propertyBuckets.some(bucket => candidate[bucket] && typeof candidate[bucket] === 'object')
    if (!hasBucket) {
      const loose = this.extractLooseProps(node)
      candidate.properties = loose
    }
    return { candidate }
  }

  private parseMetaType(metaType?: string): { isArray: boolean; isObject: boolean } {
    const raw = (metaType || '').trim()
    const lower = raw.toLowerCase()
    const isArray = /array\s*</.test(lower) || /\[\s*\]$/.test(lower) || lower.includes('array')
    const isObject = !isArray && (lower.includes('{') || lower.includes('object'))
    return { isArray, isObject }
  }

  private hasFormLikeFields(source?: Record<string, any>): boolean {
    if (!source || typeof source !== 'object') {
      return false
    }
    const buckets = [
      source,
      (source as any).content,
      (source as any).props,
      (source as any).properties,
      (source as any).data
    ]
    for (const bucket of buckets) {
      if (!bucket || typeof bucket !== 'object') continue
      const anyBucket = bucket as any
      if (Array.isArray(anyBucket.fields) && anyBucket.fields.length > 0) return true
      if (Array.isArray(anyBucket.inputs) && anyBucket.inputs.length > 0) return true
      if (anyBucket.form && typeof anyBucket.form === 'object') return true
    }
    return false
  }

  private normalizeComponentType(type?: string, props?: Record<string, any>): string {
    if (!type) return 'unknown'
    const trimmed = String(type).trim()
    if (!trimmed) return 'unknown'

    const lower = trimmed.toLowerCase()
    if (lower === 'cta') {
      return this.hasFormLikeFields(props) ? ComponentType.CTAWithForm : ComponentType.CTASimple
    }

    const camelToKebab = trimmed
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase()
    const normalizedCandidates = new Set<string>([
      lower,
      lower.replace(/_/g, '-'),
      lower.replace(/\s+/g, '-'),
      camelToKebab
    ])

    if (normalizedCandidates.has(ComponentType.CTAWithForm)) {
      return ComponentType.CTAWithForm
    }
    if (normalizedCandidates.has(ComponentType.CTASimple)) {
      return ComponentType.CTASimple
    }
    if (normalizedCandidates.has(ComponentType.CTABanner)) {
      return ComponentType.CTABanner
    }
    if (normalizedCandidates.has(ComponentType.CTAButtonGroup)) {
      return ComponentType.CTAButtonGroup
    }

    return trimmed
  }

  private applySchemaNormalization(
    type: string,
    collected: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = { ...collected }
    try {
      const meta = this.getPropsMetaForType(type)
      if (!meta || typeof meta !== 'object') return result

      // Map normalized key -> canonical meta key
      const aliases = new Map<string, string>()
      for (const key of Object.keys(meta)) aliases.set(this.normalizeName(key), key)

      const parseIfJsonString = (val: any) => {
        if (typeof val !== 'string') return undefined
        const s = val.trim()
        if (!(s.startsWith('{') || s.startsWith('['))) return undefined
        try { return JSON.parse(s) } catch { return undefined }
      }

      for (const [field, conf] of Object.entries(meta)) {
        const norm = this.normalizeName(field)
        // Find candidate value among various casings
        let value = result[field]
        if (value === undefined) {
          for (const k of Object.keys(result)) {
            if (this.normalizeName(k) === norm) { value = result[k]; break }
          }
        }

        const { isArray, isObject } = this.parseMetaType(conf.type)

        // Parse stringified JSON to object/array when schema expects complex type
        if ((isArray || isObject) && typeof value === 'string') {
          const parsed = parseIfJsonString(value)
          if (parsed !== undefined) value = parsed
        }

        // Coerce to array if schema expects array (wrap single object without inventing new data)
        if (isArray) {
          if (Array.isArray(value)) {
            // ok
          } else if (value && typeof value === 'object') {
            value = [value]
          }
        }

        // Assign back under canonical field name when defined
        if (value !== undefined) {
          result[field] = value
          // Remove duplicate alias keys
          for (const k of Object.keys(result)) {
            if (k !== field && this.normalizeName(k) === norm) delete (result as any)[k]
          }
        }
      }
    } catch {}
    return result
  }

  private componentKey(component: Pick<ExtractedComponent, 'id' | 'type'>): string {
    return `${component.id ?? 'unknown'}::${component.type ?? 'unknown'}`
  }

  private pickAllowedChildType(original: string, allowedTypes?: string[]): string {
    if (!allowedTypes || allowedTypes.length === 0) {
      return original
    }
    const normalizedOriginal = this.normalizeName(original)
    for (const allowed of allowedTypes) {
      if (this.normalizeName(allowed) === normalizedOriginal) {
        return allowed
      }
    }
    return allowedTypes[0]
  }

  private coerceComponent(
    comp: any,
    index: number,
    parentId: string | null = null,
    fallbackIdPrefix = 'comp'
  ): ExtractedComponent {
    const collected: Record<string, any> = {}
    const mergeIfObject = (obj: any) => {
      if (obj && typeof obj === 'object') {
        Object.assign(collected, obj)
      }
    }
    mergeIfObject(comp?.properties)
    mergeIfObject(comp?.props)
    mergeIfObject(comp?.content)
    mergeIfObject(comp?.data)
    mergeIfObject(comp?.fields)
    mergeIfObject(comp?.attributes)

    const promoteJsonBucket = (raw: any) => {
      if (typeof raw !== 'string') return undefined
      const s = raw.trim()
      if (!(s.startsWith('{') || s.startsWith('['))) return undefined
      try {
        const parsed = JSON.parse(s)
        if (parsed && typeof parsed === 'object') return parsed
      } catch {}
      return undefined
    }

    // IMPORTANT: Process `content` object FIRST (normalized data), BEFORE `text` JSON string.
    // This ensures normalized data (from import normalizers) takes precedence over raw LLM output in `text`.
    // The import pipeline stores normalized data in `props.content` but also keeps raw LLM output in `props.text`.
    try {
      const objectBuckets = ['content', 'data'] as const
      for (const b of objectBuckets) {
        const val = collected[b]
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          for (const [k, v] of Object.entries(val)) {
            if (collected[k] === undefined) collected[k] = v
          }
          delete (collected as any)[b]
        }
      }
    } catch {}

    // Then process JSON string buckets (text, content) as fallback for any missing fields
    try {
      const buckets = ['text', 'content'] as const
      for (const b of buckets) {
        const parsed = promoteJsonBucket(collected[b])
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            if (collected[k] === undefined) collected[k] = v
          }
          delete (collected as any)[b]
        }
      }
    } catch {}

    const sharedIdCandidate = (
      comp?.sharedId ||
      comp?.sharedComponentId ||
      collected?.sharedComponentId ||
      collected?.sharedId
    )
    const isShared = (
      comp?.type === '_shared' ||
      comp?.type === 'shared' ||
      comp?.isShared === true ||
      Boolean(sharedIdCandidate)
    )

    const resolvedType = this.normalizeComponentType(comp?.type, collected)
    const normalized = this.applySchemaNormalization(resolvedType, collected)

    return {
      id: comp?.id || `${fallbackIdPrefix}-${Date.now()}-${index}`,
      type: resolvedType,
      parentId: comp?.parentId ?? parentId ?? null,
      position: comp?.position !== undefined ? comp.position : index,
      properties: normalized,
      isShared,
      sharedId: isShared ? (sharedIdCandidate || undefined) : undefined
    } as ExtractedComponent
  }

  private appendNestedComponentsFromProperties(
    parentComp: ExtractedComponent,
    properties: any,
    extracted: ExtractedComponent[],
    trace: ((...args: any[]) => void) | undefined,
    seen?: Set<string>
  ): void {
    if (!properties || typeof properties !== 'object') return

    const visit = (
      node: any,
      depth: number,
      context: { fieldName?: string; path?: string }
    ) => {
      if (!node || depth >= this.maxTraversalDepth) return
      const pointer = context.path || context.fieldName

      const fieldMeta = this.resolveEffectiveFieldMeta(parentComp, context.fieldName)
      const slotKind = fieldMeta ? this.getContentSlotKind(fieldMeta.meta.type) : null

      if (slotKind) {
        const values = slotKind === 'array'
          ? (Array.isArray(node) ? node : [node].filter(Boolean))
          : [node]

        values.forEach((entry, entryIndex) => {
          if (!entry || typeof entry !== 'object') return
          if (!fieldMeta) {
            console.warn('ComponentInstanceExtractor: Missing field metadata for nested component slot', {
              parentId: parentComp.id,
              parentType: parentComp.type,
              field: context.fieldName,
              index: entryIndex
            })
            trace?.('Candidate component skipped (missing field metadata)', {
              parentId: parentComp.id,
              parentType: parentComp.type,
              field: context.fieldName,
              index: entryIndex,
              depth,
              path: pointer
            })
            return
          }
          const prepared = this.prepareSchemaChildCandidate(entry, fieldMeta.meta.allowedTypes)
          if (!prepared) {
            console.warn(
              'ComponentInstanceExtractor: Skipping nested component without type',
              {
                parentId: parentComp.id,
                parentType: parentComp.type,
                field: fieldMeta?.key,
                index: entryIndex
              }
            )
            trace?.('Candidate component skipped (schema slot missing type)', {
              parentId: parentComp.id,
              parentType: parentComp.type,
              field: fieldMeta?.key,
              index: entryIndex,
              depth,
              path: pointer
            })
            return
          }

          const { candidate } = prepared
          const child = this.coerceComponent(
            { ...candidate, parentId: parentComp.id },
            slotKind === 'array' ? entryIndex : 0,
            parentComp.id ?? null,
            `${parentComp.id || parentComp.type || 'child'}`
          )

          const childKey = this.componentKey(child)
          if (seen?.has(childKey)) {
            return
          }
          if (!extracted.some(e => e.id === child.id && e.type === child.type)) {
            extracted.push(child)
            seen?.add(childKey)
            trace?.('Nested component (Schema slot)', {
              parentId: parentComp.id,
              parentType: parentComp.type,
              slot: fieldMeta?.key,
              index: entryIndex,
              type: child.type,
              depth,
              path: pointer
            })
            visit(child.properties, depth + 1, {
              path: `${pointer ?? fieldMeta?.key ?? 'slot'}${slotKind === 'array' ? `[${entryIndex}]` : ''}`
            })
          }
        })
        return
      }

      if (node && typeof node === 'object' && node.contentType && node.properties) {
        const childType = String(node.contentType)
        const childProps = typeof node.properties === 'object'
          ? node.properties[childType] || node.properties
          : {}
        const child = this.coerceComponent(
          { type: childType, properties: childProps, parentId: parentComp.id },
          extracted.length,
          parentComp.id ?? null,
          `${parentComp.id || parentComp.type || 'child'}`
        )
        const childKey = this.componentKey(child)
        if (!extracted.some(e => e.id === child.id && e.type === child.type) && !seen?.has(childKey)) {
          extracted.push(child)
          seen?.add(childKey)
          trace?.('Nested component (Pattern A)', {
            parentId: parentComp.id,
            type: childType,
            depth,
            path: pointer
          })
          visit(child.properties, depth + 1, { path: pointer ? `${pointer}#patternA` : 'patternA' })
        }
        return
      }

      // Pattern B: Object with type + property bucket is a component
      // BUT exclude reference types - they use 'type' for discrimination, not component identification
      const referenceTypes = ['mediareference', 'pagereference', 'internal', 'external', 'email', 'phone', 'anchor']
      const nodeType = node && typeof node === 'object' && typeof node.type === 'string' ? node.type.toLowerCase() : ''
      const isReferenceType = referenceTypes.includes(nodeType)

      if (node && typeof node === 'object' && node.type && !isReferenceType && (node.properties || node.props || node.content || node.data || node.fields)) {
        const child = this.coerceComponent(
          { ...node, parentId: parentComp.id },
          extracted.length,
          parentComp.id ?? null,
          `${parentComp.id || parentComp.type || 'child'}`
        )
        const childKey = this.componentKey(child)
        if (!extracted.some(e => e.id === child.id && e.type === child.type) && !seen?.has(childKey)) {
          extracted.push(child)
          seen?.add(childKey)
          trace?.('Nested component (Pattern B)', {
            parentId: parentComp.id,
            type: child.type,
            depth,
            path: pointer
          })
          visit(child.properties, depth + 1, { path: pointer ? `${pointer}#patternB` : 'patternB' })
        }
        return
      } else if (node && typeof node === 'object' && node.type) {
        trace?.('Candidate component skipped (no recognized property bucket)', {
          parentId: parentComp.id,
          type: node.type,
          depth,
          keys: Object.keys(node),
          path: pointer
        })
      }

      if (Array.isArray(node)) {
        node.forEach((el, idx) =>
          visit(el, depth + 1, {
            fieldName: context.fieldName,
            path: `${pointer ?? 'array'}[${idx}]`
          })
        )
        return
      }

      if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          if (value && typeof value === 'object') {
            const childPath = pointer ? `${pointer}.${key}` : key
            visit(value, depth + 1, { fieldName: key, path: childPath })
          }
        }
      }
    }

    visit(properties, 0, { path: 'properties' })
  }

  /**
   * Extract component instances from page content JSON
   * Epic 16 stores components in content.components array, not database tables
  */
  extractFromPageContent(pageContent: any): ExtractedComponent[] {
    if (!pageContent || typeof pageContent !== 'object') {
      console.log('ComponentInstanceExtractor: No page content or invalid format')
      return []
    }

    const traceExtraction = process.env.EXPORT_TRACE === '1'
    const trace = (...args: any[]) => {
      if (!traceExtraction) return
      console.log('[ComponentExtraction TRACE]', ...args)
    }

    // Epic 16 stores components in content.components array (primary)
    let components: any[] = Array.isArray(pageContent.components) ? pageContent.components : []
    // Fallback: also look for other conventional arrays if primary missing
    if (components.length === 0) {
      const altKeys = ['contentArea', 'sections', 'blocks', 'widgets']
      for (const k of altKeys) {
        const arr = (pageContent as any)[k]
        if (Array.isArray(arr) && arr.length > 0) {
          components = arr
          break
        }
      }
    }

    console.log(`ComponentInstanceExtractor: Extracting ${components.length} components from page content`)
    const extracted: ExtractedComponent[] = []
    const seen = new Set<string>()

    // First, coerce and add all top-level components
    components.forEach((comp: any, index: number) => {
      const top = this.coerceComponent(comp, index, comp.parentId ?? null)
      trace('Top-level component detected', {
        id: top.id,
        type: top.type,
        parentId: top.parentId,
        hasProperties: Object.keys(top.properties || {}).length > 0
      })
      extracted.push(top)
      seen.add(this.componentKey(top))

      // Bounded deep scan into nested objects/arrays inside this component's properties
      try {
        this.appendNestedComponentsFromProperties(top, top.properties, extracted, trace, seen)
      } catch (e) {
        console.warn('ComponentInstanceExtractor: nested scan skipped due to error:', (e as Error)?.message)
      }
    })

    return extracted
  }

  /**
   * Resolve shared component references to get actual component types
   * "_shared" type indicates a reference to WebsiteSharedComponent table
   */
  async resolveSharedComponents(
    components: ExtractedComponent[], 
    websiteId: string,
    usage?: Set<string>
  ): Promise<ExtractedComponent[]> {
    if (!components.length) {
      return components
    }

    const recordUsage = (type?: string) => {
      if (!usage) return
      const raw = String(type ?? '').trim()
      if (!raw) return
      usage.add(raw)
    }

    const sharedComponents = components.filter(comp => comp.isShared && comp.sharedId)
    
    if (!sharedComponents.length) {
      console.log('ComponentInstanceExtractor: No shared components to resolve')
      components.forEach(comp => recordUsage(comp.type))
      return components
    }

    console.log(`ComponentInstanceExtractor: Resolving ${sharedComponents.length} shared components`)

    // Get unique shared component IDs to minimize database calls
    const uniqueSharedIds = [
      ...new Set(
        sharedComponents
          .map(comp => comp.sharedId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    ]
    
    // Fetch shared component data in batch
    const sharedComponentData = await this.fetchSharedComponentsBatch(uniqueSharedIds, websiteId)
    
    // Create lookup map
    const sharedLookup = new Map<string, any>()
    sharedComponentData.forEach(data => {
      sharedLookup.set(data.id, data)
    })

    const traceExtraction = process.env.EXPORT_TRACE === '1'
    const trace = (...args: any[]) => {
      if (!traceExtraction) return
      console.log('[ComponentExtraction TRACE]', ...args)
    }

    const seen = new Set<string>(components.map(comp => this.componentKey(comp)))
    const resolvedComponents: ExtractedComponent[] = []

    components.forEach(comp => {
      if (!comp.isShared || !comp.sharedId) {
        recordUsage(comp.type)
        resolvedComponents.push(comp)
        seen.add(this.componentKey(comp))
        return
      }

      const sharedData = sharedLookup.get(comp.sharedId)

      if (!sharedData) {
        console.warn(`ComponentInstanceExtractor: Shared component not found: ${comp.sharedId}`)
        recordUsage(comp.type)
        resolvedComponents.push(comp)
        seen.add(this.componentKey(comp))
        return
      }

      const cfg = (sharedData?.config && typeof sharedData.config === 'object') ? sharedData.config as any : {}
      const base = (sharedData?.content && typeof sharedData.content === 'object')
        ? (sharedData.content as any)
        : (cfg?.defaultProps || {})

      const props = (comp.properties && typeof comp.properties === 'object') ? { ...comp.properties } : {}
      let overrides: any = (props as any)?.overrides || {}
      let hasOverrides = Boolean((props as any)?.hasOverrides) || (overrides && Object.keys(overrides).length > 0)

      const legacyFlag = String(process.env.EXPORT_TREAT_LEGACY_FULL_PROPS_AS_OVERRIDES || '').toLowerCase() === 'true'
      if (!hasOverrides && legacyFlag) {
        const reserved = new Set(['overrides', 'hasOverrides', 'sharedComponentId'])
        const legacyOverrides: Record<string, any> = {}
        for (const [k, v] of Object.entries(props)) {
          if (reserved.has(k)) continue
          const baseVal = (base as any)?.[k]
          if (JSON.stringify(baseVal) !== JSON.stringify(v)) legacyOverrides[k] = v
        }
        if (Object.keys(legacyOverrides).length > 0) {
          overrides = legacyOverrides
          hasOverrides = true
        }
      }

      const effective = deepMerge(base, overrides) as Record<string, any>

      delete (props as any).overrides
      delete (props as any).hasOverrides
      delete (props as any).sharedComponentId

      const resolvedType = this.normalizeComponentType(
        sharedData.websiteComponentType?.type || comp.type,
        effective
      )
      recordUsage(resolvedType)

      const normalizedProps = this.applySchemaNormalization(resolvedType, effective || {})

      const resolvedComp: ExtractedComponent = {
        ...comp,
        type: resolvedType,
        properties: normalizedProps,
        hasOverrides
      }

      resolvedComponents.push(resolvedComp)
      seen.add(this.componentKey(resolvedComp))

      this.appendNestedComponentsFromProperties(
        resolvedComp,
        resolvedComp.properties,
        resolvedComponents,
        trace,
        seen
      )
    })

    return resolvedComponents
  }
  /**
   * Batch fetch shared components to optimize database calls
   */
  private async fetchSharedComponentsBatch(sharedIds: string[], websiteId: string): Promise<any[]> {
    const cacheKey = `batch_${websiteId}_${sharedIds.sort().join(',')}`
    
    if (this.sharedComponentCache.has(cacheKey)) {
      console.log('ComponentInstanceExtractor: Using cached shared components batch')
      return this.sharedComponentCache.get(cacheKey)!
    }

    try {
      const sharedComponents = await this.prisma.websiteSharedComponent.findMany({
        where: {
          id: { in: sharedIds },
          websiteId: websiteId
        },
        include: {
          websiteComponentType: true
        }
      })

      this.sharedComponentCache.set(cacheKey, sharedComponents)
      
      console.log(`ComponentInstanceExtractor: Fetched ${sharedComponents.length} shared components from database`)
      return sharedComponents
      
    } catch (error) {
      console.error('ComponentInstanceExtractor: Error fetching shared components:', error)
      return []
    }
  }

  /**
   * Extract and resolve components from page content in one operation
   */
  async extractAndResolveComponents(pageContent: any, websiteId: string, usage?: Set<string>): Promise<ExtractedComponent[]> {
    const extracted = this.extractFromPageContent(pageContent)
    return this.resolveSharedComponents(extracted, websiteId, usage)
  }

  /**
   * Clear shared component cache (useful for testing)
   */
  clearCache(): void {
    this.sharedComponentCache.clear()
  }
}
