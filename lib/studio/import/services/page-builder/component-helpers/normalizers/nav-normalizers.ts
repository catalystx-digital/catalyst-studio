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

const LOGO_IMAGE_SHAPE_KEYS = new Set([
  'src',
  'url',
  'href',
  'link',
  'path',
  'value',
  'mediaId',
  'originalUrl',
  'signedUrl',
  'publicUrl',
  'image',
  'imageUrl',
  'imageSrc',
  'asset',
  'media',
  'file',
  'picture',
  'photo',
  'thumbnail',
  'logo',
  'logoImage',
  'logoSrc',
  'logoUrl',
  'logoMedia',
  'brandLogo'
])
const STRONG_LOGO_IMAGE_SHAPE_KEYS = new Set([
  'src',
  'url',
  'mediaId',
  'originalUrl',
  'signedUrl',
  'publicUrl',
  'image',
  'imageUrl',
  'imageSrc',
  'asset',
  'media',
  'file',
  'picture',
  'photo',
  'thumbnail',
  'logoImage',
  'logoSrc',
  'logoUrl',
  'logoMedia',
  'brandLogo'
])
const MENU_ITEM_COLLECTION_KEYS = new Set(['menuItems', 'utilityNav'])
const MENU_ITEM_CHILD_KEYS = new Set(['children'])
const MENU_ITEM_IMAGE_KEYS = new Set(['image', 'imageUrl', 'imageSrc', 'thumbnail', 'media', 'picture', 'photo'])

function isLogoImageShaped(value: unknown): boolean {
  if (typeof value === 'string') {
    return false
  }
  if (Array.isArray(value)) {
    return value.some(entry => isLogoImageShaped(entry))
  }
  if (!isRecord(value)) {
    return value != null
  }
  const keys = Object.keys(value)
  const hasTextOnlyBrand =
    Boolean(normalizeString(value.text) ?? normalizeString(value.label) ?? normalizeString(value.name)) &&
    !keys.some(key => STRONG_LOGO_IMAGE_SHAPE_KEYS.has(key))
  if (hasTextOnlyBrand) {
    return false
  }
  return keys.some(key => LOGO_IMAGE_SHAPE_KEYS.has(key))
}

function isMediaReferenceLike(value: unknown): value is Record<string, any> {
  return isRecord(value) &&
    typeof value.mediaId === 'string' &&
    typeof value.mediaType === 'string' &&
    (value.url == null || typeof value.url === 'string')
}

function extractStructuredLogoImage(
  value: unknown,
  fallbackAlt: string | undefined
): Record<string, any> | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const srcCandidate = isMediaReferenceLike(value.src)
    ? value.src
    : isMediaReferenceLike(value)
      ? value
      : undefined
  if (!srcCandidate) {
    return undefined
  }

  const alt = normalizeString(value.alt) ?? normalizeString(srcCandidate.alt) ?? fallbackAlt
  return {
    ...value,
    src: {
      mediaId: srcCandidate.mediaId,
      mediaType: srcCandidate.mediaType,
      ...(typeof srcCandidate.url === 'string' ? { url: srcCandidate.url } : {}),
      ...(alt ? { alt } : {})
    },
    ...(alt ? { alt } : {}),
    ...(typeof value.originalUrl === 'string'
      ? { originalUrl: value.originalUrl }
      : typeof srcCandidate.url === 'string'
        ? { originalUrl: srcCandidate.url }
        : {})
  }
}

function hasMenuItemSubstance(item: Record<string, any>): boolean {
  return Boolean(
    extractLinkUrl(item.href) ||
    normalizeString(item.description) ||
    normalizeString(item.icon) ||
    (Array.isArray(item.children) && item.children.length > 0) ||
    (Array.isArray(item.groups) && item.groups.length > 0)
  )
}

function imagePayloadHasSemanticHint(value: unknown): boolean {
  if (typeof value === 'string') {
    return !/^https?:\/\//i.test(value.trim()) && value.trim().length > 0
  }
  if (!isRecord(value)) {
    return false
  }
  return Boolean(
    normalizeString(value.icon) ??
    normalizeString(value.iconName) ??
    normalizeString(value.name) ??
    normalizeString(value.title) ??
    normalizeString(value.alt) ??
    normalizeString(value.label)
  )
}

function normalizeMenuItemArray(
  value: unknown,
  warnings: LocalNormalizationWarning[],
  fieldPath: string
): unknown {
  if (!Array.isArray(value)) {
    return value
  }
  return value.map((item, index) => normalizeMenuItem(item, warnings, `${fieldPath}.${index}`))
}

function normalizeMenuItemGroups(
  value: unknown,
  warnings: LocalNormalizationWarning[],
  fieldPath: string
): unknown {
  if (!Array.isArray(value)) {
    return value
  }
  return value.map((group, index) => {
    if (!isRecord(group)) {
      return group
    }
    const normalizedGroup: Record<string, any> = { ...group }
    if (Array.isArray(normalizedGroup.items)) {
      normalizedGroup.items = normalizeMenuItemArray(normalizedGroup.items, warnings, `${fieldPath}.${index}.items`)
    }
    return normalizedGroup
  })
}

