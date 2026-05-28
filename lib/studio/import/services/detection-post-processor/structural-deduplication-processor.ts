import type { DetectedComponent } from '@/lib/studio/import/detection/types'

type ListingKind = 'listing' | 'other'

interface SurfaceFingerprint {
  kind: ListingKind
  family: string
  titles: Set<string>
  heading?: string
  hasMedia: boolean
  hasEditorialLinks: boolean
  richnessScore: number
}

const LISTING_TYPES = new Set(['card-grid', 'content-feed', 'two-column'])
const NEWS_HEADING_PATTERN = /\b(news|latest|updates?|stories|media|articles?)\b/i
const EDITORIAL_PATH_PATTERN = /\/(?:news|blog|blogs|article|articles|post|posts|press|media|stories)(?:\/|$)/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  return normalized.length > 0 ? normalized : undefined
}

function listingItems(component: DetectedComponent): Record<string, unknown>[] {
  const content = isRecord(component.content) ? component.content : {}

  if (component.type === 'two-column') {
    const columns = [
      ...childComponents(content.leftColumn),
      ...childComponents(content.rightColumn),
    ]
    const nestedItems: Record<string, unknown>[] = []
    for (const child of columns) {
      const type = childType(child)
      const childContent = isRecord(child.content) ? child.content : {}
      if (!LISTING_TYPES.has(type) || type === 'two-column') {
        continue
      }
      const childCandidates = [
        childContent.cards,
        childContent.pinned,
        childContent.items,
        childContent.entries,
      ]
      for (const candidate of childCandidates) {
        if (Array.isArray(candidate)) {
          nestedItems.push(...candidate.filter(isRecord))
          break
        }
      }
    }
    return nestedItems
  }

  const candidates = [
    content.cards,
    content.pinned,
    content.items,
    content.entries
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord)
    }
  }

  return []
}

function heroCarouselSlideTitles(component: DetectedComponent): Set<string> {
  if (component.type !== 'hero-carousel') {
    return new Set()
  }

  const content = isRecord(component.content) ? component.content : {}
  const slides = Array.isArray(content.slides) ? content.slides.filter(isRecord) : []
  const titles = new Set<string>()

  for (const slide of slides) {
    const slideContent = isRecord(slide.content) ? slide.content : {}
    const sources = [slide, slideContent]
    for (const source of sources) {
      const title = normalizeText(source.heading ?? source.title ?? source.label ?? source.alt)
      if (title) {
        titles.add(title)
      }
      const image = isRecord(source.image) ? source.image : undefined
      const imageAlt = normalizeText(image?.alt)
      if (imageAlt) {
        titles.add(imageAlt)
      }
      const ctaButtons = Array.isArray(source.ctaButtons) ? source.ctaButtons.filter(isRecord) : []
      for (const button of ctaButtons) {
        const label = normalizeText(button.label)
        if (label) {
          titles.add(label)
        }
      }
    }
  }

  return titles
}

