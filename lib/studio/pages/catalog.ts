import { pageTemplateFactory } from './_factory/page-factory'
import { initializePageTemplates } from './_factory/initialize'
import {
  PageTemplateCategory,
  PageTemplateAIMetadata,
  PageTemplatePropsMeta,
  PageTemplateRegionConfig,
  PageTemplateRegistration,
  PageTemplateContentSchema
} from './_core/types'
import type { TemplateCanonicalRule, TemplateDetectionGuidance, TemplateRegionPolicy } from './_core/manifest'

export interface PageCatalogTemplateSummary {
  templateKey: string
  name: string
  category: PageTemplateCategory
  isHomeEligible: boolean
  description: string
  requiredRegions: PageTemplateRegionConfig[]
  optionalRegions: PageTemplateRegionConfig[]
  propsMeta?: PageTemplatePropsMeta
  contentSchema?: PageTemplateContentSchema
  childContainment?: string[]
  aiMetadata: PageTemplateAIMetadata
  canonical?: TemplateCanonicalRule[]
  detectionGuidance?: TemplateDetectionGuidance[]
  regionPolicies?: TemplateRegionPolicy[]
}

export interface PageCatalogCategorySummary {
  category: PageTemplateCategory
  templates: PageCatalogTemplateSummary[]
}

export interface PageCatalogSummary {
  total: number
  generatedAt: string
  templates: PageCatalogTemplateSummary[]
  categories: PageCatalogCategorySummary[]
  homeEligibleTemplates: string[]
}

const CACHE_TTL = 60_000
let cachedSummary: PageCatalogSummary | null = null
let cacheTimestamp = 0

function cloneRegions(regions: PageTemplateRegionConfig[] | undefined): PageTemplateRegionConfig[] {
  if (!regions) {
    return []
  }
  return regions.map(region => ({
    ...region,
    allowedComponents: [...region.allowedComponents]
  }))
}

function clonePropsMeta(propsMeta: PageTemplatePropsMeta | undefined): PageTemplatePropsMeta | undefined {
  if (!propsMeta) {
    return undefined
  }
  // Schema-first: propsMeta is already derived from schema or legacy propsMeta
  return Object.fromEntries(
    Object.entries(propsMeta).map(([key, meta]) => [
      key,
      {
        ...meta,
        allowedComponentTypes: meta.allowedComponentTypes ? [...meta.allowedComponentTypes] : undefined,
        allowedValues: meta.allowedValues ? [...meta.allowedValues] : undefined
      }
    ])
  )
}

function cloneContentSchema(
  contentSchema: PageTemplateContentSchema | undefined
): PageTemplateContentSchema | undefined {
  if (!contentSchema) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(contentSchema).map(([key, meta]) => [
      key,
      {
        ...meta,
        allowedComponentTypes: meta.allowedComponentTypes ? [...meta.allowedComponentTypes] : undefined
      }
    ])
  )
}

function cloneCanonicalRules(rules: TemplateCanonicalRule[] | undefined): TemplateCanonicalRule[] | undefined {
  if (!rules) {
    return undefined
  }
  return rules.map(rule => ({
    ...rule,
    allowedCanonicals: rule.allowedCanonicals ? [...rule.allowedCanonicals] : undefined,
    hints: rule.hints ? [...rule.hints] : undefined,
    metadata: rule.metadata ? { ...rule.metadata } : undefined
  }))
}

function cloneDetectionGuidance(guidance: TemplateDetectionGuidance[] | undefined): TemplateDetectionGuidance[] | undefined {
  if (!guidance) {
    return undefined
  }
  return [...guidance]
}

function cloneRegionPolicies(policies: TemplateRegionPolicy[] | undefined): TemplateRegionPolicy[] | undefined {
  if (!policies) {
    return undefined
  }
  return policies.map(policy => ({
    ...policy,
    allowedRegions: policy.allowedRegions ? [...policy.allowedRegions] : undefined,
    metadata: policy.metadata ? { ...policy.metadata } : undefined
  }))
}

function normalizeTemplate(registration: PageTemplateRegistration): PageCatalogTemplateSummary {
  const manifest = pageTemplateFactory.getManifest(registration.templateKey)
  const canonical = cloneCanonicalRules(manifest?.canonical)
  const detectionGuidance = cloneDetectionGuidance(manifest?.detectionGuidance)
  const regionPolicies = cloneRegionPolicies(manifest?.regionPolicies)

  return {
    templateKey: registration.templateKey,
    name: registration.name,
    category: registration.category,
    isHomeEligible: registration.isHomeEligible,
    description: registration.description,
    requiredRegions: cloneRegions(registration.requiredRegions),
    optionalRegions: cloneRegions(registration.optionalRegions),
    propsMeta: clonePropsMeta(registration.propsMeta),
    contentSchema: cloneContentSchema(registration.contentSchema),
    childContainment: registration.childContainment ? [...registration.childContainment] : undefined,
    aiMetadata: {
      ...registration.aiMetadata,
      keywords: [...registration.aiMetadata.keywords],
      layoutGuidelines: [...registration.aiMetadata.layoutGuidelines],
      contentGuidelines: registration.aiMetadata.contentGuidelines
        ? [...registration.aiMetadata.contentGuidelines]
        : undefined,
      recommendedComponents: registration.aiMetadata.recommendedComponents
        ? [...registration.aiMetadata.recommendedComponents]
        : undefined,
      discouragedComponents: registration.aiMetadata.discouragedComponents
        ? [...registration.aiMetadata.discouragedComponents]
        : undefined,
      exampleUseCases: registration.aiMetadata.exampleUseCases
        ? [...registration.aiMetadata.exampleUseCases]
        : undefined,
      routeHints: registration.aiMetadata.routeHints ? [...registration.aiMetadata.routeHints] : undefined
    },
    canonical,
    detectionGuidance,
    regionPolicies
  }
}
function computeCategories(templates: PageCatalogTemplateSummary[]): PageCatalogCategorySummary[] {
  const map = new Map<PageTemplateCategory, PageCatalogTemplateSummary[]>()
  for (const template of templates) {
    const existing = map.get(template.category) || []
    existing.push(template)
    map.set(template.category, existing)
  }
  return Array.from(map.entries()).map(([category, items]) => ({
    category,
    templates: items
  }))
}

export async function getPageCatalogSummary(forceRefresh = false): Promise<PageCatalogSummary> {
  const now = Date.now()
  if (!forceRefresh && cachedSummary && now - cacheTimestamp < CACHE_TTL) {
    return cachedSummary
  }

  await initializePageTemplates()
  const templates = pageTemplateFactory.listTemplates().map(normalizeTemplate)
  const summary: PageCatalogSummary = {
    total: templates.length,
    generatedAt: new Date().toISOString(),
    templates,
    categories: computeCategories(templates),
    homeEligibleTemplates: templates.filter(t => t.isHomeEligible).map(t => t.templateKey)
  }

  cachedSummary = summary
  cacheTimestamp = now
  return summary
}

export function clearPageCatalogCache(): void {
  cachedSummary = null
  cacheTimestamp = 0
}
