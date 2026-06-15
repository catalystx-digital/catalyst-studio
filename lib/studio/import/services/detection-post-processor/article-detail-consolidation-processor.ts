import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent, PageMetadata } from '@/lib/studio/import/detection/types'

export interface ArticleDetailConsolidationOptions {
  pageUrl?: string
  pageMetadata?: PageMetadata
}

const EDITORIAL_DETAIL_PATH = /^\/(?:news|blog|blogs|article|articles|post|posts|press|media|insights?)\/.+/i
const ARTICLE_FRAGMENT_TYPES = new Set<string>([
  ComponentType.TextBlock,
  ComponentType.HtmlBlock,
  ComponentType.Accordion,
  ComponentType.QuoteBlock
])

function isEditorialDetailUrl(pageUrl?: string): boolean {
  if (!pageUrl) {
    return false
  }
  try {
    return EDITORIAL_DETAIL_PATH.test(new URL(pageUrl).pathname)
  } catch {
    return EDITORIAL_DETAIL_PATH.test(pageUrl)
  }
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized || undefined
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stripTags(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function paragraphsToHtml(value: string): string {
  return value
    .split(/\n{2,}/)
    .map(paragraph => normalizeText(paragraph))
    .filter((paragraph): paragraph is string => Boolean(paragraph))
    .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
    .join('')
}

function fragmentBodyHtml(component: DetectedComponent): string {
  const content = component.content ?? {}

  if (component.type === ComponentType.HtmlBlock) {
    const title = normalizeText(content.title ?? content.heading)
    const bodyHtml = normalizeText(content.bodyHtml ?? content.html)
    return `${title ? `<h2>${escapeHtml(title)}</h2>` : ''}${bodyHtml ?? ''}`
  }

  if (component.type === ComponentType.TextBlock) {
    const heading = normalizeText(content.heading ?? content.title)
    const body = normalizeText(content.body ?? content.bodyText ?? content.text ?? content.description)
    return `${heading ? `<h2>${escapeHtml(heading)}</h2>` : ''}${body ? paragraphsToHtml(body) : ''}`
  }

  if (component.type === ComponentType.Accordion) {
    const items = Array.isArray(content.items) ? content.items : []
    return items
      .map(item => {
        const question = normalizeText(item?.question ?? item?.title ?? item?.heading)
        const answer = normalizeText(item?.answer ?? item?.content ?? item?.body ?? item?.description)
        if (!question || !answer) {
          return ''
        }
        return `<h2>${escapeHtml(question)}</h2>${paragraphsToHtml(answer)}`
      })
      .filter(Boolean)
      .join('')
  }

  if (component.type === ComponentType.QuoteBlock) {
    const quote = normalizeText(content.quote ?? content.text ?? content.body)
    const citation = normalizeText(content.citation ?? content.author)
    if (!quote) {
      return ''
    }
    return `<blockquote><p>${escapeHtml(quote)}</p>${citation ? `<cite>${escapeHtml(citation)}</cite>` : ''}</blockquote>`
  }

  return ''
}

function isArticleBodyFragment(component: DetectedComponent): boolean {
  if (!ARTICLE_FRAGMENT_TYPES.has(component.type)) {
    return false
  }
  if (component.location === 'header' || component.location === 'footer') {
    return false
  }
  return Boolean(stripTags(fragmentBodyHtml(component)))
}

function hasEnoughArticleBody(bodyHtml: string, fragmentCount: number): boolean {
  const text = stripTags(bodyHtml)
  const paragraphLikeCount = (bodyHtml.match(/<(?:p|h2|li|blockquote)\b/gi) ?? []).length
  return text.length >= 120 && (paragraphLikeCount >= 2 || fragmentCount >= 2)
}

function buildBlogPost(
  components: DetectedComponent[],
  fragments: DetectedComponent[],
  options: ArticleDetailConsolidationOptions
): DetectedComponent | undefined {
  const articleHeader = components.find(component => component.type === ComponentType.ArticleHeader)
  const headerContent = articleHeader?.content ?? {}
  const title =
    normalizeText(headerContent.title ?? headerContent.heading) ??
    normalizeText(options.pageMetadata?.title)
  const bodyHtml = fragments.map(fragmentBodyHtml).filter(Boolean).join('')

  if (!title || !hasEnoughArticleBody(bodyHtml, fragments.length)) {
    return undefined
  }

  const content: Record<string, unknown> = {
    title,
    bodyHtml
  }

  const excerpt =
    normalizeText(headerContent.excerpt ?? headerContent.summary) ??
    normalizeText(options.pageMetadata?.description)
  if (excerpt) {
    content.excerpt = excerpt
  }
  if (headerContent.author) {
    content.author = headerContent.author
  } else if (options.pageMetadata?.author) {
    content.author = { name: options.pageMetadata.author }
  }
  if (headerContent.publishDate ?? options.pageMetadata?.publishedDate) {
    content.publishDate = headerContent.publishDate ?? options.pageMetadata?.publishedDate
  }
  if (options.pageUrl) {
    content.sourceUrl = options.pageUrl
  }

  return {
    component: ComponentType.BlogPost,
    type: ComponentType.BlogPost,
    confidence: Math.min(0.92, Math.max(...fragments.map(fragment => fragment.confidence ?? 0.7), 0.7)),
    location: 'main',
    metadata: {
      source: 'article-detail-consolidation',
      sourceEvidence: {
        articleDetailConsolidation: {
          fragmentTypes: fragments.map(fragment => fragment.type),
          fragmentCount: fragments.length,
          route: options.pageUrl
        }
      }
    },
    content
  }
}

function mergeBlogPostContent(primary: DetectedComponent, rest: DetectedComponent[], options: ArticleDetailConsolidationOptions): DetectedComponent {
  const mergedBodyHtml = [primary, ...rest]
    .map(component => normalizeText(component.content?.bodyHtml))
    .filter((bodyHtml): bodyHtml is string => Boolean(bodyHtml))
    .join('')

  const content = {
    ...primary.content,
    bodyHtml: mergedBodyHtml || primary.content?.bodyHtml
  }

  return {
    ...primary,
    location: 'main',
    metadata: {
      ...primary.metadata,
      region: 'main',
      sourceEvidence: {
        ...(primary.metadata?.sourceEvidence ?? {}),
        articleDetailBlogPostMerge: {
          mergedCount: rest.length + 1,
          route: options.pageUrl
        }
      }
    },
    content
  }
}

function consolidateExistingBlogPosts(
  components: DetectedComponent[],
  options: ArticleDetailConsolidationOptions
): DetectedComponent[] {
  const blogPosts = components.filter(component => component.type === ComponentType.BlogPost)
  if (blogPosts.length <= 1) {
    return components
  }

  const [primary, ...rest] = blogPosts
  const merged = mergeBlogPostContent(primary, rest, options)
  let inserted = false
  const blogPostSet = new Set(blogPosts)
  return components.flatMap(component => {
    if (!blogPostSet.has(component)) {
      return [component]
    }
    if (inserted) {
      return []
    }
    inserted = true
    return [merged]
  })
}

export function consolidateArticleDetailFragments(
  components: DetectedComponent[],
  options: ArticleDetailConsolidationOptions = {}
): DetectedComponent[] {
  if (!isEditorialDetailUrl(options.pageUrl)) {
    return components
  }
  if (!components.some(component => component.type === ComponentType.ArticleHeader)) {
    return components
  }

  const regionAligned = components.map(component => {
    if (component.type !== ComponentType.ArticleHeader || component.location !== 'header') {
      return component
    }
    return {
      ...component,
      location: 'hero' as const,
      metadata: {
        ...component.metadata,
        region: 'hero',
        sourceEvidence: {
          ...(component.metadata?.sourceEvidence ?? {}),
          articleDetailRegionAlignment: {
            from: 'header',
            to: 'hero',
            route: options.pageUrl
          }
        }
      }
    }
  })

  if (regionAligned.some(component => component.type === ComponentType.BlogPost)) {
    return consolidateExistingBlogPosts(regionAligned, options)
  }

  const fragments = regionAligned.filter(isArticleBodyFragment)
  const blogPost = buildBlogPost(regionAligned, fragments, options)
  if (!blogPost) {
    return regionAligned
  }

  const fragmentSet = new Set(fragments)
  const insertIndex = regionAligned.findIndex(component => fragmentSet.has(component))
  const result = regionAligned.filter(component => !fragmentSet.has(component))
  result.splice(insertIndex === -1 ? result.length : insertIndex, 0, blogPost)
  return result
}
