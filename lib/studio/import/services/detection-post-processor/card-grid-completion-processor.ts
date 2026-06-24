import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { resolveAssetUrl } from './utils'

const MAX_DOM_SNAPSHOT_LENGTH = 250_000
const MAX_SOURCE_SECTIONS = 50
const MAX_SECTION_ANCHORS = 200
const MAX_SOURCE_CARDS_PER_SECTION = 100
const MAX_APPENDED_CARDS = 24

interface CardGridCompletionOptions {
  domSnapshot?: string | null
  pageUrl?: string
}

interface SourceCard {
  title: string
  description?: string
  href?: unknown
  image?: {
    src: {
      mediaId: string
      mediaType: 'image'
      url: string
    }
    alt: string
    originalUrl: string
  }
}

interface SourceCardSection {
  heading: string
  cards: SourceCard[]
}

function stripTags(value: string): string {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
}

function attr(value: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}=["']([^"']+)["']`, 'i').exec(value)
  return match?.[1]?.trim() || undefined
}

function stableId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'image'
}

function normalizeText(value: unknown): string {
  return typeof value === 'string'
    ? stripTags(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    : ''
}

function smartLink(rawHref: string | undefined, pageUrl?: string): unknown {
  if (!rawHref) {
    return undefined
  }

  const href = decodeHtml(rawHref).trim()
  if (!href || href === '#' || href.startsWith('javascript:')) {
    return undefined
  }

  try {
    const resolved = new URL(href, pageUrl)
    const base = pageUrl ? new URL(pageUrl) : null
    if (base && resolved.origin === base.origin) {
      const path = `${resolved.pathname}${resolved.search}${resolved.hash}`
      return {
        type: 'internal',
        pageId: stableId(resolved.pathname),
        path,
      }
    }
    return {
      type: 'external',
      url: resolved.href,
    }
  } catch {
    return href.startsWith('/')
      ? { type: 'internal', pageId: stableId(href), path: href }
      : undefined
  }
}

function extractSourceSections(html: string, pageUrl?: string): SourceCardSection[] {
  const sections: SourceCardSection[] = []
  const sectionRegex = /<section\b[^>]*>[\s\S]*?(?=<section\b|<\/main>|$)/gi
  let sectionMatch

  while (sections.length < MAX_SOURCE_SECTIONS && (sectionMatch = sectionRegex.exec(html)) !== null) {
    const section = sectionMatch[0]
    const headingMatch = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(section)
    if (!headingMatch) {
      continue
    }

    const heading = stripTags(headingMatch[1])
    if (!heading) {
      continue
    }

    const cards: SourceCard[] = []
    const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi
    let anchorMatch
    let anchorCount = 0
    while (anchorCount < MAX_SECTION_ANCHORS && cards.length < MAX_SOURCE_CARDS_PER_SECTION && (anchorMatch = anchorRegex.exec(section)) !== null) {
      anchorCount++
      const anchor = anchorMatch[0]
      if (!/<img\b/i.test(anchor)) {
        continue
      }

      const titleMatch = /<h[3-5]\b[^>]*>([\s\S]*?)<\/h[3-5]>/i.exec(anchor)
      const imageMatch = /<img\b[^>]*>/i.exec(anchor)
      const src = imageMatch ? attr(imageMatch[0], 'src') : undefined
      if (!src || src.startsWith('data:')) {
        continue
      }

      const alt = imageMatch ? stripTags(attr(imageMatch[0], 'alt') ?? '') : ''
      const title = titleMatch ? stripTags(titleMatch[1]) : alt
      if (!title) {
        continue
      }

      const paragraphMatch = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(anchor)
      const resolvedUrl = resolveAssetUrl(decodeHtml(src), pageUrl)
      cards.push({
        title,
        ...(paragraphMatch ? { description: stripTags(paragraphMatch[1]) } : {}),
        href: smartLink(anchorMatch[1], pageUrl),
        image: {
          src: {
            mediaId: `detected:${stableId(resolvedUrl)}`,
            mediaType: 'image',
            url: resolvedUrl,
          },
          alt,
          originalUrl: resolvedUrl,
        },
      })
    }

    if (cards.length >= 2) {
      sections.push({ heading, cards })
    }
  }

  return sections
}

function cardTitle(card: unknown): string {
  if (!card || typeof card !== 'object') {
    return ''
  }
  const record = card as Record<string, unknown>
  return normalizeText(record.title ?? record.heading ?? record.label)
}

function hasCardImage(card: unknown): boolean {
  return Boolean(card && typeof card === 'object' && (card as Record<string, unknown>).image)
}

function hasCardHref(card: unknown): boolean {
  return Boolean(card && typeof card === 'object' && (card as Record<string, unknown>).href)
}

export function completeCardGridsFromSource(
  components: DetectedComponent[],
  options: CardGridCompletionOptions = {}
): void {
  if (!options.domSnapshot || options.domSnapshot.length > MAX_DOM_SNAPSHOT_LENGTH) {
    return
  }

  const sourceSections = extractSourceSections(options.domSnapshot, options.pageUrl)
  if (sourceSections.length === 0) {
    return
  }

  for (const component of components) {
    if (component.type !== ComponentType.CardGrid) {
      continue
    }

    const content = component.content as Record<string, unknown>
    const cards = Array.isArray(content.cards) ? content.cards as unknown[] : undefined
    const heading = normalizeText(content.heading)
    if (!heading || !cards || cards.length === 0) {
      continue
    }

    const linkedImageCards = cards.filter(card => hasCardHref(card) && hasCardImage(card)).length
    if (linkedImageCards < Math.max(1, Math.ceil(cards.length * 0.6))) {
      continue
    }

    const existingTitles = new Set(cards.map(cardTitle).filter(Boolean))
    const sourceSection = sourceSections.find(section => {
      if (normalizeText(section.heading) !== heading) {
        return false
      }
      const sourceTitles = new Set(section.cards.map(card => normalizeText(card.title)).filter(Boolean))
      const overlap = Array.from(existingTitles).filter(title => sourceTitles.has(title)).length
      return overlap >= Math.max(1, Math.ceil(cards.length * 0.6))
    })
    if (!sourceSection || sourceSection.cards.length <= cards.length) {
      continue
    }

    const missingCards = sourceSection.cards
      .filter(card => !existingTitles.has(normalizeText(card.title)))
      .slice(0, MAX_APPENDED_CARDS)
    if (missingCards.length === 0) {
      continue
    }

    content.cards = [...cards, ...missingCards]
    component.metadata = {
      ...(component.metadata ?? {}),
      sourceEvidence: {
        ...(component.metadata?.sourceEvidence ?? {}),
        cardGridCompletion: {
          heading: sourceSection.heading,
          addedCards: missingCards.length,
          sourceCards: sourceSection.cards.length,
        },
      },
    }

    console.log('[CardGridCompletion] Added missing source cards', {
      heading: sourceSection.heading,
      addedCards: missingCards.length,
      totalCards: sourceSection.cards.length,
    })
  }
}
