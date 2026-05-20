import { ComponentType, DetectionResult } from '../interfaces'
import { normalizeMenuItems } from '@/lib/studio/components/cms/navigation/utils/menu-items'
import { ComponentType as CmsComponentType } from '@/lib/studio/components/cms/_core/types'
import { generateComponentId as generateUniqueComponentId } from '@/lib/studio/components/cms/_core/utils'
import { getComponentContractByCanonicalType } from '@/lib/studio/components/catalog/component-contracts'
import {
  recordNormalizationWarning,
  type NormalizationIssueCode
} from './normalization-telemetry'
import { cmsComponentFactory } from '@/lib/studio/components/cms/_factory/factory'

// ============================================================================
// Type Definitions for Component Helpers
// ============================================================================

/**
 * Valid component region values.
 */
type ComponentRegion = 'header' | 'hero' | 'main' | 'footer'

/**
 * Extended DetectionResult with optional metadata fields used in this module.
 */
interface ExtendedDetectionResult extends DetectionResult {
  pageUrl?: string
  location?: ComponentRegion
  metadata?: DetectionMetadata
}

/**
 * Detection metadata structure.
 */
interface DetectionMetadata {
  region?: string
  summary?: string
  [key: string]: unknown
}

/**
 * Props meta entry from component contracts or registry.
 */
interface PropsMetaEntry {
  type: string
  required: boolean
  allowedTypes?: string[]
}

/**
 * Registry entry from CMS component factory.
 */
interface RegistryEntry {
  propsMeta?: Record<string, PropsMetaEntry>
  [key: string]: unknown
}

/**
 * Extended component props with known optional fields.
 */
interface ExtendedComponentProps extends Record<string, unknown> {
  confidence?: number
  metadata?: DetectionMetadata
  text?: string
  content?: unknown
  styles?: Record<string, unknown>
  region?: ComponentRegion
  menuItemCount?: string
  linkCount?: string
  buttonCount?: string
  hasLogo?: boolean
  hasSearch?: boolean
  hasForm?: boolean
  hasSubscribe?: boolean
  formFieldTypes?: string[]
  semanticTokens?: string[]
  styleTokens?: string[]
}

/**
 * Parsed content structure with common fields.
 */
interface ParsedContent extends Record<string, unknown> {
  region?: string
  metadata?: DetectionMetadata
  variant?: string
  menuItems?: unknown[]
  items?: unknown[]
  links?: unknown[]
  buttons?: unknown[]
  ctaButtons?: unknown[]
  logo?: unknown
  logoUrl?: string
  logoSrc?: string
  search?: unknown
  searchBox?: unknown
  hasSearch?: boolean
  form?: unknown
  forms?: unknown
  formFields?: string[]
  subscribe?: unknown
  newsletter?: unknown
  title?: string
  label?: string
  text?: string
  summary?: string
}
import {
  SUBCOMPONENT_NORMALIZERS,
  expandSourceRecord,
  normalizeImage,
  type NormalizedImageValue
} from './subcomponent-normalizers'

// Import extracted utilities from component-helpers subdirectory
import {
  clampSummary,
  extractSummaryFromJsonString,
  extractFirstSentence,
  STOP_WORDS,
  normalizeString,
  containsHtmlTags,
  stripHtmlToText,
  convertPlainTextToHtml,
  normalizeBooleanFlag,
  isRecord
} from './component-helpers/string-utils'

// Note: normalizeComponentRegionValue, normalizeTokenList, normalizeCmsComponentKey, ComponentRegion
// are defined locally in this file (not imported) to preserve existing behavior
// The canonical-types.ts module has similar but slightly different implementations

// Import normalizers from decomposed modules
import {
  COMPONENT_CONTENT_NORMALIZERS,
  extractLinkUrl,
  pruneObjectAgainstContract,
  type LocalNormalizationWarning,
  type ComponentContentNormalizer
} from './component-helpers/normalizers'

// Re-export escapeHtml for backwards compatibility (it's exported from this file)
export { escapeHtml } from './component-helpers/string-utils'

