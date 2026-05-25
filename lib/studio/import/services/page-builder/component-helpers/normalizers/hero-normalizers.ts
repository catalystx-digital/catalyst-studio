/**
 * Hero Component Normalizers
 *
 * Normalizers for hero-simple and hero-with-image components.
 * Extracted from component-helpers.ts for modularity.
 *
 * @module hero-normalizers
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
  normalizeOverlayOpacityValue,
  isLikelyColorOrGradient,
  normalizeHeroBackgroundFocalPoint,
  type LocalNormalizationWarning,
  type ComponentContentNormalizer
} from './shared-normalizer-utils'

function createMalformedImageWarning(params: {
  field: string
  childType: string
  index: number
  message: string
  valueType?: string
}): LocalNormalizationWarning {
  return {
    issue: 'invalid-subcomponent',
    message: params.message,
    field: params.field,
    childType: params.childType,
    details: {
      index: params.index,
      ...(params.valueType ? { valueType: params.valueType } : {})
    }
  }
}

function isMediaReferenceLike(value: unknown): value is Record<string, any> {
  return isRecord(value) &&
    typeof value.mediaId === 'string' &&
    typeof value.mediaType === 'string' &&
    (value.url == null || typeof value.url === 'string')
}

function extractStructuredImage(
  value: Record<string, any>,
  fallbackAlt: string | undefined
): Record<string, any> | undefined {
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

/**
 * Collects and normalizes CTA button payloads from hero components.
 */
function collectHeroCtaPayloads(
  source: unknown,
  options: { parentCanonicalType: string; pageUrl?: string; canonicalType: string }
): { ctas: Record<string, any>[]; warnings: LocalNormalizationWarning[] } {
  const warnings: LocalNormalizationWarning[] = []
  if (source == null) {
    return { ctas: [], warnings }
  }

  const rawCtas = Array.isArray(source)
    ? source
    : isRecord(source)
      ? [source]
      : []

  if (!Array.isArray(source) && !isRecord(source)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: 'Ignored CTA payload because it is neither an array nor an object.',
      field: 'ctaButtons',
      childType: 'cta-button',
      details: { valueType: typeof source }
    })
  }

  const normalizedCtas: Record<string, any>[] = []

  rawCtas.forEach((cta, index) => {
    if (!isRecord(cta)) {
      warnings.push({
        issue: 'invalid-subcomponent',
        message: `Dropped CTA at index ${index} because payload is not an object.`,
        field: 'ctaButtons',
        childType: 'cta-button',
        details: { index, valueType: typeof cta }
      })
      return
    }

    const expanded = expandSourceRecord(cta, {
      canonicalType: options.canonicalType,
      parentCanonicalType: options.parentCanonicalType,
      field: 'ctaButtons',
      index,
      pageUrl: options.pageUrl
    })

    normalizedCtas.push(expanded)
  })

  return { ctas: normalizedCtas, warnings }
}

/**
 * Normalizes background settings for hero-simple components.
 */
