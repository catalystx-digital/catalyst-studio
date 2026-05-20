import { applyTemplateCanonicalization } from './canonicalization'
import {
  canonicalizeComponentType,
  getCanonicalComponent
} from './canonical'
import type { ComponentPattern, DetectedComponent, DetectedPageTemplate, PageMetadata } from './types'
import type { PageCatalogSummary } from '@/lib/studio/ai/page-catalog'
import { ConfidenceConfig } from '../config'
import { normalizePath, isHomePath } from '../utils/path-utils'
import {
  clampConfidence,
  matchTemplateByRouteHints,
  pickHomeTemplateKey,
  inferTemplateKeyFromUrl,
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

/**
 * Raw template candidate from model output.
 * Can be a string (templateKey) or an object with metadata.
 */
type RawTemplateCandidate = string | {
  templateKey?: string
  confidence?: number
  reason?: string
} | null | undefined

/**
 * Raw parsed content from model response.
 * Components may be in array format [name, confidence, content] or object format.
 */
type RawParsedItem = [string, number, Record<string, unknown>] | {
  component?: string
  type?: string
  name?: string
  confidence?: number
  score?: number
  content?: Record<string, unknown>
  data?: Record<string, unknown>
  location?: string
  [key: string]: unknown
}

/**
 * Parsed detection response with typed fields.
 */
interface ParsedDetectionResponse {
  contentByField: Map<string, RawParsedItem[]>
  pageMetadata?: PageMetadata
  pageTemplate?: RawTemplateCandidate
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
  const primaryContent = contentByField.get(primaryField)
    ?? Array.from(contentByField.values())[0]
    ?? []
  const normalizedComponents = normalizeComponentTriples(primaryContent)
  const detectedComponents = parseComponentsArray(normalizedComponents, availableComponents, confidenceThreshold, url)
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
    if (Array.isArray(value)) {
      contentByField.set(field, value)
    }
  }

  try {
    const raw = JSON.parse(response)
    for (const field of contentFieldNames) {
      register(field, (raw as Record<string, unknown>)[field])
    }
    const pageMetadata: PageMetadata | undefined = (raw as any)?.pageMetadata || undefined
    const pageTemplate = (raw as any)?.pageTemplate || undefined
    if (contentByField.size > 0 || pageMetadata || pageTemplate) {
      return { contentByField, pageMetadata, pageTemplate }
    }
  } catch {
    /* fall through */
  }

  const objString = extractAndSanitizeJsonObject(response)
  if (objString) {
    try {
      const obj = JSON.parse(objString)
      for (const field of contentFieldNames) {
        register(field, (obj as Record<string, unknown>)[field])
      }
      const pageMetadata: PageMetadata | undefined = (obj as any)?.pageMetadata || undefined
      const pageTemplate = (obj as any)?.pageTemplate || undefined
      if (contentByField.size > 0 || pageMetadata || pageTemplate) {
        return { contentByField, pageMetadata, pageTemplate }
      }
    } catch (e) {
      try {
        for (const field of contentFieldNames) {
          const arraySnippet = extractTopLevelArrayAfterKey(response, field)
          if (!arraySnippet) continue
          try {
            const arr = JSON.parse(arraySnippet)
            register(field, arr)
          } catch {
            // ignore parse failure per field
          }
        }
        const metaStr = extractTopLevelObjectAfterKey(response, 'pageMetadata')
        const templateStr = extractTopLevelObjectAfterKey(response, 'pageTemplate')
        let pageMetadata: PageMetadata | undefined
        if (metaStr) {
          try {
            pageMetadata = JSON.parse(metaStr)
          } catch {
            pageMetadata = undefined
          }
        }
        let pageTemplate: any
        if (templateStr) {
          try {
            pageTemplate = JSON.parse(templateStr)
          } catch {
            pageTemplate = templateStr
          }
        }
        return { contentByField, pageMetadata, pageTemplate }
      } catch (innerError) {
        const rawMessage = innerError instanceof Error ? innerError.message : String(innerError)
        const snippet = rawMessage.length > 240 ? rawMessage.slice(0, 237) + '...' : rawMessage
        console.warn('Failed to parse JSON object, falling back to array extraction:', snippet)
      }
    }
  }

  for (const field of contentFieldNames) {
    const arrayString = extractTopLevelArrayAfterKey(response, field) || extractAndSanitizeJsonArray(response)
    if (arrayString) {
      try {
        const arr = JSON.parse(arrayString)
        register(field, arr)
        // break after first successful parse to avoid overriding with generic fallback
        break
      } catch {
        /* ignore */
      }
    }
  }

  if (contentByField.size === 0) {
    const items = extractArrayItems(response)
    if (items.length > 0) {
      register(contentFieldNames[0], items)
    }
  }

  return { contentByField, pageMetadata: undefined, pageTemplate: undefined }
}


