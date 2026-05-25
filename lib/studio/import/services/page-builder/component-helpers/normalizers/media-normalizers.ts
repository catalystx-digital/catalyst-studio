/**
 * Media Component Normalizers
 *
 * Normalizers for video-embed component.
 * Extracted from component-helpers.ts for modularity.
 *
 * @module media-normalizers
 */

import {
  expandSourceRecord,
  normalizeString,
  normalizeBooleanFlag,
  extractLinkUrl,
  pruneObjectAgainstContract,
  type LocalNormalizationWarning,
  type ComponentContentNormalizer
} from './shared-normalizer-utils'

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