function normalizeHeroSimpleBackground(
  flattened: Record<string, any>,
  _options: { parentCanonicalType: string; pageUrl?: string }
): { background?: Record<string, any>; warnings: LocalNormalizationWarning[] } {
  const warnings: LocalNormalizationWarning[] = []

  const rawBackground = flattened.background
  const backgroundSource = isRecord(rawBackground) ? rawBackground : undefined
  const backgroundSettings = backgroundSource && isRecord(backgroundSource.settings) ? backgroundSource.settings : undefined
  const backgroundOptions = backgroundSource && isRecord(backgroundSource.options) ? backgroundSource.options : undefined

  const backgroundSources = [backgroundSource, backgroundSettings, backgroundOptions].filter(
    (value): value is Record<string, any> => Boolean(value)
  )
  const searchSources = [...backgroundSources, flattened]

  const pickFirstString = (sources: Record<string, any>[], keys: string[]): string | undefined => {
    for (const source of sources) {
      if (!source) {
        continue
      }
      for (const key of keys) {
        if (!(key in source)) {
          continue
        }
        const normalizedValue = normalizeString(source[key])
        if (normalizedValue) {
          return normalizedValue
        }
      }
    }
    return undefined
  }

  const pickFirstOpacity = (sources: Record<string, any>[], keys: string[]): number | undefined => {
    for (const source of sources) {
      if (!source) {
        continue
      }
      for (const key of keys) {
        if (!(key in source)) {
          continue
        }
        const normalizedOpacity = normalizeOverlayOpacityValue(source[key])
        if (normalizedOpacity !== undefined) {
          return normalizedOpacity
        }
      }
    }
    return undefined
  }

  const imageCandidates: unknown[] = []
  const imageRecordSources: Record<string, any>[] = []

  const addImageCandidate = (value: unknown) => {
    if (value == null) {
      return
    }
    if (Array.isArray(value)) {
      value.forEach(entry => addImageCandidate(entry))
      return
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) {
        return
      }
      if (isLikelyColorOrGradient(trimmed)) {
        return
      }
      imageCandidates.push(trimmed)
      return
    }
    if (isRecord(value)) {
      imageRecordSources.push(value)
      imageCandidates.push(value)
      return
    }
    imageCandidates.push(value)
  }

  addImageCandidate(backgroundSource?.image)
  addImageCandidate(backgroundSource?.backgroundImage)
  addImageCandidate(backgroundSource?.media)
  addImageCandidate(backgroundSource?.asset)
  addImageCandidate(backgroundSource?.value)
  addImageCandidate(backgroundSource?.src)
  addImageCandidate(backgroundSource?.url)
  addImageCandidate(backgroundSource?.imageUrl)
  addImageCandidate(backgroundSource?.imageSrc)
  addImageCandidate(backgroundSource?.heroImage)

  const aliasKeys = [
    'backgroundImage',
    'background_image',
    'backgroundImg',
    'backgroundImageUrl',
    'backgroundUrl',
    'backgroundSrc',
    'backgroundMedia',
    'backgroundAsset',
    'backgroundFile',
    'heroImage',
    'heroBackground',
    'heroBackgroundImage',
    'heroBackgroundImg',
    'heroBackgroundUrl',
    'image',
    'imageUrl',
    'imageSrc'
  ]
  aliasKeys.forEach(key => {
    addImageCandidate(flattened[key])
  })

  const background: Record<string, any> = {}

  const colorCandidate = pickFirstString(searchSources, ['backgroundColor', 'bgColor', 'backgroundColour', 'color'])
  if (colorCandidate && !colorCandidate.toLowerCase().includes('gradient')) {
    background.color = colorCandidate
  }

  const gradientCandidate = pickFirstString(searchSources, ['backgroundGradient', 'gradient', 'backgroundImageGradient'])
  if (gradientCandidate) {
    if (gradientCandidate.toLowerCase().includes('gradient')) {
      background.gradient = gradientCandidate
    } else if (!background.color) {
      background.color = gradientCandidate
    }
  }

  if (typeof rawBackground === 'string') {
    const normalizedBackgroundString = normalizeString(rawBackground)
    if (normalizedBackgroundString) {
      if (normalizedBackgroundString.toLowerCase().includes('gradient')) {
        if (!background.gradient) {
          background.gradient = normalizedBackgroundString
        }
      } else if (!background.color) {
        background.color = normalizedBackgroundString
      }
    }
  }

  const overlayColorCandidate = pickFirstString(
    searchSources,
    ['overlayColor', 'overlay', 'backgroundOverlayColor', 'backgroundOverlay', 'tintColor', 'backgroundTint']
  )
  if (overlayColorCandidate) {
    background.overlayColor = overlayColorCandidate
  }

  const overlayOpacity = pickFirstOpacity(
    searchSources,
    ['overlayOpacity', 'backgroundOverlayOpacity', 'overlay_opacity', 'tintOpacity', 'overlayAlpha']
  )
  if (overlayOpacity !== undefined) {
    background.overlayOpacity = overlayOpacity
  }

  const allImageSources = [...imageRecordSources, ...searchSources]
  const fallbackAlt = pickFirstString(allImageSources, [
    'alt',
    'altText',
    'description',
    'imageAlt',
    'backgroundAlt',
    'backgroundImageAlt',
    'title',
    'name'
  ])

  let normalizedImage: NormalizedImageValue | undefined
  for (let index = 0; index < imageCandidates.length; index += 1) {
    const candidate = imageCandidates[index]
    const normalizedAsset = normalizeImage(candidate, fallbackAlt)
    if (normalizedAsset && (normalizedAsset.src || normalizedAsset.mediaId)) {
      normalizedImage = { ...normalizedAsset }
      if (normalizedAsset.mediaId && !normalizedAsset.src) {
        warnings.push({
          issue: 'media-src-missing',
          message: 'Hero background image mediaId detected without a usable src.',
          field: 'background.image',
          childType: 'hero-simple-background-image',
          details: { index, mediaId: normalizedAsset.mediaId }
        })
      }
      break
    }

    warnings.push(createMalformedImageWarning({
      field: 'background.image',
      childType: 'hero-simple-background-image',
      index,
      message: 'Dropped hero background image payload because it did not contain a usable image source.',
      valueType: Array.isArray(candidate) ? 'array' : typeof candidate
    }))
  }

  if (normalizedImage) {
    const focalPointCandidate = pickFirstString(
      allImageSources,
      ['focalPoint', 'imageFocalPoint', 'backgroundFocalPoint', 'objectPosition', 'backgroundPosition', 'imagePosition']
    )
    const normalizedFocalPoint = normalizeHeroBackgroundFocalPoint(focalPointCandidate)
    if (normalizedFocalPoint) {
      normalizedImage.focalPoint = normalizedFocalPoint
    }

    background.image = normalizedImage
  }

  const imagePositionRaw = pickFirstString(
    allImageSources,
    ['imagePosition', 'backgroundPosition', 'objectPosition', 'imageAlignment']
  )
  if (imagePositionRaw) {
    background.imagePosition = imagePositionRaw
  }

  if (Object.keys(background).length === 0) {
    return { warnings }
  }

  return { background, warnings }
}

