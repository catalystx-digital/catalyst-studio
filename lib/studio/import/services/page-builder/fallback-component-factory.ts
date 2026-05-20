import type { ComponentInstance, ComponentType, DetectionResult, PageData } from '../interfaces'
import type { PageTemplateRegionConfig } from '@/lib/studio/pages/_core/types'
import { toCmsComponentType } from './component-helpers'
import { ComponentType as CmsComponentType } from '@/lib/studio/components/cms/_core/types'
import { getFallbackComponentTypes } from '@/lib/studio/components/cms/_core/definition-loader'

interface FallbackFactoryDeps {
  canonicalizeComponentType: (value: string | undefined | null) => string | undefined
  generateComponentId: (type: string, index: number) => string
  extractComponentProps: (detection: DetectionResult, componentType: ComponentType) => Record<string, any>
  derivePlacementBucket: (region: string) => string
  generatePageTitle: (pageData: PageData) => string
}

interface CreateFallbackComponentInstanceOptions {
  regionConfig: PageTemplateRegionConfig
  componentTypes: ComponentType[]
  pageData: PageData
  insertionIndex: number
  deps: FallbackFactoryDeps
}

export function createFallbackComponentInstance({
  regionConfig,
  componentTypes,
  pageData,
  insertionIndex,
  deps
}: CreateFallbackComponentInstanceOptions): ComponentInstance | null {
  const SUPPORTED_FALLBACK_TYPES = getFallbackComponentTypes()
  const allowed = regionConfig.allowedComponents || []
  if (allowed.length === 0) {
    return null
  }

  const typeIndex = new Map<string, ComponentType>()
  for (const type of componentTypes) {
    const canonical = deps.canonicalizeComponentType(type.type)
    if (canonical && !typeIndex.has(canonical)) {
      typeIndex.set(canonical, type)
    }
  }

  const preferredOrder = allowed
    .map(value => deps.canonicalizeComponentType(typeof value === 'string' ? value : String(value)))
    .filter((value): value is string => Boolean(value))

  let selectedCanonical: string | undefined
  let selectedType: ComponentType | undefined

  for (const canonical of preferredOrder) {
    if (SUPPORTED_FALLBACK_TYPES.has(canonical)) {
      const matched = typeIndex.get(canonical)
      if (matched) {
        selectedCanonical = canonical
        selectedType = matched
        break
      }
    }
  }

  if (!selectedType || !selectedCanonical) {
    return null
  }

  const canonicalType = selectedCanonical
  const cmsComponentType =
    toCmsComponentType(canonicalType) ?? toCmsComponentType(selectedType.type)

  switch (selectedCanonical) {
    case 'text-block':
      return buildTextBlockFallback({
        selectedType,
        canonicalType,
        cmsComponentType,
        regionConfig,
        pageData,
        insertionIndex,
        deps
      })
    case 'blog-post':
      return buildBlogPostFallback({
        selectedType,
        canonicalType,
        cmsComponentType,
        regionConfig,
        pageData,
        insertionIndex,
        deps
      })
    case 'navbar':
      return buildNavbarFallback({
        selectedType,
        canonicalType,
        cmsComponentType,
        regionConfig,
        pageData,
        insertionIndex,
        deps
      })
    case 'footer':
      return buildFooterFallback({
        selectedType,
        canonicalType,
        cmsComponentType,
        regionConfig,
        pageData,
        insertionIndex,
        deps
      })
    default:
      return null
  }
}

interface FallbackBuilderParams {
  selectedType: ComponentType
  canonicalType: string
  cmsComponentType?: CmsComponentType
  regionConfig: PageTemplateRegionConfig
  pageData: PageData
  insertionIndex: number
  deps: FallbackFactoryDeps
}

