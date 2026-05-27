import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { resolveAssetUrl } from './utils'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function componentRegion(component: DetectedComponent): string | undefined {
  const metadataRegion = component.metadata?.region
  if (typeof metadataRegion === 'string') {
    return metadataRegion
  }
  const content = isRecord(component.content) ? component.content : {}
  return typeof content.region === 'string' ? content.region : undefined
}

function hasHeroImage(component: DetectedComponent): boolean {
  const content = isRecord(component.content) ? component.content : {}
  return Boolean(content.image || content.imageUrl || content.backgroundImage)
}

function hasHeroHeading(component: DetectedComponent): boolean {
  const content = isRecord(component.content) ? component.content : {}
  return typeof content.heading === 'string' && content.heading.trim().length > 0
}

function isHeroWithImage(component: DetectedComponent): boolean {
  return String(component.type) === 'hero-with-image' &&
    hasHeroHeading(component) &&
    hasHeroImage(component)
}

function minimumConfidence(components: DetectedComponent[]): number {
  if (components.length === 0) {
    return 0.9
  }
  return Math.min(...components.map(component => component.confidence || 0.9))
}

function buildSlide(component: DetectedComponent, index: number): Record<string, unknown> {
  const content = isRecord(component.content) ? component.content : {}
  const slide: Record<string, unknown> = {
    id: `slide-${index + 1}`,
  }

  for (const key of [
    'eyebrow',
    'kicker',
    'heading',
    'subheading',
    'body',
    'summary',
    'description',
    'theme',
    'alignment',
    'backgroundColor',
    'image',
    'overlay',
    'ctaButtons',
    'analyticsId'
  ]) {
    if (content[key] != null) {
      slide[key] = content[key]
    }
  }

  if (!slide.image && content.imageUrl) {
    slide.image = content.imageUrl
  }

  return slide
}

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
  const text = stripHtml(value)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
  return text.length > 0 ? text : undefined
}

function listingItems(component: DetectedComponent): Record<string, unknown>[] {
  const content = isRecord(component.content) ? component.content : {}
  for (const key of ['pinned', 'cards', 'items', 'entries']) {
    const value = content[key]
    if (Array.isArray(value)) {
      return value.filter(isRecord)
    }
  }
  return []
}

function getImageUrl(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (!isRecord(value)) {
    return undefined
  }
  const src = value.src
  if (typeof src === 'string') {
    return src
  }
  if (isRecord(src)) {
    return typeof src.url === 'string'
      ? src.url
      : typeof src.originalUrl === 'string'
        ? src.originalUrl
        : undefined
  }
  return typeof value.url === 'string'
    ? value.url
    : typeof value.originalUrl === 'string'
      ? value.originalUrl
      : undefined
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'hero-slide'
}

function normalizeListingImage(item: Record<string, unknown>): unknown {
  if (item.image) {
    return item.image
  }

  const imageValue = item.imageUrl ?? item.thumbnail
  const url = getImageUrl(imageValue)
  if (!url) {
    return undefined
  }

  const title = typeof item.title === 'string'
    ? item.title
    : typeof item.heading === 'string'
      ? item.heading
      : 'Hero slide'
  const alt = isRecord(imageValue) && typeof imageValue.alt === 'string' ? imageValue.alt : title
  return {
    src: {
      mediaId: `detected:${slugify(title)}`,
      mediaType: 'image',
      url,
    },
    alt,
  }
}

function isHeroImageUrl(value: unknown): boolean {
  const url = getImageUrl(value)
  return typeof url === 'string' && /(hero|carousel|slide|banner|homepage)/i.test(url)
}

function buildSlideFromListingItem(item: Record<string, unknown>, index: number): Record<string, unknown> {
  const title = typeof item.title === 'string'
    ? item.title
    : typeof item.heading === 'string'
      ? item.heading
      : undefined
  const excerpt = typeof item.excerpt === 'string'
    ? item.excerpt
    : typeof item.description === 'string'
      ? item.description
      : undefined
  const href = item.href
  const image = normalizeListingImage(item)
  return {
    id: `slide-${index + 1}`,
    ...(title ? { heading: title } : {}),
    ...(excerpt ? { body: excerpt } : {}),
    ...(image ? { image } : {}),
    ...(href ? { ctaButtons: [{ label: title ?? 'Open', href, variant: 'primary' }] } : {}),
  }
}