/**
 * Normalizes hero-simple component content.
 */
export const normalizeHeroSimpleContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'hero-simple',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }

  const { ctas: normalizedCtas, warnings: ctaWarnings } = collectHeroCtaPayloads(flattened.ctaButtons, {
    parentCanonicalType: options.parentCanonicalType,
    pageUrl: options.pageUrl,
    canonicalType: 'hero-simple-cta'
  })
  if (ctaWarnings.length > 0) {
    warnings.push(...ctaWarnings)
  }

  if (normalizedCtas.length > 0) {
    normalized.ctaButtons = normalizedCtas
  } else {
    delete normalized.ctaButtons
  }

  const supportingSource = Array.isArray(flattened.supportingLinks)
    ? flattened.supportingLinks
    : isRecord(flattened.supportingLinks)
      ? [flattened.supportingLinks]
      : []

  const normalizedLinks: Record<string, any>[] = []

  supportingSource.forEach((link, index) => {
    if (!isRecord(link)) {
      return
    }

    const expanded = expandSourceRecord(link, {
      canonicalType: 'hero-simple-supporting-link',
      parentCanonicalType: options.parentCanonicalType,
      field: 'supportingLinks',
      index,
      pageUrl: options.pageUrl
    })

    const label =
      normalizeString(expanded.label) ??
      normalizeString(expanded.text) ??
      normalizeString(expanded.title) ??
      normalizeString(expanded.name)
    const href =
      extractLinkUrl(expanded.href) ??
      extractLinkUrl(expanded.url) ??
      extractLinkUrl(expanded.link)

    if (!label || !href) {
      return
    }

    const normalizedLink: Record<string, any> = { label, href }

    const icon =
      normalizeString(expanded.icon) ??
      normalizeString(expanded.iconName) ??
      normalizeString(expanded.symbol)
    if (icon) {
      normalizedLink.icon = icon
    }

    let external =
      normalizeBooleanFlag(expanded.external) ??
      normalizeBooleanFlag(expanded.isExternal) ??
      normalizeBooleanFlag(expanded.newTab) ??
      normalizeBooleanFlag(expanded.opensInNewTab)
    if (external === undefined && typeof expanded.target === 'string') {
      const target = expanded.target.trim().toLowerCase()
      if (target === '_blank') {
        external = true
      }
    }
    if (external !== undefined) {
      normalizedLink.external = external
    }

    normalizedLinks.push(normalizedLink)
  })

  if (normalizedLinks.length > 0) {
    normalized.supportingLinks = normalizedLinks
  } else {
    delete normalized.supportingLinks
  }

  const { background, warnings: backgroundWarnings } = normalizeHeroSimpleBackground(flattened, options)
  if (backgroundWarnings.length > 0) {
    warnings.push(...backgroundWarnings)
  }
  if (background) {
    normalized.background = background

    const backgroundAliasKeys = [
      'backgroundImage',
      'background_image',
      'backgroundImg',
      'backgroundImageUrl',
      'backgroundUrl',
      'backgroundSrc',
      'backgroundMedia',
      'backgroundAsset',
      'backgroundFile',
      'heroImage',
      'heroBackground',
      'heroBackgroundImage',
      'heroBackgroundImg',
      'heroBackgroundUrl',
      'image',
      'imageUrl',
      'imageSrc',
      'backgroundColor',
      'bgColor',
      'backgroundColour',
      'gradient',
      'backgroundGradient',
      'backgroundImageGradient',
      'overlayColor',
      'overlay',
      'backgroundOverlayColor',
      'backgroundOverlay',
      'tintColor',
      'backgroundTint',
      'overlayOpacity',
      'backgroundOverlayOpacity',
      'overlay_opacity',
      'tintOpacity',
      'overlayAlpha',
      'backgroundPosition',
      'imagePosition',
      'objectPosition',
      'imageAlignment',
      'focalPoint',
      'imageFocalPoint',
      'backgroundFocalPoint'
    ]
    backgroundAliasKeys.forEach(alias => {
      if (alias in normalized && alias !== 'background') {
        delete normalized[alias]
      }
    })
  } else if (Object.prototype.hasOwnProperty.call(normalized, 'background')) {
    delete normalized.background
  }

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'hero-simple', {
    childType: 'hero-simple'
  })
  if (pruneWarnings.length > 0) {
    warnings.push(...pruneWarnings)
  }

  return { content: pruned, warnings }
}