function buildTextBlockFallback({
  selectedType,
  regionConfig,
  pageData,
  insertionIndex,
  deps,
  cmsComponentType
}: FallbackBuilderParams): ComponentInstance {
  const heading = (pageData.title || '').trim() || 'Additional information'
  const description = pageData.metadata?.description?.trim()
  const body = description
    ? `<p>${escapeHtml(description)}</p>`
    : `<p>${escapeHtml(`Imported from ${pageData.url}`)}</p>`

  const detectionContent = {
    region: regionConfig.region,
    heading,
    body,
    fallback: true
  }

  const componentId = deps.generateComponentId(selectedType.type, insertionIndex)
  const detection: DetectionResult = {
    id: componentId,
    type: selectedType.type,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    content: detectionContent,
    metadata: {
      region: regionConfig.region,
      source: 'fallback',
      addedBy: 'PageBuilderService.ensureRequiredRegionCoverage'
    }
  }

  const props = deps.extractComponentProps(detection, selectedType)
  props.region = regionConfig.region
  props.placementBucket = deps.derivePlacementBucket(regionConfig.region)
  const metadata = props.metadata && typeof props.metadata === 'object' ? props.metadata : {}
  metadata.region = regionConfig.region
  metadata.source = 'fallback'
  metadata.addedBy = 'PageBuilderService.ensureRequiredRegionCoverage'
  props.metadata = metadata

  if (cmsComponentType) {
    (props as Record<string, unknown>).type = cmsComponentType
  }

  return {
    id: componentId,
    type: selectedType.type,
    typeId: (selectedType as any).id,
    componentType: cmsComponentType,
    componentTypeId: (selectedType as any).id,
    parentId: null,
    position: insertionIndex,
    props
  }
}

function buildNavbarFallback({
  selectedType,
  regionConfig,
  pageData,
  insertionIndex,
  deps,
  cmsComponentType
}: FallbackBuilderParams): ComponentInstance {
  const brand = deps.generatePageTitle(pageData)
  const detectionContent = {
    region: regionConfig.region,
    menuItems: [],
    logo: { text: brand },
    metadata: {
      region: regionConfig.region,
      source: 'fallback',
      addedBy: 'PageBuilderService.ensureRequiredRegionCoverage',
      fallbackReason: 'missing-required-navbar'
    }
  }

  const componentId = deps.generateComponentId(selectedType.type, insertionIndex)
  const detection: DetectionResult = {
    id: componentId,
    type: selectedType.type,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    content: detectionContent,
    metadata: {
      region: regionConfig.region,
      source: 'fallback',
      addedBy: 'PageBuilderService.ensureRequiredRegionCoverage',
      fallbackReason: 'missing-required-navbar'
    }
  }

  const props = deps.extractComponentProps(detection, selectedType)
  props.region = regionConfig.region
  props.placementBucket = deps.derivePlacementBucket(regionConfig.region)
  const metadata = props.metadata && typeof props.metadata === 'object' ? props.metadata : {}
  metadata.region = regionConfig.region
  metadata.source = 'fallback'
  metadata.addedBy = 'PageBuilderService.ensureRequiredRegionCoverage'
  metadata.fallbackReason = 'missing-required-navbar'
  props.metadata = metadata

  if (cmsComponentType) {
    (props as Record<string, unknown>).type = cmsComponentType
  }

  return {
    id: componentId,
    type: selectedType.type,
    typeId: (selectedType as any).id,
    componentType: cmsComponentType,
    componentTypeId: (selectedType as any).id,
    parentId: null,
    position: insertionIndex,
    props
  }
}

function buildFooterFallback({
  selectedType,
  regionConfig,
  pageData,
  insertionIndex,
  deps,
  cmsComponentType
}: FallbackBuilderParams): ComponentInstance {
  const brand = deps.generatePageTitle(pageData)
  const currentYear = new Date().getFullYear()
  const description = pageData.metadata?.description?.trim()
  const detectionContent = {
    region: regionConfig.region,
    columns: [],
    description,
    copyright: `© ${currentYear} ${brand}`,
    legalLinks: [],
    metadata: {
      region: regionConfig.region,
      source: 'fallback',
      addedBy: 'PageBuilderService.ensureRequiredRegionCoverage',
      fallbackReason: 'missing-required-footer'
    }
  }

  const componentId = deps.generateComponentId(selectedType.type, insertionIndex)
  const detection: DetectionResult = {
    id: componentId,
    type: selectedType.type,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    content: detectionContent,
    metadata: {
      region: regionConfig.region,
      source: 'fallback',
      addedBy: 'PageBuilderService.ensureRequiredRegionCoverage',
      fallbackReason: 'missing-required-footer'
    }
  }

  const props = deps.extractComponentProps(detection, selectedType)
  props.region = regionConfig.region
  props.placementBucket = deps.derivePlacementBucket(regionConfig.region)
  const metadata = props.metadata && typeof props.metadata === 'object' ? props.metadata : {}
  metadata.region = regionConfig.region
  metadata.source = 'fallback'
  metadata.addedBy = 'PageBuilderService.ensureRequiredRegionCoverage'
  metadata.fallbackReason = 'missing-required-footer'
  props.metadata = metadata

  if (cmsComponentType) {
    (props as Record<string, unknown>).type = cmsComponentType
  }

  return {
    id: componentId,
    type: selectedType.type,
    typeId: (selectedType as any).id,
    componentType: cmsComponentType,
    componentTypeId: (selectedType as any).id,
    parentId: null,
    position: insertionIndex,
    props
  }
}

