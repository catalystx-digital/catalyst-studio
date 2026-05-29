export type SourceSectionKind = 'hero' | 'listing' | 'narrative' | 'nav' | 'footer' | 'unknown'

export interface SourceSectionImage {
  src: string
  alt?: string
}

export interface SourceSectionCard {
  title?: string
  body?: string
  href?: string
  image?: SourceSectionImage
}

export interface SourceSection {
  index: number
  kind: SourceSectionKind
  heading?: string
  body?: string
  text: string
  html: string
  images: SourceSectionImage[]
  cards: SourceSectionCard[]
}

const SECTION_TAG_PATTERN = /<(section|article|header|footer|nav)\b[^>]*>[\s\S]*?<\/\1>/gi

function normalizeText(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTags(value: string): string {
  return normalizeText(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
}

function getOpeningTag(html: string): string {
  return html.slice(0, Math.min(html.indexOf('>') + 1 || html.length, 500)).toLowerCase()
}

function isHiddenSection(html: string): boolean {
  const openingTag = getOpeningTag(html)
  const className = readAttr(openingTag, 'class') ?? ''
  return (
    /^<[a-z0-9-]+\b[^>]*\shidden(?:\s|>|=)/i.test(openingTag) ||
    /\bstyle\s*=\s*["'][^"']*(display\s*:\s*none|visibility\s*:\s*hidden)/i.test(openingTag) ||
    /\b(sr-only|visually-hidden)\b/i.test(className) ||
    /(?:^|\s)hidden(?:\s|$)/i.test(className)
  )
}

function readAttr(tag: string, attr: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${attr}\\s*=\\s*["']([^"']*)["']`, 'i'))
  return match?.[1] ? normalizeText(match[1]) : undefined
}

function firstTagText(html: string, tags: string[]): string | undefined {
  const tagPattern = tags.map(tag => tag.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')
  const match = html.match(new RegExp(`<(${tagPattern})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'))
  const text = match?.[2] ? stripTags(match[2]) : ''
  return text || undefined
}

function extractParagraphs(html: string): string[] {
  return Array.from(html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map(match => stripTags(match[1] ?? ''))
    .filter(text => text.length > 0)
}

function isSrcsetLike(value: string): boolean {
  return /(?:^|,\s*)\S+\s+(?:\d+w|[\d.]+x)(?:\s*,|$)/i.test(value.trim())
}

function selectLargestSrcsetCandidate(value: string): string | undefined {
  if (!isSrcsetLike(value)) {
    return undefined
  }

  return value
    .split(',')
    .map(entry => entry.trim())
    .map(entry => {
      const [src, descriptor] = entry.split(/\s+/, 2)
      const widthMatch = descriptor?.match(/^(\d+)w$/i)
      const densityMatch = descriptor?.match(/^([\d.]+)x$/i)
      const width = widthMatch ? Number(widthMatch[1]) : undefined
      const density = densityMatch ? Number(densityMatch[1]) : undefined
      const score = typeof width === 'number' && Number.isFinite(width)
        ? width
        : typeof density === 'number' && Number.isFinite(density)
          ? density * 1000
          : 0
      return src ? { src, score } : null
    })
    .filter((entry): entry is { src: string; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score)[0]?.src
}

function resolveUrl(value: string | undefined, pageUrl?: string): string | undefined {
  if (!value) {
    return undefined
  }
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('data:')) {
    return undefined
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }
  if (!pageUrl) {
    return trimmed
  }
  try {
    return new URL(trimmed, pageUrl).toString()
  } catch {
    return trimmed
  }
}

export function extractSectionHeading(section: Pick<SourceSection, 'html'>): string | undefined {
  return firstTagText(section.html, ['h1', 'h2', 'h3'])
}

export function extractSectionNarrative(section: Pick<SourceSection, 'html'>): string | undefined {
  const paragraphs = extractParagraphs(section.html)
  return paragraphs.length > 0 ? paragraphs.join('\n\n') : undefined
}

function extractImages(html: string, pageUrl?: string): SourceSectionImage[] {
  return Array.from(html.matchAll(/<img\b[^>]*>/gi))
    .map(match => {
      const tag = match[0]
      const srcset = readAttr(tag, 'srcset')
      const src = resolveUrl(selectLargestSrcsetCandidate(srcset ?? '') ?? readAttr(tag, 'src'), pageUrl)
      if (!src) {
        return null
      }
      return {
        src,
        ...(readAttr(tag, 'alt') ? { alt: readAttr(tag, 'alt') } : {})
      }
    })
    .filter((image): image is SourceSectionImage => image !== null)
}

export function extractSectionCards(section: Pick<SourceSection, 'html'>, pageUrl?: string): SourceSectionCard[] {
  return Array.from(section.html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi))
    .map(match => {
      const html = match[0]
      const href = resolveUrl(match[1], pageUrl)
      const title = firstTagText(html, ['h2', 'h3', 'h4']) ?? stripTags(html).slice(0, 120)
      const paragraphs = extractParagraphs(html)
      const image = extractImages(html, pageUrl)[0]
      return {
        ...(title ? { title } : {}),
        ...(paragraphs[0] ? { body: paragraphs[0] } : {}),
        ...(href ? { href } : {}),
        ...(image ? { image } : {})
      }
    })
    .filter(card => Boolean(card.title || card.body || card.image))
}

export function classifySourceSection(section: Pick<SourceSection, 'html' | 'heading' | 'body' | 'cards' | 'images' | 'text'>): SourceSectionKind {
  const openingTag = getOpeningTag(section.html)
  const text = section.text.toLowerCase()
  if (/^<nav\b/i.test(openingTag) || /\b(role|aria-label)\s*=\s*["'][^"']*(navigation|menu)[^"']*["']/i.test(openingTag)) {
    return 'nav'
  }
  if (/^<footer\b/i.test(openingTag)) {
    return 'footer'
  }
  if (/^<header\b/i.test(openingTag) || /\b(hero|banner)\b/i.test(openingTag)) {
    return 'hero'
  }
  if (section.cards.length >= 2 || /\b(latest|posts|articles|projects|resources|case studies)\b/.test(text)) {
    return 'listing'
  }
  if (section.heading && (section.body || section.images.length > 0) && text.length >= 80) {
    return 'narrative'
  }
  return 'unknown'
}

export function extractSourceSections(domSnapshot: string | null | undefined, pageUrl?: string): SourceSection[] {
  if (!domSnapshot || typeof domSnapshot !== 'string') {
    return []
  }

  return Array.from(domSnapshot.matchAll(SECTION_TAG_PATTERN))
    .map((match, index): SourceSection | null => {
      const html = match[0]
      if (!html || isHiddenSection(html)) {
        return null
      }

      const base = { html }
      const heading = extractSectionHeading(base)
      const body = extractSectionNarrative(base)
      const text = stripTags(html)
      const images = extractImages(html, pageUrl)
      const cards = extractSectionCards(base, pageUrl)
      const section: SourceSection = {
        index,
        kind: 'unknown',
        ...(heading ? { heading } : {}),
        ...(body ? { body } : {}),
        text,
        html,
        images,
        cards
      }
      section.kind = classifySourceSection(section)
      return section
    })
    .filter((section): section is SourceSection => section !== null)
}
