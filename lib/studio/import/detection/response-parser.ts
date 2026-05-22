import { applyTemplateCanonicalization } from './canonicalization'
import type { ComponentPattern, DetectedComponent, DetectedPageTemplate, PageMetadata } from './types'
import type { PageCatalogSummary } from '@/lib/studio/ai/page-catalog'
import { ConfidenceConfig } from '../config'
import { normalizePath } from '../utils/path-utils'
import {
  clampConfidence,
  sanitizeReason,
  ensureHomeEligible
} from '../services/page-builder/template-resolver'

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
  const validComponents: DetectedComponent[] = []
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
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      throw new Error(`Detection response components[${index}].content must be an object`)
    }
    let pattern = componentMap.get(componentName) ||
      availableComponents.find(c => c.type.toLowerCase() === String(componentName).toLowerCase())
    if (!pattern) {
      throw new Error(`Detection response components[${index}].component "${componentName}" is not registered`)
    }
    validComponents.push({
      component: componentName,
      type: pattern.type as DetectedComponent['type'],
      confidence,
      content,
      location: inferLocationFromType(pattern.type),
      metadata: pattern.metadata as DetectedComponent['metadata']
    })
  }
  return validComponents
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
    const adjustedKey = ensureHomeEligible(key, path, pageSummary)
    if (adjustedKey !== key) {
      throw new Error(`Detection response pageTemplate.templateKey "${key}" is not eligible for home path ${path}`)
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
  resolvePageTemplate,
  calculateAccuracy
}
