/**
 * Blog Component Normalizers
 *
 * Normalizers for blog-post and article-header components.
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
