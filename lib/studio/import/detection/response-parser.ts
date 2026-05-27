import { applyTemplateCanonicalization } from './canonicalization'
import type { ComponentPattern, DetectedComponent, DetectedPageTemplate, InvalidDetectedComponent, PageMetadata, ParserRepairNote } from './types'
import type { PageCatalogSummary } from '@/lib/studio/ai/page-catalog'
import { ConfidenceConfig } from '../config'
import { normalizePath } from '../utils/path-utils'
import {
  clampConfidence,
  sanitizeReason,
  ensureHomeEligible,
  isTemplateRouteEligible
} from '../services/page-builder/template-resolver'
import { normalizeComponentContent } from '../services/page-builder/component-helpers'
import { isFatalNormalizationWarning } from '../services/page-builder/normalization-telemetry'
import { getComponentContractByCanonicalType } from '@/lib/studio/components/catalog/component-contracts'
import { cmsComponentFactory } from '@/lib/studio/components/cms/_factory/factory'
import { classifySectionIntent } from './section-taxonomy'

// Use centralized confidence threshold
const HIGH_CONFIDENCE = ConfidenceConfig.highConfidence

interface ParseDetectionInput {
  rawResponse: string
  availableComponents: ComponentPattern[]
  pageSummary: PageCatalogSummary
  url: string
  confidenceThreshold: number
}

interface ParseDetectionOutput {
  components: DetectedComponent[]
  pageTemplate: DetectedPageTemplate
  pageMetadata?: PageMetadata
  accuracy: number
}

interface ParseSectionDetectionInput {
  rawResponse: string
  sectionKey: string
  availableComponents: ComponentPattern[]
  url: string
  confidenceThreshold: number
  allowMissingSectionKey?: boolean
  isolateInvalidComponents?: boolean
}

interface ParseSectionDetectionOutput {
  sectionKey: string
  components: DetectedComponent[]
  pageMetadata?: PageMetadata
  invalidComponents?: InvalidDetectedComponent[]
  parserRepairs?: ParserRepairNote[]
}

type RawTemplateCandidate = {
  templateKey?: string
  confidence?: number
  reason?: string
}

type RawParsedItem = {
  component: string
  confidence: number
  content: Record<string, unknown>
  location?: string
  [key: string]: unknown
}

/**
 * Parsed detection response with typed fields.
 */
interface ParsedDetectionResponse {
  contentByField: Map<string, RawParsedItem[]>
  pageMetadata?: PageMetadata
  pageTemplate: RawTemplateCandidate
}

function deriveContentFieldNames(pageSummary: PageCatalogSummary): string[] {
  const fieldNames = new Set<string>()
  for (const template of pageSummary.templates) {
    const schema = template.contentSchema
    if (!schema) continue
    for (const key of Object.keys(schema)) {
      fieldNames.add(key)
    }
  }
  if (fieldNames.size === 0) {
    fieldNames.add('components')
  }
  return Array.from(fieldNames)
}

export function parseDetectionResponse({
  rawResponse,
  availableComponents,
  pageSummary,
  url,
  confidenceThreshold
}: ParseDetectionInput): ParseDetectionOutput {
  const contentFieldNames = deriveContentFieldNames(pageSummary)
  const { contentByField, pageMetadata, pageTemplate } = parseCombinedDetectionResponse(
    rawResponse,
    contentFieldNames
  )
  const primaryField = contentFieldNames[0]
  const primaryContent = contentByField.get(primaryField) ?? []
  const detectedComponents = parseComponentsArray(primaryContent, availableComponents, confidenceThreshold, url)
  const resolvedTemplate = resolvePageTemplate(pageTemplate, pageSummary, url)
  const canonicalComponents = applyTemplateCanonicalization({
    components: detectedComponents,
    template: resolvedTemplate,
    pageSummary,
    availableComponents,
    pageUrl: url,
    pageMetadata
  })
  const accuracy = calculateAccuracy(canonicalComponents, availableComponents)

  return {
    components: canonicalComponents,
    pageTemplate: resolvedTemplate,
    pageMetadata,
    accuracy
  }
}