function normalizeComponentTriples(components: unknown[]): RawParsedItem[] {
  const normalized: RawParsedItem[] = []
  for (let index = 0; index < components.length; index++) {
    const item = components[index]
    if (typeof item === 'string') {
      const next = components[index + 1]
      const afterNext = components[index + 2]
      if (typeof next === 'number' && afterNext && typeof afterNext === 'object' && !Array.isArray(afterNext)) {
        normalized.push([item, next, afterNext as Record<string, unknown>])
        index += 2
        continue
      }
    }
    // Push as-is, parseComponentsArray will handle type validation
    normalized.push(item as RawParsedItem)
  }
  return normalized
}

const canonicalPatternFallbackCache = new Map<string, ComponentPattern>()

function resolveCanonicalPatternFallback(componentName: string): ComponentPattern | undefined {
  const canonicalType = canonicalizeComponentType(componentName)
  if (!canonicalType) {
    return undefined
  }

  const cached = canonicalPatternFallbackCache.get(canonicalType)
  if (cached) {
    return cached
  }

  const definition = getCanonicalComponent(canonicalType)
  if (!definition) {
    return undefined
  }

  const pattern: ComponentPattern = {
    type: definition.componentType ?? canonicalType,
    confidence: typeof definition.sampleContent?.confidence === 'number'
      ? Number(definition.sampleContent.confidence)
      : 0.6,
    description: definition.summary,
    metadata: {
      source: 'canonical-fallback',
      fragments: definition.fragments,
      cues: definition.cues
    }
  }

  canonicalPatternFallbackCache.set(canonicalType, pattern)
  return pattern
}

function parseComponentsArray(
  parsed: RawParsedItem[],
  availableComponents: ComponentPattern[],
  confidenceThreshold: number,
  pageUrl?: string
): DetectedComponent[] {
  try {
    const validComponents: DetectedComponent[] = []
    const componentMap = new Map(availableComponents.map(c => [c.type, c]))
    for (const item of parsed) {
      let componentName: string | undefined
      let confidence: number | undefined
      let content: Record<string, unknown> | undefined

      if (Array.isArray(item) && item.length >= 3) {
        componentName = item[0]
        confidence = item[1]
        content = item[2]
      } else if (item && typeof item === 'object' && !Array.isArray(item)) {
        const obj = item
        componentName = obj.component ?? obj.type ?? obj.name
        confidence = typeof obj.confidence === 'number' ? obj.confidence : (typeof obj.score === 'number' ? obj.score : undefined)
        if (obj.content || obj.data) {
          content = (obj.content ?? obj.data) as Record<string, unknown>
        } else {
          const structural = new Set(['component','type','name','confidence','score','location'])
          const c: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(obj)) {
            if (!structural.has(k)) c[k] = v
          }
          content = c
        }
      } else {
        continue
      }

      if (typeof componentName !== 'string') continue
      if (typeof confidence !== 'number') confidence = 0.8
      if (typeof confidence === 'number' && confidence < confidenceThreshold) continue
      let pattern = componentMap.get(componentName) ||
        availableComponents.find(c => c.type.toLowerCase() === String(componentName).toLowerCase())
      if (!pattern) {
        const fallbackPattern = resolveCanonicalPatternFallback(componentName)
        if (fallbackPattern) {
          componentMap.set(componentName, fallbackPattern)
          componentMap.set(fallbackPattern.type, fallbackPattern)
          pattern = fallbackPattern
          console.warn('[DetectionParser] Missing component pattern; using canonical fallback', {
            component: componentName,
            resolvedType: fallbackPattern.type,
            pageUrl
          })
        }
      }
      if (!pattern) continue
      const enhancedContent = enhanceContentWithDefaults(content || {}, pattern)
      validComponents.push({
        component: componentName,
        type: pattern.type as DetectedComponent['type'],
        confidence,
        content: enhancedContent,
        location: inferLocationFromType(pattern.type),
        metadata: pattern.metadata as DetectedComponent['metadata']
      })
    }
    return validComponents
  } catch (error) {
    console.error('Error parsing components array:', error)
    return []
  }
}

