/**
 * Component Type Registration Stage
 *
 * Handles component type extraction and registration during import.
 *
 * @module component-type-stage
 */

import type { PrismaClient, Prisma } from '@/lib/generated/prisma'
import type { DetectionResult, ComponentPattern } from '../interfaces/component-type-extractor.interface'
import { canonicalizeComponentType as canonicalizeTemplateType } from '../page-builder/component-helpers'
import { getPageCatalogSummary } from '@/lib/studio/pages/catalog'
import { ComponentCategory } from '@/lib/studio/components/cms/_core/types'
import { ensureTemplatePageTypes } from '../template-page-type-seeder'
import {
  buildSeedAiMetadata,
  getCanonicalContractMetadata,
  hasCanonicalDefinition,
  resolveCategoryForCanonicalType
} from '../canonical-type-utils'
import { ConfidenceConfig, DetectionConfig } from '../../config'
import { GENERIC_PAGE_TEMPLATE_KEY } from '@/lib/studio/pages/_core/constants'

const FALLBACK_TEMPLATE_KEY = GENERIC_PAGE_TEMPLATE_KEY
const CANONICAL_SEEDING_CONFIDENCE_THRESHOLD = ConfidenceConfig.canonicalSeeding
const CANONICAL_SEEDING_CHUNK_SIZE = DetectionConfig.canonicalSeedingChunkSize
const SKIPPED_CANONICAL_TYPES = DetectionConfig.skippedCanonicalTypes

export interface ComponentTypeStageInput {
  detectionResults: DetectionResult[]
  websiteId: string
  simpleImport: boolean
  prisma: PrismaClient
  componentTypeExtractor: {
    extractComponentTypes: (params: {
      detectionResults: DetectionResult[]
      websiteId: string
    }) => Promise<ComponentPattern[]>
  }
  onProgress?: (message: string, progress: number) => void
}

export interface ContentTypeConfiguration {
  defaultContentTypeId: string
  templateContentTypes: Map<string, string>
}

/**
 * Registers component types for simple imports (without full extraction).
 */
export async function registerSimpleComponentTypes(
  input: ComponentTypeStageInput
): Promise<any[]> {
  const { detectionResults, websiteId, prisma, onProgress } = input

  onProgress?.('Simple import: registering detected component types', 10)

  const allNodes: DetectionResult[] = []
  const walk = (node: DetectionResult) => {
    allNodes.push(node)
    if (node.children) node.children.forEach(walk)
  }
  detectionResults.forEach(walk)

  const uniqueTypes = Array.from(new Set(
    allNodes
      .map(n => n.type)
      .filter(Boolean)
      .filter(t => !/^page(?:-v\d+)?$/i.test(t))
  ))

  const inferCategory = (type: string): string => {
    const t = type.toLowerCase()
    if (t.includes('nav') || t.includes('menu')) return 'navigation'
    if (t.includes('footer')) return 'footer'
    if (t.includes('form') || t.includes('input')) return 'form'
    if (t.includes('hero') || t.includes('banner')) return 'hero'
    if (t.includes('gallery') || t.includes('image')) return 'media'
    if (t.includes('feed') || t.includes('card') || t.includes('article') || t.includes('list')) return 'content'
    return 'layout'
  }

  const createData = uniqueTypes.map(type => ({
    websiteId,
    type,
    category: inferCategory(type),
    defaultConfig: {},
    placeholderData: {},
    styles: {},
    aiMetadata: { simpleImport: true }
  }))

  const createdTypes = await prisma.websiteComponentType.createMany({
    data: createData,
    skipDuplicates: true
  })
  const createdCount = typeof createdTypes?.count === 'number' ? createdTypes.count : 0
  console.log(`[ComponentTypeStage] Simple import: created ${createdCount} component types`)

  const fetchedTypes = await prisma.websiteComponentType.findMany({
    where: { websiteId }
  })

  await ensureTemplatePageTypes({ prisma, websiteId })

  return ensureCoreComponentTypes({
    websiteId,
    detectionResults,
    componentTypes: fetchedTypes,
    prisma
  })
}

/**
 * Registers component types using full extraction pipeline.
 */