const FALLBACK_CONTENT_META: Record<string, Record<string, { type: string; required: boolean; allowedTypes?: string[] }>> = {
  'card-grid': {
    heading: { type: 'string', required: false },
    subheading: { type: 'string', required: false },
    cards: {
      type: 'content[]',
      required: true,
      allowedTypes: ['card-item', 'promo-item']
    },
    columns: { type: 'string', required: false },
    gap: { type: 'string', required: false },
    cardStyle: { type: 'string', required: false },
    imagePosition: { type: 'string', required: false },
    imageAspectRatio: { type: 'string', required: false },
    filters: {
      type: 'content[]',
      required: false,
      allowedTypes: ['filter-chip']
    }
  }
}

// Note: LocalNormalizationWarning, ComponentContentNormalizer, extractLinkUrl,
// and pruneObjectAgainstContract are now imported from ./component-helpers/normalizers
// isRecord, normalizeString, etc. are imported from ./component-helpers/string-utils.ts

// Helper functions (normalizeOverlayOpacityValue, isLikelyColorOrGradient, normalizeHeroBackgroundFocalPoint,
// isValuePresent, pruneObjectAgainstContract) have been moved to ./component-helpers/normalizers/shared-normalizer-utils.ts

// collectHeroCtaPayloads and normalizeHeroSimpleBackground have been moved to
// ./component-helpers/normalizers/hero-normalizers.ts

// === REMAINING INLINE NORMALIZERS TO BE REMOVED ===
// The following functions have been moved to the normalizers module:
// - normalizeHeroSimpleContent -> hero-normalizers.ts
// - normalizeHeroWithImageContent -> hero-normalizers.ts
// - normalizeVideoEmbedContent -> media-normalizers.ts
// - normalizeNavbarContent -> nav-normalizers.ts
// - normalizeTimelineContent -> content-normalizers.ts
// - normalizeCtaWithFormContent -> cta-normalizers.ts
// - normalizeTextBlockContent -> content-normalizers.ts
// - normalizeContentFeedContent -> content-normalizers.ts
// - normalizeBlogPostContent -> blog-normalizers.ts
// - normalizeArticleHeaderContent -> blog-normalizers.ts
// - normalizeCtaSimpleContent -> cta-normalizers.ts
// - normalizeTwoColumnContent -> content-normalizers.ts

// TODO: Remove the remaining inline normalizer code below once verified

// All inline normalizer functions have been moved to ./component-helpers/normalizers/
// See normalizers/index.ts for the mapping

// COMPONENT_CONTENT_NORMALIZERS is now imported from ./component-helpers/normalizers