function buildBlogPostFallback({
  selectedType,
  regionConfig,
  pageData,
  insertionIndex,
  deps,
  cmsComponentType
}: FallbackBuilderParams): ComponentInstance {
  const title = (pageData.title || '').trim() || 'Imported Article'
  const description = pageData.metadata?.description?.trim()
  const excerpt = description ? truncate(description, 220) : undefined
  const bodyHtml = description
    ? `<p>${escapeHtml(description)}</p>`
    : `<p>${escapeHtml(`Imported from ${pageData.url}`)}</p>`

  const openGraph = pageData.metadata?.openGraph || {}
  const heroImage = resolveHeroImage(openGraph)
  const author = resolveAuthor(openGraph)
  const publishDate = selectFirstString([
    (openGraph as any)?.publishedTime,
    (openGraph as any)?.publishDate,
    (openGraph as any)['article:published_time']
  ])

  const detectionContent = {
    region: regionConfig.region,
    title,
    excerpt,
    bodyHtml,
    bodyText: description,
    sourceUrl: pageData.url,
    heroImage,
    author,
    publishDate,
    metadata: {
      region: regionConfig.region,
      source: 'fallback',
      addedBy: 'PageBuilderService.ensureRequiredRegionCoverage',
      fallbackReason: 'missing-required-blog-post'
    }
  }

  const componentId = deps.generateComponentId(selectedType.type, insertionIndex)
  const detection: DetectionResult = {
    id: componentId,
    type: selectedType.type,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    content: detectionContent,
    metadata: {
      region: regionConfig.region,
      source: 'fallback',
      addedBy: 'PageBuilderService.ensureRequiredRegionCoverage'
    }
  }

  const props = deps.extractComponentProps(detection, selectedType)
  props.region = regionConfig.region
  props.placementBucket = deps.derivePlacementBucket(regionConfig.region)
  const metadata = props.metadata && typeof props.metadata === 'object' ? props.metadata : {}
  metadata.region = regionConfig.region
  metadata.source = 'fallback'
  metadata.addedBy = 'PageBuilderService.ensureRequiredRegionCoverage'
  metadata.fallbackReason = 'missing-required-blog-post'
  props.metadata = metadata

  if (cmsComponentType) {
    (props as Record<string, unknown>).type = cmsComponentType
  }

  return {
    id: componentId,
    type: selectedType.type,
    typeId: (selectedType as any).id,
    componentType: cmsComponentType,
    componentTypeId: (selectedType as any).id,
    parentId: null,
    position: insertionIndex,
    props
  }
}

function resolveHeroImage(openGraph: Record<string, any>): Record<string, any> | undefined {
  const raw = openGraph && (openGraph.image ?? (Array.isArray(openGraph.images) ? openGraph.images[0] : undefined))
  if (!raw) {
    return undefined
  }
  if (typeof raw === 'string') {
    return { src: raw }
  }
  if (typeof raw === 'object') {
    const src = selectFirstString([raw.url, raw.src, raw.href])
    if (src) {
      return {
        src,
        alt: selectFirstString([raw.alt, raw.caption, raw.title])
      }
    }
  }
  return undefined
}

function resolveAuthor(openGraph: Record<string, any>): Record<string, any> | undefined {
  const name = selectFirstString([
    openGraph && openGraph.author,
    openGraph && openGraph.creator,
    openGraph ? openGraph['article:author'] : undefined
  ])
  if (!name) {
    return undefined
  }
  return { name }
}

function selectFirstString(values: any[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return undefined
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 3)}...`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