export async function registerFullComponentTypes(
  input: ComponentTypeStageInput
): Promise<any[]> {
  const { detectionResults, websiteId, prisma, componentTypeExtractor, onProgress } = input

  onProgress?.('Extracting component type patterns', 10)

  const componentPatterns = await componentTypeExtractor.extractComponentTypes({
    detectionResults,
    websiteId
  })

  onProgress?.(`Registering ${componentPatterns.length} component types`, 20)

  await prisma.websiteComponentType.createMany({
    data: componentPatterns.map(ct => {
      const ctAny = ct as unknown as Record<string, unknown>
      return {
        websiteId,
        type: ct.type,
        category: ct.category || 'layout',
        defaultConfig: ct.defaultConfig || {},
        placeholderData: ct.placeholderData || {},
        styles: ctAny.styles || {},
        aiMetadata: ctAny.aiMetadata || {}
      }
    }) as any,
    skipDuplicates: true
  })

  const createdTypes = await prisma.websiteComponentType.createMany({
    data: componentPatterns.map(ct => {
      const ctAny = ct as unknown as Record<string, unknown>
      return {
        websiteId,
        type: ct.type,
        category: ct.category || 'layout',
        defaultConfig: ct.defaultConfig || {},
        placeholderData: ct.placeholderData || {},
        styles: ctAny.styles || {},
        aiMetadata: ctAny.aiMetadata || {}
      }
    }) as any,
    skipDuplicates: true
  })

  const createdCount = typeof createdTypes?.count === 'number' ? createdTypes.count : 0
  console.log(`[ComponentTypeStage] Created ${createdCount} component types in database`)

  const fetchedTypes = await prisma.websiteComponentType.findMany({
    where: { websiteId }
  })

  await ensureTemplatePageTypes({ prisma, websiteId })

  return ensureCoreComponentTypes({
    websiteId,
    detectionResults,
    componentTypes: Array.isArray(fetchedTypes) ? fetchedTypes : [],
    prisma
  })
}

/**
 * Ensures core component types are present for template requirements.
 */
export async function ensureCoreComponentTypes({
  websiteId,
  detectionResults,
  componentTypes,
  prisma
}: {
  websiteId: string
  detectionResults: DetectionResult[]
  componentTypes: any[]
  prisma: PrismaClient
}): Promise<any[]> {
  const existing = Array.isArray(componentTypes) ? componentTypes : []

  const templateKeys = collectTemplateKeysFromDetections(detectionResults)
  const detectionStats = new Map<string, { maxConfidence: number; occurrences: number }>()

  const collectDetectionTypes = (nodes: DetectionResult[] | undefined): void => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes) {
      if (!node) continue
      const canonicalType = canonicalizeTemplateType((node as any)?.type)
      if (canonicalType && !SKIPPED_CANONICAL_TYPES.has(canonicalType)) {
        const confidence = typeof (node as any)?.confidence === 'number' ? Number((node as any).confidence) : undefined
        const current = detectionStats.get(canonicalType) ?? { maxConfidence: 0, occurrences: 0 }
        current.occurrences += 1
        if (typeof confidence === 'number') {
          current.maxConfidence = Math.max(current.maxConfidence, confidence)
        }
        detectionStats.set(canonicalType, current)
      }
      if (Array.isArray((node as any)?.children) && (node as any).children.length > 0) {
        collectDetectionTypes((node as any).children as DetectionResult[])
      }
    }
  }

  collectDetectionTypes(detectionResults)
  const detectionTypeSet = new Set<string>(detectionStats.keys())

  const requiredTypes = new Set<string>()
  try {
    const catalog = await getPageCatalogSummary()
    const templateIndex = new Map(catalog.templates.map(template => [template.templateKey, template]))

    for (const key of templateKeys) {
      const template = templateIndex.get(key)
      const templateAny = template as unknown as { requiredComponentTypes?: string[] } | undefined
      if (templateAny?.requiredComponentTypes) {
        templateAny.requiredComponentTypes.forEach(requiredType => requiredTypes.add(requiredType))
      }
    }
  } catch {
    // Ignore catalog errors
  }

  const existingTypeSet = new Set(existing.map(ct => canonicalizeTemplateType(ct.type)).filter(Boolean))
  const missingRequired = Array.from(requiredTypes).filter(type => !existingTypeSet.has(type))
  const missingDetected = Array.from(detectionTypeSet).filter(type => {
    if (existingTypeSet.has(type)) return false
    const stats = detectionStats.get(type)
    return (stats?.maxConfidence ?? 0) >= CANONICAL_SEEDING_CONFIDENCE_THRESHOLD
  })

  const allMissing = Array.from(new Set([...missingRequired, ...missingDetected]))
  if (allMissing.length === 0) {
    return existing
  }

  const timestamp = new Date().toISOString()
  const entries: Prisma.WebsiteComponentTypeCreateManyInput[] = []

  for (const canonical of allMissing) {
    if (!hasCanonicalDefinition(canonical)) continue
    const reason = requiredTypes.has(canonical) ? 'template-required' : 'detected-high-confidence'
    const stats = detectionStats.get(canonical)
    const entry = buildComponentTypeEntry({
      websiteId,
      canonical,
      reason,
      timestamp,
      detectionStats: stats
    })
    entries.push(entry)
  }

  if (entries.length === 0) {
    return existing
  }

  // Process in chunks
  for (let i = 0; i < entries.length; i += CANONICAL_SEEDING_CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CANONICAL_SEEDING_CHUNK_SIZE)
    await prisma.websiteComponentType.createMany({
      data: chunk,
      skipDuplicates: true
    })
  }

  console.log(`[ComponentTypeStage] Seeded ${entries.length} core component types`)

  return prisma.websiteComponentType.findMany({ where: { websiteId } })
}

