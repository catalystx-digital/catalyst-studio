import {
  coerceBoolean,
  expandSourceRecord,
  extractLinkUrl,
  isRecord,
  normalizeImage,
  normalizeString,
  pruneObjectAgainstContract,
  type ComponentContentNormalizer,
  type LocalNormalizationWarning
} from './shared-normalizer-utils'

function pageIdFromPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'home'
}

function normalizeSmartLink(value: unknown): Record<string, any> | undefined {
  const rawHref = extractLinkUrl(value)
  const href = rawHref?.startsWith('//')
    ? `https:${rawHref}`
    : rawHref && /^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(rawHref)
      ? `https://${rawHref}`
      : rawHref
  if (!href) return undefined
  if (href.startsWith('#')) return { type: 'anchor', href }
  if (href.startsWith('mailto:')) return { type: 'email', href }
  if (href.startsWith('tel:')) return { type: 'phone', href }
  if (/^https?:\/\//i.test(href)) return { type: 'external', url: href }
  return { type: 'internal', pageId: pageIdFromPath(href), path: href }
}

function normalizeLogoCloudItem(
  value: unknown,
  index: number,
  warnings: LocalNormalizationWarning[],
  options: { parentCanonicalType: string; pageUrl?: string }
): Record<string, any> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Dropped logo-cloud logo ${index} because it is not an object.`,
      field: `logos.${index}`,
      childType: 'logo-cloud'
    })
    return undefined
  }

  const record = value as Record<string, any>
  const fallbackAlt =
    normalizeString(record.alt) ??
    normalizeString(record.altText) ??
    normalizeString(record.name) ??
    normalizeString(record.title) ??
    normalizeString(record.label) ??
    `Logo ${index + 1}`
  const imageWarnings: LocalNormalizationWarning[] = []
  const normalizedImage = normalizeImage(record.image ?? record.logo ?? record.src ?? record.url ?? record, fallbackAlt, {
    field: `logos.${index}`,
    warnings: imageWarnings,
    context: {
      canonicalType: 'logo-cloud',
      parentCanonicalType: options.parentCanonicalType,
      field: 'logos',
      index,
      pageUrl: options.pageUrl
    }
  })
  warnings.push(...imageWarnings)

  if (!normalizedImage?.src && !normalizedImage?.originalUrl) {
    warnings.push({
      issue: 'invalid-value',
      message: `Dropped logo-cloud logo ${index} because it has no renderable image URL.`,
      field: `logos.${index}`,
      childType: 'logo-cloud',
      details: { index, mediaId: normalizedImage?.mediaId }
    })
    return undefined
  }

  const id =
    normalizeString(record.id) ??
    normalizeString(record.slug) ??
    normalizeString(record.name)?.replace(/[^a-z0-9]+/gi, '-').toLowerCase() ??
    `logo-${index + 1}`
  const href = normalizeSmartLink(record.href ?? record.link ?? record.urlLink ?? record.website)
  if (typeof (record.href ?? record.link ?? record.urlLink ?? record.website) === 'string' && href) {
    warnings.push({
      issue: 'suspicious-value',
      message: `Normalized logo-cloud string link at logos.${index} into a structured SmartLink.`,
      field: `logos.${index}.href`,
      childType: 'logo-cloud'
    })
  }

  return {
    id,
    ...(normalizedImage.mediaId
      ? {
          src: {
            mediaId: normalizedImage.mediaId,
            mediaType: 'image',
            ...(normalizedImage.src ? { url: normalizedImage.src } : {}),
            ...(normalizedImage.alt ? { alt: normalizedImage.alt } : {})
          }
        }
      : {}),
    ...(normalizedImage.alt ? { alt: normalizedImage.alt } : { alt: fallbackAlt }),
    ...(normalizedImage.originalUrl ?? normalizedImage.src ? { originalUrl: normalizedImage.originalUrl ?? normalizedImage.src } : {}),
    ...(normalizedImage.renditions ? { renditions: normalizedImage.renditions } : {}),
    ...(href ? { href } : {}),
    ...(normalizeString(record.caption) ? { caption: normalizeString(record.caption) } : {})
  }
}

function normalizeLogoCloudSize(value: unknown): 'small' | 'medium' | 'large' | undefined {
  const normalized = normalizeString(value)?.toLowerCase()
  if (normalized === 'small' || normalized === 'sm' || normalized === 'compact') return 'small'
  if (normalized === 'large' || normalized === 'lg') return 'large'
  if (normalized === 'medium' || normalized === 'md' || normalized === 'default') return 'medium'
  return undefined
}

function slugFromText(value: string, fallback: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48) || fallback
}

function normalizeRating(value: unknown): number | undefined {
  const raw = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : undefined
  if (!Number.isFinite(raw)) return undefined
  const rating = Math.round(raw as number)
  return rating >= 1 && rating <= 5 ? rating : undefined
}

function normalizeTestimonialItem(
  value: unknown,
  index: number,
  warnings: LocalNormalizationWarning[]
): Record<string, any> | undefined {
  if (!isRecord(value)) {
    warnings.push({
      issue: 'invalid-subcomponent',
      message: `Dropped testimonial at index ${index} because payload is not an object.`,
      field: 'testimonials',
      childType: 'testimonial-item',
      details: { index, valueType: typeof value }
    })
    return undefined
  }

  const flattened = expandSourceRecord(value, {
    canonicalType: 'testimonial-item',
    parentCanonicalType: 'testimonials',
    field: 'testimonials',
    index
  })
  const quote = normalizeString(flattened.quote ?? flattened.text ?? flattened.body ?? flattened.review ?? flattened.testimonial)
  const author = normalizeString(flattened.author ?? flattened.name ?? flattened.person ?? flattened.customer ?? flattened.client)
  if (!quote || !author) {
    warnings.push({
      issue: 'missing-required-field',
      message: `Dropped testimonial at index ${index} because quote or author is missing.`,
      field: 'testimonials',
      childType: 'testimonial-item',
      details: { index, quotePresent: Boolean(quote), authorPresent: Boolean(author) }
    })
    return undefined
  }

  const avatar = normalizeImage(flattened.avatar ?? flattened.image ?? flattened.photo ?? flattened.headshot, author)?.src
  const role = normalizeString(flattened.role ?? flattened.title ?? flattened.jobTitle)
  const company = normalizeString(flattened.company ?? flattened.organization ?? flattened.org)
  const rating = normalizeRating(flattened.rating ?? flattened.stars)

  return {
    id: normalizeString(flattened.id) ?? `testimonial-item-${slugFromText(author, `testimonial-${index + 1}`)}`,
    quote,
    author,
    ...(role ? { role } : {}),
    ...(company ? { company } : {}),
    ...(avatar ? { avatar } : {}),
    ...(rating ? { rating } : {})
  }
}

export const normalizeTestimonialsContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'testimonials',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })
  const normalized: Record<string, any> = { ...flattened }
  const rawTestimonials =
    Array.isArray(flattened.testimonials) ? flattened.testimonials :
    Array.isArray(flattened.items) ? flattened.items :
    Array.isArray(flattened.reviews) ? flattened.reviews :
    Array.isArray(flattened.quotes) ? flattened.quotes :
    []

  normalized.testimonials = rawTestimonials
    .map((entry, index) => normalizeTestimonialItem(entry, index, warnings))
    .filter((entry): entry is Record<string, any> => Boolean(entry))
  delete normalized.items
  delete normalized.reviews
  delete normalized.quotes

  if ('showNavigation' in normalized) normalized.showNavigation = coerceBoolean(normalized.showNavigation)
  if ('showDots' in normalized) normalized.showDots = coerceBoolean(normalized.showDots)
  if ('pauseOnHover' in normalized) normalized.pauseOnHover = coerceBoolean(normalized.pauseOnHover)
  const interval = typeof normalized.autoPlayInterval === 'string'
    ? Number(normalized.autoPlayInterval)
    : normalized.autoPlayInterval
  if (Number.isFinite(interval)) normalized.autoPlayInterval = interval

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'testimonials', {
    childType: 'testimonials'
  })
  warnings.push(...pruneWarnings)
  return { content: pruned, warnings }
}

export const normalizeLogoCloudContent: ComponentContentNormalizer = (
  rawContent: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(rawContent, {
    canonicalType: 'logo-cloud',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })
  const normalized: Record<string, any> = { ...flattened }
  const rawLogos =
    Array.isArray(flattened.logos) ? flattened.logos :
    Array.isArray(flattened.items) ? flattened.items :
    Array.isArray(flattened.brands) ? flattened.brands :
    Array.isArray(flattened.clients) ? flattened.clients :
    Array.isArray(flattened.partners) ? flattened.partners :
    []

  normalized.logos = rawLogos
    .map((entry, index) => normalizeLogoCloudItem(entry, index, warnings, options))
    .filter((entry): entry is Record<string, any> => Boolean(entry))
  delete normalized.items
  delete normalized.brands
  delete normalized.clients
  delete normalized.partners

  const size = normalizeLogoCloudSize(flattened.size ?? flattened.logoSize)
  if (size) normalized.size = size
  delete normalized.logoSize

  if ('animateScroll' in normalized) normalized.animateScroll = coerceBoolean(normalized.animateScroll)
  if ('grayscale' in normalized) normalized.grayscale = coerceBoolean(normalized.grayscale)

  const scrollSpeed = typeof flattened.scrollSpeed === 'number'
    ? flattened.scrollSpeed
    : typeof flattened.scrollSpeed === 'string'
      ? Number(flattened.scrollSpeed)
      : undefined
  if (Number.isFinite(scrollSpeed)) normalized.scrollSpeed = scrollSpeed

  const { result: pruned, warnings: pruneWarnings } = pruneObjectAgainstContract(normalized, 'logo-cloud', {
    childType: 'logo-cloud'
  })
  warnings.push(...pruneWarnings)
  return { content: pruned, warnings }
}