/**
 * Normalizes a hero-with-image image candidate.
 */
function normalizeHeroWithImageImageCandidate(
  candidate: unknown,
  options: { parentCanonicalType: string; pageUrl?: string; index: number }
): { image?: Record<string, any>; warning?: LocalNormalizationWarning } {
  if (candidate == null) {
    return {}
  }

  if (typeof candidate === 'string') {
    const normalizedAsset = normalizeImage(candidate)
    if (normalizedAsset?.src) {
      return { image: { ...normalizedAsset } }
    }
    return {
      warning: createMalformedImageWarning({
        field: 'image',
        childType: 'hero-with-image-image',
        index: options.index,
        message: 'Dropped hero image missing src.'
      })
    }
  }

  if (Array.isArray(candidate)) {
    for (let idx = 0; idx < candidate.length; idx += 1) {
      const { image, warning } = normalizeHeroWithImageImageCandidate(candidate[idx], {
        parentCanonicalType: options.parentCanonicalType,
        pageUrl: options.pageUrl,
        index: options.index + idx
      })
      if (image) {
        return { image }
      }
      if (warning) {
        return { warning }
      }
    }
    return {}
  }

  if (!isRecord(candidate)) {
    return {
      warning: createMalformedImageWarning({
        field: 'image',
        childType: 'hero-with-image-image',
        index: options.index,
        message: 'Dropped hero image payload because it is not an object or URL.',
        valueType: typeof candidate
      })
    }
  }

  const expanded = expandSourceRecord(candidate, {
    canonicalType: 'hero-with-image-image',
    parentCanonicalType: options.parentCanonicalType,
    field: 'image',
    index: options.index,
    pageUrl: options.pageUrl
  })

  const fallbackAlt =
    normalizeString(expanded.alt) ??
    normalizeString(expanded.altText) ??
    normalizeString(expanded.title) ??
    normalizeString(expanded.name) ??
    normalizeString(expanded.description)
  const structuredImage = extractStructuredImage(expanded, fallbackAlt)
  if (structuredImage) {
    return { image: structuredImage }
  }
  const normalizedAsset: NormalizedImageValue | undefined = normalizeImage(expanded, fallbackAlt)
  const src =
    normalizedAsset?.src ??
    extractLinkUrl(expanded.src) ??
    extractLinkUrl(expanded.url) ??
    extractLinkUrl(expanded.href) ??
    extractLinkUrl(expanded.link) ??
    extractLinkUrl(expanded.image) ??
    extractLinkUrl(expanded.path) ??
    extractLinkUrl(expanded.value)

  if (!src && !(normalizedAsset?.mediaId && normalizedAsset.mediaId.trim().length > 0)) {
    return {
      warning: createMalformedImageWarning({
        field: 'image',
        childType: 'hero-with-image-image',
        index: options.index,
        message: 'Dropped hero image missing src.'
      })
    }
  }

  const image: Record<string, any> = normalizedAsset ? { ...normalizedAsset } : {}
  if (!image.src && src) {
    image.src = src
  }
  if (normalizedAsset?.originalUrl && !image.originalUrl) {
    image.originalUrl = normalizedAsset.originalUrl
  }
  if (!image.alt && fallbackAlt) {
    image.alt = fallbackAlt
  }

  const backgroundPosition =
    normalizeString(expanded.backgroundPosition) ??
    normalizeString(expanded.position) ??
    normalizeString(expanded.imagePosition)
  if (backgroundPosition) {
    image.backgroundPosition = backgroundPosition
  }

  const objectFit = normalizeString(expanded.objectFit) ?? normalizeString(expanded.fit)
  if (objectFit) {
    image.objectFit = objectFit
  }

  const overlayColor =
    normalizeString(expanded.overlayColor) ??
    normalizeString(expanded.overlay) ??
    normalizeString(expanded.tintColor)
  if (overlayColor) {
    image.overlayColor = overlayColor
  }

  let warning: LocalNormalizationWarning | undefined
  if (normalizedAsset?.mediaId && (!image.src || (typeof image.src === 'string' && image.src.trim().length === 0))) {
    warning = {
      issue: 'media-src-missing',
      message: 'Hero image mediaId detected without a usable src.',
      field: 'image',
      childType: 'hero-with-image-image',
      details: { index: options.index, mediaId: normalizedAsset.mediaId }
    }
  }

  return { image, warning }
}

