import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { resolveAssetUrl } from './utils'

interface SourceNewsCard {
  title: string
  description?: string
  href?: { url: string; type: 'external' }
  image?: {
    src: {
      mediaId: string
      mediaType: 'image'
      url: string
      originalUrl: string
    }
    alt: string
    originalUrl: string
  }
}

const NEWS_CONTAINER_PATTERN = /<div\b[^>]*(?:id|class)\s*=\s*(["'])[^"']*(?:news|article|story)[^"']*(?:carousel|listing|list|feed|grid)[^"']*\1[^>]*>/gi
const LINK_PATTERN = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi
const IMG_PATTERN = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi
const ALT_PATTERN = /\balt\s*=\s*(["'])(.*?)\1/i
const NEWS_HEADING_PATTERN = /\b(?:news|articles?|stories|insights|updates)\b/i
const NEWS_LINK_PATH_PATTERN = /\/(?:news|articles?|stories|insights|updates|blog)\b/i

function stripHtml(value: string): string {
  return value
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const title = stripHtml(value)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
  return title.length > 0 ? title : undefined
}

function stableImageId(url: string): string {
  const file = url.split(/[?#]/, 1)[0]?.split('/').filter(Boolean).pop() ?? 'image'
  return file
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'image'
}

function findNewsContainerHtml(html: string): string | undefined {
  const starts: number[] = []
  let match: RegExpExecArray | null
  NEWS_CONTAINER_PATTERN.lastIndex = 0
  while ((match = NEWS_CONTAINER_PATTERN.exec(html)) !== null) {
    starts.push(match.index)
  }

  return starts
    .map((start, index) => ({
      start,
      end: starts[index + 1] ?? Math.min(html.length, start + 20000),
      html: html.slice(start, starts[index + 1] ?? Math.min(html.length, start + 20000)),
    }))
    .filter(container => NEWS_HEADING_PATTERN.test(stripHtml(container.html)))
    .sort((a, b) => b.html.length - a.html.length)[0]?.html
}

function extractImagesByAlt(containerHtml: string, pageUrl?: string): Map<string, SourceNewsCard['image']> {
  const images = new Map<string, SourceNewsCard['image']>()
  let match: RegExpExecArray | null
  while ((match = IMG_PATTERN.exec(containerHtml)) !== null) {
    const imageHtml = match[0]
    const src = match[2]
    const alt = ALT_PATTERN.exec(imageHtml)?.[2]
    const normalized = normalizeTitle(alt)
    if (!src || !alt || !normalized || images.has(normalized)) {
      continue
    }
    const url = resolveAssetUrl(src, pageUrl)
    images.set(normalized, {
      src: {
        mediaId: `detected:${stableImageId(url)}`,
        mediaType: 'image',
        url,
        originalUrl: url,
      },
      alt,
      originalUrl: url,
    })
  }
  return images
}

function extractSourceNewsCards(domSnapshot: string | null | undefined, pageUrl?: string): SourceNewsCard[] {
  if (!domSnapshot) {
    return []
  }

  const html = domSnapshot.replace(/<!--[\s\S]*?-->/g, ' ')
  const containerHtml = findNewsContainerHtml(html)
  if (!containerHtml) {
    return []
  }

  const imagesByAlt = extractImagesByAlt(containerHtml, pageUrl)
  const cards: SourceNewsCard[] = []
  const seenTitles = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = LINK_PATTERN.exec(containerHtml)) !== null) {
    const href = match[2]
    const title = stripHtml(match[3])
    const normalized = normalizeTitle(title)
    if (!href || !normalized || seenTitles.has(normalized) || title === '‹' || title === '›') {
      continue
    }
    if (!NEWS_LINK_PATH_PATTERN.test(href)) {
      continue
    }

    const nextLinkIndex = LINK_PATTERN.lastIndex
    const nextMatch = LINK_PATTERN.exec(containerHtml)
    if (nextMatch) {
      LINK_PATTERN.lastIndex = nextLinkIndex
    }
    const descriptionHtml = containerHtml.slice(nextLinkIndex, nextMatch?.index ?? Math.min(containerHtml.length, nextLinkIndex + 1200))
    const description = stripHtml(descriptionHtml)
    const image = imagesByAlt.get(normalized)
    const url = resolveAssetUrl(href, pageUrl)

    seenTitles.add(normalized)
    cards.push({
      title,
      ...(description ? { description } : {}),
      href: { url, type: 'external' },
      ...(image ? { image } : {}),
    })
  }

  return cards
}

function listingTitleSet(component: DetectedComponent): Set<string> {
  const content = component.content && typeof component.content === 'object'
    ? component.content as Record<string, unknown>
    : {}
  const items = [
    ...(Array.isArray(content.cards) ? content.cards : []),
    ...(Array.isArray(content.items) ? content.items : []),
    ...(Array.isArray(content.pinned) ? content.pinned : []),
  ].filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)

  return new Set(items
    .map(item => normalizeTitle(item.title ?? item.heading))
    .filter((title): title is string => Boolean(title)))
}

function componentHeading(component: DetectedComponent): string | undefined {
  const content = component.content && typeof component.content === 'object'
    ? component.content as Record<string, unknown>
    : {}
  return typeof content.heading === 'string' ? content.heading : undefined
}

function sourceHeading(containerHtml: string | undefined): string | undefined {
  if (!containerHtml) return undefined
  const match =
    /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(containerHtml) ??
    /<(?:span|div)\b[^>]*(?:class|id)\s*=\s*(["'])[^"']*news[^"']*\1[^>]*>([\s\S]*?)<\/(?:span|div)>/i.exec(containerHtml)
  const heading = match ? stripHtml(match[2] ?? match[1]) : undefined
  return heading && NEWS_HEADING_PATTERN.test(heading) ? heading : undefined
}

function sourceOverlap(component: DetectedComponent, sourceCards: SourceNewsCard[]): number {
  const titles = listingTitleSet(component)
  return sourceCards.filter(card => {
    const title = normalizeTitle(card.title)
    return title ? titles.has(title) : false
  }).length
}

export function enrichSourceNewsListing(
  components: DetectedComponent[],
  options: { domSnapshot?: string | null; pageUrl?: string } = {}
): DetectedComponent[] {
  const html = options.domSnapshot?.replace(/<!--[\s\S]*?-->/g, ' ') ?? ''
  const containerHtml = findNewsContainerHtml(html)
  const sourceCards = extractSourceNewsCards(options.domSnapshot, options.pageUrl)
  if (sourceCards.length < 3) {
    return components
  }

  const headingFromSource = sourceHeading(containerHtml) ?? 'News'
  const newsIndex = components
    .map((component, index) => ({ component, index, overlap: sourceOverlap(component, sourceCards) }))
    .filter(entry => String(entry.component.type) === 'card-grid')
    .filter(entry => {
      const heading = normalizeTitle(componentHeading(entry.component))
      return entry.overlap >= 2 || Boolean(heading && NEWS_HEADING_PATTERN.test(heading))
    })
    .sort((a, b) => b.overlap - a.overlap)[0]?.index ?? -1

  if (newsIndex === -1) {
    return components
  }

  const newsListing = components[newsIndex]
  const overlap = sourceOverlap(newsListing, sourceCards)
  if (overlap < 2) {
    return components
  }

  const nextNewsListing: DetectedComponent = {
    ...newsListing,
    content: {
      ...(newsListing.content && typeof newsListing.content === 'object' ? newsListing.content as Record<string, unknown> : {}),
      heading: headingFromSource,
      cards: sourceCards,
    },
    metadata: {
      ...(newsListing.metadata ?? {}),
      source: 'source-news-enrichment',
    },
  }

  console.log('[SourceNewsProcessor] Enriched news listing from source DOM:', {
    previousOverlap: overlap,
    sourceCardCount: sourceCards.length,
  })

  const sourceHeadingPresent = Boolean(headingFromSource)
  const result: DetectedComponent[] = []
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index]
    const heading = componentHeading(component)
    const normalizedHeading = normalizeTitle(heading)
    const isUnsupportedLatestNews =
      sourceHeadingPresent &&
      normalizedHeading === 'latest news' &&
      Math.abs(index - newsIndex) <= 2 &&
      sourceOverlap(component, sourceCards) >= 2

    if (isUnsupportedLatestNews) {
      console.log('[SourceNewsProcessor] Dropped unsupported split news listing:', {
        heading: componentHeading(component),
      })
      continue
    }

    result.push(index === newsIndex ? nextNewsListing : component)
  }

  return result
}