function normalizeComponentContent(
  content: Record<string, unknown>,
  options: {
    parentCanonicalType: string
    pageUrl?: string
  }
): { content: Record<string, unknown>; warnings: LocalNormalizationWarning[] } {
  const warnings: LocalNormalizationWarning[] = []

  // Check for a dedicated normalizer first
  const customNormalizer = COMPONENT_CONTENT_NORMALIZERS[options.parentCanonicalType]
  if (customNormalizer) {
    return customNormalizer(content as Record<string, unknown>, options)
  }

  // Fall back to contract-based normalization (propsMeta is derived from schema in contract)
  const contract = getComponentContractByCanonicalType(options.parentCanonicalType)

  // Get propsMeta from contract (derived from schema) or fallback
  let propsMetaSource: Record<string, PropsMetaEntry> | undefined = contract?.propsMeta

  if (!propsMetaSource) {
    propsMetaSource = FALLBACK_CONTENT_META[options.parentCanonicalType]
  }

  if (!propsMetaSource) {
    return { content, warnings }
  }

  const propsMetaEntries = Object.entries(propsMetaSource)
  const allowedKeys = new Set(propsMetaEntries.map(([key]) => key))
  const normalizedContent: Record<string, unknown> = {}

  for (const key of Object.keys(content)) {
    if (allowedKeys.has(key)) {
      normalizedContent[key] = content[key]
    } else {
      warnings.push({
        issue: 'unknown-field',
        message: `Removed unsupported field "${key}" from ${options.parentCanonicalType} content.`,
        field: key,
        childType: options.parentCanonicalType,
        details: { field: key }
      })
    }
  }

  for (const [field, meta] of propsMetaEntries) {
    const metaType = typeof meta?.type === 'string' ? meta.type : ''
    if (typeof metaType === 'string' && metaType.includes('content[]')) {
      const allowedTypes = Array.isArray(meta?.allowedTypes)
        ? (meta.allowedTypes as string[])
            .map(type => canonicalizeComponentType(type) ?? type)
            .filter((type): type is string => typeof type === 'string' && type.length > 0)
        : []

      const rawValue = normalizedContent[field]
      const items = Array.isArray(rawValue) ? rawValue : []

      if (!Array.isArray(rawValue) && rawValue != null) {
        warnings.push({
          issue: 'invalid-subcomponent',
          message: `Expected array for "${field}" on ${options.parentCanonicalType}.`,
          field,
          childType: options.parentCanonicalType,
          details: { fieldType: meta.type }
        })
      }

      const normalizedItems: Record<string, unknown>[] = []
      items.forEach((item, index) => {
        if (!isRecord(item)) {
          warnings.push({
            issue: 'invalid-subcomponent',
            message: `Dropped non-object entry in "${field}" (index ${index}).`,
            field,
            childType: Array.isArray(meta?.allowedTypes) ? meta.allowedTypes[0] : undefined,
            details: { index }
          })
          return
        }

        const rawType = normalizeString(item.type ?? item.component ?? item.kind)
        let canonicalChildType = rawType ? canonicalizeComponentType(rawType) ?? rawType : undefined

        if (!canonicalChildType && allowedTypes.length === 1) {
          canonicalChildType = allowedTypes[0]
        }

        if (!canonicalChildType) {
          warnings.push({
            issue: 'invalid-subcomponent',
            message: `Skipped child in "${field}" missing recognizable type.`,
            field,
            details: { index },
            childType: rawType
          })
          return
        }

        if (allowedTypes.length > 0 && !allowedTypes.includes(canonicalChildType)) {
          warnings.push({
            issue: 'unsupported-subcomponent',
            message: `Skipped unsupported child type "${canonicalChildType}" in "${field}".`,
            field,
            childType: canonicalChildType,
            details: { index, allowed: allowedTypes }
          })
          return
        }

        const normalizer = SUBCOMPONENT_NORMALIZERS[canonicalChildType]
        if (!normalizer) {
          warnings.push({
            issue: 'normalizer-missing',
            message: `No sub-component normalizer registered for "${canonicalChildType}".`,
            field,
            childType: canonicalChildType,
            details: { index }
          })
          return
        }

        const result = normalizer(item, {
          canonicalType: canonicalChildType,
          parentCanonicalType: options.parentCanonicalType,
          field,
          index,
          pageUrl: options.pageUrl
        })

        if (result.warnings.length > 0) {
          for (const childWarning of result.warnings) {
            warnings.push({
              ...childWarning,
              field,
              childType: canonicalChildType
            })
          }
        }

        if (!result.value) {
          return
        }

        const contractType = result.contractOverride ?? canonicalChildType
        const { result: pruned, warnings: pruningWarnings } = pruneObjectAgainstContract(result.value, contractType, {
          field,
          childType: canonicalChildType
        })

        if (pruningWarnings.length > 0) {
          warnings.push(...pruningWarnings)
        }

        normalizedItems.push(pruned)
      })

      normalizedContent[field] = normalizedItems
    }
  }

  const { result: prunedParent, warnings: parentWarnings } = pruneObjectAgainstContract(
    normalizedContent,
    options.parentCanonicalType,
    { childType: options.parentCanonicalType }
  )

  if (parentWarnings.length > 0) {
    warnings.push(...parentWarnings)
  }

  return { content: prunedParent, warnings }
}

function normalizeComponentRegionValue(value: unknown): ComponentRegion | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === 'header' || normalized === 'hero' || normalized === 'main' || normalized === 'footer') {
    return normalized
  }
  return undefined
}

