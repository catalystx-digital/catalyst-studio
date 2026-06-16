/**
 * Blog Component Normalizers
 *
 * Normalizers for blog-list, blog-post, and article-header components.
 * Extracted from component-helpers.ts for modularity.
 *
 * @module blog-normalizers
 */

import {
  expandSourceRecord,
  normalizeString,
  isRecord,
  type LocalNormalizationWarning,
  type ComponentContentNormalizer
} from './shared-normalizer-utils'

function getImageUrl(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (!isRecord(value)) return undefined
  if (typeof value.url === 'string') return value.url
  if (typeof value.src === 'string') return value.src
  if (isRecord(value.src) && typeof value.src.url === 'string') return value.src.url
  if (typeof value.originalUrl === 'string') return value.originalUrl
  return undefined
}

function isLikelyBrandAssetImage(src: string): boolean {
  const lowerSrc = src.toLowerCase()
  const pathname = (() => {
    try {
      return new URL(src, 'https://example.invalid').pathname.toLowerCase()
    } catch {
      return lowerSrc.split(/[?#]/, 1)[0] || lowerSrc
    }
  })()
  const filename = pathname.split('/').filter(Boolean).pop() || pathname
  const pathSegments = pathname.split('/').filter(Boolean)
  const directorySegments = pathSegments.slice(0, -1)
  const extension = filename.match(/\.[a-z0-9]+$/i)?.[0] ?? ''

  return (
    directorySegments.some(segment => segment === 'logos' || segment === 'logo' || /^logo[-_]\d/.test(segment)) ||
    filename.includes('brandmark') ||
    filename.includes('wordmark') ||
    (filename.includes('logo') && extension === '.svg')
  )
}

/**
 * Normalizes blog-list component content.
 * Handles optional post images without synthesizing placeholders.
 */
export const normalizeBlogListContent: ComponentContentNormalizer = (
  content: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const flattened = expandSourceRecord(content, {
    canonicalType: 'blog-list',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalizePosts = (value: unknown): unknown => {
    if (!Array.isArray(value)) {
      return value
    }
    return value.map(item => {
      if (!isRecord(item)) {
        return item
      }
      const { image: _image, author: _author, ...rest } = item
      const imageUrl = getImageUrl(item.image)
      if (item.image !== null && (!imageUrl || !isLikelyBrandAssetImage(imageUrl))) {
        rest.image = item.image
      }
      if (item.author !== null) {
        rest.author = item.author
      }
      return rest
    })
  }

  return {
    content: {
      ...flattened,
      ...(Object.prototype.hasOwnProperty.call(flattened, 'posts') ? { posts: normalizePosts(flattened.posts) } : {}),
      ...(Object.prototype.hasOwnProperty.call(flattened, 'manualPosts') ? { manualPosts: normalizePosts(flattened.manualPosts) } : {})
    },
    warnings: []
  }
}

/**
 * Normalizes blog-post component content.
 * Handles bodyHtml/bodyText normalization without reintroducing legacy body aliases.
 */
export const normalizeBlogPostContent: ComponentContentNormalizer = (
  content: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(content, {
    canonicalType: 'blog-post',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }
  const bodyText = normalizeString(flattened.bodyText)
  const bodyHtml = normalizeString(flattened.bodyHtml)

  delete normalized.body
  delete normalized.text
  delete normalized.copy
  delete normalized.html
  delete normalized.bodyHTML

  if (bodyText) {
    normalized.bodyText = bodyText
  }
  if (bodyHtml) {
    normalized.bodyHtml = bodyHtml
  } else {
    delete normalized.bodyHtml
    warnings.push({
      issue: 'missing-required-field',
      message: 'Blog post is missing required bodyHtml field.',
      field: 'bodyHtml',
      childType: 'blog-post',
      details: { field: 'bodyHtml' }
    })
  }

  return { content: normalized, warnings }
}

/**
 * Normalizes article-header component content.
 * Handles title, author, and publish date extraction with fallbacks.
 */
export const normalizeArticleHeaderContent: ComponentContentNormalizer = (
  content: Record<string, any>,
  options: { parentCanonicalType: string; pageUrl?: string }
) => {
  const warnings: LocalNormalizationWarning[] = []
  const flattened = expandSourceRecord(content, {
    canonicalType: 'article-header',
    parentCanonicalType: options.parentCanonicalType,
    field: 'content',
    index: 0,
    pageUrl: options.pageUrl
  })

  const normalized: Record<string, any> = { ...flattened }
  const metadata = isRecord(flattened.metadata) ? (flattened.metadata as Record<string, unknown>) : undefined

  const resolvedTitle =
    normalizeString(flattened.title) ??
    normalizeString(flattened.heading) ??
    normalizeString(flattened.label) ??
    normalizeString(flattened.name) ??
    (metadata ? normalizeString(metadata.title) : undefined)
  if (resolvedTitle) {
    normalized.title = resolvedTitle
  } else {
    delete normalized.title
    warnings.push({
      issue: 'missing-required-field',
      message: 'Article header is missing required title field.',
      field: 'title',
      childType: 'article-header',
      details: { field: 'title' }
    })
  }

  const coerceAuthorObject = (value: unknown): Record<string, any> | undefined => {
    if (!value) {
      return undefined
    }
    if (typeof value === 'string') {
      const name = normalizeString(value)
      return name ? { name } : undefined
    }
    if (isRecord(value)) {
      return { ...value }
    }
    return undefined
  }

  const authorFromArray = Array.isArray(flattened.authors) ? flattened.authors[0] : undefined
  let author =
    coerceAuthorObject(flattened.author) ??
    coerceAuthorObject(authorFromArray) ??
    coerceAuthorObject(flattened.byline) ??
    coerceAuthorObject(metadata?.author)

  const authorName = author ? normalizeString(author.name) : undefined
  if (!authorName) {
    const placeholderName =
      normalizeString(flattened.authorName ?? flattened.authorTitle) ??
      normalizeString(metadata?.authorName)
    if (placeholderName) {
      author = { ...(author || {}), name: placeholderName }
    } else {
      warnings.push({
        issue: 'missing-required-field',
        message: 'Article header is missing required author field.',
        field: 'author',
        childType: 'article-header',
        details: { field: 'author' }
      })
    }
  }
  if (author && normalizeString(author.name)) {
    normalized.author = author
  } else {
    delete normalized.author
  }

  const publishDate =
    normalizeString(flattened.publishDate) ??
    normalizeString(flattened.date) ??
    (metadata ? normalizeString((metadata as Record<string, unknown>).publishDate ?? (metadata as Record<string, unknown>).date) : undefined)
  if (publishDate) {
    normalized.publishDate = publishDate
  } else {
    delete normalized.publishDate
    warnings.push({
      issue: 'missing-required-field',
      message: 'Article header is missing required publishDate field.',
      field: 'publishDate',
      childType: 'article-header',
      details: { field: 'publishDate' }
    })
  }

  return { content: normalized, warnings }
}
