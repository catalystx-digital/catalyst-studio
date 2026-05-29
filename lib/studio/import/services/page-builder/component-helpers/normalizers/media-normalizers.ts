/**
 * Media Component Normalizers
 *
 * Normalizers for media-heavy components.
 * Extracted from component-helpers.ts for modularity.
 *
 * @module media-normalizers
 */

import {
  expandSourceRecord,
  normalizeImage,
  normalizeString,
  normalizeBooleanFlag,
  coerceBoolean,
  extractLinkUrl,
  pruneObjectAgainstContract,
  type LocalNormalizationWarning,
  type ComponentContentNormalizer
} from './shared-normalizer-utils'

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function normalizeGalleryDisplayMode(value: unknown): 'grid' | 'carousel' | 'masonry' | undefined {
  const normalized = normalizeString(value)?.toLowerCase().replace(/[^a-z]/g, '')
  if (!normalized) return undefined
  if (normalized === 'carousel' || normalized === 'slider' || normalized === 'slideshow') return 'carousel'
  if (normalized === 'masonry' || normalized === 'waterfall') return 'masonry'
  if (normalized === 'grid' || normalized === 'gallery' || normalized === 'tiles') return 'grid'
  return undefined
}

function normalizeGallerySpacing(value: unknown): 'tight' | 'normal' | 'loose' | undefined {
  const normalized = normalizeString(value)?.toLowerCase().replace(/[^a-z]/g, '')
  if (!normalized) return undefined
  if (normalized === 'tight' || normalized === 'compact' || normalized === 'small') return 'tight'
  if (normalized === 'loose' || normalized === 'spacious' || normalized === 'large') return 'loose'
  if (normalized === 'normal' || normalized === 'medium' || normalized === 'default') return 'normal'
  return undefined
}

function readStringField(record: Record<string, any>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = normalizeString(record[key])
    if (value) return value
  }
  return undefined
}

function normalizeGalleryImageEntry(
  entry: unknown,
  index: number,
  warnings: LocalNormalizationWarning[],
  options: { parentCanonicalType: string; pageUrl?: string }
): Record<string, any> | null {
  const record = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as Record<string, any> : {}
  const imageWarnings: LocalNormalizationWarning[] = []
  const fallbackAlt = readStringField(record, ['alt', 'altText', 'title', 'name', 'caption']) ?? `Gallery image ${index + 1}`
  const normalized = normalizeImage(entry, fallbackAlt, {
    field: `images.${index}`,
    warnings: imageWarnings,
    context: {
      canonicalType: 'image-gallery',
      parentCanonicalType: options.parentCanonicalType,
      field: 'images',
      index,
      pageUrl: options.pageUrl
    }
  })

  warnings.push(...imageWarnings)

  if (!normalized) {
    warnings.push({
      issue: 'invalid-value',
      message: `Removed invalid image-gallery image at index ${index}.`,
      field: `images.${index}`,
      childType: 'image-gallery',
      details: { index }
    })
    return null
  }

  if (!normalized.src && !normalized.originalUrl) {
    warnings.push({
      issue: 'invalid-value',
      message: `Removed image-gallery image at index ${index} because it has no renderable URL.`,
      field: `images.${index}`,
      childType: 'image-gallery',
      details: { index, mediaId: normalized.mediaId }
    })
    return null
  }

  const image: Record<string, any> = {}
  if (normalized.mediaId) {
    image.src = {
      mediaId: normalized.mediaId,
      mediaType: 'image',
      ...(normalized.src ? { url: normalized.src } : {}),
      ...(normalized.alt ? { alt: normalized.alt } : {})
    }
  }
  if (normalized.alt) {
    image.alt = normalized.alt
  }
  if (normalized.originalUrl ?? normalized.src) {
    image.originalUrl = normalized.originalUrl ?? normalized.src
  }
  if (normalized.renditions) {
    image.renditions = normalized.renditions
  }

  const caption = readStringField(record, ['caption', 'description', 'subtitle'])
  const credit = readStringField(record, ['credit', 'attribution'])
  const width = normalizeNumber(record.width ?? record.imageWidth ?? record.originalWidth)
  const height = normalizeNumber(record.height ?? record.imageHeight ?? record.originalHeight)
  if (caption) image.caption = caption
  if (credit) image.credit = credit
  if (width !== undefined) image.width = width
  if (height !== undefined) image.height = height

  return image
}

/**
 * Normalizes image-gallery component content.
 * Converts URL aliases into the schema-compatible image shape used by CMS renderers.
 */
