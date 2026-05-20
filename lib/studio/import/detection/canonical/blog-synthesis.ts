import { canonicalizeComponentType } from './registry'
import type { CanonicalSynthesizeParams, CanonicalSynthesisResult } from './types'
import type { DetectedComponent } from '../types'
import { ConfidenceConfig } from '../../config'

// Use centralized synthetic confidence
const SYNTH_CONFIDENCE = ConfidenceConfig.synthetic.blog

interface BlogFragments {
  headerIndex?: number
  header?: DetectedComponent
  authorIndex?: number
  author?: DetectedComponent
  textBlocks: Array<{ index: number; component: DetectedComponent }>
  galleryIndex?: number
  gallery?: DetectedComponent
  additionalIndices: number[]
}

interface BlogListFragments {
  indices: number[]
  items: Array<Record<string, any>>
  title?: string
  description?: string
  filters?: { categories?: string[]; tags?: string[] }
  fragmentTypes: string[]
}

export function synthesizeBlogPost({
  components,
  pattern,
  region,
  pageUrl,
  templateKey
}: CanonicalSynthesizeParams): CanonicalSynthesisResult | null {
  const fragments = collectBlogFragments(components)
  if (!fragments.header && fragments.textBlocks.length === 0) {
    console.warn('[DetectionCanonicalizer] blog-post-fragments-missing', {
      templateKey,
      pageUrl
    })
    return null
  }

  const headerContent = fragments.header?.content ?? {}
  const bodySections = fragments.textBlocks.map(entry => entry.component.content ?? {})
  const galleryContent = fragments.gallery?.content ?? {}
  const authorContent = fragments.author?.content ?? headerContent?.author

  const title = selectFirstString([
    headerContent.title,
    headerContent.heading,
    headerContent.headline
  ])

  const subtitle = selectFirstString([
    headerContent.subtitle,
    headerContent.subheading,
    headerContent.description
  ])

  const publishDate = selectFirstString([
    headerContent.publishDate,
    headerContent.publishedAt,
    headerContent.date
  ])

  const tags = toStringArray(headerContent.tags || headerContent.categories)

  const heroImage = selectHeroImage(headerContent, galleryContent)

  const bodyHtml = buildBodyHtml(bodySections)
  if (!title && !bodyHtml) {
    return null
  }

  const excerpt = subtitle || deriveExcerpt(bodyHtml)
  const bodyText = stripHtml(bodyHtml)

  const author = buildAuthor(authorContent)

  const content: Record<string, any> = {
    title: title ?? excerpt ?? 'Imported Article',
    excerpt,
    bodyHtml: bodyHtml || `<p>${excerpt || 'Content imported from detection.'}</p>`,
    region
  }

  if (bodyText) {
    content.bodyText = bodyText
  }
  
  if (heroImage) {
    content.heroImage = heroImage
  }
  if (author) {
    content.author = author
  }
  if (publishDate) {
    content.publishDate = publishDate
  }
  if (tags.length > 0) {
    content.tags = tags
  }
  if (typeof pageUrl === 'string' && pageUrl.trim().length > 0) {
    content.sourceUrl = pageUrl
  }
  content.region = region

  content.metadata = {
    ...(content.metadata || {}),
    region,
    source: 'canonical-synthesis',
    templateKey,
    pageUrl,
    fragments: buildFragmentList(fragments)
  }

  const insertIndex = determineInsertIndex([
    fragments.headerIndex,
    ...fragments.textBlocks.map(entry => entry.index),
    fragments.authorIndex,
    fragments.galleryIndex
  ], components.length)

  const componentType = pattern.type as DetectedComponent['type']

  const synthesized: DetectedComponent = {
    component: componentType,
    type: componentType,
    confidence: SYNTH_CONFIDENCE,
    content,
    location: inferLocationFromRegion(region),
    metadata: {
      confidence: pattern.confidence ?? SYNTH_CONFIDENCE,
      ...(pattern.metadata as Record<string, any> | undefined),
      region,
      source: 'canonical-synthesis',
      templateKey,
      fragments: buildFragmentList(fragments)
    }
  }

  return {
    component: synthesized,
    insertIndex
  }
}

