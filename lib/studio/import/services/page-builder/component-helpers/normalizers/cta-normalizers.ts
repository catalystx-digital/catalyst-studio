/**
 * CTA Component Normalizers
 *
 * Normalizers for cta-with-form and cta-simple components.
 * Extracted from component-helpers.ts for modularity.
 *
 * @module cta-normalizers
 */

import {
  expandSourceRecord,
  normalizeString,
  isRecord,
  extractLinkUrl,
  normalizeImage,
  pruneObjectAgainstContract,
  type LocalNormalizationWarning,
  type ComponentContentNormalizer
} from './shared-normalizer-utils'
import { containsHtmlTags, stripHtmlToText } from '../string-utils'

function pageIdFromPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'home'
}

function normalizeSmartLink(value: unknown): Record<string, any> | undefined {
  if (isRecord(value)) {
    const type = normalizeString(value.type)?.toLowerCase()
    if (type === 'internal') {
      const path = extractLinkUrl(value.path ?? value.href ?? value.url)
      if (!path) return undefined
      return {
        type: 'internal',
        pageId: normalizeString(value.pageId) ?? pageIdFromPath(path),
        path,
        ...(normalizeString(value.label) ? { label: normalizeString(value.label) } : {})
      }
    }
    if (type === 'external') {
      const url = extractLinkUrl(value.url ?? value.href)
      if (!url) return undefined
      if (url.startsWith('/')) {
        return {
          type: 'internal',
          pageId: pageIdFromPath(url),
          path: url,
          ...(normalizeString(value.label) ? { label: normalizeString(value.label) } : {})
        }
      }
      const normalizedUrl = url.startsWith('//')
        ? `https:${url}`
        : /^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(url)
          ? `https://${url}`
          : url
      return /^https?:\/\//i.test(normalizedUrl)
        ? {
            type: 'external',
            url: normalizedUrl,
            ...(normalizeString(value.label) ? { label: normalizeString(value.label) } : {}),
            ...(typeof value.openInNewTab === 'boolean' ? { openInNewTab: value.openInNewTab } : {})
          }
        : undefined
    }
    if (type === 'email' || type === 'phone' || type === 'anchor') {
      const href = extractLinkUrl(value.href ?? value.url ?? value.path)
      return href
        ? {
            type,
            href,
            ...(normalizeString(value.label) ? { label: normalizeString(value.label) } : {})
          }
        : undefined
    }
  }

  const rawHref = extractLinkUrl(value)
  const href = rawHref?.startsWith('//')
    ? `https:${rawHref}`
    : rawHref && /^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(rawHref)
      ? `https://${rawHref}`
      : rawHref

  if (!href) {
    return undefined
  }
  if (href.startsWith('#')) return { type: 'anchor', href }
  if (href.startsWith('mailto:')) return { type: 'email', href }
  if (href.startsWith('tel:')) return { type: 'phone', href }
  if (/^https?:\/\//i.test(href)) return { type: 'external', url: href }
  return { type: 'internal', pageId: pageIdFromPath(href), path: href }
}

function normalizeCtaVariant(value: unknown): 'primary' | 'secondary' | 'outline' | undefined {
  const variant = normalizeString(value)?.toLowerCase()
  if (variant === 'primary' || variant === 'secondary' || variant === 'outline') {
    return variant
  }
  if (variant === 'default' || variant === 'accent' || variant === 'filled' || variant === 'solid') {
    return 'primary'
  }
  if (variant === 'neutral') {
    return 'secondary'
  }
  if (variant === 'ghost' || variant === 'link') {
    return 'outline'
  }
  return undefined
}

function normalizeAlignment(value: unknown): 'left' | 'center' | 'right' | undefined {
  const alignment = normalizeString(value)?.toLowerCase()
  if (alignment === 'left' || alignment === 'center' || alignment === 'right') {
    return alignment
  }
  return undefined
}

function normalizeBackgroundVariant(value: unknown): 'surface' | 'accent' | 'inverted' | undefined {
  const variant = normalizeString(value)?.toLowerCase()
  if (variant === 'surface' || variant === 'accent' || variant === 'inverted') {
    return variant
  }
  return undefined
}

function normalizeBooleanValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return undefined
    if (['true', '1', 'yes', 'on', 'full', 'full-width'].includes(normalized)) return true
    if (['false', '0', 'no', 'off', 'contained'].includes(normalized)) return false
  }
  return undefined
}