function normalizeMenuItem(
  value: unknown,
  warnings: LocalNormalizationWarning[],
  fieldPath: string
): unknown {
  if (!isRecord(value)) {
    return value
  }

  const item: Record<string, any> = { ...value }
  for (const childKey of MENU_ITEM_CHILD_KEYS) {
    if (Array.isArray(item[childKey])) {
      item[childKey] = normalizeMenuItemArray(item[childKey], warnings, `${fieldPath}.${childKey}`)
    }
  }
  if (Array.isArray(item.groups)) {
    item.groups = normalizeMenuItemGroups(item.groups, warnings, `${fieldPath}.groups`)
  }

  for (const imageKey of MENU_ITEM_IMAGE_KEYS) {
    if (!(imageKey in item)) {
      continue
    }
    if (!hasMenuItemSubstance(item)) {
      continue
    }
    const imageValue = item[imageKey]
    const semanticIcon =
      !normalizeString(item.icon) && imagePayloadHasSemanticHint(imageValue)
        ? normalizeString((imageValue as Record<string, unknown>)?.icon) ??
          normalizeString((imageValue as Record<string, unknown>)?.iconName) ??
          normalizeString((imageValue as Record<string, unknown>)?.name) ??
          normalizeString((imageValue as Record<string, unknown>)?.title) ??
          normalizeString((imageValue as Record<string, unknown>)?.alt) ??
          normalizeString((imageValue as Record<string, unknown>)?.label)
        : undefined
    if (semanticIcon && !/^https?:\/\//i.test(semanticIcon)) {
      item.icon = semanticIcon
    }
    delete item[imageKey]
    warnings.push({
      issue: 'suspicious-value',
      message: `Dropped unsupported navbar menu item image field "${imageKey}" after preserving supported menu item data.`,
      field: `${fieldPath}.${imageKey}`,
      childType: 'navbar-menu-item',
      details: { field: imageKey }
    })
  }

  return item
}

function extractTextLogo(
  value: Record<string, any>,
  fallbackAlt: string | undefined,
  fallbackText?: string,
  allowAltAsText = false
): Record<string, any> | undefined {
  const text =
    normalizeString(value.text) ??
    normalizeString(value.label) ??
    normalizeString(value.name) ??
    fallbackText ??
    (allowAltAsText ? fallbackAlt : undefined)
  if (!text) {
    return undefined
  }
  const logo: Record<string, any> = { text }
  const alt = normalizeString(value.alt) ?? normalizeString(value.altText) ?? fallbackAlt
  if (alt) {
    logo.alt = alt
  }
  return logo
}

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
  for (const collectionKey of MENU_ITEM_COLLECTION_KEYS) {
    if (Array.isArray(normalized[collectionKey])) {
      normalized[collectionKey] = normalizeMenuItemArray(normalized[collectionKey], warnings, collectionKey)
    }
  }
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
  const logoTextFallback =
    normalizeString(baseLogo.text) ??
    normalizeString(baseLogo.label) ??
    normalizeString(baseLogo.name) ??
    normalizeString(flattened.logoText) ??
    normalizeString(flattened.brand)
  const baseLogoHasDirectUrlCandidate = ['src', 'url', 'href', 'link', 'path', 'value'].some(key =>
    typeof baseLogo[key] === 'string' && baseLogo[key].trim().length > 0
  )

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
  let resolvedStructuredLogoImage: Record<string, any> | undefined
  let malformedLogoCandidate = false
  for (let index = 0; index < logoCandidates.length; index += 1) {
    const candidate = logoCandidates[index]
    const structuredLogo = extractStructuredLogoImage(candidate, fallbackAlt)
    if (structuredLogo) {
      resolvedStructuredLogoImage = structuredLogo
      break
    }
    const normalizedLogo = normalizeImage(candidate, fallbackAlt)
    if (normalizedLogo) {
      resolvedLogoImage = normalizedLogo
      break
    }
    if (isLogoImageShaped(candidate)) {
      malformedLogoCandidate = true
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
    if (resolvedStructuredLogoImage) {
      return {
        ...baseLogo,
        ...resolvedStructuredLogoImage
      }
    }
    if (resolvedLogoImage) {
      return {
        ...baseLogo,
        ...resolvedLogoImage
      }
    }
    if (malformedLogoCandidate) {
      return extractTextLogo(baseLogo, fallbackAlt, logoTextFallback, baseLogoHasDirectUrlCandidate)
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
  } else if (malformedLogoCandidate) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: 'Dropped navbar logo image payload because it did not contain a usable image source or text label.',
      field: 'logo',
      childType: 'navbar',
      details: { valueType: 'object' }
    })
    delete normalized.logo
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