export function synthesizeBlogList({
  components,
  pattern,
  region,
  pageUrl,
  templateKey
}: CanonicalSynthesizeParams): CanonicalSynthesisResult | null {
  const fragments = collectBlogCards(components)
  if (fragments.items.length === 0) {
    console.warn('[DetectionCanonicalizer] blog-list-fragments-missing', {
      templateKey,
      pageUrl
    })
    return null
  }

  const content: Record<string, any> = {
    title: fragments.title ?? 'Latest Articles',
    description: fragments.description ?? 'Imported blog posts from the source page.',
    posts: fragments.items,
    region,
    metadata: {
      region,
      source: 'canonical-synthesis',
      fragments: fragments.fragmentTypes
    }
  }

  if (fragments.filters?.categories) {
    content.categories = fragments.filters.categories
  }
  if (fragments.filters?.tags) {
    content.tags = fragments.filters.tags
  }

  const componentType = pattern.type as DetectedComponent['type']

  const synthesized: DetectedComponent = {
    component: componentType,
    type: componentType,
    confidence: SYNTH_CONFIDENCE,
    content,
    location: inferLocationFromRegion(region),
    metadata: {
      confidence: pattern.confidence ?? SYNTH_CONFIDENCE,
      ...(pattern.metadata as Record<string, any> | undefined),
      source: 'canonical-synthesis',
      templateKey,
      fragments: fragments.fragmentTypes
    }
  }

  const insertIndex = determineInsertIndex(fragments.indices, components.length)

  return {
    component: synthesized,
    insertIndex
  }
}

function collectBlogFragments(components: DetectedComponent[]): BlogFragments {
  const fragments: BlogFragments = {
    textBlocks: [],
    additionalIndices: []
  }

  components.forEach((component, index) => {
    const canonical = canonicalizeComponentType(component.component) || canonicalizeComponentType(component.type)
    if (!canonical) {
      return
    }
    if (!fragments.header && canonical === 'article-header') {
      fragments.header = component
      fragments.headerIndex = index
      return
    }
    if (!fragments.author && canonical === 'author-bio') {
      fragments.author = component
      fragments.authorIndex = index
      return
    }
    if (canonical === 'text-block' || canonical === 'rich-text') {
      fragments.textBlocks.push({ index, component })
      return
    }
    if (!fragments.gallery && (canonical === 'image-gallery' || canonical === 'hero-with-image')) {
      fragments.gallery = component
      fragments.galleryIndex = index
      return
    }
  })

  return fragments
}

function collectBlogCards(components: DetectedComponent[]): BlogListFragments {
  const fragments: BlogListFragments = {
    indices: [],
    items: [],
    fragmentTypes: []
  }

  components.forEach((component, index) => {
    const canonical = canonicalizeComponentType(component.component) || canonicalizeComponentType(component.type)
    if (!canonical) {
      return
    }
    if (canonical === 'blog-card') {
      const item = normalizeBlogCard(component.content || {})
      if (item) {
        fragments.items.push(item)
        fragments.indices.push(index)
        fragments.fragmentTypes.push(canonical)
      }
      return
    }
    if (!fragments.title && canonical === 'hero-simple') {
      fragments.title = selectFirstString([
        component.content?.title,
        component.content?.heading
      ])
      fragments.description = selectFirstString([
        component.content?.description,
        component.content?.subheading
      ])
      fragments.indices.push(index)
      fragments.fragmentTypes.push(canonical)
      return
    }
    if (canonical === 'card-grid') {
      const cards = Array.isArray(component.content?.cards)
        ? component.content.cards.map(normalizeBlogCard).filter(Boolean)
        : []
      if (cards.length > 0) {
        fragments.items.push(...cards as Array<Record<string, any>>)
        fragments.indices.push(index)
        fragments.fragmentTypes.push(canonical)
      }
      if (!fragments.title) {
        fragments.title = selectFirstString([
          component.content?.title,
          component.content?.heading
        ])
      }
      if (!fragments.description) {
        fragments.description = selectFirstString([
          component.content?.description,
          component.content?.subheading
        ])
      }
      return
    }
  })

  return fragments
}

function normalizeBlogCard(raw: any): Record<string, any> | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const title = selectFirstString([raw.title, raw.heading, raw.headline])
  const excerpt = selectFirstString([raw.excerpt, raw.summary, raw.description])
  const href = raw.href || raw.link || raw.url
  const publishDate = selectFirstString([raw.publishDate, raw.publishedAt, raw.date])
  const author = raw.author && typeof raw.author === 'object'
    ? selectFirstString([raw.author.name, raw.author.label])
    : undefined
  const image = raw.image || raw.thumbnail || raw.heroImage

  const item: Record<string, any> = {
    title: title ?? 'Article',
    excerpt: excerpt ?? undefined,
    href: typeof href === 'string' ? href : undefined
  }
  if (publishDate) {
    item.publishDate = publishDate
  }
  if (author) {
    item.author = author
  }
  if (image) {
    item.image = image
  }
  return item
}