function extractRegionFromRecord(record: Record<string, unknown> | undefined): ComponentRegion | undefined {
  if (!isRecord(record)) {
    return undefined
  }
  const direct = normalizeComponentRegionValue(record.region)
  if (direct) {
    return direct
  }
  const metadata = record.metadata as Record<string, unknown> | undefined
  const metadataRegion = isRecord(metadata)
    ? normalizeComponentRegionValue(metadata.region)
    : undefined
  return metadataRegion
}

function getDetectionRegion(detection: DetectionResult): ComponentRegion | undefined {
  const extended = detection as ExtendedDetectionResult
  return normalizeComponentRegionValue(extended.metadata?.region)
}

function applyRegionToDetection(detection: DetectionResult, region: ComponentRegion): void {
  const extended = detection as ExtendedDetectionResult
  extended.location = region
  const existingMetadata = isRecord(extended.metadata) ? extended.metadata : {}
  extended.metadata = { ...existingMetadata, region }

  if (isRecord(detection.content)) {
    const contentRecord = detection.content as Record<string, unknown>
    contentRecord.region = region
    const contentMetadata = contentRecord.metadata as Record<string, unknown> | undefined
    if (isRecord(contentMetadata)) {
      contentRecord.metadata = { ...contentMetadata, region }
    } else {
      contentRecord.metadata = { region }
    }
  }
}

function applyRegionToProps(props: Record<string, unknown> | undefined, region: ComponentRegion): void {
  if (!isRecord(props)) {
    return
  }

  props.region = region

  const propsMetadata = props.metadata as Record<string, unknown> | undefined
  if (isRecord(propsMetadata)) {
    props.metadata = { ...propsMetadata, region }
  } else {
    props.metadata = { region }
  }

  const content = props.content as Record<string, unknown> | undefined
  if (isRecord(content)) {
    content.region = region
    const contentMetadata = content.metadata as Record<string, unknown> | undefined
    if (isRecord(contentMetadata)) {
      content.metadata = { ...contentMetadata, region }
    } else {
      content.metadata = { region }
    }
  }
}

function normalizeTokenList(tokens: string[] | undefined): string[] {
  if (!Array.isArray(tokens)) {
    return []
  }
  return tokens
    .map(token => (typeof token === 'string' ? token.toLowerCase().trim() : ''))
    .filter(token => token.length > 0)
}

function shouldForceHeaderUtilityCta(tokens: string[] | undefined, props: Record<string, unknown>): boolean {
  const normalizedTokens = normalizeTokenList(tokens)
  const hasQuickExitToken = normalizedTokens.some(
    token => token.includes('quick-exit') || token.includes('quickexit') || (token.includes('quick') && token.includes('exit'))
  )
  const hasHeaderToken = normalizedTokens.some(token =>
    ['header', 'preheader', 'pre-header', 'pre-nav', 'prenav', 'topbar', 'top-bar'].includes(token)
  )
  const hasUtilityToken = normalizedTokens.some(token =>
    ['utility', 'utilities', 'utilitybar', 'utility-bar', 'utilitystrip', 'utility-strip'].includes(token)
  )
  const hasHotlineToken = normalizedTokens.some(token => token.includes('hotline') || token.includes('safety') || token.includes('violence'))

  if (hasQuickExitToken || (hasHeaderToken && (hasUtilityToken || hasHotlineToken))) {
    return true
  }

  const contentRecord = isRecord(props.content) ? (props.content as Record<string, unknown>) : undefined
  const contentHeading =
    contentRecord &&
    normalizeString(
      contentRecord.heading ??
        contentRecord.title ??
        contentRecord.eyebrow ??
        contentRecord.body
    )
  const heading = normalizeString(props.heading ?? props.title ?? props.eyebrow ?? props.body ?? contentHeading)
  if (!heading) {
    return false
  }
  const lowerHeading = heading.toLowerCase()
  return (
    lowerHeading.includes('quick exit') ||
    lowerHeading.includes('safety exit') ||
    lowerHeading.includes('leave this site') ||
    lowerHeading.includes('leave this page')
  )
}