function enhanceContentWithDefaults(
  content: Record<string, unknown>,
  pattern: ComponentPattern
): Record<string, unknown> {
  if (!pattern.properties || !Array.isArray(pattern.properties)) {
    return content
  }

  const enhanced = { ...content }

  for (const prop of pattern.properties) {
    if (prop.required && !Object.prototype.hasOwnProperty.call(enhanced, prop.name)) {
      if (prop.type.includes('Array')) {
        enhanced[prop.name] = []
      } else if (prop.type === 'string') {
        enhanced[prop.name] = ''
      } else if (prop.type === 'number') {
        enhanced[prop.name] = 0
      } else if (prop.type === 'boolean') {
        enhanced[prop.name] = false
      } else {
        enhanced[prop.name] = null
      }
    }
  }

  try {
    const props = Array.isArray(pattern.properties) ? pattern.properties : []
    for (const p of props) {
      const t = p.type ? String(p.type).toLowerCase() : ''
      const allowed = p.allowedTypes
      if (!allowed || !Array.isArray(allowed) || allowed.length === 0) continue
      const single = allowed.length === 1 ? allowed[0] : undefined
      if (!single) continue

      const isContentArray = t.includes('content[]') || t.includes('array<content') || t.includes('array<contentreference>')
      const isContentSingle = !isContentArray && (t === 'content' || t.includes('contentreference'))

      if (isContentArray) {
        const v = enhanced[p.name]
        if (Array.isArray(v)) {
          enhanced[p.name] = v.map((el: unknown) => {
            if (el && typeof el === 'object' && !('type' in el)) {
              return { type: single, ...(el as Record<string, unknown>) }
            }
            return el
          })
        }
      } else if (isContentSingle) {
        const v = enhanced[p.name]
        if (v && typeof v === 'object' && !Array.isArray(v) && !('type' in (v as object))) {
          enhanced[p.name] = { type: single, ...(v as Record<string, unknown>) }
        }
      }
    }
  } catch {}

  if (enhanced.buttons && Array.isArray(enhanced.buttons)) {
    enhanced.buttons = enhanced.buttons.map((btn: unknown) => {
      const btnObj = btn as Record<string, unknown>
      return {
        ...btnObj,
        style: btnObj.style || 'primary'
      }
    })
  }

  if (enhanced.ctaButtons && Array.isArray(enhanced.ctaButtons)) {
    enhanced.ctaButtons = enhanced.ctaButtons.map((btn: unknown) => {
      const btnObj = btn as Record<string, unknown>
      return {
        ...btnObj,
        style: btnObj.style || 'primary'
      }
    })
  }

  return enhanced
}

function inferLocationFromType(type: string): DetectedComponent['location'] {
  const typeLower = type.toLowerCase()
  if (typeLower.includes('nav') || typeLower.includes('header')) return 'header'
  if (typeLower.includes('hero')) return 'hero'
  if (typeLower.includes('footer')) return 'footer'
  return 'main'
}

