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
  pruneObjectAgainstContract,
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
const ROW_STYLE_KEYS = new Set(['backgroundColor', 'textColor', 'borderColor'])
const SMART_LINK_TYPES = new Set(['internal', 'external', 'email', 'phone', 'anchor'])
const SOCIAL_PLATFORMS = new Set(['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'github', 'website'])
type FooterSocialPlatform = 'facebook' | 'twitter' | 'linkedin' | 'instagram' | 'youtube' | 'github' | 'website'

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

function pageIdFromPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'home'
}

function normalizeSmartLink(value: unknown): Record<string, any> | undefined {
  if (isRecord(value)) {
    const type = normalizeString(value.type)?.toLowerCase()
    if (type === 'internal') {
      const path = extractLinkUrl(value.path ?? value.href ?? value.url)
      return path
        ? {
            type: 'internal',
            pageId: normalizeString(value.pageId) ?? pageIdFromPath(path),
            path,
            ...(normalizeString(value.label) ? { label: normalizeString(value.label) } : {})
          }
        : undefined
    }
    if (type === 'external') {
      const url = extractLinkUrl(value.url ?? value.href)
      if (!url) return undefined
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

  const raw = extractLinkUrl(value)
  if (raw) {
    if (raw.startsWith('#')) return { type: 'anchor', href: raw }
    if (raw.startsWith('mailto:')) return { type: 'email', href: raw }
    if (raw.startsWith('tel:')) return { type: 'phone', href: raw }
    const href = raw.startsWith('//')
      ? `https:${raw}`
      : /^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(raw)
        ? `https://${raw}`
        : raw
    if (/^https?:\/\//i.test(href)) return { type: 'external', url: href }
    return { type: 'internal', pageId: pageIdFromPath(href), path: href }
  }

  if (!isRecord(value)) {
    return undefined
  }
  return undefined
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

function isSafeCssColor(value: string): boolean {
  const color = value.trim()
  if (!color || /[;{}]/.test(color)) {
    return false
  }
  return (
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^rgba?\(\s*[\d.\s,%]+\)$/i.test(color) ||
    /^hsla?\(\s*[\d.\s,%degturnrad]+\)$/i.test(color) ||
    /^var\(--[a-z0-9-_]+\)$/i.test(color)
  )
}

function normalizeRowStyle(
  value: unknown,
  warnings: LocalNormalizationWarning[],
  fieldPath: string
): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const style: Record<string, string> = {}
  for (const key of ROW_STYLE_KEYS) {
    const sourceValue = key === 'textColor' ? value.textColor ?? value.color : value[key]
    const normalized = normalizeString(sourceValue)
    if (normalized) {
      if (isSafeCssColor(normalized)) {
        style[key] = normalized
      } else {
        warnings.push({
          issue: 'suspicious-value',
          message: `Dropped unsupported navbar row style color "${key}".`,
          field: `${fieldPath}.${key}`,
          childType: 'navbar',
          details: { field: key }
        })
      }
    }
  }

  return Object.keys(style).length > 0 ? style : undefined
}

function normalizeNavbarStyles(
  flattened: Record<string, any>,
  warnings: LocalNormalizationWarning[]
): Record<string, any> | undefined {
  const stylesSource = isRecord(flattened.styles) ? flattened.styles as Record<string, any> : {}
  const primaryItems = Array.isArray(stylesSource.primaryItems)
    ? stylesSource.primaryItems
        .map((item, index) => {
          if (!isRecord(item)) {
            return undefined
          }
          const label = normalizeString(item.label)
          const rowStyle = normalizeRowStyle(item, warnings, `styles.primaryItems.${index}`)
          return label && rowStyle ? { label, ...rowStyle } : undefined
        })
        .filter((item): item is { label: string } & Record<string, string> => Boolean(item))
    : undefined
  const rootRow =
    normalizeRowStyle(stylesSource.rootRow, warnings, 'styles.rootRow') ??
    normalizeRowStyle(flattened.rootRowStyle, warnings, 'rootRowStyle') ??
    normalizeRowStyle(flattened.rootRow, warnings, 'rootRow') ??
    normalizeRowStyle(flattened.logoRowStyle, warnings, 'logoRowStyle') ??
    normalizeRowStyle(flattened.logoRow, warnings, 'logoRow') ??
    normalizeRowStyle(flattened.navbarRowStyle, warnings, 'navbarRowStyle') ??
    normalizeRowStyle({
      backgroundColor:
        flattened.rootRowBackgroundColor ??
        flattened.logoRowBackgroundColor ??
        flattened.navbarRowBackgroundColor,
      textColor:
        flattened.rootRowTextColor ??
        flattened.rootRowForegroundColor ??
        flattened.logoRowTextColor ??
        flattened.logoRowForegroundColor ??
        flattened.navbarRowTextColor,
      borderColor:
        flattened.rootRowBorderColor ??
        flattened.logoRowBorderColor ??
        flattened.navbarRowBorderColor
    }, warnings, 'rootRow')
  const primaryRow =
    normalizeRowStyle(stylesSource.primaryRow, warnings, 'styles.primaryRow') ??
    normalizeRowStyle(flattened.primaryRowStyle, warnings, 'primaryRowStyle') ??
    normalizeRowStyle(flattened.primaryRow, warnings, 'primaryRow') ??
    normalizeRowStyle(flattened.primaryNavStyle, warnings, 'primaryNavStyle') ??
    normalizeRowStyle(flattened.mainRowStyle, warnings, 'mainRowStyle') ??
    normalizeRowStyle(flattened.audienceRowStyle, warnings, 'audienceRowStyle') ??
    normalizeRowStyle({
      backgroundColor:
        flattened.primaryRowBackgroundColor ??
        flattened.primaryNavBackgroundColor ??
        flattened.mainRowBackgroundColor ??
        flattened.audienceRowBackgroundColor,
      textColor:
        flattened.primaryRowTextColor ??
        flattened.primaryRowForegroundColor ??
        flattened.primaryNavTextColor ??
        flattened.mainRowTextColor ??
        flattened.audienceRowTextColor,
      borderColor:
        flattened.primaryRowBorderColor ??
        flattened.primaryNavBorderColor ??
        flattened.mainRowBorderColor ??
        flattened.audienceRowBorderColor
    }, warnings, 'primaryRow')

  const utilityRow =
    normalizeRowStyle(stylesSource.utilityRow, warnings, 'styles.utilityRow') ??
    normalizeRowStyle(flattened.utilityRowStyle, warnings, 'utilityRowStyle') ??
    normalizeRowStyle(flattened.utilityRow, warnings, 'utilityRow') ??
    normalizeRowStyle(flattened.topRowStyle, warnings, 'topRowStyle') ??
    normalizeRowStyle({
      backgroundColor:
        flattened.utilityRowBackgroundColor ??
        flattened.topRowBackgroundColor,
      textColor:
        flattened.utilityRowTextColor ??
        flattened.utilityRowForegroundColor ??
        flattened.topRowTextColor,
      borderColor:
        flattened.utilityRowBorderColor ??
        flattened.topRowBorderColor
    }, warnings, 'utilityRow')

  const styles: Record<string, any> = {
    ...(rootRow ? { rootRow } : {}),
    ...(utilityRow ? { utilityRow } : {}),
    ...(primaryRow ? { primaryRow } : {}),
    ...(primaryItems && primaryItems.length > 0 ? { primaryItems } : {})
  }

  return Object.keys(styles).length > 0 ? styles : undefined
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
  const normalizedStyles = normalizeNavbarStyles(flattened, warnings)
  if (normalizedStyles) {
    normalized.styles = normalizedStyles
  }

  const styleAliasKeys = [
    'primaryRowStyle',
    'primaryRow',
    'primaryNavStyle',
    'mainRowStyle',
    'audienceRowStyle',
    'primaryRowBackgroundColor',
    'primaryNavBackgroundColor',
    'mainRowBackgroundColor',
    'audienceRowBackgroundColor',
    'primaryRowTextColor',
    'primaryRowForegroundColor',
    'primaryNavTextColor',
    'mainRowTextColor',
    'audienceRowTextColor',
    'primaryRowBorderColor',
    'primaryNavBorderColor',
    'mainRowBorderColor',
    'audienceRowBorderColor',
    'rootRowStyle',
    'rootRow',
    'logoRowStyle',
    'logoRow',
    'navbarRowStyle',
    'rootRowBackgroundColor',
    'logoRowBackgroundColor',
    'navbarRowBackgroundColor',
    'rootRowTextColor',
    'rootRowForegroundColor',
    'logoRowTextColor',
    'logoRowForegroundColor',
    'navbarRowTextColor',
    'rootRowBorderColor',
    'logoRowBorderColor',
    'navbarRowBorderColor',
    'utilityRowStyle',
    'utilityRow',
    'topRowStyle',
    'utilityRowBackgroundColor',
    'topRowBackgroundColor',
    'utilityRowTextColor',
    'utilityRowForegroundColor',
    'topRowTextColor',
    'utilityRowBorderColor',
    'topRowBorderColor'
  ]
  styleAliasKeys.forEach(alias => {
    if (alias in normalized) {
      delete normalized[alias]
    }
  })

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

function normalizeFooterMenuItem(
  value: unknown,
  warnings: LocalNormalizationWarning[],
  fieldPath: string
): Record<string, any> | undefined {
  if (!isRecord(value)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Dropped footer menu item at "${fieldPath}" because it is not an object.`,
      field: fieldPath,
      childType: 'footer-link'
    })
    return undefined
  }

  const label =
    normalizeString(value.label) ??
    normalizeString(value.text) ??
    normalizeString(value.title) ??
    normalizeString(value.name)
  if (!label) {
    warnings.push({
      issue: 'missing-required-field',
      message: `Dropped footer menu item at "${fieldPath}" because it has no label.`,
      field: fieldPath,
      childType: 'footer-link'
    })
    return undefined
  }

  for (const unsupported of ['type', 'id']) {
    if (unsupported in value) {
      warnings.push({
        issue: 'unknown-field',
        message: `Removed unsupported footer menu item field "${unsupported}".`,
        field: `${fieldPath}.${unsupported}`,
        childType: 'footer-link',
        details: { field: unsupported }
      })
    }
  }

  const href = normalizeSmartLink(value.href ?? value.url ?? value.link ?? value.path)
  const rawLinkValue = value.href ?? value.url ?? value.link ?? value.path
  if (typeof rawLinkValue === 'string') {
    warnings.push({
      issue: 'suspicious-value',
      message: `Normalized footer string link at "${fieldPath}" into a structured SmartLink.`,
      field: `${fieldPath}.href`,
      childType: 'footer-link'
    })
  } else {
    for (const alias of ['url', 'link', 'path']) {
      if (alias in value && !('href' in value)) {
        warnings.push({
          issue: 'unknown-field',
          message: `Normalized footer link alias "${alias}" into href.`,
          field: `${fieldPath}.${alias}`,
          childType: 'footer-link',
          details: { field: alias }
        })
      }
    }
  }
  const children = Array.isArray(value.children)
    ? value.children
        .map((child, index) => normalizeFooterMenuItem(child, warnings, `${fieldPath}.children.${index}`))
        .filter((child): child is Record<string, any> => Boolean(child))
    : undefined
  const groups = Array.isArray(value.groups)
    ? value.groups
        .filter(isRecord)
        .map((group, groupIndex) => {
          const items = Array.isArray(group.items)
            ? group.items
                .map((item, itemIndex) => normalizeFooterMenuItem(item, warnings, `${fieldPath}.groups.${groupIndex}.items.${itemIndex}`))
                .filter((item): item is Record<string, any> => Boolean(item))
            : undefined
          return {
            ...(normalizeString(group.title) ? { title: normalizeString(group.title) } : {}),
            ...(normalizeString(group.description) ? { description: normalizeString(group.description) } : {}),
            ...(items && items.length > 0 ? { items } : {})
          }
        })
        .filter(group => Object.keys(group).length > 0)
    : undefined

  return {
    label,
    ...(href ? { href } : {}),
    ...(normalizeString(value.description) ? { description: normalizeString(value.description) } : {}),
    ...(normalizeString(value.icon) ? { icon: normalizeString(value.icon) } : {}),
    ...(children && children.length > 0 ? { children } : {}),
    ...(groups && groups.length > 0 ? { groups } : {}),
    ...(typeof value.external === 'boolean' ? { external: value.external } : {}),
    ...(typeof value.panelOffset === 'number' ? { panelOffset: value.panelOffset } : {}),
    ...(typeof value.panelWidth === 'number' || typeof value.panelWidth === 'string' ? { panelWidth: value.panelWidth } : {}),
    ...(value.panelAlign === 'start' || value.panelAlign === 'center' || value.panelAlign === 'end' ? { panelAlign: value.panelAlign } : {})
  }
}

function normalizeFooterColumns(value: unknown, warnings: LocalNormalizationWarning[]): Record<string, any>[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const columns = value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        warnings.push({
          issue: 'invalid-subcomponent',
          message: `Dropped footer column ${index} because it is not an object.`,
          field: `columns.${index}`,
          childType: 'footer-column'
        })
        return undefined
      }
      const linksSource = Array.isArray(entry.links)
        ? entry.links
        : Array.isArray(entry.items)
          ? entry.items
          : Array.isArray(entry.children)
            ? entry.children
            : []
      const links = linksSource
        .map((link, linkIndex) => normalizeFooterMenuItem(link, warnings, `columns.${index}.links.${linkIndex}`))
        .filter((link): link is Record<string, any> => Boolean(link))
      const title = normalizeString(entry.title) ?? normalizeString(entry.heading) ?? normalizeString(entry.label)
      for (const unsupported of ['type', 'id']) {
        if (unsupported in entry) {
          warnings.push({
            issue: 'unknown-field',
            message: `Removed unsupported footer column field "${unsupported}".`,
            field: `columns.${index}.${unsupported}`,
            childType: 'footer-column',
            details: { field: unsupported }
          })
        }
      }
      if (!title && links.length === 0) {
        return undefined
      }
      return {
        ...(title ? { title } : {}),
        ...(links.length > 0 ? { links } : {})
      }
    })
    .filter((column): column is Record<string, any> => Boolean(column))
  return columns.length > 0 ? columns : undefined
}

function normalizeSocialPlatform(value: unknown): FooterSocialPlatform {
  const normalized = normalizeString(value)?.toLowerCase().replace(/[^a-z]/g, '')
  if (!normalized) return 'website'
  if (normalized === 'x' || normalized === 'twitter') return 'twitter'
  if (normalized === 'linkedinin' || normalized === 'linkedin') return 'linkedin'
  return SOCIAL_PLATFORMS.has(normalized) ? normalized as FooterSocialPlatform : 'website'
}

function inferSocialPlatformFromUrl(url: string): FooterSocialPlatform {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host.includes('facebook.')) return 'facebook'
    if (host.includes('twitter.') || host === 'x.com' || host.endsWith('.x.com')) return 'twitter'
    if (host.includes('linkedin.')) return 'linkedin'
    if (host.includes('instagram.')) return 'instagram'
    if (host.includes('youtube.') || host.includes('youtu.be')) return 'youtube'
    if (host.includes('github.')) return 'github'
  } catch {
    // Keep generic website platform when URL parsing fails.
  }
  return 'website'
}

function normalizeFooterSocialLinks(value: unknown, warnings: LocalNormalizationWarning[]): Record<string, any>[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const links: Record<string, any>[] = value
    .map((entry, index) => {
      if (!isRecord(entry)) {
        warnings.push({
          issue: 'invalid-subcomponent',
          message: `Dropped footer social link ${index} because it is not an object.`,
          field: `socialLinks.${index}`,
          childType: 'footer-social-link'
        })
        return undefined
      }
      const url = extractLinkUrl(entry.url ?? entry.href ?? entry.link)
      if (!url) {
        warnings.push({
          issue: 'missing-required-field',
          message: `Dropped footer social link ${index} because it has no URL.`,
          field: `socialLinks.${index}`,
          childType: 'footer-social-link'
        })
        return undefined
      }
      const platform = normalizeString(entry.platform)
        ? normalizeSocialPlatform(entry.platform)
        : inferSocialPlatformFromUrl(url)
      for (const unsupported of ['type', 'id']) {
        if (unsupported in entry) {
          warnings.push({
            issue: 'unknown-field',
            message: `Removed unsupported footer social link field "${unsupported}".`,
            field: `socialLinks.${index}.${unsupported}`,
            childType: 'footer-social-link',
            details: { field: unsupported }
          })
        }
      }
      return {
        platform,
        url,
        ...(normalizeString(entry.icon) ? { icon: normalizeString(entry.icon) } : {}),
        ...(normalizeString(entry.label) ? { label: normalizeString(entry.label) } : {})
      }
    })
    .filter((link): link is NonNullable<typeof link> => Boolean(link))
  return links.length > 0 ? links : undefined
}

function normalizeFooterLogo(flattened: Record<string, any>): Record<string, any> | undefined {
  const logoSource = flattened.logo ?? flattened.logoImage ?? flattened.logoUrl ?? flattened.logoSrc ?? flattened.brandLogo
  const fallbackAlt =
    normalizeString(flattened.logoAlt) ??
    normalizeString(flattened.siteName) ??
    normalizeString(flattened.brand) ??
    normalizeString(flattened.title)
  const fallbackText =
    normalizeString(flattened.logoText) ??
    normalizeString(flattened.siteName) ??
    normalizeString(flattened.brand)

  if (isRecord(logoSource)) {
    const structured = extractStructuredLogoImage(logoSource, fallbackAlt)
    if (structured) {
      return {
        ...structured,
        ...(fallbackText && !structured.text ? { text: fallbackText } : {})
      }
    }
    const normalized = normalizeImage(logoSource, fallbackAlt)
    if (normalized) {
      return {
        ...(normalized.mediaId
          ? { src: { mediaId: normalized.mediaId, mediaType: 'image', ...(normalized.src ? { url: normalized.src } : {}) } }
          : {}),
        ...(normalized.alt ? { alt: normalized.alt } : fallbackAlt ? { alt: fallbackAlt } : {}),
        ...(normalized.originalUrl ?? normalized.src ? { originalUrl: normalized.originalUrl ?? normalized.src } : {}),
        ...(fallbackText ? { text: fallbackText } : {})
      }
    }
    const text = extractTextLogo(logoSource, fallbackAlt, fallbackText, true)
    return text
  }

  const logoString = normalizeString(logoSource)
  if (logoString) {
    const looksLikeImage = /^https?:\/\//i.test(logoString) || logoString.startsWith('/') || /\.(svg|png|jpe?g|webp|gif|avif)(\?|$)/i.test(logoString)
    return looksLikeImage
      ? { originalUrl: logoString, ...(fallbackAlt ? { alt: fallbackAlt } : {}) }
      : { text: logoString, ...(fallbackAlt ? { alt: fallbackAlt } : {}) }
  }

  return fallbackText ? { text: fallbackText, ...(fallbackAlt ? { alt: fallbackAlt } : {}) } : undefined
}

export const normalizeFooterContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'footer',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })
  const normalized: Record<string, any> = { ...flattened }

  const columns = normalizeFooterColumns(flattened.columns ?? flattened.sections ?? flattened.groups, warnings)
  if (columns) normalized.columns = columns

  const legalLinksSource = flattened.legalLinks ?? flattened.legal ?? flattened.policyLinks
  if (Array.isArray(legalLinksSource)) {
    const legalLinks = legalLinksSource
      .map((link, index) => normalizeFooterMenuItem(link, warnings, `legalLinks.${index}`))
      .filter((link): link is Record<string, any> => Boolean(link))
    if (legalLinks.length > 0) normalized.legalLinks = legalLinks
  }

  const socialLinks = normalizeFooterSocialLinks(flattened.socialLinks ?? flattened.social ?? flattened.socials, warnings)
  if (socialLinks) normalized.socialLinks = socialLinks

  const logo = normalizeFooterLogo(flattened)
  if (logo) normalized.logo = logo

  const newsletterSource = isRecord(flattened.newsletter) ? flattened.newsletter : undefined
  if (newsletterSource) {
    const heading = normalizeString(newsletterSource.heading ?? newsletterSource.title ?? newsletterSource.label)
    if (heading) {
      normalized.newsletter = {
        heading,
        ...(normalizeString(newsletterSource.description ?? newsletterSource.body ?? newsletterSource.text)
          ? { description: normalizeString(newsletterSource.description ?? newsletterSource.body ?? newsletterSource.text) }
          : {}),
        ...(normalizeString(newsletterSource.placeholder) ? { placeholder: normalizeString(newsletterSource.placeholder) } : {}),
        ...(normalizeString(newsletterSource.buttonText ?? newsletterSource.buttonLabel ?? newsletterSource.cta)
          ? { buttonText: normalizeString(newsletterSource.buttonText ?? newsletterSource.buttonLabel ?? newsletterSource.cta) }
          : {})
      }
    } else {
      delete normalized.newsletter
      warnings.push({
        issue: 'missing-required-field',
        message: 'Dropped footer newsletter because it has no heading.',
        field: 'newsletter',
        childType: 'footer'
      })
    }
  }

  ;[
    'sections',
    'groups',
    'legal',
    'policyLinks',
    'social',
    'socials',
    'logoImage',
    'logoUrl',
    'logoSrc',
    'brandLogo',
    'logoText',
    'logoAlt',
    'region',
    'type',
    'id'
  ].forEach(key => {
    if (key in normalized && key !== 'logo') delete normalized[key]
  })

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'footer', {
    childType: 'footer'
  })
  warnings.push(...pruneWarnings)

  return { content: pruned, warnings }
}

function deriveBreadcrumbLabel(item: Record<string, any>, fallbackHomeLabel?: string): string | undefined {
  const explicit =
    normalizeString(item.label) ??
    normalizeString(item.text) ??
    normalizeString(item.title) ??
    normalizeString(item.name)
  if (explicit) {
    return explicit
  }

  const path = normalizeString(item.path ?? item.url ?? item.href)
  if (path === '/') {
    return fallbackHomeLabel ?? 'Home'
  }

  return undefined
}

function normalizeBreadcrumbItem(
  item: unknown,
  fallbackHomeLabel: string | undefined,
  warnings: LocalNormalizationWarning[],
  index: number
): Record<string, any> | undefined {
  if (!isRecord(item)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Dropped breadcrumb item ${index} - expected object.`,
      field: `items.${index}`,
      childType: 'breadcrumbs',
      details: { index, valueType: typeof item }
    })
    return undefined
  }

  const source = item as Record<string, any>
  const sourceType = normalizeString(source.type)
  const hrefSource = isRecord(source.href) ? source.href as Record<string, any> : undefined
  const label = deriveBreadcrumbLabel(source, fallbackHomeLabel)

  if (sourceType && SMART_LINK_TYPES.has(sourceType)) {
    const href = normalizeSmartLink(source)
    return {
      ...(label ? { label } : {}),
      ...(href ? { href } : {})
    }
  }

  if (hrefSource) {
    const href = normalizeSmartLink(hrefSource)
    return {
      ...(label ? { label } : {}),
      ...(href ? { href } : {}),
      ...(typeof source.external === 'boolean' ? { external: source.external } : {}),
      ...(typeof source.target === 'string' ? { target: source.target } : {})
    }
  }

  const href = normalizeSmartLink(source.url ?? source.link ?? source.path ?? source.href)

  return {
    ...(label ? { label } : {}),
    ...(href ? { href } : {}),
    ...(typeof source.external === 'boolean' ? { external: source.external } : {}),
    ...(typeof source.target === 'string' ? { target: source.target } : {})
  }
}

export const normalizeBreadcrumbsContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'breadcrumbs',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }
  const homeLabel = normalizeString(flattened.homeLabel)
  if (Array.isArray(flattened.items)) {
    normalized.items = flattened.items
      .map((item, index) => normalizeBreadcrumbItem(item, homeLabel, warnings, index))
      .filter((item): item is Record<string, any> => Boolean(item))
  }

  const separator = normalizeString(normalized.separator)
  if (separator === '/' || separator === '>' || separator === '→' || separator === '•') {
    normalized.separator = separator
  } else {
    delete normalized.separator
  }

  if ('showHome' in normalized) {
    normalized.showHome = normalizeBooleanFlag(normalized.showHome)
  }

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'breadcrumbs', {
    childType: 'breadcrumbs'
  })
  warnings.push(...pruneWarnings)

  return { content: pruned, warnings }
}
