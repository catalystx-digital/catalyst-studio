import type { DetectionPromptPayload } from './types'
import type { DetectionTelemetry } from '../telemetry/detection-telemetry'
import { filterPageContentCandidateTypes } from './candidate-types'
import { classifyRouteIntent } from './section-taxonomy'

type ComponentCatalogModule = typeof import('@/lib/studio/ai/component-catalog')
type PageCatalogModule = typeof import('@/lib/studio/ai/page-catalog')
type SchemaBuilderModule = typeof import('@/lib/studio/ai/prompt-schema-builder')
type ContractBuilderModule = typeof import('@/lib/studio/ai/prompt-contract-builder')

type SummariesResult = {
  componentCatalog: ComponentCatalogModule
  pageCatalog: PageCatalogModule
  contractBuilder: ContractBuilderModule
  schemaBuilder: SchemaBuilderModule
  componentSummary: Awaited<ReturnType<ComponentCatalogModule['getComponentCatalogSummary']>>
  pageSummary: Awaited<ReturnType<PageCatalogModule['getPageCatalogSummary']>>
  schemaSummary: Awaited<ReturnType<SchemaBuilderModule['buildPromptSchemaSummary']>>
  contractBundle: Awaited<ReturnType<ContractBuilderModule['buildPromptContractBundle']>>
  cacheKey: string
  cacheHit: boolean
}

interface BuildDetectionPromptOptions {
  telemetry?: DetectionTelemetry
  pageUrl?: string
  candidateTypes?: Iterable<string>
  mode?: 'full' | 'section'
  model?: string
  provider?: string
}

interface BuildFillPromptOptions extends Omit<BuildDetectionPromptOptions, 'mode'> {
  mode?: 'fill'
}

const PROMPT_CACHE_TTL_MS = 60_000
const PROMPT_CACHE_MAX_ENTRIES = 100

let cachedSummaries: {
  key: string
  timestamp: number
} | null = null

const promptCache = new Map<string, {
  payload: DetectionPromptPayload
  pagePromptLength: number
  timestamp: number
}>()

function buildCacheKey(
  componentSummary: SummariesResult['componentSummary'],
  pageSummary: SummariesResult['pageSummary'],
  schemaSummary: SummariesResult['schemaSummary'],
  contractBundle: SummariesResult['contractBundle']
): string {
  return [
    componentSummary.generatedAt,
    componentSummary.total,
    pageSummary.generatedAt,
    pageSummary.templates.length,
    schemaSummary.schemaHash,
    contractBundle.hash
  ].join('|')
}

const BASE_COMPONENT_TYPES = new Set([
  'navbar',
  'footer',
  'breadcrumbs',
  'hero-simple',
  'hero-banner',
  'hero-carousel',
  'hero-split',
  'hero-with-image',
  'text-block',
  'html-block',
  'two-column',
  'card-grid',
  'cta-simple',
  'cta-banner',
  'cta-with-form',
  'feature-grid',
  'feature-list',
  'statistics',
  'testimonials',
  'logo-cloud',
  'content-feed',
  'simple-form',
  'image-gallery'
])

const HOME_COMPONENT_TYPES = new Set([
  'navbar',
  'footer',
  'hero-carousel',
  'hero-with-image',
  'hero-simple',
  'text-block',
  'two-column',
  'card-grid',
  'cta-banner',
  'cta-with-form',
  'feature-grid',
  'feature-list',
  'statistics',
  'testimonials',
  'logo-cloud',
  'content-feed'
])

const ROUTE_COMPONENT_HINTS: Array<{ pattern: RegExp; types: string[] }> = [
  { pattern: /(?:^|[-/\s])(?:about|company|team|people|who[-\s]?we[-\s]?are)(?:$|[-/\s])/, types: ['about-section', 'team-grid', 'statistics', 'timeline', 'logo-cloud', 'testimonials'] },
  { pattern: /(?:^|[-/\s])(?:contact|locations?|find[-\s]?us|get[-\s]?in[-\s]?touch)(?:$|[-/\s])/, types: ['contact-form', 'contact-info', 'location-map', 'simple-form', 'cta-with-form'] },
  { pattern: /(?:^|[-/\s])(?:services?|solutions?|capabilities|what[-\s]?we[-\s]?do)(?:$|[-/\s])/, types: ['feature-grid', 'feature-list', 'feature-showcase', 'feature-comparison', 'statistics', 'accordion'] },
  { pattern: /(?:^|[-/\s])(?:portfolio|work|our[-\s]?work|case[-\s]?stud(?:y|ies)|clients?)(?:$|[-/\s])/, types: ['card-grid', 'logo-cloud', 'testimonials', 'reviews'] },
  { pattern: /(?:^|[-/\s])(?:blog|news|insights?|articles?|posts?)(?:$|[-/\s])/, types: ['blog-list', 'blog-post', 'article-header', 'author-bio', 'related-posts', 'content-feed'] },
  { pattern: /(?:^|[-/\s])(?:pricing|plans?|packages?)(?:$|[-/\s])/, types: ['pricing-table', 'pricing-card', 'feature-comparison', 'faq', 'accordion'] }
]