export function parseSectionDetectionResponse({
  rawResponse,
  sectionKey,
  availableComponents,
  url,
  confidenceThreshold,
  allowMissingSectionKey = false,
  isolateInvalidComponents = false
}: ParseSectionDetectionInput): ParseSectionDetectionOutput {
  const raw = JSON.parse(rawResponse)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Section detection response must be a JSON object')
  }

  const responseObject = raw as Record<string, unknown>
  const hasSectionKey = Object.prototype.hasOwnProperty.call(responseObject, 'sectionKey')
  if ((!hasSectionKey && !allowMissingSectionKey) || (hasSectionKey && responseObject.sectionKey !== sectionKey)) {
    throw new Error(`Section detection response sectionKey must be "${sectionKey}"`)
  }
  if (!Array.isArray(responseObject.components)) {
    throw new Error('Section detection response components must be an array')
  }

  const pageMetadata =
    responseObject.pageMetadata && typeof responseObject.pageMetadata === 'object' && !Array.isArray(responseObject.pageMetadata)
      ? responseObject.pageMetadata as PageMetadata
      : undefined

  const parsedComponents = parseComponentsArrayDetailed(
    responseObject.components as RawParsedItem[],
    availableComponents,
    confidenceThreshold,
    url,
    { isolateInvalidContent: isolateInvalidComponents }
  )

  return {
    sectionKey,
    components: parsedComponents.components,
    pageMetadata,
    ...(parsedComponents.invalidComponents.length > 0 ? { invalidComponents: parsedComponents.invalidComponents } : {}),
    ...(parsedComponents.parserRepairs.length > 0 ? { parserRepairs: parsedComponents.parserRepairs } : {})
  }
}

function parseCombinedDetectionResponse(
  response: string,
  contentFieldNames: string[]
): ParsedDetectionResponse {
  const contentByField = new Map<string, RawParsedItem[]>()

  const register = (field: string, value: unknown) => {
    if (!Array.isArray(value)) {
      throw new Error(`Detection response field "${field}" must be an array`)
    }
    contentByField.set(field, value as RawParsedItem[])
  }

  const raw = JSON.parse(response)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Detection response must be a JSON object')
  }

  const responseObject = raw as Record<string, unknown>
  for (const field of contentFieldNames) {
    if (Object.prototype.hasOwnProperty.call(responseObject, field)) {
      register(field, responseObject[field])
    }
  }

  if (contentByField.size === 0) {
    throw new Error(`Detection response must include one of: ${contentFieldNames.join(', ')}`)
  }

  const rawPageTemplate = responseObject.pageTemplate
  if (!rawPageTemplate || typeof rawPageTemplate !== 'object' || Array.isArray(rawPageTemplate)) {
    throw new Error('Detection response must include pageTemplate object')
  }
  const pageTemplate = rawPageTemplate as RawTemplateCandidate
  if (typeof pageTemplate.templateKey !== 'string' || pageTemplate.templateKey.trim().length === 0) {
    throw new Error('Detection response pageTemplate.templateKey must be a non-empty string')
  }

  const pageMetadata =
    responseObject.pageMetadata && typeof responseObject.pageMetadata === 'object' && !Array.isArray(responseObject.pageMetadata)
      ? responseObject.pageMetadata as PageMetadata
      : undefined

  return {
    contentByField,
    pageMetadata,
    pageTemplate
  }
}

function parseComponentsArray(
  parsed: RawParsedItem[],
  availableComponents: ComponentPattern[],
  confidenceThreshold: number,
  pageUrl?: string
): DetectedComponent[] {
  return parseComponentsArrayDetailed(parsed, availableComponents, confidenceThreshold, pageUrl).components
}

