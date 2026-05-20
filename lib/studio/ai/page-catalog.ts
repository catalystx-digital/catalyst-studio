import { PageTemplateCategory } from '@/lib/studio/pages/_core/types'
import {
  getPageCatalogSummary,
  type PageCatalogSummary,
  type PageCatalogTemplateSummary
} from '@/lib/studio/pages/catalog'

export interface BuildPageTemplatePromptOptions {
  maxTemplatesPerCategory?: number
  maxRegionsPerTemplate?: number
  maxAllowedComponentsPerRegion?: number
  maxPropsPerTemplate?: number
}

function normalizeHint(hint: string): string {
  if (!hint) return '/'
  let normalized = hint.trim()
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized || '/'
}

function formatRegionList(
  regions: PageCatalogTemplateSummary['requiredRegions'],
  limit: number,
  maxAllowed: number
): string {
  if (!regions || regions.length === 0) {
    return 'none'
  }
  return regions
    .slice(0, limit)
    .map(region => {
      const allowed = region.allowedComponents.slice(0, maxAllowed).join(', ') || 'none'
      const suffix = region.allowedComponents.length > maxAllowed ? ', ...' : ''
      const min = typeof region.min === 'number' ? ` min=${region.min}` : ''
      const max = typeof region.max === 'number' ? ` max=${region.max}` : ''
      return `${region.region} -> [${allowed}${suffix}]${min}${max}`
    })
    .join(' | ')
}

function formatOptionalRegions(
  regions: PageCatalogTemplateSummary['optionalRegions'],
  limit: number,
  maxAllowed: number
): string {
  if (!regions || regions.length === 0) {
    return 'none'
  }
  return regions
    .slice(0, limit)
    .map(region => {
      const allowed = region.allowedComponents.slice(0, maxAllowed).join(', ') || 'none'
      const suffix = region.allowedComponents.length > maxAllowed ? ', ...' : ''
      return `${region.region} -> [${allowed}${suffix}]`
    })
    .join(' | ')
}

function formatProps(
  propsMeta: PageCatalogTemplateSummary['propsMeta'],
  limit: number
): string {
  if (!propsMeta) {
    return 'none'
  }
  // Schema-first: propsMeta is already derived from schema or legacy propsMeta
  const entries = Object.entries(propsMeta)
  if (entries.length === 0) {
    return 'none'
  }
  return entries
    .slice(0, limit)
    .map(([key, meta]) => {
      const required = meta.required ? 'required' : 'optional'
      const allowedTypes = meta.allowedComponentTypes && meta.allowedComponentTypes.length > 0
        ? ` allowedTypes=[${meta.allowedComponentTypes.join(', ')}]`
        : ''
      const allowedValues = meta.allowedValues && meta.allowedValues.length > 0
        ? ` values=[${meta.allowedValues.join(', ')}]`
        : ''
      return `${key}: ${meta.type} (${required}${allowedTypes}${allowedValues})`
    })
    .join(' | ')
}

function formatContentSchema(
  contentSchema: PageCatalogTemplateSummary['contentSchema'],
  limit: number,
  maxAllowed: number
): string {
  if (!contentSchema) {
    return 'none'
  }

  const entries = Object.entries(contentSchema)
  if (entries.length === 0) {
    return 'none'
  }

  return entries
    .slice(0, limit)
    .map(([key, meta]) => {
      const required = meta.required ? 'required' : 'optional'
      const allowedTypes = meta.allowedComponentTypes ?? []
      const allowedPreview = allowedTypes.slice(0, maxAllowed)
      const overflow = allowedTypes.length > maxAllowed ? ', ...' : ''
      const allowedLabel = allowedPreview.length > 0
        ? ` allowedTypes=[${allowedPreview.join(', ')}${overflow}]`
        : ''
      return `${key}: ${meta.type} (${required}${allowedLabel})`
    })
    .join(' | ')
}

function formatRouteHints(template: PageCatalogTemplateSummary): string {
  const hints = template.aiMetadata.routeHints || []
  if (hints.length === 0) {
    return 'none'
  }
  return hints.map(normalizeHint).join(', ')
}