export const normalizeImageGalleryContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'image-gallery',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }
  const rawImages =
    Array.isArray(flattened.images) ? flattened.images :
    Array.isArray(flattened.gallery) ? flattened.gallery :
    Array.isArray(flattened.items) ? flattened.items :
    []

  normalized.images = rawImages
    .map((entry, index) => normalizeGalleryImageEntry(entry, index, warnings, options))
    .filter((image): image is Record<string, any> => image !== null)
  delete normalized.gallery
  delete normalized.items

  const displayMode = normalizeGalleryDisplayMode(flattened.displayMode ?? flattened.layout ?? flattened.mode)
  if (displayMode) {
    normalized.displayMode = displayMode
  }
  delete normalized.layout
  delete normalized.mode

  const columns = normalizeNumber(flattened.columns ?? flattened.columnCount ?? flattened.cols)
  if (columns !== undefined) {
    normalized.columns = Math.min(6, Math.max(2, Math.round(columns)))
  }
  delete normalized.columnCount
  delete normalized.cols

  const spacing = normalizeGallerySpacing(flattened.spacing ?? flattened.gap)
  if (spacing) {
    normalized.spacing = spacing
  }
  delete normalized.gap

  const booleanKeys: Array<'showCaptions' | 'enableLightbox' | 'autoPlay'> = ['showCaptions', 'enableLightbox', 'autoPlay']
  booleanKeys.forEach(key => {
    if (key in normalized) {
      normalized[key] = coerceBoolean(normalized[key])
    }
  })

  const autoPlayInterval = normalizeNumber(flattened.autoPlayInterval ?? flattened.interval)
  if (autoPlayInterval !== undefined) {
    normalized.autoPlayInterval = autoPlayInterval
  }
  delete normalized.interval

  for (const field of ['heading', 'title', 'description']) {
    if (field in normalized) {
      warnings.push({
        issue: 'unknown-field',
        message: `Removed unsupported field "${field}" from image-gallery.`,
        field,
        childType: 'image-gallery',
        details: { field }
      })
      delete normalized[field]
    }
  }

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'image-gallery', {
    childType: 'image-gallery'
  })
  if (pruneWarnings.length > 0) {
    warnings.push(...pruneWarnings)
  }

  return { content: pruned, warnings }
}

function inferVideoProvider(url: string): 'youtube' | 'vimeo' | 'loom' | 'wistia' | 'iframe' {
  let hostname = ''
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return 'iframe'
  }

  if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com') || hostname === 'youtu.be') return 'youtube'
  if (hostname === 'vimeo.com' || hostname.endsWith('.vimeo.com')) return 'vimeo'
  if (hostname === 'loom.com' || hostname.endsWith('.loom.com')) return 'loom'
  if (
    hostname === 'wistia.com' ||
    hostname.endsWith('.wistia.com') ||
    hostname === 'wistia.net' ||
    hostname.endsWith('.wistia.net')
  ) return 'wistia'
  return 'iframe'
}

function normalizeVideoProvider(provider: unknown): 'youtube' | 'vimeo' | 'loom' | 'wistia' | 'iframe' | undefined {
  const normalized = normalizeString(provider)?.toLowerCase().replace(/[^a-z]/g, '')
  if (!normalized) return undefined
  if (normalized === 'youtube' || normalized === 'youtu') return 'youtube'
  if (normalized === 'vimeo') return 'vimeo'
  if (normalized === 'loom') return 'loom'
  if (normalized === 'wistia') return 'wistia'
  if (normalized === 'iframe' || normalized === 'embed') return 'iframe'
  return undefined
}

/**
 * Normalizes video-embed component content.
 * Handles URL resolution and boolean property normalization.
 */
export const normalizeVideoEmbedContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'video-embed',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }

  const urlCandidate =
    extractLinkUrl(flattened.url) ??
    extractLinkUrl(flattened.embedUrl) ??
    extractLinkUrl(flattened.source) ??
    extractLinkUrl(flattened.src) ??
    extractLinkUrl(flattened.videoUrl)

  if (urlCandidate) {
    normalized.url = urlCandidate
    delete normalized.embedUrl
    delete normalized.source
    delete normalized.src
    delete normalized.videoUrl
    normalized.provider = normalizeVideoProvider(normalized.provider) ?? inferVideoProvider(urlCandidate)
  } else if (normalized.url && typeof normalized.url !== 'string') {
    delete normalized.url
  }

  const booleanKeys: Array<'allowFullScreen' | 'autoPlay' | 'muted'> = ['allowFullScreen', 'autoPlay', 'muted']
  booleanKeys.forEach(key => {
    if (key in normalized) {
      const value = normalizeBooleanFlag(normalized[key])
      if (value !== undefined) {
        normalized[key] = value
      } else if (typeof normalized[key] === 'string') {
        const trimmed = normalizeString(normalized[key])
        if (trimmed === undefined) {
          delete normalized[key]
        } else {
          normalized[key] = trimmed
        }
      }
    }
  })

  if ('startTime' in normalized) {
    const rawStart = normalized.startTime
    if (typeof rawStart === 'string') {
      const trimmed = rawStart.trim()
      if (!trimmed) {
        delete normalized.startTime
      } else {
        const parsed = Number(trimmed)
        if (Number.isFinite(parsed)) {
          normalized.startTime = parsed
        } else {
          delete normalized.startTime
        }
      }
    }
  }

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'video-embed', {
    childType: 'video-embed'
  })
  if (pruneWarnings.length > 0) {
    warnings.push(...pruneWarnings)
  }

  return { content: pruned, warnings }
}