function maybeForceHeaderUtilityCtaRegion(
  detection: DetectionResult,
  props: Record<string, unknown>,
  canonicalComponentType: string | undefined,
  semanticTokens: string[] | undefined
): void {
  if (canonicalComponentType !== 'cta-simple') {
    return
  }
  if (!shouldForceHeaderUtilityCta(semanticTokens, props)) {
    return
  }
  if (getDetectionRegion(detection) === 'header') {
    return
  }
  applyRegionToDetection(detection, 'header')
  applyRegionToProps(props, 'header')
}

/**
 * @deprecated Use the unified canonicalization module instead.
 * Import from '@/lib/studio/components/cms/_core/canonicalization'
 *
 * This function delegates to the unified implementation for backward compatibility.
 */
export function canonicalizeComponentType(value: string | undefined | null): string | undefined {
  // Import inline to avoid circular dependencies
  const { canonicalizeComponentType: unifiedCanonicalize } = require('@/lib/studio/components/cms/_core/canonicalization')
  const result = unifiedCanonicalize(value)
  // Convert null to undefined for backward compatibility
  return result !== null ? result : undefined
}

function normalizeCmsComponentKey(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

const CMS_COMPONENT_TYPE_LOOKUP: Map<string, CmsComponentType> = new Map(
  (Object.values(CmsComponentType) as string[]).map(value => [
    normalizeCmsComponentKey(value),
    value as CmsComponentType
  ])
)

function synchronizeContentToRoot(
  props: Record<string, unknown>,
  canonicalType: string,
  content: Record<string, unknown>
): void {
  if (canonicalType === 'cta-simple') {
    const stringKeys = ['heading', 'eyebrow', 'body', 'alignment', 'backgroundVariant'] as const
    for (const key of stringKeys) {
      if (key in content) {
        const value = content[key]
        if (typeof value === 'string') {
          props[key] = value.trim()
        } else if (value != null) {
          props[key] = value
        } else if (key in props) {
          delete props[key]
        }
      } else if (key in props) {
        delete props[key]
      }
    }

    if (isRecord(content.primaryButton)) {
      props.primaryButton = content.primaryButton
    } else if ('primaryButton' in props) {
      delete props.primaryButton
    }

    if (isRecord(content.secondaryButton)) {
      props.secondaryButton = content.secondaryButton
    } else if ('secondaryButton' in props) {
      delete props.secondaryButton
    }

    const fieldsToScrub = ['heading', 'body', 'eyebrow'] as const
    for (const field of fieldsToScrub) {
      const value = props[field]
      if (typeof value === 'string' && /catalyst studio/i.test(value)) {
        const replacement = typeof content[field] === 'string' ? String(content[field]).trim() : ''
        if (replacement) {
          props[field] = replacement
        } else {
          delete props[field]
        }
      }
    }
  }
}

export function toCmsComponentType(value: string | undefined | null): CmsComponentType | undefined {
  if (!value) {
    return undefined
  }
  return CMS_COMPONENT_TYPE_LOOKUP.get(normalizeCmsComponentKey(value))
}

export function generateComponentId(type: string, index: number): string {
  const sanitizedType = type.trim().replace(/\s+/g, '-').toLowerCase();
  const namespace = sanitizedType ? `cms-${sanitizedType}-${index}` : `cms-${index}`;
  return generateUniqueComponentId(namespace);
}

export function extractComponentProps(
  detection: DetectionResult,
  componentType: ComponentType
): ExtendedComponentProps {
  const props: ExtendedComponentProps = {}
  let parsedContent: ParsedContent | undefined
  let normalizedContentRegion: ComponentRegion | undefined
  let rawContentRegion: ComponentRegion | undefined
  const canonicalComponentType = canonicalizeComponentType(componentType.type) ?? componentType.type
  const extendedDetection = detection as ExtendedDetectionResult

  if (typeof detection.confidence === 'number') {
    props.confidence = detection.confidence
  }

  if (detection.metadata) {
    props.metadata = detection.metadata as DetectionMetadata
  }

  if (detection.content != null) {
    if (typeof detection.content === 'string') {
      props.text = detection.content
    } else {
      props.text = JSON.stringify(detection.content)
    }
    props.content = detection.content
    try {
      const parsed = typeof detection.content === 'string' ? JSON.parse(detection.content) : detection.content
      if (parsed && typeof parsed === 'object') {
        parsedContent = parsed as ParsedContent
        props.content = parsedContent

        if (isRecord(parsedContent)) {
          rawContentRegion = rawContentRegion ?? extractRegionFromRecord(parsedContent)
          if (canonicalComponentType) {
            const pageUrl = typeof extendedDetection.pageUrl === 'string' ? extendedDetection.pageUrl : undefined
            const { content: normalizedContent, warnings: normalizationWarnings } = normalizeComponentContent(parsedContent, {
              parentCanonicalType: canonicalComponentType,
              pageUrl
            })
            props.content = normalizedContent
            parsedContent = normalizedContent as ParsedContent
            if (normalizationWarnings.length > 0) {
              for (const warning of normalizationWarnings) {
                recordNormalizationWarning({
                  pageUrl,
                  parentType: canonicalComponentType,
                  field: warning.field,
                  childType: warning.childType,
                  issue: warning.issue,
                  message: warning.message,
                  details: warning.details
                })
              }
            }
          }
        }

        const obj = parsedContent
        const arrLen = (v: unknown): number => (Array.isArray(v) ? v.length : 0)
        const bucket = (n: number): string => (n === 0 ? '0' : n <= 3 ? '1-3' : n <= 8 ? '4-8' : '9+')
        const toTokens = (vals: unknown[]): string[] =>
          Array.from(
            new Set(
              (vals || [])
                .map(v => {
                  if (typeof v === 'string') return v
                  if (isRecord(v)) return String(v.label || v.text || '')
                  return ''
                })
                .filter(Boolean)
                .map((s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ''))
                .flatMap(s => s.split(/\s+/))
                .filter(Boolean)
                .filter(word => !STOP_WORDS.has(word))
            )
          )

        const menuItems = normalizeMenuItems((obj?.menuItems ?? obj?.items ?? []) as unknown[])
        const links = normalizeMenuItems((obj?.links ?? []) as unknown[])
        const buttons = Array.isArray(obj?.buttons)
          ? obj.buttons
          : Array.isArray(obj?.ctaButtons)
            ? obj.ctaButtons
            : []
        const hasLogo = Boolean(obj?.logo || obj?.logoUrl || obj?.logoSrc)
        const hasSearch = Boolean(obj?.search || obj?.searchBox || obj?.hasSearch)
        const hasForm = Boolean(obj?.form || obj?.forms || obj?.formFields)
        const hasSubscribe = Boolean(obj?.subscribe || obj?.newsletter)
        const formFields: string[] = Array.isArray(obj?.formFields) ? obj.formFields : []

        props.menuItemCount = bucket(arrLen(menuItems))
        props.linkCount = bucket(arrLen(links))
        props.buttonCount = bucket(arrLen(buttons))
        props.hasLogo = hasLogo
        props.hasSearch = hasSearch
        props.hasForm = hasForm
        props.hasSubscribe = hasSubscribe
        if (formFields.length > 0) {
          props.formFieldTypes = Array.from(new Set(formFields.map(f => String(f).toLowerCase())))
        }

        const semanticSources: string[] = []
        const pushIf = (value?: string) => {
          if (value && typeof value === 'string') {
            semanticSources.push(value)
          }
        }
        pushIf(obj?.title)
        pushIf(obj?.label)
        pushIf(obj?.text)
        semanticSources.push(...toTokens(menuItems))
        semanticSources.push(...toTokens(links))
        semanticSources.push(...toTokens(buttons as unknown[]))
        const semanticTokens = Array.from(new Set(semanticSources))
        props.semanticTokens = semanticTokens

        maybeForceHeaderUtilityCtaRegion(detection, props, canonicalComponentType, semanticTokens)
      }
      normalizedContentRegion = extractRegionFromRecord(parsedContent)
    } catch {
      // Ignore JSON parse errors from detection content
    }
  }

  if (parsedContent && canonicalComponentType) {
    synchronizeContentToRoot(props, canonicalComponentType, parsedContent)
  }

  if (detection.styles) {
    props.styles = detection.styles as Record<string, unknown>
    try {
      const style = detection.styles as Record<string, unknown>
      const tokens: string[] = []
      const font = style.fontFamily || style.font || style['font-family']
      if (font) {
        tokens.push(`fontFamily:${String(font).split(',')[0].replace(/['"]/g, '').trim()}`)
      }
      const color = style.primaryColor || style.color || style.backgroundColor
      if (color) {
        const col = String(color).toLowerCase()
        const bucket = col.startsWith('#') ? col.slice(0, 4) : col.includes('rgb') ? 'rgb' : col.split(/\s+/)[0]
        tokens.push(`primaryColor:${bucket}`)
      }
      const pos = style.position || style['position']
      if (typeof pos === 'string' && /(sticky|fixed)/i.test(pos)) {
        tokens.push(pos.toString().toLowerCase())
      }
      if (tokens.length > 0) {
        props.styleTokens = Array.from(new Set(tokens))
      }
    } catch {
      // Ignore style parsing errors
    }
  }

  if (
    componentType.defaultConfig &&
    typeof componentType.defaultConfig === 'object' &&
    canonicalComponentType !== 'hero-carousel'
  ) {
    const configRecord = componentType.defaultConfig as Record<string, unknown>
    const defaultProps = (isRecord(configRecord.props) ? configRecord.props : {}) as Record<string, unknown>
    // Keys that should only be merged from defaultConfig if they don't exist in props.content either.
    // This prevents sample/fallback data from contaminating actual extracted content.
    const navigationContentKeys = new Set(['menuItems', 'cta', 'logo', 'columns', 'socialLinks', 'legalLinks'])
    const contentRecord = isRecord(props.content) ? (props.content as Record<string, unknown>) : {}

    Object.keys(defaultProps).forEach(key => {
      if (key in props) {
        return // Already exists at root level, skip
      }
      // For navigation-related keys, also check if they exist in content
      if (navigationContentKeys.has(key) && key in contentRecord) {
        const contentValue = contentRecord[key]
        // Skip if content already has a non-empty array or truthy value
        if (Array.isArray(contentValue) ? contentValue.length > 0 : Boolean(contentValue)) {
          return
        }
      }
      props[key] = defaultProps[key]
    })
  }

  if (canonicalComponentType === 'timeline' && parsedContent) {
    const variant = normalizeString(parsedContent.variant)
    if (variant) {
      props.variant = variant
    }
  }

  const detectionRegion = getDetectionRegion(detection)
  const currentRegion = extractRegionFromRecord(props)
  const derivedContentRegion = isRecord(props.content)
    ? extractRegionFromRecord(props.content as Record<string, unknown>)
    : undefined
  const desiredRegion = normalizedContentRegion ?? rawContentRegion ?? detectionRegion ?? derivedContentRegion
  if (desiredRegion && currentRegion !== desiredRegion) {
    applyRegionToProps(props, desiredRegion)
  }

  const summaryCandidate =
    (props.metadata && typeof props.metadata === 'object'
      ? props.metadata.summary
      : undefined) ??
    (parsedContent ? parsedContent.summary : undefined) ??
    (props.content && typeof props.content === 'object'
      ? (props.content as Record<string, unknown>).summary
      : undefined) ??
    (typeof props.content === 'string' ? extractSummaryFromJsonString(props.content) : undefined) ??
    (typeof props.text === 'string' ? extractSummaryFromJsonString(props.text) : undefined)

  const normalizedSummary = clampSummary(summaryCandidate)

  if (normalizedSummary) {
    if (!props.metadata || typeof props.metadata !== 'object') {
      props.metadata = {}
    }
    props.metadata.summary = normalizedSummary
  }

  return props
}