function parseComponentsArrayDetailed(
  parsed: RawParsedItem[],
  availableComponents: ComponentPattern[],
  confidenceThreshold: number,
  pageUrl?: string,
  options: { isolateInvalidContent?: boolean } = {}
): { components: DetectedComponent[]; invalidComponents: InvalidDetectedComponent[]; parserRepairs: ParserRepairNote[] } {
  const validComponents: DetectedComponent[] = []
  const invalidComponents: InvalidDetectedComponent[] = []
  const parserRepairs: ParserRepairNote[] = []
  const componentMap = new Map(availableComponents.map(c => [c.type, c]))
  for (let index = 0; index < parsed.length; index++) {
    const item = parsed[index]

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Detection response components[${index}] must be an object`)
    }

    const componentName = item.component
    const confidence = item.confidence
    const content = item.content

    if (typeof componentName !== 'string' || componentName.trim().length === 0) {
      throw new Error(`Detection response components[${index}].component must be a non-empty string`)
    }
    if (typeof confidence !== 'number' || !Number.isFinite(confidence)) {
      throw new Error(`Detection response components[${index}].confidence must be a finite number`)
    }
    if (confidence < confidenceThreshold) {
      continue
    }
    let pattern = componentMap.get(componentName) ||
      availableComponents.find(c => c.type.toLowerCase() === String(componentName).toLowerCase())
    if (!pattern) {
      throw new Error(`Detection response components[${index}].component "${componentName}" is not registered`)
    }
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      if (options.isolateInvalidContent) {
        invalidComponents.push({
          index,
          component: componentName,
          type: pattern.type,
          reason: `Detection response components[${index}].content must be an object`
        })
        continue
      }
      throw new Error(`Detection response components[${index}].content must be an object`)
    }

    const taxonomy = classifySectionIntent({
      componentType: pattern.type,
      content,
      pageUrl
    })
    if (taxonomy.deniedTypes.includes(pattern.type)) {
      throw new Error(
        `Detection response components[${index}].component "${componentName}" conflicts with section taxonomy: intent=${taxonomy.intent}; denied=${taxonomy.deniedTypes.join(',')}; evidence=${taxonomy.evidence.join('|') || 'none'}`
      )
    }
    let validatedContent: Record<string, unknown>
    try {
      validatedContent = validateDetectedComponentContent({
        index,
        componentName,
        canonicalType: pattern.type,
        content,
        pageUrl
      })
    } catch (error) {
      if (options.isolateInvalidContent) {
        const duplicateEmptyCardGridRepair = getDuplicateEmptyCardGridRepair({
          index,
          componentName,
          canonicalType: pattern.type,
          content,
          validComponents
        })
        if (duplicateEmptyCardGridRepair) {
          parserRepairs.push(duplicateEmptyCardGridRepair)
          continue
        }
        invalidComponents.push({
          index,
          component: componentName,
          type: pattern.type,
          reason: error instanceof Error ? error.message : String(error)
        })
        continue
      }
      throw error
    }

    validComponents.push({
      component: componentName,
      type: pattern.type as DetectedComponent['type'],
      confidence,
      content: validatedContent,
      location: inferLocationFromType(pattern.type),
      metadata: {
        ...(pattern.metadata as DetectedComponent['metadata']),
        sectionIntent: taxonomy.intent,
        sectionIntentEvidence: taxonomy.evidence
      } as DetectedComponent['metadata']
    })
  }
  return { components: validComponents, invalidComponents, parserRepairs }
}

function getDuplicateEmptyCardGridRepair({
  index,
  componentName,
  canonicalType,
  content,
  validComponents
}: {
  index: number
  componentName: string
  canonicalType: string
  content: Record<string, unknown>
  validComponents: DetectedComponent[]
}): ParserRepairNote | null {
  if (canonicalType !== 'card-grid') {
    return null
  }

  if (!Array.isArray(content.cards) || content.cards.length > 0) {
    return null
  }

  const sourceHeading = extractComparableHeading(content)
  if (!sourceHeading || sourceHeading.length < 8 || sourceHeading.split(' ').length < 2) {
    return null
  }

  const duplicateSibling = validComponents.find(component => extractComparableHeading(component.content) === sourceHeading)
  if (!duplicateSibling) {
    return null
  }

  return {
    index,
    component: componentName,
    type: canonicalType,
    action: 'drop_duplicate_empty_card_grid',
    reason: `Dropped empty card-grid because required cards were missing and valid sibling ${duplicateSibling.type} already represents heading "${sourceHeading}".`
  }
}

function extractComparableHeading(content: Record<string, unknown>): string {
  const value = typeof content.heading === 'string'
    ? content.heading
    : typeof content.title === 'string'
      ? content.title
      : ''

  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function validateDetectedComponentContent({
  index,
  componentName,
  canonicalType,
  content,
  pageUrl
}: {
  index: number
  componentName: string
  canonicalType: string
  content: Record<string, unknown>
  pageUrl?: string
}): Record<string, unknown> {
  const contract = getComponentContractByCanonicalType(canonicalType)
  const { content: normalizedContent, warnings } = normalizeComponentContent(content, {
    parentCanonicalType: canonicalType,
    pageUrl
  })
  const fatalWarnings = warnings.filter(isFatalNormalizationWarning)
  if (fatalWarnings.length > 0) {
    const rendered = fatalWarnings.slice(0, 5).map(warning => {
      const field = warning.field ?? warning.childType ?? 'unknown'
      return `${field}:${warning.issue}`
    })
    const remainder = fatalWarnings.length > rendered.length ? `; ... ${fatalWarnings.length - rendered.length} more` : ''
    throw new Error(
      `Detection response components[${index}].content is invalid for component "${componentName}" (${canonicalType}): ${rendered.join('; ')}${remainder}`
    )
  }

  const allowedKeys = contract?.propsMeta ? new Set(Object.keys(contract.propsMeta)) : undefined
  const unsupportedFields = allowedKeys
    ? Object.keys(normalizedContent).filter(field => !allowedKeys.has(field))
    : []
  if (unsupportedFields.length > 0) {
    throw new Error(
      `Detection response components[${index}].content is invalid for component "${componentName}" (${canonicalType}): ${unsupportedFields
        .map(field => `${field}:unknown-field`)
        .join('; ')}`
    )
  }

  const schema = contract?.componentType
    ? cmsComponentFactory.getRegistry().get(contract.componentType)?.schema
    : undefined
  const validation = schema?.safeParse(normalizedContent)
  if (validation && !validation.success) {
    const rendered = validation.error.issues.slice(0, 5).map(issue => {
      const field = issue.path.length > 0 ? issue.path.join('.') : 'content'
      return `${field}:${issue.code}`
    })
    const remainder = validation.error.issues.length > rendered.length ? `; ... ${validation.error.issues.length - rendered.length} more` : ''
    throw new Error(
      `Detection response components[${index}].content is invalid for component "${componentName}" (${canonicalType}): ${rendered.join('; ')}${remainder}`
    )
  }

  return validation?.success ? validation.data : normalizedContent
}

function inferLocationFromType(type: string): DetectedComponent['location'] {
  const typeLower = type.toLowerCase()
  if (typeLower.includes('nav') || typeLower.includes('header')) return 'header'
  if (typeLower.includes('hero')) return 'hero'
  if (typeLower.includes('footer')) return 'footer'
  return 'main'
}

function calculateAccuracy(
  detected: DetectedComponent[],
  available: ComponentPattern[]
): number {
  if (detected.length === 0 || available.length === 0) return 0
  const highConfidence = detected.filter(d => d.confidence >= HIGH_CONFIDENCE).length
  return Math.min(1, highConfidence / Math.min(detected.length, 10))
}

function resolvePageTemplate(
  candidate: RawTemplateCandidate,
  pageSummary: PageCatalogSummary,
  url: string
): DetectedPageTemplate {
  const path = normalizePath(url)
  const registry = new Map(pageSummary.templates.map(template => [template.templateKey, template]))

  let key: string | undefined
  let reason: string | undefined
  let source: 'model' = 'model'
  let rawConfidence: number | undefined

  if (typeof candidate.templateKey === 'string') {
    key = candidate.templateKey.trim()
  }
  if (typeof candidate.reason === 'string') {
    reason = candidate.reason.trim()
  }
  if (typeof candidate.confidence === 'number') {
    rawConfidence = candidate.confidence
  }

  if (key && registry.has(key)) {
    const template = registry.get(key)!
    const adjustedKey = ensureHomeEligible(key, path, pageSummary)
    if (adjustedKey !== key) {
      throw new Error(`Detection response pageTemplate.templateKey "${key}" is not eligible for home path ${path}`)
    }
    if (!isTemplateRouteEligible(template, path)) {
      throw new Error(`Detection response pageTemplate.templateKey "${key}" is not route-eligible for path ${path}`)
    }
    key = adjustedKey
  } else {
    throw new Error(
      key
        ? `Detection response pageTemplate.templateKey "${key}" is not registered`
        : 'Detection response pageTemplate.templateKey is required'
    )
  }

  const confidence = clampConfidence(rawConfidence)

  return {
    templateKey: key!,
    confidence,
    reason: sanitizeReason(reason),
    source
  }
}

export const detectionParserInternals = {
  parseCombinedDetectionResponse,
  parseComponentsArray,
  parseComponentsArrayDetailed,
  parseSectionDetectionResponse,
  resolvePageTemplate,
  validateDetectedComponentContent,
  calculateAccuracy
}