function repairDanglingTrustedAssetUrl(value: string | undefined): string | undefined {
  if (!value) {
    return value
  }

  try {
    const parsed = new URL(value.replace(/&amp;/g, '&'))
    if (/(^|\.)kc-usercontent\.com$/i.test(parsed.hostname) && parsed.pathname.endsWith('.')) {
      parsed.pathname = `${parsed.pathname}png`
      return parsed.toString()
    }
  } catch {
    return value
  }

  return value
}

function normalizeCtaButton(
  value: unknown,
  field: 'primaryButton' | 'secondaryButton',
  warnings: LocalNormalizationWarning[],
  childType: string
): Record<string, any> | undefined {
  if (!isRecord(value)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Dropped ${field} because payload is not an object.`,
      field,
      childType: 'cta-button',
      details: { valueType: typeof value }
    })
    return undefined
  }

  const label =
    normalizeString(value.label) ??
    normalizeString(value.text) ??
    normalizeString(value.title) ??
    normalizeString(value.name)
  const href = normalizeSmartLink(value.href ?? value.url ?? value.link ?? value.path ?? value)

  if (!label) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Dropped ${field} missing label.`,
      field,
      childType: 'cta-button'
    })
    return undefined
  }

  if (!href && childType !== 'cta-banner') {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Dropped ${field} missing href.`,
      field,
      childType: 'cta-button'
    })
    return undefined
  }

  if (!href) {
    warnings.push({
      issue: 'suspicious-value',
      message: `Kept ${childType}.${field} label without href because CTAButton href is optional.`,
      field,
      childType
    })
  }

  if (typeof value.text === 'string' || typeof value.url === 'string' || typeof value.link === 'string') {
    warnings.push({
      issue: 'suspicious-value',
      message: `Normalized ${childType}.${field} legacy text/url/link fields into CTAButton label/href.`,
      field,
      childType
    })
  }

  return {
    label,
    ...(href ? { href } : {}),
    ...(normalizeCtaVariant(value.variant) ? { variant: normalizeCtaVariant(value.variant) } : {}),
    ...(normalizeString(value.icon) ? { icon: normalizeString(value.icon) } : {}),
    ...(typeof value.external === 'boolean' ? { external: value.external } : {})
  }
}

function normalizeCtaButtons(
  normalized: Record<string, any>,
  canonicalType: 'cta-simple' | 'cta-banner',
  warnings: LocalNormalizationWarning[],
  requiredPrimary: boolean
): void {
  const primary = normalized.primaryButton
  if (primary == null) {
    if (requiredPrimary) {
      warnings.push({
        issue: 'missing-required-field',
        message: `Normalized ${canonicalType} is missing required "primaryButton" field.`,
        field: 'primaryButton',
        childType: canonicalType,
        details: { field: 'primaryButton' }
      })
    }
  } else {
    const button = normalizeCtaButton(primary, 'primaryButton', warnings, canonicalType)
    if (button) normalized.primaryButton = button
    else delete normalized.primaryButton
  }

  const secondary = normalized.secondaryButton
  if (secondary != null) {
    const button = normalizeCtaButton(secondary, 'secondaryButton', warnings, canonicalType)
    if (button) normalized.secondaryButton = button
    else delete normalized.secondaryButton
  }
}

/**
 * Normalizes cta-with-form component content.
 * Handles HTML subheading variants and cleans up legacy field names.
 */
export const normalizeCtaWithFormContent: ComponentContentNormalizer = (
  content: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(content, {
    canonicalType: 'cta-with-form',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }
  const htmlCandidates = [
    normalized.subheadingHtml,
    normalized.subheadingHTML,
    normalized.subheadingRichText,
    normalized.bodyHtml,
    normalized.bodyHTML,
    normalized.consentHtml
  ]

  let resolvedHtml: string | undefined
  for (const candidate of htmlCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      resolvedHtml = candidate.trim()
      break
    }
  }

  const existingSubheading = typeof normalized.subheading === 'string' ? normalized.subheading : undefined
  if (!resolvedHtml && existingSubheading && containsHtmlTags(existingSubheading)) {
    resolvedHtml = existingSubheading.trim()
  }

  if (resolvedHtml) {
    normalized.subheadingHtml = resolvedHtml
    const plainText = stripHtmlToText(resolvedHtml)
    if (plainText && (!existingSubheading || containsHtmlTags(existingSubheading))) {
      normalized.subheading = plainText
    }
  }

  ;['subheadingHTML', 'subheadingRichText', 'bodyHtml', 'bodyHTML', 'consentHtml'].forEach(key => {
    if (key in normalized) {
      delete normalized[key]
    }
  })

  return { content: normalized, warnings }
}

/**
 * Normalizes cta-simple component content.
 * Validates primary and secondary button fields.
 */
export const normalizeCtaSimpleContent: ComponentContentNormalizer = (
  content: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(content, {
    canonicalType: 'cta-simple',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })
  const normalized: Record<string, any> = { ...flattened }

  normalizeCtaButtons(normalized, 'cta-simple', warnings, true)

  const alignment = normalizeAlignment(normalized.alignment)
  if (alignment) normalized.alignment = alignment
  else delete normalized.alignment

  const backgroundVariant = normalizeBackgroundVariant(normalized.backgroundVariant ?? normalized.variant)
  if (backgroundVariant) normalized.backgroundVariant = backgroundVariant
  else delete normalized.backgroundVariant
  delete normalized.variant

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'cta-simple', {
    childType: 'cta-simple'
  })
  warnings.push(...pruneWarnings)

  return { content: pruned, warnings }
}

/**
 * Normalizes cta-banner component content.
 * Converts legacy text/url buttons and media aliases into contract fields.
 */
export const normalizeCtaBannerContent: ComponentContentNormalizer = (
  content: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(content, {
    canonicalType: 'cta-banner',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })
  const normalized: Record<string, any> = { ...flattened }

  normalizeCtaButtons(normalized, 'cta-banner', warnings, false)

  const alignment = normalizeAlignment(normalized.alignment)
  if (alignment) normalized.alignment = alignment
  else delete normalized.alignment

  const fullWidth = normalizeBooleanValue(normalized.fullWidth)
  if (fullWidth !== undefined) normalized.fullWidth = fullWidth
  else delete normalized.fullWidth

  const imageCandidate = normalized.backgroundImage ?? normalized.background?.image ?? normalized.image
  const imageWarnings: LocalNormalizationWarning[] = []
  const backgroundImage = normalizeImage(imageCandidate, normalizeString(normalized.heading), {
    field: 'backgroundImage',
    warnings: imageWarnings,
    context: {
      canonicalType: 'cta-banner',
      parentCanonicalType: options.parentCanonicalType,
      field: 'backgroundImage',
      index: 0,
      pageUrl: options.pageUrl
    }
  })
  warnings.push(...imageWarnings)
  if (backgroundImage?.src ?? backgroundImage?.originalUrl) {
    const rawBackgroundImageUrl = backgroundImage.src ?? backgroundImage.originalUrl
    const repairedBackgroundImageUrl = repairDanglingTrustedAssetUrl(rawBackgroundImageUrl)
    if (repairedBackgroundImageUrl !== rawBackgroundImageUrl) {
      warnings.push({
        issue: 'suspicious-value',
        message: 'Repaired cta-banner backgroundImage URL with dangling trusted asset extension.',
        field: 'backgroundImage',
        childType: 'cta-banner',
        details: { originalUrl: rawBackgroundImageUrl, repairedUrl: repairedBackgroundImageUrl }
      })
    }
    normalized.backgroundImage = repairedBackgroundImageUrl
  } else {
    delete normalized.backgroundImage
  }
  delete normalized.background
  delete normalized.image

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'cta-banner', {
    childType: 'cta-banner'
  })
  warnings.push(...pruneWarnings)

  return { content: pruned, warnings }
}
