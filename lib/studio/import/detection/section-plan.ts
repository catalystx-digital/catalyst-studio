import type { SectionInfo } from '../services/web-tools'
import { filterPageContentCandidateTypes } from './candidate-types'
import { classifyRouteIntent } from './section-taxonomy'

export type DetectionSectionRole = 'header' | 'hero' | 'main' | 'footer'

export interface DetectionSectionTask {
  sectionKey: string
  sectionOrder: number
  role: DetectionSectionRole
  required: boolean
  candidateTypes: string[]
}

const HEADER_TYPES = ['navbar']
const FOOTER_TYPES = ['footer']
const HERO_TYPES = ['hero-simple', 'hero-banner', 'hero-carousel', 'hero-split', 'hero-with-image', 'cta-banner', 'text-block']
const MAIN_TYPES = [
  'breadcrumbs',
  'hero-simple',
  'hero-with-image',
  'text-block',
  'two-column',
  'card-grid',
  'content-feed',
  'cta-simple',
  'cta-banner',
  'feature-grid',
  'feature-list',
  'statistics',
  'testimonials',
  'logo-cloud',
  'image-gallery',
  'about-section',
  'accordion'
]

const ROUTE_EXTRA_TYPES: Array<{ pattern: RegExp; types: string[] }> = [
  { pattern: /\/(?:about|team|people|company)(?:\/|$)/i, types: ['team-grid', 'about-section'] },
  { pattern: /\/(?:contact|get-in-touch|locations?)(?:\/|$)/i, types: ['contact-form', 'contact-info', 'location-map', 'simple-form'] },
  { pattern: /\/(?:pricing|plans?)(?:\/|$)/i, types: ['pricing-table', 'pricing-card'] },
  { pattern: /\/(?:news|blog|blogs|article|articles|post|posts|press|insights?)(?:\/|$)/i, types: ['content-feed', 'blog-list', 'blog-post', 'article-header'] }
]

function isDedicatedEditorialListingUrl(pageUrl: string): boolean {
  try {
    const path = new URL(pageUrl).pathname
    return /^\/(?:news|blog|blogs|article|articles|post|posts|press|media|insights?)(?:\/page\/\d+)?\/?$/i.test(path)
  } catch {
    return false
  }
}

function roleForSection(sectionKey: string, index: number): DetectionSectionRole {
  const key = sectionKey.toLowerCase()
  if (key.includes('header')) return 'header'
  if (key.includes('footer')) return 'footer'
  return index === 0 ? 'hero' : 'main'
}

function candidatesForRole(role: DetectionSectionRole, pageUrl: string): string[] {
  const routeIntent = classifyRouteIntent(pageUrl)
  const dedicatedEditorialListing = isDedicatedEditorialListingUrl(pageUrl)
  const candidates = new Set<string>(
    role === 'header'
      ? HEADER_TYPES
      : role === 'footer'
        ? FOOTER_TYPES
        : role === 'hero'
          ? [...HERO_TYPES, ...MAIN_TYPES]
          : MAIN_TYPES
  )

  routeIntent.allowedTypes.forEach(type => candidates.add(type))
  routeIntent.deniedTypes.forEach(type => candidates.delete(type))
  for (const hint of ROUTE_EXTRA_TYPES) {
    if (hint.pattern.test(pageUrl)) {
      hint.types.forEach(type => candidates.add(type))
    }
  }
  if (dedicatedEditorialListing && candidates.has('blog-list')) {
    candidates.delete('content-feed')
    candidates.delete('card-grid')
  }
  return filterPageContentCandidateTypes(candidates)
}

export function buildDetectionSectionPlan({
  pageUrl,
  sections
}: {
  pageUrl: string
  sections: SectionInfo[]
}): DetectionSectionTask[] {
  return sections.map((section, index) => {
    const role = roleForSection(section.key, index)
    return {
      sectionKey: section.key,
      sectionOrder: index,
      role,
      required: role === 'header' || role === 'footer',
      candidateTypes: candidatesForRole(role, pageUrl)
    }
  })
}
