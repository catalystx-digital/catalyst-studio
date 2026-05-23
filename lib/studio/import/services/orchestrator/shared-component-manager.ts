import type { PrismaClient } from '@/lib/generated/prisma'
import type { ISharedComponentDetector } from '../interfaces/shared-component-detector.interface'
import { RetryConfig, ConcurrencyConfig } from '../../config'
import {
  withRetry as withRetryUtil,
  processInBatches as processInBatchesUtil
} from '../../utils/retry-utils'
import { isConnectionError } from '../../utils/error-classification'
import { safeStringify } from '../../utils/json-parsing'

/**
 * Represents a component instance within a shared component candidate.
 */
interface ComponentInstance {
  props?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Represents a pattern detected for a shared component.
 */
interface SharedComponentPattern {
  type?: string
  structure?: unknown
  frequency?: number
  confidence?: number
}

/**
 * Represents a shared component candidate for persistence.
 */
interface SharedComponentCandidate {
  name?: string
  category?: string
  pattern?: SharedComponentPattern
  instances?: ComponentInstance[]
  pages?: string[]
}

/**
 * Represents a component type from the database.
 */
interface ComponentTypeRecord {
  id: string
  type?: string
  category?: string
  isGlobal?: boolean
  [key: string]: unknown
}

/**
 * Represents a shared component record from/to the database.
 */
interface SharedComponentRecord {
  id: string
  websiteComponentTypeId: string
  name: string
  content: Record<string, unknown>
  config: Record<string, unknown>
  usageCount?: number
}

/**
 * Represents a page record with component content.
 */
interface PageRecord {
  id: string
  content?: {
    components?: ComponentNode[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * Represents a node in the component tree.
 */
interface ComponentNode {
  props?: {
    sharedComponentId?: string
    [key: string]: unknown
  }
  children?: ComponentNode[]
  [key: string]: unknown
}

interface SharedComponentPersistOptions {
  prisma: PrismaClient
  websiteId: string
  sharedComponentDetector: ISharedComponentDetector
  pages: PageRecord[]
  candidates: SharedComponentCandidate[]
  componentTypes: ComponentTypeRecord[]
}

interface SharedComponentPersistResult {
  sharedComponents: SharedComponentRecord[]
  updatedPages: PageRecord[]
  refreshedComponentTypes: ComponentTypeRecord[]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(entry => sortValue(entry))
  }
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue((value as Record<string, unknown>)[key])
        return acc
      }, {})
  }
  return value
}

function stableHash(value: unknown): string {
  try {
    return JSON.stringify(sortValue(value))
  } catch {
    return ''
  }
}

// Use centralized retry configuration
const MAX_RETRIES = RetryConfig.maxAttempts
const BASE_RETRY_DELAY_MS = RetryConfig.baseDelayMs

/**
 * Wraps a database operation with retry logic for connection errors.
 * Uses centralized retry utilities.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries = MAX_RETRIES
): Promise<T> {
  return withRetryUtil(operation, {
    maxAttempts: maxRetries,
    baseDelayMs: BASE_RETRY_DELAY_MS,
    operationName,
    shouldRetry: (error) => isConnectionError(error)
  })
}

/**
 * Processes items in batches with delays between batches to prevent connection exhaustion.
 */
async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T, index: number) => Promise<R>,
  operationName: string
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batchEnd = Math.min(i + batchSize, items.length)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(items.length / batchSize)

    console.log(`[SharedComponentManager] Processing ${operationName} batch ${batchNum}/${totalBatches}`)

    // Process batch items sequentially to avoid connection pool exhaustion
    for (let j = i; j < batchEnd; j++) {
      const result = await processor(items[j], j)
      results.push(result)
    }

    // Small delay between batches to allow connection pool recovery
    if (batchEnd < items.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}