function buildMediaReference(url: string, title: string): Record<string, unknown> {
  return {
    src: {
      mediaId: `detected:${slugify(title)}`,
      mediaType: 'image',
      url,
      originalUrl: url,
    },
    alt: title,
    originalUrl: url,
  }
}

const ITEM_START_PATTERN = /<div\b[^>]*\bclass\s*=\s*(["'])[^"']*\bitem\b[^"']*\1[^>]*>/gi
const RCH_FEATURED_CAROUSEL_START_PATTERN = /<div\b[^>]*\bid\s*=\s*(["'])rch-featured-carousel\1[^>]*>/i
const RCH_FEATURED_CAROUSEL_END_PATTERN = /<div\b[^>]*\bid\s*=\s*(["'])(?:rch-featured-carousel-xs|rch-quicklinks|rch-news-carousel|fd-news-carousel)\1[^>]*>/i
const GENERIC_CAROUSEL_PATTERN = /<div\b[^>]*(?:id|class)\s*=\s*(["'])[^"']*\bcarousel\b[^"']*\1[^>]*>/gi
const HEADING_PATTERN = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i
const HREF_PATTERN = /\bhref\s*=\s*(["'])(.*?)\1/i
const IMG_PATTERN = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/i
const BACKGROUND_PATTERN = /background(?:-image)?\s*:[^;]*url\((['"]?)([^'")]+)\1\)/i

function findSourceCarouselHtml(html: string): string | undefined {
  const rchStart = RCH_FEATURED_CAROUSEL_START_PATTERN.exec(html)
  if (rchStart) {
    const afterStart = html.slice(rchStart.index + rchStart[0].length)
    const end = RCH_FEATURED_CAROUSEL_END_PATTERN.exec(afterStart)
    return html.slice(
      rchStart.index,
      end ? rchStart.index + rchStart[0].length + end.index : Math.min(html.length, rchStart.index + 30000)
    )
  }

  const starts: number[] = []
  let match: RegExpExecArray | null
  GENERIC_CAROUSEL_PATTERN.lastIndex = 0
  while ((match = GENERIC_CAROUSEL_PATTERN.exec(html)) !== null) {
    starts.push(match.index)
  }

  return starts
    .map((start, index) => {
      const end = starts[index + 1] ?? Math.min(html.length, start + 30000)
      return html.slice(start, end)
    })
    .filter(container => (container.match(ITEM_START_PATTERN) ?? []).length >= 2)
    .sort((a, b) => b.length - a.length)[0]
}

function extractSourceCarouselSlides(domSnapshot: string | null | undefined, pageUrl?: string): Record<string, unknown>[] {
  if (!domSnapshot) {
    return []
  }

  const html = domSnapshot
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')

  const carouselHtml = findSourceCarouselHtml(html)
  if (!carouselHtml) {
    return []
  }

  const itemStarts: RegExpExecArray[] = []
  let match: RegExpExecArray | null
  ITEM_START_PATTERN.lastIndex = 0
  while ((match = ITEM_START_PATTERN.exec(carouselHtml)) !== null) {
    itemStarts.push(match)
  }

  const slides: Record<string, unknown>[] = []
  const seenTitles = new Set<string>()
  for (let index = 0; index < itemStarts.length; index += 1) {
    const start = itemStarts[index].index
    const end = itemStarts[index + 1]?.index ?? Math.min(carouselHtml.length, start + 6000)
    const itemHtml = carouselHtml.slice(start, end)
    const heading = HEADING_PATTERN.exec(itemHtml)?.[1]
    const title = heading ? stripHtml(heading) : ''
    const normalized = normalizeTitle(title)
    if (!normalized || seenTitles.has(normalized)) {
      continue
    }

    const rawText = stripHtml(itemHtml)
    const body = rawText
      .replace(title, '')
      .replace(/\bClick here(?: to (?:find out more|learn more))?\.?/i, '')
      .replace(/\s+/g, ' ')
      .trim()
    const imageCandidate = IMG_PATTERN.exec(itemHtml)?.[2] ?? BACKGROUND_PATTERN.exec(itemHtml)?.[2]
    const imageUrl = imageCandidate ? resolveAssetUrl(imageCandidate, pageUrl) : undefined
    const hrefCandidate = HREF_PATTERN.exec(itemHtml)?.[2]
    const hrefUrl = hrefCandidate ? resolveAssetUrl(hrefCandidate, pageUrl) : undefined

    seenTitles.add(normalized)
    slides.push({
      id: `slide-${slides.length + 1}`,
      heading: title,
      ...(body ? { body } : {}),
      ...(imageUrl ? { image: buildMediaReference(imageUrl, title) } : {}),
      ...(hrefUrl ? { ctaButtons: [{ label: 'Click here', href: { url: hrefUrl, type: 'external' }, variant: 'primary' }] } : {}),
    })
  }

  return slides
}

function componentHeading(component: DetectedComponent): string | undefined {
  const content = isRecord(component.content) ? component.content : {}
  return typeof content.heading === 'string' ? content.heading : undefined
}

function carouselSlideTitleSet(component: DetectedComponent): Set<string> {
  const content = isRecord(component.content) ? component.content : {}
  const slides = Array.isArray(content.slides) ? content.slides.filter(isRecord) : []
  return new Set(slides.map(slide => normalizeTitle(slide.heading)).filter((title): title is string => Boolean(title)))
}

function slideOverlap(existingTitles: Set<string>, sourceSlides: Record<string, unknown>[]): number {
  let overlap = 0
  for (const slide of sourceSlides) {
    const title = normalizeTitle(slide.heading)
    if (title && existingTitles.has(title)) {
      overlap += 1
    }
  }
  return overlap
}

function listingTitleSet(component: DetectedComponent): Set<string> {
  return new Set(listingItems(component)
    .map(item => normalizeTitle(item.title ?? item.heading))
    .filter((title): title is string => Boolean(title)))
}

function findTopSourceCarouselCandidate(
  components: DetectedComponent[],
  sourceSlides: Record<string, unknown>[]
): { start: number; end: number; overlap: number } | undefined {
  const sourceTitles = new Set(sourceSlides.map(slide => normalizeTitle(slide.heading)).filter((title): title is string => Boolean(title)))
  const start = components.findIndex(component => {
    const title = normalizeTitle(componentHeading(component))
    return String(component.type) === 'hero-with-image' && title ? sourceTitles.has(title) : false
  })
  if (start === -1) {
    return undefined
  }

  const precedingComponents = components.slice(0, start)
  const onlyHeaderBeforeHero = precedingComponents.every(component => {
    const type = String(component.type)
    const region = componentRegion(component)
    return region === 'header' || type === 'navbar' || type === 'breadcrumb' || type === 'breadcrumbs'
  })
  if (!onlyHeaderBeforeHero) {
    return undefined
  }

  let end = start
  let overlap = 0
  let index = start
  for (; index < components.length; index += 1) {
    const component = components[index]
    const type = String(component.type)
    if (type !== 'hero-with-image') {
      break
    }

    const title = normalizeTitle(componentHeading(component))
    if (!title || !sourceTitles.has(title)) {
      break
    }

    overlap += 1
    end = index
  }

  const recapCandidate = components[index]
  const recapType = String(recapCandidate?.type)
  if (recapCandidate && (recapType === 'card-grid' || recapType === 'content-feed')) {
    const titles = listingTitleSet(recapCandidate)
    let listingOverlap = 0
    titles.forEach(title => {
      if (sourceTitles.has(title)) {
        listingOverlap += 1
      }
    })
    const overlapRatio = titles.size > 0 ? listingOverlap / titles.size : 0
    if (listingOverlap >= 2 && overlapRatio >= 0.6) {
      overlap += listingOverlap
      end = index
    }
  }

  return overlap >= 2 ? { start, end, overlap } : undefined
}

function isHeroImageListing(component: DetectedComponent): boolean {
  const type = String(component.type)
  if (type !== 'card-grid' && type !== 'content-feed') {
    return false
  }
  const items = listingItems(component)
  if (items.length < 2 || items.length > 5) {
    return false
  }
  let heroImageMatches = 0
  const allItemsValid = items.every(item => {
    const title = typeof item.title === 'string' || typeof item.heading === 'string'
    const hasDateOrCategory = item.date != null || item.category != null
    const imageValue = item.image ?? item.imageUrl ?? item.thumbnail
    if (isHeroImageUrl(imageValue)) {
      heroImageMatches += 1
    }
    return title && !hasDateOrCategory && Boolean(getImageUrl(imageValue))
  })
  return allItemsValid && heroImageMatches >= Math.max(2, Math.ceil(items.length * 0.6))
}

function findFirstHeroRun(components: DetectedComponent[]): { start: number; end: number } | undefined {
  const start = components.findIndex(isHeroWithImage)
  if (start === -1) {
    return undefined
  }

  const precedingComponents = components.slice(0, start)
  const onlyHeaderBeforeHero = precedingComponents.every(component => {
    const type = String(component.type)
    const region = componentRegion(component)
    return region === 'header' || type === 'navbar' || type === 'breadcrumb' || type === 'breadcrumbs'
  })
  if (!onlyHeaderBeforeHero) {
    return undefined
  }

  let end = start
  while (end + 1 < components.length && isHeroWithImage(components[end + 1])) {
    end += 1
  }

  const count = end - start + 1
  return count >= 2 && count <= 5 ? { start, end } : undefined
}

function findTopHeroWithListingRun(components: DetectedComponent[]): { heroIndex: number; listingIndex: number } | undefined {
  const heroIndex = components.findIndex(isHeroWithImage)
  if (heroIndex === -1 || heroIndex + 1 >= components.length) {
    return undefined
  }

  const precedingComponents = components.slice(0, heroIndex)
  const onlyHeaderBeforeHero = precedingComponents.every(component => {
    const type = String(component.type)
    const region = componentRegion(component)
    return region === 'header' || type === 'navbar' || type === 'breadcrumb' || type === 'breadcrumbs'
  })
  if (!onlyHeaderBeforeHero) {
    return undefined
  }

  return isHeroImageListing(components[heroIndex + 1])
    ? { heroIndex, listingIndex: heroIndex + 1 }
    : undefined
}

/**
 * Collapses adjacent top-of-page hero-with-image slides into the existing
 * hero-carousel component so page hierarchy matches slider source structure.
 */
export function collapseAdjacentHeroSlides(components: DetectedComponent[]): DetectedComponent[] {
  const run = findFirstHeroRun(components)
  const listingRun = run ? undefined : findTopHeroWithListingRun(components)
  if (!run && !listingRun) {
    return components
  }

  const heroSlides = run
    ? components.slice(run.start, run.end + 1).map(buildSlide)
    : [
        buildSlide(components[listingRun!.heroIndex], 0),
        ...listingItems(components[listingRun!.listingIndex]).map((item, index) => buildSlideFromListingItem(item, index + 1))
      ]
  const firstComponent = run ? components[run.start] : components[listingRun!.heroIndex]
  const start = run ? run.start : listingRun!.heroIndex
  const end = run ? run.end : listingRun!.listingIndex
  const confidenceComponents = run
    ? components.slice(run.start, run.end + 1)
    : [components[listingRun!.heroIndex], components[listingRun!.listingIndex]]
  const firstContent = isRecord(firstComponent.content)
    ? firstComponent.content
    : {}
  const carousel: DetectedComponent = {
    ...firstComponent,
    component: 'hero-carousel',
    type: 'hero-carousel' as DetectedComponent['type'],
    confidence: minimumConfidence(confidenceComponents),
    content: {
      slides: heroSlides,
      autoPlay: true,
      pauseOnHover: true,
      showIndicators: true,
      showControls: true,
      loop: true,
      height: 'large',
      transitionStyle: 'fade',
      ...(typeof firstContent.alignment === 'string' ? { alignment: firstContent.alignment } : {}),
      ...(typeof firstContent.theme === 'string' ? { theme: firstContent.theme } : {}),
    },
    metadata: {
      ...(firstComponent.metadata ?? {}),
      region: 'hero',
      source: 'structural-hero-carousel-collapse',
    },
  }

  console.log('[HeroCarouselProcessor] Collapsed adjacent hero slides:', {
    startIndex: start,
    slideCount: heroSlides.length,
  })

  return [
    ...components.slice(0, start),
    carousel,
    ...components.slice(end + 1),
  ]
}

export function enrichHeroCarouselFromSource(
  components: DetectedComponent[],
  options: { domSnapshot?: string | null; pageUrl?: string } = {}
): DetectedComponent[] {
  const sourceSlides = extractSourceCarouselSlides(options.domSnapshot, options.pageUrl)
  if (sourceSlides.length < 2) {
    return components
  }

  const carouselIndex = components.findIndex(component => String(component.type) === 'hero-carousel')
  if (carouselIndex === -1) {
    const candidate = findTopSourceCarouselCandidate(components, sourceSlides)
    if (!candidate) {
      return components
    }

    const firstComponent = components[candidate.start]
    const firstContent = isRecord(firstComponent.content) ? firstComponent.content : {}
    const carousel: DetectedComponent = {
      ...firstComponent,
      component: 'hero-carousel',
      type: 'hero-carousel' as DetectedComponent['type'],
      content: {
        slides: sourceSlides,
        autoPlay: true,
        pauseOnHover: true,
        showIndicators: true,
        showControls: true,
        loop: true,
        height: 'large',
        transitionStyle: 'fade',
        ...(typeof firstContent.alignment === 'string' ? { alignment: firstContent.alignment } : {}),
        ...(typeof firstContent.theme === 'string' ? { theme: firstContent.theme } : {}),
      },
      metadata: {
        ...(firstComponent.metadata ?? {}),
        region: 'hero',
        source: 'source-carousel-enrichment',
      },
    }

    console.log('[HeroCarouselProcessor] Created hero carousel from source DOM:', {
      startIndex: candidate.start,
      replacedThroughIndex: candidate.end,
      sourceSlideCount: sourceSlides.length,
      overlap: candidate.overlap,
    })

    return [
      ...components.slice(0, candidate.start),
      carousel,
      ...components.slice(candidate.end + 1),
    ]
  }

  const carousel = components[carouselIndex]
  const existingTitles = carouselSlideTitleSet(carousel)
  if (existingTitles.size === 0 || sourceSlides.length <= existingTitles.size) {
    return components
  }

  const overlap = slideOverlap(existingTitles, sourceSlides)
  if (overlap < Math.max(2, Math.ceil(existingTitles.size * 0.6))) {
    return components
  }

  const sourceTitles = new Set(sourceSlides.map(slide => normalizeTitle(slide.heading)).filter((title): title is string => Boolean(title)))
  const nextCarousel: DetectedComponent = {
    ...carousel,
    content: {
      ...(isRecord(carousel.content) ? carousel.content : {}),
      slides: sourceSlides,
    },
    metadata: {
      ...(carousel.metadata ?? {}),
      source: 'source-carousel-enrichment',
    },
  }

  console.log('[HeroCarouselProcessor] Enriched hero carousel from source DOM:', {
    previousSlideCount: existingTitles.size,
    sourceSlideCount: sourceSlides.length,
    overlap,
  })

  const result: DetectedComponent[] = []
  for (let index = 0; index < components.length; index += 1) {
    if (index === carouselIndex) {
      result.push(nextCarousel)
      continue
    }

    const component = components[index]
    const title = normalizeTitle(componentHeading(component))
    if (
      index > carouselIndex &&
      String(component.type) === 'hero-with-image' &&
      title &&
      sourceTitles.has(title)
    ) {
      console.log('[HeroCarouselProcessor] Dropped standalone hero duplicated by source carousel:', {
        title: componentHeading(component),
      })
      continue
    }

    result.push(component)
  }

  return result
}
