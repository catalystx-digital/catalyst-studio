import { canonicalizeComponentType } from './registry'
import type { CanonicalSynthesizeParams, CanonicalSynthesisResult } from './types'
import type { DetectedComponent } from '../types'
import { ConfidenceConfig } from '../../config'

// Use centralized synthetic confidence
const SYNTH_CONFIDENCE = ConfidenceConfig.synthetic.hero

export function synthesizeHeroWithImage({
  components,
  pattern,
  region,
  pageMetadata,
  pageUrl,
  templateKey
}: CanonicalSynthesizeParams): CanonicalSynthesisResult | null {
  const resolvedRegion = region || 'hero'

  // Parse title to extract page name and site name
  const { pageTitle, siteName } = parseTitleAndSiteName(
    pageMetadata?.title,
    pageMetadata?.openGraph?.title
  )

  const heading = selectFirstString([
    pageTitle,
    inferTitleFromUrl(pageUrl)
  ]) ?? 'Welcome'

  // Use site name as subheading fallback if no description available
  const subheading = selectFirstString([
    pageMetadata?.description,
    pageMetadata?.openGraph?.description,
    siteName
  ])

  const image = findPrimaryImage(components, pageMetadata)

  const content: Record<string, any> = {
    heading,
    region: resolvedRegion,
    fallback: true
  }

  if (subheading) {
    content.subheading = subheading
  }

  if (image) {
    content.image = image
  }

  const primaryCta = buildPrimaryCta(pageMetadata)
  if (primaryCta) {
    content.ctaButtons = [primaryCta]
  }

  content.metadata = {
    confidence: SYNTH_CONFIDENCE,
    region: resolvedRegion,
    source: 'canonical-synthesis',
    templateKey,
    fragments: ['hero-heading', 'hero-image']
  }

  const componentType = canonicalizeComponentType(pattern.type) as DetectedComponent['type']
  const synthesized: DetectedComponent = {
    component: componentType,
    type: componentType,
    confidence: SYNTH_CONFIDENCE,
    content,
    location: inferLocationFromRegion(resolvedRegion),
    metadata: {
      confidence: pattern.confidence ?? SYNTH_CONFIDENCE,
      ...(pattern.metadata as Record<string, any> | undefined),
      source: 'canonical-synthesis',
      templateKey,
      fragments: ['hero-heading', 'hero-image']
    }
  }

  const insertIndex = determineHeroInsertIndex(components)

  return {
    component: synthesized,
    insertIndex
  }
}

function determineHeroInsertIndex(components: DetectedComponent[]): number {
  if (components.length === 0) {
    return 0
  }
  let headerCount = 0
  for (let i = 0; i < components.length; i += 1) {
    const location = components[i].location || inferLocationFromRegion(components[i].metadata?.region || '')
    if (location === 'header') {
      headerCount = i + 1
    }
  }
  return headerCount
}

function findPrimaryImage(
  components: DetectedComponent[],
  pageMetadata?: CanonicalSynthesizeParams['pageMetadata']
): { src: string; alt?: string } | undefined {
  const metaImage = selectFirstString([
    pageMetadata?.openGraph?.image,
    pageMetadata?.logo
  ])
  if (metaImage) {
    return { src: metaImage }
  }

  for (const component of components) {
    const canonical = canonicalizeComponentType(component.component) || canonicalizeComponentType(component.type)
    const content = component.content || {}

    if (canonical === 'hero-with-image' && content.image && typeof content.image === 'object') {
      const candidate = normalizeImage(content.image)
      if (candidate) {
        return candidate
      }
    }

    const heroImage = content.heroImage || content.image
    if (heroImage) {
      const candidate = normalizeImage(heroImage)
      if (candidate) {
        return candidate
      }
    }

    if (canonical === 'image-gallery' && Array.isArray(content.images)) {
      for (const item of content.images) {
        const candidate = normalizeImage(item)
        if (candidate) {
          return candidate
        }
      }
    }

    if (canonical === 'card-grid' && Array.isArray(content.cards)) {
      for (const card of content.cards) {
        const candidate = normalizeImage(card?.image)
        if (candidate) {
          return candidate
        }
      }
    }
  }

  return undefined
}

function normalizeImage(value: any): { src: string; alt?: string } | undefined {
  if (!value) {
    return undefined
  }
  if (typeof value === 'string') {
    return { src: value }
  }
  if (typeof value === 'object') {
    const src = value.src || value.url || value.href
    if (typeof src === 'string' && src.trim().length > 0) {
      return {
        src,
        alt: selectFirstString([value.alt, value.title, value.caption])
      }
    }
  }
  return undefined
}

function buildPrimaryCta(pageMetadata?: CanonicalSynthesizeParams['pageMetadata']): { label: string; href: string; variant: string } | undefined {
  const target = pageMetadata?.primaryPurpose || pageMetadata?.targetAudience
  if (target) {
    return {
      label: 'Learn More',
      href: '#learn-more',
      variant: 'default'
    }
  }
  return undefined
}

function inferTitleFromUrl(pageUrl?: string): string | undefined {
  if (!pageUrl) {
    return undefined
  }
  try {
    const { pathname } = new URL(pageUrl)
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) {
      return undefined
    }
    const last = segments[segments.length - 1]
    return last
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, char => char.toUpperCase())
  } catch {
    return undefined
  }
}

function selectFirstString(values: any[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return undefined
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

/**
 * Parse a page title to extract the page-specific name and site name
 * Common formats:
 * - "Page Title | Site Name"
 * - "Page Title - Site Name"
 * - "Page Title : Site Name"
 */
function parseTitleAndSiteName(
  title?: string,
  ogTitle?: string
): { pageTitle?: string; siteName?: string } {
  const rawTitle = title || ogTitle
  if (!rawTitle || typeof rawTitle !== 'string') {
    return {}
  }

  // Try common title separators: |, -, :
  const separators = [' | ', ' - ', ' : ', '|', '-']
  for (const sep of separators) {
    if (rawTitle.includes(sep)) {
      const parts = rawTitle.split(sep).map(p => p.trim()).filter(p => p.length > 0)
      if (parts.length >= 2) {
        // First part is typically the page title, last part is typically the site name
        return {
          pageTitle: parts[0],
          siteName: parts[parts.length - 1]
        }
      }
    }
  }

  // No separator found, return the whole title as page title
  return { pageTitle: rawTitle.trim() }
}