export async function persistSharedComponentsAndUpdatePages({
  prisma,
  websiteId,
  sharedComponentDetector,
  pages,
  candidates,
  componentTypes
}: SharedComponentPersistOptions): Promise<SharedComponentPersistResult> {
  const baseComponentTypes = Array.isArray(componentTypes) ? componentTypes : []
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      sharedComponents: [],
      updatedPages: pages,
      refreshedComponentTypes: baseComponentTypes
    }
  }

  const extractCanonicalProps = (comp: ComponentInstance): Record<string, unknown> => {
    const props = (comp?.props && typeof comp.props === 'object') ? comp.props : {}
    const out: Record<string, unknown> = { ...props }
    delete out.bounds
    delete out.confidence
    delete out.metadata
    delete out.type           // Type is infrastructure, not content
    delete out.componentType  // Defensive - also strip componentType if present

    const promoteJsonBucket = (val: unknown): Record<string, unknown> | null => {
      if (typeof val !== 'string') return null
      const s = val.trim()
      if (!(s.startsWith('{') || s.startsWith('['))) return null
      try {
        const parsed = JSON.parse(s)
        return (parsed && typeof parsed === 'object') ? (parsed as Record<string, unknown>) : null
      } catch {
        return null
      }
    }

    for (const key of ['text', 'content']) {
      const parsed = promoteJsonBucket(out[key])
      if (parsed) {
        for (const [k, v] of Object.entries(parsed)) {
          if (out[k] === undefined) out[k] = v
        }
        delete out[key]
      }
    }

    return out
  }

  const ensureGenericType = async (): Promise<{ id: string; type: string; category: string; isGlobal?: boolean }> => {
    const client = (prisma as any).websiteComponentType
    if (!client || typeof client.findFirst !== 'function' || typeof client.create !== 'function') {
      return {
        id: 'shared-generic',
        type: 'shared-generic',
        category: 'content',
        isGlobal: true
      }
    }

    const existing = await withRetry(
      () => client.findFirst({ where: { websiteId, type: 'shared-generic' } }),
      'find generic type'
    )

    if (existing) return existing as { id: string; type: string; category: string; isGlobal?: boolean }

    return withRetry(
      () => client.create({
        data: {
          websiteId,
          type: 'shared-generic',
          category: 'content',
          defaultConfig: {},
          placeholderData: {},
          styles: {},
          aiMetadata: { source: 'import-orchestrator' },
          isGlobal: true
        }
      }),
      'create generic type'
    )
  }

  const genericType = await ensureGenericType()

  const typeIndex = new Map<string, string>()
  let refreshedTypes = baseComponentTypes
  try {
    const allTypesRaw = await prisma.websiteComponentType.findMany({ where: { websiteId } })
    const allTypes = Array.isArray(allTypesRaw) ? allTypesRaw : []
    for (const t of allTypes) {
      if (t.type) typeIndex.set(t.type.toLowerCase(), t.id)
      if (t.category) typeIndex.set(`cat:${t.category.toLowerCase()}`, t.id)
    }
    refreshedTypes = allTypes
  } catch {}

  const sanitizeTypeKey = (raw?: string) => {
    if (!raw) return ''
    return raw.toString().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  }

  const componentHasFormSignals = (instances: ComponentInstance[]): boolean => {
    return instances.some(instance => {
      const props = instance?.props ?? {}
      if (props.hasForm === true) return true
      if (Array.isArray(props.formFieldTypes) && props.formFieldTypes.length > 0) return true
      if (Array.isArray(props.inputs) && props.inputs.length > 0) return true
      if (props.form && typeof props.form === 'object') return true
      return false
    })
  }

  const resolveCanonicalComponentType = (candidate: SharedComponentCandidate): ComponentTypeRecord | null => {
    const rawType = candidate?.pattern?.type
    const normalized = sanitizeTypeKey(rawType)
    if (!normalized || !Array.isArray(refreshedTypes)) return null

    const typesWithScores = refreshedTypes.map((t: ComponentTypeRecord) => ({
      type: t,
      key: sanitizeTypeKey(t?.type)
    }))

    const exact = typesWithScores.find(entry => entry.key === normalized)
    if (exact) return exact.type

    const fuzzyMatches = typesWithScores.filter(entry => entry.key.startsWith(normalized) || entry.key.includes(`_${normalized}`))
    if (fuzzyMatches.length === 0) return null
    if (fuzzyMatches.length === 1) return fuzzyMatches[0].type

    const hasForm = componentHasFormSignals(candidate?.instances || [])
    const formFocused = fuzzyMatches.filter(entry => /form/.test(entry.key))
    if (hasForm && formFocused.length > 0) return formFocused[0].type

    const nonForm = fuzzyMatches.filter(entry => !/form/.test(entry.key))
    if (!hasForm && nonForm.length > 0) return nonForm[0].type

    return fuzzyMatches[0].type
  }

  // Access Prisma client dynamically - types are checked at runtime
  const sharedComponentClient = (prisma as unknown as Record<string, unknown>).websiteSharedComponent as {
    findFirst: (args: unknown) => Promise<SharedComponentRecord | null>
    create: (args: unknown) => Promise<SharedComponentRecord>
    update: (args: unknown) => Promise<SharedComponentRecord>
  } | undefined
  const sharedRecords: SharedComponentRecord[] = []

  const CANDIDATE_BATCH_SIZE = 10

  const processSingleCandidate = async (cand: SharedComponentCandidate, _index: number): Promise<SharedComponentRecord> => {
    const name: string = cand.name || `${cand.category || 'Component'} Shared`
    const canonicalType = resolveCanonicalComponentType(cand)
    const preferredTypeId =
      canonicalType?.id ||
      typeIndex.get((cand.pattern?.type || '').toLowerCase()) ||
      typeIndex.get(`cat:${(cand.category || '').toLowerCase()}`) ||
      genericType.id

    const canonicalContent =
      cand.instances && cand.instances[0] ? extractCanonicalProps(cand.instances[0]) : {}
    const configType = canonicalType?.type || cand.pattern?.type || cand.category || 'shared'
    const configPayload = {
      type: configType,
      category: cand.category || 'content',
      pattern: {
        structure: cand.pattern?.structure,
        frequency: cand.pattern?.frequency,
        confidence: cand.pattern?.confidence,
        refreshedAt: new Date().toISOString()
      }
    }

    let record = null

    // Find existing record
    if (sharedComponentClient && typeof sharedComponentClient.findFirst === 'function') {
      record = await withRetry(
        () => sharedComponentClient.findFirst({
          where: { websiteId, name, websiteComponentTypeId: preferredTypeId }
        }),
        `find shared component: ${name}`
      )
    }

    // Handle legacy record upgrade
    if (
      !record &&
      canonicalType &&
      sharedComponentClient &&
      typeof sharedComponentClient.findFirst === 'function' &&
      typeof sharedComponentClient.update === 'function'
    ) {
      const legacyRecord = await withRetry(
        () => sharedComponentClient.findFirst({ where: { websiteId, name } }),
        `find legacy shared component: ${name}`
      )

      if (legacyRecord && legacyRecord.websiteComponentTypeId !== canonicalType.id) {
        const existingConfig =
          legacyRecord.config && typeof legacyRecord.config === 'object'
            ? { ...legacyRecord.config }
            : {}
        const updatedConfig = { ...existingConfig, type: canonicalType.type }

        record = await withRetry(
          () => sharedComponentClient.update({
            where: { id: legacyRecord.id },
            data: {
              websiteComponentTypeId: canonicalType.id,
              config: updatedConfig
            }
          }),
          `upgrade legacy shared component: ${name}`
        )
      }
    }

    // Create new record if not found
    if (!record && sharedComponentClient && typeof sharedComponentClient.create === 'function') {
      record = await withRetry(
        () => sharedComponentClient.create({
          data: {
            websiteId,
            websiteComponentTypeId: preferredTypeId,
            name,
            content: canonicalContent,
            config: configPayload,
            usageCount: cand.pages?.length || 0
          }
        }),
        `create shared component: ${name}`
      )
    }

    // Fallback for in-memory record
    if (!record) {
      record = {
        id: `${preferredTypeId}-${name}`,
        websiteComponentTypeId: preferredTypeId,
        name,
        content: canonicalContent,
        config: configPayload,
        usageCount: 0
      }
    } else if (
      record.id &&
      sharedComponentClient &&
      typeof sharedComponentClient.update === 'function' &&
      (stableHash(record.content ?? {}) !== stableHash(canonicalContent) ||
        stableHash(record.config ?? {}) !== stableHash(configPayload))
    ) {
      // Update existing record if content changed
      const recordId = record.id
      record = await withRetry(
        () => sharedComponentClient.update({
          where: { id: recordId },
          data: {
            content: canonicalContent,
            config: configPayload
          }
        }),
        `update shared component: ${name}`
      )
    } else if (!record.id) {
      record.content = canonicalContent
      record.config = configPayload
    }

    return record
  }

  // Process candidates in batches with retry logic
  const processedRecords = await processInBatches(
    candidates,
    CANDIDATE_BATCH_SIZE,
    processSingleCandidate,
    'shared component persistence'
  )
  sharedRecords.push(...processedRecords)

  const freshPagesRaw = await withRetry(
    () => prisma.websitePage.findMany({ where: { websiteId } }),
    'fetch pages for reference update'
  )
  const freshPages = Array.isArray(freshPagesRaw) ? freshPagesRaw : []
  const rewritten: PageRecord[] = []

  for (const p of freshPages) {
    try {
      const updated = await withRetry(
        () => sharedComponentDetector.updatePageReferences(p as unknown as Parameters<typeof sharedComponentDetector.updatePageReferences>[0], sharedRecords as unknown as Parameters<typeof sharedComponentDetector.updatePageReferences>[1]),
        `update page references: ${p.id}`
      )
      rewritten.push(updated as PageRecord)
    } catch (error) {
      // Non-fatal; keep existing page when update fails
      console.warn(`[SharedComponentManager] Failed to update page references for ${p.id}`, {
        error: error instanceof Error ? error.message : error
      })
      rewritten.push(p as PageRecord)
    }
  }
  const updatedPages = rewritten.length > 0 ? rewritten : pages

  try {
    const counts = new Map<string, number>()
    for (const rec of sharedRecords) counts.set(rec.id, 0)

    const pagesForCountRaw = await withRetry(
      () => prisma.websitePage.findMany({ where: { websiteId } }),
      'fetch pages for usage count'
    )
    const pagesForCount = Array.isArray(pagesForCountRaw) ? pagesForCountRaw : []

    const visit = (nodes: ComponentNode[]) => {
      if (!Array.isArray(nodes)) return
      for (const n of nodes) {
        const sid = n?.props?.sharedComponentId
        if (sid && counts.has(sid)) counts.set(sid, (counts.get(sid) || 0) + 1)
        if (Array.isArray(n?.children)) visit(n.children)
      }
    }

    for (const pg of pagesForCount) {
      const content = pg.content as PageRecord['content']
      if (content && Array.isArray(content.components)) visit(content.components)
    }

    if (sharedComponentClient && typeof sharedComponentClient.update === 'function') {
      // Update usage counts in batches
      const countEntries = Array.from(counts.entries())
      await processInBatches(
        countEntries,
        10,
        async ([sid, cnt]) => {
          await withRetry(
            () => sharedComponentClient.update({ where: { id: sid }, data: { usageCount: cnt } }),
            `update usage count: ${sid}`
          )
        },
        'usage count update'
      )
    }
  } catch (error) {
    console.warn('[SharedComponentManager] Failed to update usage counts', {
      error: error instanceof Error ? error.message : error
    })
    // Non-fatal - continue without usage counts
  }

  if (!Array.isArray(refreshedTypes)) {
    refreshedTypes = []
  }
  const hasGenericType = refreshedTypes.some((type: ComponentTypeRecord) => type?.id === genericType.id || type?.type === genericType.type)
  if (!hasGenericType) {
    refreshedTypes = [...refreshedTypes, genericType]
  }
  return {
    sharedComponents: sharedRecords,
    updatedPages,
    refreshedComponentTypes: refreshedTypes
  }
}