/**
 * Resolves content type configuration for templates.
 */
export async function resolveContentTypeConfiguration(
  prisma: PrismaClient,
  websiteId: string
): Promise<ContentTypeConfiguration> {
  const templateContentTypes = await ensureTemplatePageTypes({
    prisma,
    websiteId
  })

  const fallbackContentTypeId = templateContentTypes.get(FALLBACK_TEMPLATE_KEY)

  if (!fallbackContentTypeId) {
    throw new Error(
      `[ComponentTypeStage] Missing fallback template content type for key "${FALLBACK_TEMPLATE_KEY}" (websiteId=${websiteId})`
    )
  }

  return { defaultContentTypeId: fallbackContentTypeId, templateContentTypes }
}

/**
 * Collects template keys from detection results.
 */
function collectTemplateKeysFromDetections(detections: DetectionResult[]): Set<string> {
  const keys = new Set<string>()
  if (!Array.isArray(detections) || detections.length === 0) return keys

  const visit = (node: DetectionResult | undefined) => {
    if (!node) return
    const direct = (node as any)?.pageTemplate
    if (direct && typeof direct === 'object') {
      const key = typeof direct.templateKey === 'string' ? direct.templateKey.trim() : ''
      if (key) keys.add(key)
    }
    const metadata = (node as any)?.metadata
    if (metadata && typeof metadata === 'object') {
      const metaTemplate = (metadata as any).pageTemplate
      if (metaTemplate && typeof metaTemplate === 'object') {
        const key = typeof metaTemplate.templateKey === 'string' ? metaTemplate.templateKey.trim() : ''
        if (key) keys.add(key)
      }
    }
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => visit(child))
    }
  }

  detections.forEach(visit)
  return keys
}

/**
 * Builds a component type entry for database insertion.
 */
function buildComponentTypeEntry({
  websiteId,
  canonical,
  reason,
  timestamp,
  detectionStats
}: {
  websiteId: string
  canonical: string
  reason: string
  timestamp: string
  detectionStats?: { maxConfidence: number; occurrences: number }
}): Prisma.WebsiteComponentTypeCreateManyInput {
  const category = resolveCategoryForCanonicalType(canonical) ?? ComponentCategory.Content
  const contractMetadata = getCanonicalContractMetadata(canonical)

  const defaultConfig = {
    variant: (contractMetadata as unknown as { defaultVariant?: string })?.defaultVariant ?? 'default',
    responsive: {
      mobile: {},
      tablet: {},
      desktop: {}
    }
  } as Prisma.InputJsonValue

  const aiMetadata = buildSeedAiMetadata({
    canonicalType: canonical,
    source: reason as 'template-required' | 'detected-canonical',
    createdAt: timestamp,
    detectionConfidence: detectionStats?.maxConfidence,
    detectionOccurrences: detectionStats?.occurrences,
    summary: contractMetadata?.summary,
    contractAiMetadata: contractMetadata?.aiMetadata
  }) as Prisma.InputJsonValue

  const confidence =
    typeof detectionStats?.maxConfidence === 'number'
      ? Math.min(1, Math.max(0.5, detectionStats.maxConfidence))
      : reason === 'template-required'
        ? 0.6
        : 0.5

  return {
    websiteId,
    type: canonical,
    category,
    defaultConfig,
    placeholderData: {} as Prisma.InputJsonValue,
    styles: {} as Prisma.InputJsonValue,
    aiMetadata,
    confidence
  }
}
