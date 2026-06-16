import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent, DetectedPageTemplate } from '@/lib/studio/import/detection/types'

export interface BlogIndexConsolidationOptions {
  pageUrl?: string
  pageTemplate?: DetectedPageTemplate
}

const EDITORIAL_INDEX_PATH = /^\/(?:news|blog|blogs|article|articles|post|posts|press|media|insights?)(?:\/page\/\d+)?\/?$/i
const EDITORIAL_LINK_PATH = /\/(?:news|blog|blogs|article|articles|post|posts|press|media|insights?)\//i

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

function imageUrl(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  if (typeof record.url === 'string') return record.url
  if (typeof record.src === 'string') return record.src
  if (record.src && typeof record.src === 'object' && !Array.isArray(record.src)) {
    const src = record.src as Record<string, unknown>
    if (typeof src.url === 'string') return src.url
  }
  if (typeof record.originalUrl === 'string') return record.originalUrl
  return undefined
}

function isBlogIndexPage(options: BlogIndexConsolidationOptions): boolean {
  if (options.pageTemplate?.templateKey === 'blog/index-standard') {
    return true
  }
  if (!options.pageUrl) {
    return false
  }
  try {
    return EDITORIAL_INDEX_PATH.test(new URL(options.pageUrl).pathname)
  } catch {
    return EDITORIAL_INDEX_PATH.test(options.pageUrl)
  }
}

function normalizePostItem(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const record = value as Record<string, unknown>
  const title = typeof record.title === 'string' ? record.title.trim() : ''
  if (!title) {
    return undefined
  }
  const post: Record<string, unknown> = { title }
  const excerpt = record.excerpt ?? record.summary ?? record.description
  if (typeof excerpt === 'string' && excerpt.trim()) {
    post.excerpt = excerpt.trim()
  }
  const slug = record.slug
  if (typeof slug === 'string' && slug.trim()) {
    post.slug = slug.trim()
  }
  const href = record.href ?? record.link ?? record.url
  const hrefSlug = slugFromHref(href)
  if (!post.slug && hrefSlug) {
    post.slug = hrefSlug
  }
  const image = record.image ?? record.thumbnail
  const imageSrc = imageUrl(image)
  if (image && typeof image === 'object' && (!imageSrc || !isLikelyBrandAssetImage(imageSrc))) {
    post.image = image
  }
  const date = record.date ?? record.publishDate ?? record.publishedAt
  if (typeof date === 'string' && date.trim()) {
    post.date = date.trim()
  }
  const author = record.author
  if (author) {
    post.author = author
  }
  const category = record.category ?? (Array.isArray(record.categories) ? record.categories[0] : undefined)
  if (typeof category === 'string' && category.trim()) {
    post.category = category.trim()
  }
  const tags = record.tags ?? record.categories
  if (Array.isArray(tags)) {
    post.tags = tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
  }
  return post
}

function slugFromHref(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const record = value as Record<string, unknown>
  const path = record.path ?? record.url ?? record.href
  return typeof path === 'string' && path.trim() ? path.trim() : undefined
}

function hasEditorialTeaserEvidence(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const record = value as Record<string, unknown>
  const href = slugFromHref(record.href ?? record.link ?? record.url)
  return Boolean(
    typeof record.slug === 'string' && record.slug.trim()
    || typeof record.date === 'string' && record.date.trim()
    || typeof record.publishDate === 'string' && record.publishDate.trim()
    || typeof record.publishedAt === 'string' && record.publishedAt.trim()
    || record.author
    || typeof record.category === 'string' && record.category.trim()
    || (Array.isArray(record.categories) && record.categories.length > 0)
    || (Array.isArray(record.tags) && record.tags.length > 0)
    || (href && EDITORIAL_LINK_PATH.test(href))
  )
}

function postsFromBlogList(component: DetectedComponent): Record<string, unknown>[] {
  const content = component.content ?? {}
  const source = Array.isArray(content.posts)
    ? content.posts
    : Array.isArray(content.manualPosts)
      ? content.manualPosts
      : []
  return source.map(normalizePostItem).filter((post): post is Record<string, unknown> => Boolean(post))
}

function postsFromContentFeed(component: DetectedComponent): Record<string, unknown>[] {
  const content = component.content ?? {}
  const source = Array.isArray(content.pinned)
    ? content.pinned
    : Array.isArray(content.items)
      ? content.items
      : Array.isArray(content.posts)
        ? content.posts
        : Array.isArray(content.articles)
          ? content.articles
          : []
  return source.map(normalizePostItem).filter((post): post is Record<string, unknown> => Boolean(post))
}

function postsFromCardGrid(component: DetectedComponent): Record<string, unknown>[] {
  const cards = Array.isArray(component.content?.cards) ? component.content.cards : []
  return cards
    .filter(hasEditorialTeaserEvidence)
    .map(normalizePostItem)
    .filter((post): post is Record<string, unknown> => Boolean(post))
}

function postKey(post: Record<string, unknown>): string {
  const slug = typeof post.slug === 'string' ? post.slug : ''
  return `${String(post.title ?? '').trim().toLowerCase()}|${slug.trim().toLowerCase()}`
}

function dedupePosts(posts: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>()
  const result: Record<string, unknown>[] = []
  for (const post of posts) {
    const key = postKey(post)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(post)
  }
  return result
}

function buildBlogListFrom(component: DetectedComponent, posts: Record<string, unknown>[], source: string): DetectedComponent {
  const content = component.content ?? {}
  return {
    ...component,
    component: ComponentType.BlogList,
    type: ComponentType.BlogList,
    location: 'main',
    metadata: {
      ...component.metadata,
      region: 'main',
      sourceEvidence: {
        ...(component.metadata?.sourceEvidence ?? {}),
        blogIndexConsolidation: {
          source,
          mergedPostCount: posts.length
        }
      }
    },
    content: {
      ...(typeof content.title === 'string' ? { title: content.title } : {}),
      ...(typeof content.heading === 'string' ? { title: content.heading } : {}),
      ...(typeof content.description === 'string' ? { description: content.description } : {}),
      posts,
      showPagination: true
    }
  }
}

export function consolidateBlogIndexListings(
  components: DetectedComponent[],
  options: BlogIndexConsolidationOptions = {}
): DetectedComponent[] {
  if (!isBlogIndexPage(options)) {
    return components
  }

  const blogLists = components.filter(component => component.type === ComponentType.BlogList)
  if (blogLists.length > 0) {
    const posts = dedupePosts(blogLists.flatMap(postsFromBlogList))
    if (posts.length === 0 || blogLists.length === 1) {
      return components
    }
    const [primary] = blogLists
    const merged = buildBlogListFrom(primary, posts, 'merge-blog-list')
    let inserted = false
    const set = new Set(blogLists)
    return components.flatMap(component => {
      if (!set.has(component)) {
        return [component]
      }
      if (inserted) {
        return []
      }
      inserted = true
      return [merged]
    })
  }

  const convertible = components.find(component => {
    if (component.type === ComponentType.ContentFeed) {
      return postsFromContentFeed(component).length > 0
    }
    if (component.type === ComponentType.CardGrid) {
      return postsFromCardGrid(component).length > 0
    }
    return false
  })
  if (!convertible) {
    return components
  }

  const posts = convertible.type === ComponentType.ContentFeed
    ? postsFromContentFeed(convertible)
    : postsFromCardGrid(convertible)
  const converted = buildBlogListFrom(convertible, dedupePosts(posts), `convert-${convertible.type}`)
  return components.map(component => component === convertible ? converted : component)
}
