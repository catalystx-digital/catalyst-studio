/**
 * Navigation Component Normalizers
 *
 * Normalizers for navbar components (search functionality is integrated into navbar).
 * Extracted from component-helpers.ts for modularity.
 *
 * @module nav-normalizers
 */

import {
  expandSourceRecord,
  normalizeImage,
  type NormalizedImageValue,
  normalizeString,
  normalizeBooleanFlag,
  isRecord,
  extractLinkUrl,
  type LocalNormalizationWarning,
  type ComponentContentNormalizer
} from './shared-normalizer-utils'

/**
 * Normalizes navbar component content.
 * Handles logo resolution and normalization from various field formats.
 */
export const normalizeNavbarContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'navbar',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }
  const baseLogo: Record<string, any> =
    isRecord(flattened.logo) && !Array.isArray(flattened.logo)
      ? { ...(flattened.logo as Record<string, any>) }
      : typeof flattened.logo === 'string'
        ? { text: flattened.logo }
        : {}

  const fallbackAlt =
    normalizeString(baseLogo.alt) ??
    normalizeString(flattened.logoAlt) ??
    normalizeString(flattened.brand) ??
    normalizeString(flattened.heading) ??
    normalizeString(flattened.title)

  const logoCandidates: unknown[] = []
  if (Object.keys(baseLogo).length > 0) {
    logoCandidates.push(baseLogo)
  }
  ;['logoImage', 'logoSrc', 'logoUrl', 'logoMedia', 'brandLogo'].forEach(key => {
    if (flattened[key] !== undefined) {
      logoCandidates.push(flattened[key])
    }
  })
  if (isRecord(flattened.brand) && (flattened.brand as Record<string, unknown>).logo) {
    logoCandidates.push((flattened.brand as Record<string, unknown>).logo)
  }

  let resolvedLogoImage: NormalizedImageValue | undefined
  for (const candidate of logoCandidates) {
    const normalizedLogo = normalizeImage(candidate, fallbackAlt)
    if (normalizedLogo) {
      resolvedLogoImage = normalizedLogo
      break
    }
  }

  if (resolvedLogoImage?.mediaId && !resolvedLogoImage.src) {
    warnings.push({
      issue: 'media-src-missing',
      message: 'Navbar logo mediaId detected without a usable src.',
      field: 'logo',
      childType: 'navbar'
    })
  }

  const resolvedLogoObject = (() => {
    if (resolvedLogoImage) {
      return {
        ...baseLogo,
        ...resolvedLogoImage
      }
    }
    if (Object.keys(baseLogo).length > 0) {
      return baseLogo
    }
    if (fallbackAlt) {
      return { text: fallbackAlt }
    }
    return undefined
  })()

  if (resolvedLogoObject) {
    const hrefCandidate =
      extractLinkUrl(flattened.logoHref) ??
      extractLinkUrl(flattened.logoLink) ??
      extractLinkUrl(flattened.brandUrl)
    if (hrefCandidate) {
      resolvedLogoObject.href = hrefCandidate
    }
    const textCandidate =
      (typeof baseLogo.text === 'string' ? normalizeString(baseLogo.text) : undefined) ??
      normalizeString(flattened.logoText) ??
      normalizeString(flattened.brand) ??
      normalizeString(flattened.title)
    if (textCandidate && !resolvedLogoObject.text) {
      resolvedLogoObject.text = textCandidate
    }
    if (!resolvedLogoObject.alt && fallbackAlt) {
      resolvedLogoObject.alt = fallbackAlt
    }
    normalized.logo = resolvedLogoObject
  }

  const logoAliasKeys = [
    'logoSrc',
    'logoUrl',
    'logoImage',
    'logoAlt',
    'logoText',
    'logoHref',
    'logoLink',
    'brandLogo',
    'brandUrl',
    'logoMedia'
  ]
  logoAliasKeys.forEach(alias => {
    if (alias in normalized && alias !== 'logo') {
      delete normalized[alias]
    }
  })

  // Normalize search configuration within navbar
  const searchSource = flattened.search ?? flattened.searchBox ?? flattened.searchConfig
  const hasSearch = normalizeBooleanFlag(flattened.hasSearch)

  if (isRecord(searchSource) || hasSearch) {
    const searchObj = isRecord(searchSource) ? searchSource as Record<string, any> : {}
    const search: Record<string, any> = { enabled: true }

    // Extract placeholder
    const placeholder = normalizeString(searchObj.placeholder ?? searchObj.label ?? searchObj.text)
    if (placeholder) {
      search.placeholder = placeholder
    }

    // Extract action URL
    const action = normalizeString(searchObj.action ?? searchObj.url ?? searchObj.formAction)
    if (action) {
      search.action = action
    }

    // Extract showSuggestions flag
    const showSuggestions = normalizeBooleanFlag(searchObj.showSuggestions ?? searchObj.hasSuggestions)
    if (showSuggestions !== undefined) {
      search.showSuggestions = showSuggestions
    }

    normalized.search = search
  }

  // Clean up search alias keys
  const searchAliasKeys = ['searchBox', 'searchConfig', 'hasSearch']
  searchAliasKeys.forEach(alias => {
    if (alias in normalized && alias !== 'search') {
      delete normalized[alias]
    }
  })

  return { content: normalized, warnings }
}