function extractAndSanitizeJsonArray(input: string): string | null {
  try {
    let s = input.trim()
    s = s.replace(/```json\s*/gi, '').replace(/```/g, '')
    s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    const start = s.indexOf('[')
    const end = s.lastIndexOf(']')
    if (start === -1 || end === -1 || end <= start) return null
    let arrayStr = s.substring(start, end + 1)
    arrayStr = arrayStr.replace(/,\s*(\]|\})/g, '$1')
    arrayStr = arrayStr.replace(/`+/g, '')
    return arrayStr
  } catch { return null }
}

function extractAndSanitizeJsonObject(input: string): string | null {
  try {
    let s = input.trim()
    s = s.replace(/```json\s*/gi, '').replace(/```/g, '')
    s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    const start = s.indexOf('{')
    const end = s.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    let objStr = s.substring(start, end + 1)
    objStr = objStr.replace(/,\s*(\]|\})/g, '$1')
    objStr = objStr.replace(/`+/g, '')
    return objStr
  } catch { return null }
}

function extractArrayItems(input: string): RawParsedItem[] {
  const items: RawParsedItem[] = []
  try {
    const s = input.replace(/```json\s*/gi, '').replace(/```/g, '')
    const re = /\[\s*"([^"]+)"\s*,\s*([0-9]+(?:\.[0-9]+)?)\s*,\s*(\{[\s\S]*?\})\s*\]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(s)) !== null) {
      const name = m[1]
      const conf = parseFloat(m[2])
      let objStr = m[3]
      objStr = objStr.replace(/,\s*(\]|\})/g, '$1')
      try { items.push([name, conf, JSON.parse(objStr) as Record<string, unknown>]) } catch {
        items.push([name, conf, {}])
      }
    }
  } catch { /* ignore */ }
  return items
}

function extractTopLevelArrayAfterKey(input: string, key: string): string | null {
  const re = new RegExp(`"${key}"\\s*:\\s*\\[`, 'i')
  const m = re.exec(input)
  if (!m) return null
  let start = (m.index + m[0].length) - 1
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < input.length; i++) {
    const ch = input[i]
    if (inStr) {
      if (esc) { esc = false } else if (ch === '\\') { esc = true } else if (ch === '"') { inStr = false }
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === '[') { if (depth === 0) start = i; depth++ }
    else if (ch === ']') { depth--; if (depth === 0) return input.slice(start, i + 1) }
  }
  return null
}

function extractTopLevelObjectAfterKey(input: string, key: string): string | null {
  const re = new RegExp(`"${key}"\\s*:\\s*\\{`, 'i')
  const m = re.exec(input)
  if (!m) return null
  let start = (m.index + m[0].length) - 1
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < input.length; i++) {
    const ch = input[i]
    if (inStr) {
      if (esc) { esc = false } else if (ch === '\\') { esc = true } else if (ch === '"') { inStr = false }
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === '{') { if (depth === 0) start = i; depth++ }
    else if (ch === '}') { depth--; if (depth === 0) return input.slice(start, i + 1) }
  }
  return null
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
  let source: 'model' | 'fallback' = 'model'
  let rawConfidence: number | undefined

  if (typeof candidate === 'string') {
    key = candidate.trim()
  } else if (candidate && typeof candidate === 'object') {
    if (typeof candidate.templateKey === 'string') {
      key = candidate.templateKey.trim()
    }
    if (typeof candidate.reason === 'string') {
      reason = candidate.reason.trim()
    }
    if (typeof candidate.confidence === 'number') {
      rawConfidence = candidate.confidence
    }
  }

  if (key && registry.has(key)) {
    const adjustedKey = ensureHomeEligible(key, path, pageSummary)
    if (adjustedKey !== key) {
      source = 'fallback'
      reason = sanitizeReason(
        `${reason ?? ''} Selected template is not home-eligible; using ${adjustedKey}.`
      )
    }
    key = adjustedKey
  } else {
    source = 'fallback'
    const fallbackKey = inferTemplateKeyFromUrl(path, pageSummary)
    reason = sanitizeReason(
      key
        ? `Template ${key} is not registered; fell back to ${fallbackKey}.`
        : `Model omitted template; heuristically selected ${fallbackKey}.`
    )
    key = fallbackKey
    if (rawConfidence === undefined) {
      rawConfidence = 0
    }
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