function buildFragmentList(fragments: BlogFragments): string[] {
  const list: string[] = []
  if (fragments.header) list.push('article-header')
  if (fragments.author) list.push('author-bio')
  if (fragments.textBlocks.length > 0) list.push('text-block')
  if (fragments.gallery) list.push('image-gallery')
  return list
}

function selectHeroImage(header: any, gallery: any): Record<string, any> | undefined {
  const headerImage = header?.heroImage || header?.image || header?.media
  if (headerImage && typeof headerImage === 'object') {
    return normalizeImage(headerImage)
  }
  const galleryImages = Array.isArray(gallery?.images) ? gallery.images : []
  if (galleryImages.length > 0) {
    return normalizeImage(galleryImages[0])
  }
  return undefined
}

function normalizeImage(image: any): Record<string, any> | undefined {
  if (!image) {
    return undefined
  }
  if (typeof image === 'string') {
    return { src: image }
  }
  if (typeof image === 'object') {
    const src = image.src || image.url || image.href
    if (typeof src === 'string') {
      return {
        src,
        alt: image.alt || image.title || image.caption
      }
    }
  }
  return undefined
}

function buildAuthor(raw: any): Record<string, any> | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined
  }
  const name = selectFirstString([raw.name, raw.label])
  if (!name) {
    return undefined
  }
  const author: Record<string, any> = { name }
  if (raw.title || raw.role) {
    author.title = raw.title || raw.role
  }
  if (raw.image || raw.photo) {
    author.avatar = raw.image || raw.photo
  }
  if (raw.bio || raw.description) {
    author.bio = raw.bio || raw.description
  }
  return author
}

function buildBodyHtml(blocks: Array<Record<string, any>>): string {
  const html: string[] = []
  for (const block of blocks) {
    if (!block) {
      continue
    }
    if (typeof block.html === 'string' && block.html.trim().length > 0) {
      html.push(block.html.trim())
      continue
    }
    if (typeof block.body === 'string' && block.body.trim().length > 0) {
      html.push(wrapInParagraph(block.body))
      continue
    }
    if (Array.isArray(block.paragraphs) && block.paragraphs.length > 0) {
      const rendered = block.paragraphs
        .map(paragraph => wrapInParagraph(paragraph))
        .filter(Boolean) as string[]
      html.push(...rendered)
      continue
    }
    if (Array.isArray(block.content) && block.content.length > 0) {
      const nested = block.content
        .map((nestedBlock: any) => (typeof nestedBlock === 'string' ? wrapInParagraph(nestedBlock) : undefined))
        .filter(Boolean) as string[]
      html.push(...nested)
    }
  }
  return html.join('\n\n')
}

function wrapInParagraph(value: any): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) {
    return ''
  }
  return `<p>${escapeHtml(text)}</p>`
}

function deriveExcerpt(bodyHtml: string): string | undefined {
  const stripped = stripHtml(bodyHtml)
  if (!stripped) {
    return undefined
  }
  return stripped.slice(0, 200)
}

function stripHtml(bodyHtml: string): string {
  if (!bodyHtml) {
    return ''
  }
  return bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function determineInsertIndex(indices: Array<number | undefined>, fallback: number): number {
  const filtered = indices.filter((index): index is number => typeof index === 'number' && index >= 0)
  if (filtered.length === 0) {
    return fallback
  }
  return Math.max(0, Math.min(...filtered))
}

function inferLocationFromRegion(region: string): DetectedComponent['location'] {
  const normalized = region.toLowerCase()
  if (normalized.includes('header')) {
    return 'header'
  }
  if (normalized.includes('hero')) {
    return 'hero'
  }
  if (normalized.includes('footer')) {
    return 'footer'
  }
  return 'main'
}

function selectFirstString(values: any[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return undefined
}

function toStringArray(value: any): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map(item => (typeof item === 'string' ? item : undefined))
    .filter((item): item is string => Boolean(item && item.trim().length > 0))
    .map(item => item.trim())
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