function hasImageLikeValue(value: unknown): boolean {
  if (!value) {
    return false
  }
  if (typeof value === 'string') {
    return /\.(png|jpe?g|webp|gif|svg|avif)(?:[?#].*)?$/i.test(value)
  }
  if (Array.isArray(value)) {
    return value.some(hasImageLikeValue)
  }
  if (!isRecord(value)) {
    return false
  }
  if (value.image || value.imageUrl || value.src || value.url || value.originalUrl) {
    return true
  }
  return Object.values(value).some(hasImageLikeValue)
}

function hasEditorialLink(value: unknown): boolean {
  if (!value) {
    return false
  }
  if (typeof value === 'string') {
    return EDITORIAL_PATH_PATTERN.test(value)
  }
  if (Array.isArray(value)) {
    return value.some(hasEditorialLink)
  }
  if (!isRecord(value)) {
    return false
  }
  return Object.values(value).some(hasEditorialLink)
}

function getComponentTitle(component: DetectedComponent): string | undefined {
  const content = isRecord(component.content) ? component.content : {}
  return normalizeText(content.heading ?? content.title ?? content.label)
}

function familyFor(component: DetectedComponent, items: Record<string, unknown>[]): string {
  const heading = getComponentTitle(component)
  if (heading && NEWS_HEADING_PATTERN.test(heading)) {
    return 'news'
  }
  if (items.some(item => hasEditorialLink(item.href ?? item.url ?? item.link ?? item))) {
    return 'news'
  }
  return heading ?? String(component.type)
}

function fingerprint(component: DetectedComponent): SurfaceFingerprint {
  if (component.type === 'hero-carousel') {
    const titles = heroCarouselSlideTitles(component)
    return {
      kind: 'other',
      family: 'hero-carousel',
      titles,
      heading: undefined,
      hasMedia: hasImageLikeValue(component.content),
      hasEditorialLinks: false,
      richnessScore: titles.size * 2 + (hasImageLikeValue(component.content) ? 8 : 0)
    }
  }

  if (!LISTING_TYPES.has(String(component.type))) {
    const title = getComponentTitle(component)
    return {
      kind: 'other',
      family: title ?? String(component.type),
      titles: new Set(title ? [title] : []),
      heading: title,
      hasMedia: hasImageLikeValue(component.content),
      hasEditorialLinks: false,
      richnessScore: title ? 1 : 0
    }
  }

  const items = listingItems(component)
  const titles = new Set<string>()
  let hasMedia = false
  let hasEditorialLinks = false
  let populatedFields = 0
  for (const item of items) {
    const title = normalizeText(item.title ?? item.heading ?? item.label ?? item.name)
    if (title) {
      titles.add(title)
    }
    for (const value of Object.values(item)) {
      if (value != null && value !== '') {
        populatedFields += 1
      }
    }
    if (hasImageLikeValue(item.image ?? item.imageUrl ?? item.thumbnail ?? item.media)) {
      hasMedia = true
    }
    if (hasEditorialLink(item.href ?? item.url ?? item.link ?? item)) {
      hasEditorialLinks = true
    }
  }

  return {
    kind: 'listing',
    family: familyFor(component, items),
    titles,
    heading: getComponentTitle(component),
    hasMedia,
    hasEditorialLinks,
    richnessScore: titles.size * 2 + Math.min(populatedFields, 12) + (hasMedia ? 8 : 0) + (hasEditorialLinks ? 2 : 0)
  }
}

function countOverlap(a: Set<string>, b: Set<string>): number {
  let count = 0
  for (const title of a) {
    if (b.has(title)) {
      count += 1
    }
  }
  return count
}

function unionTitles(fingerprints: SurfaceFingerprint[]): Set<string> {
  const titles = new Set<string>()
  for (const entry of fingerprints) {
    entry.titles.forEach(title => titles.add(title))
  }
  return titles
}

function duplicatesPreviousHeroCarousel(current: SurfaceFingerprint, previous: SurfaceFingerprint[]): boolean {
  if (current.kind !== 'listing' || current.hasMedia || current.titles.size < 3) {
    return false
  }

  const heroTitles = unionTitles(previous.filter(entry => entry.family === 'hero-carousel'))
  if (heroTitles.size < 3) {
    return false
  }

  const overlap = countOverlap(current.titles, heroTitles)
  return overlap >= Math.max(3, Math.ceil(current.titles.size * 0.75))
}

function duplicatesRecentHeroSequence(current: SurfaceFingerprint, previous: SurfaceFingerprint[]): boolean {
  if (current.kind !== 'listing' || current.hasMedia || current.titles.size < 5) {
    return false
  }

  const recent = previous.slice(-5).filter(entry => entry.kind === 'other' && entry.titles.size > 0)
  if (recent.length < 2) {
    return false
  }

  const heroTitles = unionTitles(recent)
  const overlap = countOverlap(current.titles, heroTitles)
  return overlap >= 3 && overlap >= Math.ceil(heroTitles.size * 0.75)
}

function duplicatesRecentMultiItemListing(current: SurfaceFingerprint, previous: SurfaceFingerprint[]): boolean {
  if (current.kind !== 'listing' || current.titles.size !== 1 || !current.heading) {
    return false
  }

  const [title] = Array.from(current.titles)
  if (current.heading !== title) {
    return false
  }

  return previous
    .slice(-4)
    .some(entry => entry.kind === 'listing' && entry.titles.size > 1 && entry.titles.has(title))
}

function relatedListingFamilies(a: SurfaceFingerprint, b: SurfaceFingerprint): boolean {
  return a.family === b.family || (a.family === 'news' && b.family === 'news')
}

function duplicateCandidateIndex(current: SurfaceFingerprint, previous: SurfaceFingerprint[]): number | undefined {
  if (current.kind !== 'listing' || current.titles.size === 0) {
    return undefined
  }

  const recentListings = previous
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.kind === 'listing')

  let bestExactOrSubset: { index: number; score: number } | undefined
  for (const { entry, index } of recentListings) {
    const overlap = countOverlap(current.titles, entry.titles)
    const exactDuplicate = overlap === current.titles.size && overlap === entry.titles.size
    const currentSubset = overlap === current.titles.size && current.titles.size < entry.titles.size
    if (!exactDuplicate && !currentSubset) {
      continue
    }
    if (!exactDuplicate && !relatedListingFamilies(current, entry)) {
      continue
    }
    const score = overlap * 10 + entry.richnessScore
    if (!bestExactOrSubset || score > bestExactOrSubset.score) {
      bestExactOrSubset = { index, score }
    }
  }
  if (bestExactOrSubset) {
    return bestExactOrSubset.index
  }

  if (current.titles.size < 2) {
    return undefined
  }

  const recentTitles = unionTitles(recentListings.slice(-4).map(({ entry }) => entry))
  const recentOverlap = countOverlap(current.titles, recentTitles)
  if (!current.hasMedia && recentOverlap >= Math.max(2, Math.ceil(current.titles.size * 0.6))) {
    let bestRecent: { index: number; overlap: number } | undefined
    for (const { entry, index } of recentListings.slice(-4)) {
      const overlap = countOverlap(current.titles, entry.titles)
      if (!bestRecent || overlap > bestRecent.overlap) {
        bestRecent = { index, overlap }
      }
    }
    return bestRecent?.index
  }

  return undefined
}

function previousSubsetIndexes(current: SurfaceFingerprint, previous: SurfaceFingerprint[]): number[] {
  if (current.kind !== 'listing' || current.titles.size < 2) {
    return []
  }

  const indexes: number[] = []
  previous.forEach((entry, index) => {
    if (entry.kind !== 'listing' || entry.titles.size === 0 || entry.titles.size >= current.titles.size) {
      return
    }
    if (!relatedListingFamilies(current, entry)) {
      return
    }
    const overlap = countOverlap(entry.titles, current.titles)
    if (overlap === entry.titles.size && current.richnessScore >= entry.richnessScore) {
      indexes.push(index)
    }
  })
  return indexes
}

function childComponents(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(isRecord)
}

function childType(child: Record<string, unknown>): string {
  return normalizeText(child.type ?? child.component) ?? ''
}

function htmlBlockIsHeadingOnly(child: Record<string, unknown>): boolean {
  const content = isRecord(child.content) ? child.content : {}
  const props = isRecord(content.props) ? content.props : content
  const html = typeof props.bodyHtml === 'string' ? props.bodyHtml : typeof props.html === 'string' ? props.html : ''
  if (!html) {
    return false
  }
  if (/<(?:p|ul|ol|li|table|img|figure|section|article)\b/i.test(html)) {
    return false
  }
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 0 && text.length <= 100
}

function childIsNavigationOnly(child: Record<string, unknown>): boolean {
  const type = childType(child)
  if (type === 'sidemenu' || type === 'sidebar-nav' || type === 'breadcrumbs' || type === 'breadcrumb') {
    return true
  }
  return type === 'html-block' && htmlBlockIsHeadingOnly(child)
}

function isNavigationOnlyLayoutArtifact(component: DetectedComponent): boolean {
  if (String(component.type) !== 'two-column' || !isRecord(component.content)) {
    return false
  }

  const left = childComponents(component.content.leftColumn)
  const right = childComponents(component.content.rightColumn)
  const children = [...left, ...right]
  if (children.length === 0) {
    return false
  }

  const hasNavigationChild = children.some(child => {
    const type = childType(child)
    return type === 'sidemenu' || type === 'sidebar-nav' || type === 'breadcrumbs' || type === 'breadcrumb'
  })

  return hasNavigationChild && children.every(childIsNavigationOnly)
}

/**
 * Removes repeated listing surfaces produced by section-level extraction when
 * the same carousel/news/widget content is emitted as multiple top-level lists.
 */
export function collapseDuplicateListingSurfaces(components: DetectedComponent[]): DetectedComponent[] {
  const result: DetectedComponent[] = []
  const retained: SurfaceFingerprint[] = []

  for (const component of components) {
    if (isNavigationOnlyLayoutArtifact(component)) {
      console.log('[StructuralDeduplication] Dropped navigation-only layout artifact:', {
        droppedComponentType: component.type,
      })
      continue
    }

    const current = fingerprint(component)
    if (duplicatesPreviousHeroCarousel(current, retained) || duplicatesRecentHeroSequence(current, retained)) {
      console.log('[StructuralDeduplication] Dropped carousel slide listing surface:', {
        droppedComponentType: component.type,
        titleCount: current.titles.size,
        family: current.family,
      })
      continue
    }

    if (duplicatesRecentMultiItemListing(current, retained)) {
      console.log('[StructuralDeduplication] Dropped duplicate single-card listing surface:', {
        droppedComponentType: component.type,
        family: current.family,
        title: Array.from(current.titles)[0],
      })
      continue
    }

    const duplicateIndex = duplicateCandidateIndex(current, retained)
    if (duplicateIndex !== undefined) {
      const previous = retained[duplicateIndex]
      const keepCurrent = current.richnessScore > previous.richnessScore
      console.log('[StructuralDeduplication] Dropped duplicate listing surface:', {
        droppedComponentType: keepCurrent ? result[duplicateIndex]?.type : component.type,
        keptComponentType: keepCurrent ? component.type : result[duplicateIndex]?.type,
        family: keepCurrent ? previous.family : current.family,
        droppedTitleCount: keepCurrent ? previous.titles.size : current.titles.size,
        keptTitleCount: keepCurrent ? current.titles.size : previous.titles.size,
      })
      if (keepCurrent) {
        result[duplicateIndex] = component
        retained[duplicateIndex] = current
      }
      continue
    }

    const subsets = previousSubsetIndexes(current, retained)
    for (const index of subsets.sort((a, b) => b - a)) {
      console.log('[StructuralDeduplication] Dropped duplicate listing subset:', {
        droppedComponentType: result[index]?.type,
        keptComponentType: component.type,
        family: current.family,
        droppedTitleCount: retained[index]?.titles.size,
        keptTitleCount: current.titles.size,
      })
      result.splice(index, 1)
      retained.splice(index, 1)
    }

    result.push(component)
    retained.push(current)
  }

  return result
}