function formatTemplateEntry(
  template: PageCatalogTemplateSummary,
  options: Required<BuildPageTemplatePromptOptions>
): string[] {
  const lines: string[] = []
  lines.push(`- ${template.templateKey} (${template.name})`)
  lines.push(`  Category: ${template.category} | Home eligible: ${template.isHomeEligible ? 'yes' : 'no'}`)
  lines.push(
    `  Required regions: ${formatRegionList(template.requiredRegions, options.maxRegionsPerTemplate, options.maxAllowedComponentsPerRegion)}`
  )
  lines.push(
    `  Optional regions: ${formatOptionalRegions(template.optionalRegions, options.maxRegionsPerTemplate, options.maxAllowedComponentsPerRegion)}`
  )
  lines.push(`  Template props: ${formatProps(template.propsMeta, options.maxPropsPerTemplate)}`)
  lines.push(
    `  Content schema: ${formatContentSchema(template.contentSchema, options.maxPropsPerTemplate, options.maxAllowedComponentsPerRegion)}`
  )
  const layoutGuidelines = template.aiMetadata.layoutGuidelines.slice(0, 2)
  if (layoutGuidelines.length > 0) {
    lines.push(`  Layout tips: ${layoutGuidelines.join(' | ')}`)
  }
  const contentGuidelines = template.aiMetadata.contentGuidelines?.slice(0, 1) || []
  if (contentGuidelines.length > 0) {
    lines.push(`  Content tip: ${contentGuidelines.join(' | ')}`)
  }
  const recommended = template.aiMetadata.recommendedComponents?.slice(0, 4) || []
  if (recommended.length > 0) {
    lines.push(`  Recommended components: ${recommended.join(', ')}`)
  }
  const discouraged = template.aiMetadata.discouragedComponents?.slice(0, 3) || []
  if (discouraged.length > 0) {
    lines.push(`  Discouraged components: ${discouraged.join(', ')}`)
  }
  lines.push(`  Route hints: ${formatRouteHints(template)}`)
  return lines
}

export function buildPageTemplatePrompt(
  summary: PageCatalogSummary,
  options: BuildPageTemplatePromptOptions = {}
): string {
  const resolved: Required<BuildPageTemplatePromptOptions> = {
    maxTemplatesPerCategory: options.maxTemplatesPerCategory ?? 3,
    maxRegionsPerTemplate: options.maxRegionsPerTemplate ?? 3,
    maxAllowedComponentsPerRegion: options.maxAllowedComponentsPerRegion ?? 6,
    maxPropsPerTemplate: options.maxPropsPerTemplate ?? 4
  }

  const lines: string[] = []
  lines.push('=== PAGE TEMPLATE OVERVIEW ===')
  lines.push(`Templates available: ${summary.total}`)
  if (summary.homeEligibleTemplates.length > 0) {
    lines.push(`Home-eligible template keys: ${summary.homeEligibleTemplates.join(', ')}`)
  }
  lines.push('')
  lines.push('SELECTION RULES:')
  lines.push('- You MUST set pageTemplate.templateKey to one of the registered keys above.')
  lines.push('- When analyzing the site root (path `/`), choose a template marked home eligible.')
  lines.push('- Match required regions and allowed components to the detected layout before selecting a template.')
  lines.push('- Use routeHints to inform template selection when URLs include category cues (e.g., /blog -> blog templates).')
  lines.push('- Provide a short justification in pageTemplate.reason mentioning the strongest signals (hero type, layout, URL, etc.).')
  lines.push('')

  for (const categoryEntry of summary.categories) {
    lines.push(`Category: ${categoryEntry.category} (${categoryEntry.templates.length} templates)`)
    const slice = categoryEntry.templates.slice(0, resolved.maxTemplatesPerCategory)
    for (const template of slice) {
      lines.push(...formatTemplateEntry(template, resolved))
    }
    if (categoryEntry.templates.length > slice.length) {
      lines.push(`  ...and ${categoryEntry.templates.length - slice.length} more templates in this category.`)
    }
    lines.push('')
  }

  lines.push('OUTPUT REQUIREMENT: Include the selected template under a `pageTemplate` object with fields { templateKey, confidence, reason }.')

  return lines.join('\n')
}

export { getPageCatalogSummary }
export type { PageCatalogSummary, PageCatalogTemplateSummary }

