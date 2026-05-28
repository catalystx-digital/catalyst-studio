import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { isHomePath, normalizePath } from '../../utils/path-utils'
import { resolveAssetUrl } from './utils'

interface HeroRecoveryOptions {
  domSnapshot?: string | null
  pageUrl?: string
}

interface SourceHero {
  heading: string
  subheading?: string
  image?: {
    url: string
    alt?: string
  }
}

const HERO_TYPES = new Set([
  ComponentType.HeroWithImage,
  ComponentType.HeroSimple,
  ComponentType.HeroBanner,
  ComponentType.HeroSplit,
  ComponentType.HeroMinimal,
  ComponentType.HeroCarousel,
  ComponentType.HeroVideo,
])

function stripTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function attr(value: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}=["']([^"']+)["']`, 'i').exec(value)
  return match?.[1]?.trim() || undefined
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stableId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'homepage-hero'
}

function looksLikeHeroContainer(openingTag: string): boolean {
  const descriptor = `${attr(openingTag, 'class') ?? ''} ${attr(openingTag, 'id') ?? ''}`.toLowerCase()
  return /\b(hero|banner|masthead|intro|showreel)\b|homepage/.test(descriptor)
}

function looksHidden(openingTag: string): boolean {
  const style = attr(openingTag, 'style')?.toLowerCase() ?? ''
  const ariaHidden = attr(openingTag, 'aria-hidden')?.toLowerCase()
  return /\bhidden\b/i.test(openingTag) || ariaHidden === 'true' || /display\s*:\s*none|visibility\s*:\s*hidden/.test(style)
}

function findContainerStart(html: string, h1Index: number): { index: number; hasHeroContainer: boolean; hiddenAncestor: boolean } {
  const searchStart = Math.max(0, h1Index - 12000)
  const prefix = html.slice(searchStart, h1Index)
  const matches = Array.from(prefix.matchAll(/<(section|div|header|main)\b[^>]*>/gi))
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i]
    const opening = match[0]
    if (looksHidden(opening)) {
      return {
        index: searchStart + (match.index ?? 0),
        hasHeroContainer: false,
        hiddenAncestor: true,
      }
    }
    if (looksLikeHeroContainer(opening)) {
      return {
        index: searchStart + (match.index ?? 0),
        hasHeroContainer: true,
        hiddenAncestor: false,
      }
    }
  }
  return {
    index: Math.max(0, h1Index - 1200),
    hasHeroContainer: false,
    hiddenAncestor: false,
  }
}

function findContainerEnd(html: string, h1Index: number): number {
  const afterHeading = html.slice(h1Index + 1)
  const nextSectionMatch = /<section\b/i.exec(afterHeading)
  if (nextSectionMatch?.index !== undefined) {
    return h1Index + 1 + nextSectionMatch.index
  }

  return Math.min(html.length, h1Index + 16000)
}

function extractFirstParagraph(html: string, startIndex: number): string | undefined {
  const afterHeading = html.slice(startIndex, startIndex + 3000)
  const paragraphMatch = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(afterHeading)
  const text = paragraphMatch ? stripTags(paragraphMatch[1]) : ''
  return text.length >= 12 && text.length <= 260 ? text : undefined
}

function extractNearbyImage(html: string, startIndex: number, endIndex: number, pageUrl?: string): SourceHero['image'] | undefined {
  const nearby = html.slice(startIndex, Math.min(html.length, endIndex))
  const imageMatches = Array.from(nearby.matchAll(/<img\b[^>]*>/gi))
  for (const match of imageMatches) {
    const tag = match[0]
    const src = attr(tag, 'src') ?? attr(tag, 'data-src') ?? attr(tag, 'data-lazy-src')
    if (!src || src.startsWith('data:')) {
      continue
    }
    const alt = attr(tag, 'alt')
    return {
      url: resolveAssetUrl(decodeHtmlAttribute(src), pageUrl),
      ...(alt ? { alt: stripTags(alt) } : {}),
    }
  }

  const backgroundMatch = /background-image\s*:\s*url\((["']?)([^"')]+)\1\)/i.exec(nearby)
  if (backgroundMatch?.[2]) {
    return { url: resolveAssetUrl(decodeHtmlAttribute(backgroundMatch[2].trim()), pageUrl) }
  }

  return undefined
}

function extractSourceHero(domSnapshot: string, pageUrl?: string): SourceHero | undefined {
  const h1Match = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(domSnapshot)
  if (!h1Match || h1Match.index === undefined) {
    return undefined
  }

  const heading = stripTags(h1Match[1])
  if (heading.length < 4 || heading.length > 120) {
    return undefined
  }

  const container = findContainerStart(domSnapshot, h1Match.index)
  if (container.hiddenAncestor) {
    return undefined
  }
  const containerEnd = findContainerEnd(domSnapshot, h1Match.index)
  const image = extractNearbyImage(domSnapshot, container.index, containerEnd, pageUrl)
  const subheading = extractFirstParagraph(domSnapshot, h1Match.index + h1Match[0].length)
  const hasHeroEvidence = container.hasHeroContainer || Boolean(image && subheading)
  if (!hasHeroEvidence) {
    return undefined
  }

  return {
    heading,
    subheading,
    image,
  }
}

function insertionIndex(components: DetectedComponent[]): number {
  let index = 0
  while (
    index < components.length &&
    (components[index].type === ComponentType.NavBar || components[index].location === 'header' || components[index].metadata?.region === 'header')
  ) {
    index += 1
  }
  return index
}

export function recoverMissingHomepageHero(
  components: DetectedComponent[],
  options: HeroRecoveryOptions = {}
): void {
  if (!options.domSnapshot || !isHomePath(normalizePath(options.pageUrl))) {
    return
  }
  if (components.some(component => HERO_TYPES.has(component.type))) {
    return
  }

  const sourceHero = extractSourceHero(options.domSnapshot, options.pageUrl)
  if (!sourceHero) {
    return
  }

  const hero: DetectedComponent = sourceHero.image
    ? {
        component: ComponentType.HeroWithImage,
        type: ComponentType.HeroWithImage,
        confidence: 0.9,
        location: 'hero',
        metadata: {
          region: 'hero',
          source: 'source-hero-recovery',
          sourceEvidence: {
            heading: true,
            image: true,
            subheading: Boolean(sourceHero.subheading),
          },
        },
        content: {
          heading: sourceHero.heading,
          ...(sourceHero.subheading ? { subheading: sourceHero.subheading } : {}),
          alignment: 'left',
          layout: 'image-right',
          image: {
            src: {
              mediaId: `detected:${stableId(sourceHero.heading)}-hero`,
              mediaType: 'image',
              url: sourceHero.image.url,
            },
            alt: sourceHero.image.alt ?? sourceHero.heading,
            originalUrl: sourceHero.image.url,
          },
        },
      }
    : {
        component: ComponentType.HeroSimple,
        type: ComponentType.HeroSimple,
        confidence: 0.84,
        location: 'hero',
        metadata: {
          region: 'hero',
          source: 'source-hero-recovery',
          sourceEvidence: {
            heading: true,
            image: false,
            subheading: Boolean(sourceHero.subheading),
          },
        },
        content: {
          heading: sourceHero.heading,
          ...(sourceHero.subheading ? { subheading: sourceHero.subheading } : {}),
          alignment: 'center',
        },
      }

  components.splice(insertionIndex(components), 0, hero)
  console.log('[HeroRecovery] Recovered missing homepage hero from source DOM', {
    heading: sourceHero.heading,
    hasImage: Boolean(sourceHero.image),
  })
}
