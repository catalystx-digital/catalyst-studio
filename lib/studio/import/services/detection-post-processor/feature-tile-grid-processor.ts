import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { resolveAssetUrl } from './utils'

interface FeatureTile {
  title: string
  description?: string
  href?: { url: string }
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

const FEATURE_CONTEXT_PATTERN = /\b(?:rch-home-[\w-]+|rch-featured-[\w-]+|feature(?:d)?|tile|card|promo)\b/i
const HEADING_PATTERN = /<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/i
const HREF_PATTERN = /\bhref\s*=\s*(["'])(.*?)\1/i
const IMG_PATTERN = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/i
const BACKGROUND_PATTERN = /background(?:-image)?\s*:[^;]*url\((['"]?)([^'")]+)\1\)/i

function stripHtml(value: string): string {
  return value
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = stripHtml(value)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
  return text.length > 0 ? text : undefined
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

function extractTileImage(anchorHtml: string, pageUrl?: string): FeatureTile['image'] | undefined {
  const imageCandidate = IMG_PATTERN.exec(anchorHtml)?.[2] ?? BACKGROUND_PATTERN.exec(anchorHtml)?.[2]
  if (!imageCandidate) return undefined

  const url = resolveAssetUrl(imageCandidate, pageUrl)
  if (!url || !/\.(png|jpe?g|webp|gif|svg)(?:[?#].*)?$/i.test(url)) {
    return undefined
  }

  return {
    src: {
      mediaId: `detected:${stableImageId(url)}`,
      mediaType: 'image',
      url,
      originalUrl: url,
    },
    alt: '',
    originalUrl: url,
  }
}

function extractFeatureTileClusters(domSnapshot: string | null | undefined, pageUrl?: string): FeatureTile[][] {
  if (!domSnapshot) return []

  const html = domSnapshot
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')

  const clusters: FeatureTile[][] = []
  let currentCluster: FeatureTile[] = []
  let currentClusterTitles = new Set<string>()
  const anchorPattern = /<a\b[^>]*>[\s\S]*?<\/a>/gi
  let match: RegExpExecArray | null
  let previousFeatureEnd = -1

  while ((match = anchorPattern.exec(html)) !== null) {
    const anchorHtml = match[0]
    const context = html.slice(Math.max(0, match.index - 350), Math.min(html.length, match.index + anchorHtml.length + 350))
    if (!FEATURE_CONTEXT_PATTERN.test(context)) {
      continue
    }

    if (previousFeatureEnd >= 0 && match.index - previousFeatureEnd > 2500) {
      if (currentCluster.length > 0) {
        clusters.push(currentCluster)
      }
      currentCluster = []
      currentClusterTitles = new Set<string>()
    }
    previousFeatureEnd = match.index + anchorHtml.length

    const heading = HEADING_PATTERN.exec(anchorHtml)?.[1]
    const title = heading ? stripHtml(heading) : ''
    const normalizedTitle = normalizeTitle(title)
    if (!normalizedTitle || currentClusterTitles.has(normalizedTitle)) {
      continue
    }

    const href = HREF_PATTERN.exec(anchorHtml)?.[2]
    const fullText = stripHtml(anchorHtml)
    const description = fullText.replace(title, '').replace(/\s+/g, ' ').trim()
    const image = extractTileImage(anchorHtml, pageUrl)

    currentClusterTitles.add(normalizedTitle)
    currentCluster.push({
      title,
      ...(description ? { description } : {}),
      ...(href ? { href: { url: resolveAssetUrl(href, pageUrl) } } : {}),
      ...(image ? { image: { ...image, alt: title } } : {}),
    })
  }

  if (currentCluster.length > 0) {
    clusters.push(currentCluster)
  }

  return clusters
}

function componentTitleSet(component: DetectedComponent): Set<string> {
  const titles = new Set<string>()
  const content = component.content && typeof component.content === 'object'
    ? component.content as Record<string, unknown>
    : {}

  const collect = (value: unknown): void => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(collect)
      return
    }
    const record = value as Record<string, unknown>
    const title = normalizeTitle(record.heading ?? record.title ?? record.label)
    if (title) {
      titles.add(title)
    }
    if (record.content && typeof record.content === 'object') {
      collect(record.content)
    }
  }

  collect(content.leftColumn)
  collect(content.rightColumn)
  return titles
}

function matchingFeatureCluster(component: DetectedComponent, clusters: FeatureTile[][]): FeatureTile[] | undefined {
  const titles = componentTitleSet(component)
  if (component.type !== 'two-column' || titles.size < 2) {
    return undefined
  }

  let best: { cluster: FeatureTile[]; extraTiles: number } | undefined
  for (const cluster of clusters) {
    if (cluster.length < 3 || cluster.length <= titles.size) {
      continue
    }

    const tileTitles = new Set(cluster.map(tile => normalizeTitle(tile.title)).filter((title): title is string => Boolean(title)))
    let overlap = 0
    titles.forEach(title => {
      if (tileTitles.has(title)) overlap += 1
    })

    if (overlap < 2 || overlap !== titles.size) {
      continue
    }

    const extraTiles = cluster.length - titles.size
    if (!best || extraTiles < best.extraTiles) {
      best = { cluster, extraTiles }
    }
  }

  return best?.cluster
}

export function promoteSourceFeatureTilesToCardGrid(
  components: DetectedComponent[],
  options: { domSnapshot?: string | null; pageUrl?: string } = {}
): DetectedComponent[] {
  const clusters = extractFeatureTileClusters(options.domSnapshot, options.pageUrl)
  if (clusters.length === 0) {
    return components
  }

  let changed = false
  const next = components.map(component => {
    const tiles = matchingFeatureCluster(component, clusters)
    if (!tiles) {
      return component
    }

    changed = true
    console.log('[FeatureTileGridProcessor] Promoted source feature tiles to card-grid:', {
      replacedComponentType: component.type,
      cardCount: tiles.length,
      titles: tiles.map(tile => tile.title).slice(0, 8),
    })

    return {
      ...component,
      component: 'card-grid',
      type: 'card-grid' as DetectedComponent['type'],
      content: {
        heading: typeof (component.content as Record<string, unknown> | undefined)?.heading === 'string'
          ? (component.content as Record<string, unknown>).heading
          : undefined,
        cards: tiles,
      },
    }
  })

  return changed ? next : components
}