function normalizeCandidateText(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isRootUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    const path = parsed.pathname.replace(/\/+$/, '')
    return path === ''
  } catch {
    const normalized = value.trim().replace(/[?#].*$/, '').replace(/\/+$/, '')
    return normalized === '' || normalized === '/'
  }
}

function collectCandidateTypes(pageUrl: string | undefined, componentSummary: SummariesResult['componentSummary']): Set<string> | null {
  if (!pageUrl) {
    return null
  }

  const text = normalizeCandidateText(pageUrl)
  const selected = new Set(isRootUrl(pageUrl) ? HOME_COMPONENT_TYPES : BASE_COMPONENT_TYPES)

  for (const hint of ROUTE_COMPONENT_HINTS) {
    if (hint.pattern.test(text)) {
      hint.types.forEach(type => selected.add(type))
    }
  }

  for (const component of componentSummary.components) {
    const haystack = normalizeCandidateText([
      component.type,
      component.category,
      component.summary,
      component.description,
      ...(component.keywords ?? []),
      ...(component.patterns ?? [])
    ].filter(Boolean).join(' '))

    if (text.split(/\s+/).some(token => token.length >= 4 && haystack.includes(token))) {
      selected.add(component.type)
    }
  }

  const routeTaxonomy = classifyRouteIntent(pageUrl)
  routeTaxonomy.allowedTypes.forEach(type => selected.add(type))
  routeTaxonomy.deniedTypes.forEach(type => selected.delete(type))

  return selected
}

function filterPromptInputs(
  componentSummary: SummariesResult['componentSummary'],
  schemaSummary: SummariesResult['schemaSummary'],
  contractBundle: SummariesResult['contractBundle'],
  selectedTypes: Set<string> | null
): {
  componentSummary: SummariesResult['componentSummary']
  schemaSummary: SummariesResult['schemaSummary']
  contractBundle: SummariesResult['contractBundle']
  selectedTypes: Set<string> | null
} {
  if (!selectedTypes) {
    return { componentSummary, schemaSummary, contractBundle, selectedTypes }
  }

  const available = new Set(componentSummary.components.map(component => component.type))
  const selectedAvailable = new Set(filterPageContentCandidateTypes(selectedTypes).filter(type => available.has(type)))
  if (selectedAvailable.size === 0) {
    throw new Error('Detection candidate selection produced no registered component types')
  }

  const allowedSubcomponents = new Set<string>()
  const selectedContracts = contractBundle.components.filter(component => selectedAvailable.has(component.type))
  for (const component of selectedContracts) {
    for (const field of component.fields) {
      field.allowedTypes?.forEach(type => allowedSubcomponents.add(type))
    }
  }
  for (const [subcomponentType, usage] of Object.entries(contractBundle.subcomponentUsage)) {
    if (usage.some(entry => selectedAvailable.has(entry.component))) {
      allowedSubcomponents.add(subcomponentType)
    }
  }
  if (
    allowedSubcomponents.size === 0 &&
    selectedContracts.some(component => component.fields.some(field => /content|array/i.test(field.type)))
  ) {
    contractBundle.subcomponents.forEach(component => allowedSubcomponents.add(component.type))
  }

  const selectedSubcomponents = new Set(
    contractBundle.subcomponents
      .filter(component => allowedSubcomponents.has(component.type))
      .map(component => component.type)
  )

  const filteredComponents = componentSummary.components.filter(component => selectedAvailable.has(component.type))
  const filteredSubComponents = componentSummary.subComponents.filter(component => selectedSubcomponents.has(component.type))

  return {
    selectedTypes: selectedAvailable,
    componentSummary: {
      ...componentSummary,
      total: filteredComponents.length,
      components: filteredComponents,
      categories: componentSummary.categories
        .map(category => ({
          ...category,
          components: category.components.filter(component => selectedAvailable.has(component.type))
        }))
        .filter(category => category.components.length > 0),
      topLevelTypes: componentSummary.topLevelTypes.filter(type => selectedAvailable.has(type)),
      subComponentTypes: componentSummary.subComponentTypes.filter(type => selectedSubcomponents.has(type)),
      subComponents: filteredSubComponents
    },
    schemaSummary: {
      ...schemaSummary,
      components: schemaSummary.components.filter(component => selectedAvailable.has(component.type)),
      subcomponents: schemaSummary.subcomponents.filter(component => selectedSubcomponents.has(component.type))
    },
    contractBundle: {
      ...contractBundle,
      components: selectedContracts,
      subcomponents: contractBundle.subcomponents.filter(component => selectedSubcomponents.has(component.type)),
      subcomponentUsage: Object.fromEntries(
        Object.entries(contractBundle.subcomponentUsage)
          .filter(([type]) => selectedSubcomponents.has(type))
          .map(([type, usage]) => [
            type,
            usage
              .filter(entry => selectedAvailable.has(entry.component))
              .map(entry => ({
                ...entry,
                fields: [...entry.fields]
              }))
          ])
          .filter(([, usage]) => usage.length > 0)
      )
    }
  }
}

async function resolveSummaries(telemetry?: DetectionTelemetry): Promise<SummariesResult> {
  const loadSummaries = async () => {
    const [componentCatalog, pageCatalog, schemaBuilder, contractBuilder] = await Promise.all([
      import('@/lib/studio/ai/component-catalog'),
      import('@/lib/studio/ai/page-catalog'),
      import('@/lib/studio/ai/prompt-schema-builder'),
      import('@/lib/studio/ai/prompt-contract-builder')
    ])

    const [componentSummary, pageSummary, schemaSummary, contractBundle] = await Promise.all([
      componentCatalog.getComponentCatalogSummary(),
      pageCatalog.getPageCatalogSummary(),
      schemaBuilder.buildPromptSchemaSummary(),
      contractBuilder.buildPromptContractBundle()
    ])

    const cacheKey = buildCacheKey(componentSummary, pageSummary, schemaSummary, contractBundle)
    const cacheHit = Boolean(
      cachedSummaries &&
      cachedSummaries.key === cacheKey &&
      Date.now() - cachedSummaries.timestamp < PROMPT_CACHE_TTL_MS
    )
    cachedSummaries = {
      key: cacheKey,
      timestamp: Date.now()
    }

    return {
      componentCatalog,
      pageCatalog,
      schemaBuilder,
      contractBuilder,
      componentSummary,
      pageSummary,
      schemaSummary,
      contractBundle,
      cacheKey,
      cacheHit
    }
  }

  if (!telemetry) {
    return await loadSummaries()
  }

  return await telemetry.timePhase('contract_loading', loadSummaries, result => ({
    componentCount: result?.componentSummary.components.length ?? 0,
    templateCount: result?.pageSummary.templates.length ?? 0,
    contractHash: result?.contractBundle.hash,
    fromCache: result?.cacheHit ?? false
  }))
}

export async function buildDetectionPromptFromCatalog(
  options: BuildDetectionPromptOptions = {}
): Promise<DetectionPromptPayload> {
  const { telemetry, pageUrl, candidateTypes, mode = 'full', model = 'default', provider = 'default' } = options
  const {
    componentCatalog,
    pageCatalog,
    componentSummary: fullComponentSummary,
    pageSummary,
    schemaSummary: fullSchemaSummary,
    contractBundle: fullContractBundle,
    cacheKey
  } =
    await resolveSummaries(telemetry)

  const filtered = filterPromptInputs(
    fullComponentSummary,
    fullSchemaSummary,
    fullContractBundle,
    candidateTypes ? new Set(candidateTypes) : collectCandidateTypes(pageUrl, fullComponentSummary)
  )
  const { componentSummary, schemaSummary, contractBundle, selectedTypes } = filtered
  const promptCacheKey = selectedTypes
    ? `${cacheKey}|mode:${mode}|model:${model}|provider:${provider}|candidates:${Array.from(selectedTypes).sort().join(',')}`
    : `${cacheKey}|mode:${mode}|model:${model}|provider:${provider}`
  const cachedPrompt = promptCache.get(promptCacheKey)
  const promptCacheHit = Boolean(cachedPrompt && Date.now() - cachedPrompt.timestamp < PROMPT_CACHE_TTL_MS)

  if (promptCacheHit && cachedPrompt) {
    if (telemetry) {
      telemetry.recordPhase('prompt_build', 0, {
        promptLength: cachedPrompt.payload.prompt.length,
        pagePromptLength: cachedPrompt.pagePromptLength,
        componentCount: componentSummary.components.length,
        templateCount: pageSummary.templates.length,
        mode,
        fromCache: true
      })
    }
    return {
      prompt: cachedPrompt.payload.prompt,
      components: componentSummary.components as DetectionPromptPayload['components'],
      pageSummary
    }
  }

  const buildPrompt = async () => {
    const pagePrompt = mode === 'section' ? '' : pageCatalog.buildPageTemplatePrompt(pageSummary)
    const prompt = componentCatalog.buildDetectionPrompt(componentSummary, {
      schemaSummary,
      contractBundle,
      pagePrompt,
      pageSummary,
      mode
    })
    return { prompt, pagePromptLength: pagePrompt.length }
  }

  const promptResult = telemetry
    ? await telemetry.timePhase('prompt_build', buildPrompt, result => ({
        promptLength: result?.prompt.length ?? 0,
        pagePromptLength: result?.pagePromptLength ?? 0,
        componentCount: componentSummary.components.length,
        fullComponentCount: fullComponentSummary.components.length,
        templateCount: pageSummary.templates.length,
        schemaHash: schemaSummary.schemaHash,
        contractHash: contractBundle.hash,
        candidateTypes: selectedTypes ? Array.from(selectedTypes).sort() : undefined,
        mode,
        fromCache: false
      }))
    : await buildPrompt()

  promptCache.set(promptCacheKey, {
    payload: {
      prompt: promptResult.prompt,
      components: componentSummary.components as DetectionPromptPayload['components'],
      pageSummary
    },
    pagePromptLength: promptResult.pagePromptLength,
    timestamp: Date.now()
  })
  while (promptCache.size > PROMPT_CACHE_MAX_ENTRIES) {
    const oldestKey = promptCache.keys().next().value
    if (!oldestKey) break
    promptCache.delete(oldestKey)
  }

  return {
    prompt: promptResult.prompt,
    components: componentSummary.components as DetectionPromptPayload['components'],
    pageSummary
  }
}

function formatFillContractComponent(component: SummariesResult['componentSummary']['components'][0]): string[] {
  const lines: string[] = []
  lines.push(`- ${component.type}: ${component.description || component.summary || 'No description provided'}`)
  const properties = (component.properties ?? []).filter(property => property.name !== 'headingLevel')
  if (properties.length > 0) {
    lines.push(`  fields: ${properties.map(property => {
      const required = property.required ? 'required' : 'optional'
      const allowed = property.allowedTypes?.length ? ` allowedTypes=${property.allowedTypes.join('|')}` : ''
      const description = property.description ? ` - ${property.description}` : ''
      return `${property.name}:${property.type}:${required}${allowed}${description}`
    }).join(', ')}`)
  }
  if (component.directives?.length) {
    for (const directive of component.directives.slice(0, 14)) {
      lines.push(`  directive: ${directive}`)
    }
  }
  return lines
}

function buildMinimalFillContract(
  componentSummary: SummariesResult['componentSummary'],
  schemaHash: string,
  contractHash: string
): string {
  const lines: string[] = [
    'FILL COMPONENT CONTRACT',
    `schemaHash: ${schemaHash}`,
    `contractHash: ${contractHash}`,
    `topLevelTypes: ${componentSummary.topLevelTypes.join(', ')}`,
    'Rules:',
    '- Emit only the requested planned top-level component types.',
    '- For content[] fields, nested item type must be one of the field allowedTypes.',
    '- Never place sub-component-only types directly in the returned section components array.',
    '- Image fields use Image shape: { "src": { "mediaId": "detected:<id>", "mediaType": "image", "url": "https://..." }, "alt": "...", "originalUrl": "https://..." }.',
    '- Never flatten mediaId/mediaType/url directly onto image; they belong under image.src.',
    '- href/link fields use SmartLink shape, never a string: internal { "type": "internal", "pageId": "<stable-id>", "path": "/path" }, external { "type": "external", "url": "https://..." }, anchor { "type": "anchor", "href": "#id" }.',
    '- For same-site or relative URLs beginning with "/", use internal SmartLink and always include pageId as the stable path slug without slashes. Example "/services/digital-strategy" -> { "type": "internal", "pageId": "services-digital-strategy", "path": "/services/digital-strategy" }.',
    '- When a field is named link and contains link text, use { "text": "...", "href": <SmartLink> }; never emit link.url.',
    '- CTA buttons use { "label": "...", "href": <SmartLink>, "variant": "primary|secondary|outline" }.',
    '- Optional CTA/button fields such as secondaryButton must be omitted entirely unless the source shows a second real CTA with non-empty label and valid href.',
    '- Never emit placeholder CTA/button values: no empty label, empty pageId, empty path, empty url, "#", or copied skeleton-only href.',
    '- cta-simple requires primaryButton with a non-empty label and valid href. secondaryButton is optional; include it only for a second visible CTA.',
    '- Numeric semantic fields must stay numeric. Example: headingLevel is 1, 2, 3, 4, 5, or 6, never "h1", "h2", "h3", "h4", "h5", or "h6".',
    '- logo-cloud.logos[] items extend Image and must include id plus Image fields: { "id": "<stable-logo-id>", "src": { "mediaId": "detected:<id>", "mediaType": "image", "url": "https://..." }, "alt": "...", "originalUrl": "https://...", "href": <SmartLink optional>, "caption": "..." optional }.',
    '',
    'Top-level components:'
  ]

  for (const component of componentSummary.components) {
    lines.push(...formatFillContractComponent(component))
  }

  if (componentSummary.subComponents.length > 0) {
    lines.push('', 'Nested sub-components:')
    for (const component of componentSummary.subComponents) {
      lines.push(...formatFillContractComponent({
        ...component,
        category: 'subcomponent',
        keywords: [],
        patterns: [],
        confidence: 1
      }))
    }
  }

  return lines.join('\n')
}

export async function buildFillPromptFromCatalog(
  options: BuildFillPromptOptions = {}
): Promise<DetectionPromptPayload> {
  const { telemetry, pageUrl, candidateTypes, model = 'default', provider = 'default' } = options
  const {
    componentSummary: fullComponentSummary,
    pageSummary,
    schemaSummary: fullSchemaSummary,
    contractBundle: fullContractBundle,
    cacheKey
  } = await resolveSummaries(telemetry)

  const filtered = filterPromptInputs(
    fullComponentSummary,
    fullSchemaSummary,
    fullContractBundle,
    candidateTypes ? new Set(candidateTypes) : collectCandidateTypes(pageUrl, fullComponentSummary)
  )
  const { componentSummary, schemaSummary, contractBundle, selectedTypes } = filtered
  const promptCacheKey = selectedTypes
    ? `${cacheKey}|mode:fill|minimal|model:${model}|provider:${provider}|candidates:${Array.from(selectedTypes).sort().join(',')}`
    : `${cacheKey}|mode:fill|minimal|model:${model}|provider:${provider}`
  const cachedPrompt = promptCache.get(promptCacheKey)
  const promptCacheHit = Boolean(cachedPrompt && Date.now() - cachedPrompt.timestamp < PROMPT_CACHE_TTL_MS)

  if (promptCacheHit && cachedPrompt) {
    telemetry?.recordPhase('prompt_build', 0, {
      promptLength: cachedPrompt.payload.prompt.length,
      pagePromptLength: 0,
      componentCount: componentSummary.components.length,
      templateCount: pageSummary.templates.length,
      mode: 'fill',
      minimalFillContract: true,
      fromCache: true
    })
    return cachedPrompt.payload
  }

  const buildPrompt = async () => ({
    prompt: buildMinimalFillContract(componentSummary, schemaSummary.schemaHash, contractBundle.hash),
    pagePromptLength: 0
  })

  const promptResult = telemetry
    ? await telemetry.timePhase('prompt_build', buildPrompt, result => ({
        promptLength: result?.prompt.length ?? 0,
        pagePromptLength: 0,
        componentCount: componentSummary.components.length,
        fullComponentCount: fullComponentSummary.components.length,
        templateCount: pageSummary.templates.length,
        schemaHash: schemaSummary.schemaHash,
        contractHash: contractBundle.hash,
        candidateTypes: selectedTypes ? Array.from(selectedTypes).sort() : undefined,
        mode: 'fill',
        minimalFillContract: true,
        fromCache: false
      }))
    : await buildPrompt()

  const payload = {
    prompt: promptResult.prompt,
    components: componentSummary.components as DetectionPromptPayload['components'],
    pageSummary
  }
  promptCache.set(promptCacheKey, {
    payload,
    pagePromptLength: 0,
    timestamp: Date.now()
  })
  while (promptCache.size > PROMPT_CACHE_MAX_ENTRIES) {
    const oldestKey = promptCache.keys().next().value
    if (!oldestKey) break
    promptCache.delete(oldestKey)
  }

  return payload
}
