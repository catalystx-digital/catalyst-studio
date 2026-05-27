import type { DetectedComponent } from '@/lib/studio/import/detection/types'

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