/**
 * Resolves the image for a hero-with-image component.
 */
function resolveHeroWithImageImage(
  flattened: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
): { image?: Record<string, any>; warnings: LocalNormalizationWarning[] } {
  const warnings: LocalNormalizationWarning[] = []
  const primaryKeys = [
    'image',
    'heroImage',
    'primaryImage',
    'media',
    'picture',
    'photo',
    'artwork',
    'backgroundImage',
    'coverImage'
  ]

  for (let i = 0; i < primaryKeys.length; i += 1) {
    const key = primaryKeys[i]
    if (!(key in flattened)) {
      continue
    }
    const { image, warning } = normalizeHeroWithImageImageCandidate(flattened[key], {
      parentCanonicalType: options.parentCanonicalType,
      pageUrl: options.pageUrl,
      index: i
    })
    if (warning) {
      warnings.push(warning)
    }
    if (image) {
      return { image, warnings }
    }
  }

  const fallbackSrc =
    extractLinkUrl(flattened.imageUrl) ??
    extractLinkUrl(flattened.imageSrc) ??
    extractLinkUrl(flattened.heroImageUrl) ??
    extractLinkUrl(flattened.mediaUrl) ??
    extractLinkUrl(flattened.featuredImage)

  if (fallbackSrc) {
    return { image: { src: fallbackSrc }, warnings }
  }

  return { warnings }
}

/**
 * Normalizes hero-with-image component content.
 */
export const normalizeHeroWithImageContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'hero-with-image',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }

  const hadCtaSource = Object.prototype.hasOwnProperty.call(normalized, 'ctaButtons')
  const { ctas: normalizedCtas, warnings: ctaWarnings } = collectHeroCtaPayloads(normalized.ctaButtons, {
    parentCanonicalType: options.parentCanonicalType,
    pageUrl: options.pageUrl,
    canonicalType: 'hero-with-image-cta'
  })
  if (ctaWarnings.length > 0) {
    warnings.push(...ctaWarnings)
  }

  if (normalizedCtas.length > 0) {
    normalized.ctaButtons = normalizedCtas
  } else if (hadCtaSource) {
    normalized.ctaButtons = []
  } else {
    delete normalized.ctaButtons
  }

  const { image, warnings: imageWarnings } = resolveHeroWithImageImage(flattened, options)
  if (imageWarnings.length > 0) {
    warnings.push(...imageWarnings)
  }
  if (image) {
    normalized.image = image
  } else if (Object.prototype.hasOwnProperty.call(normalized, 'image')) {
    delete normalized.image
  }

  ;[
    'heroImage',
    'primaryImage',
    'media',
    'picture',
    'photo',
    'artwork',
    'backgroundImage',
    'coverImage',
    'imageUrl',
    'imageSrc',
    'heroImageUrl',
    'mediaUrl',
    'featuredImage'
  ].forEach(alias => {
    if (alias in normalized && alias !== 'image') {
      delete normalized[alias]
    }
  })

  return { content: normalized, warnings }
}
