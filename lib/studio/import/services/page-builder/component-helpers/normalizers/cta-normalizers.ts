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
  type LocalNormalizationWarning,
  type ComponentContentNormalizer
} from './shared-normalizer-utils'
import { containsHtmlTags, stripHtmlToText } from '../string-utils'

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
  const normalized = { ...flattened }

  const validateButton = (field: 'primaryButton' | 'secondaryButton', required: boolean) => {
    const value = normalized[field]
    if (value == null) {
      if (required) {
        warnings.push({
          issue: 'missing-required-field',
          message: `Normalized cta-simple is missing required "${field}" field.`,
          field,
          childType: 'cta-simple',
          details: { field }
        })
      }
      return
    }

    if (!isRecord(value)) {
      warnings.push({
        issue: 'invalid-subcomponent',
        message: `Dropped ${field} because payload is not an object.`,
        field,
        childType: 'cta-button',
        details: { valueType: typeof value }
      })
      delete normalized[field]
      return
    }

    const title =
      normalizeString(value.text) ??
      normalizeString((value as Record<string, unknown>).label) ??
      normalizeString((value as Record<string, unknown>).title)
    const href = extractLinkUrl((value as Record<string, unknown>).url) ??
      extractLinkUrl((value as Record<string, unknown>).href)

    if (!title || !href) {
      warnings.push({
        issue: 'invalid-subcomponent',
        message: `Dropped ${field} missing label or href.`,
        field,
        childType: 'cta-button'
      })
      delete normalized[field]
    }
  }

  validateButton('primaryButton', true)
  validateButton('secondaryButton', false)

  return { content: normalized, warnings }
}
