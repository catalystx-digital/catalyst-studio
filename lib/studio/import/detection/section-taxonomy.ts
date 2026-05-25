export type SectionIntent =
  | 'project_grid'
  | 'editorial_feed'
  | 'service_grid'
  | 'feature_grid'
  | 'hero'
  | 'navigation'
  | 'footer'
  | 'unknown'

export interface SectionTaxonomyResult {
  intent: SectionIntent
  evidence: string[]
  allowedTypes: string[]
  deniedTypes: string[]
}

const PROJECT_TERMS = /\b(projects?|latest work|our work|client work|case stud(?:y|ies)|portfolio|showcase)\b/i
const SERVICE_TERMS = /\b(services?|solutions?|capabilities|offerings?|what we do)\b/i
const EDITORIAL_TERMS = /\b(news|blog|blogs|articles?|posts?|press|insights?|stories|updates)\b/i
const HERO_TERMS = /\b(hero|headline|masthead)\b/i
const NAV_TERMS = /\b(nav|navigation|menu|header)\b/i
const FOOTER_TERMS = /\b(footer|legal|copyright)\b/i
const DATE_PATTERN = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i
const EDITORIAL_PATH = /\/(?:news|blog|blogs|article|articles|post|posts|press|insights?)(?:\/|$)/i
const PROJECT_PATH = /\/(?:projects?|work|our-work|portfolio|case-stud(?:y|ies)|clients?|showcase)(?:\/|$)/i
const SERVICE_PATH = /\/(?:services?|solutions?|capabilities|offerings?)(?:\/|$)/i

function normalizeText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value == null) return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function collectStrings(value: unknown, limit = 80): string[] {
  const found: string[] = []
  const visit = (candidate: unknown) => {
    if (found.length >= limit || candidate == null) return
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim()
      if (trimmed) found.push(trimmed)
      return
    }
    if (typeof candidate === 'number' || typeof candidate === 'boolean') {
      found.push(String(candidate))
      return
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item)
      return
    }
    if (typeof candidate === 'object') {
      for (const nested of Object.values(candidate as Record<string, unknown>)) {
        visit(nested)
      }
    }
  }
  visit(value)
  return found
}

function addEvidence(evidence: string[], label: string, value?: string): void {
  const suffix = value ? `:${value.slice(0, 80)}` : ''
  evidence.push(`${label}${suffix}`)
}

export function classifySectionIntent(input: {
  componentType?: string
  content?: Record<string, unknown>
  pageUrl?: string
}): SectionTaxonomyResult {
  const content = input.content ?? {}
  const headingText = [
    content.heading,
    content.title,
    content.subheading,
    content.eyebrow
  ].map(normalizeText).filter(Boolean).join(' ')
  const allText = collectStrings(content).join(' ')
  const combined = [headingText, allText, input.pageUrl].filter(Boolean).join(' ')
  const evidence: string[] = []

  const hasDates = DATE_PATTERN.test(combined)
  const hasEditorialText = EDITORIAL_TERMS.test(combined)
  const hasEditorialPath = EDITORIAL_PATH.test(combined)
  const hasProjectText = PROJECT_TERMS.test(combined)
  const hasProjectPath = PROJECT_PATH.test(combined)
  const hasServiceText = SERVICE_TERMS.test(combined)
  const hasServicePath = SERVICE_PATH.test(combined)

  if (hasDates) addEvidence(evidence, 'date')
  if (hasEditorialText) addEvidence(evidence, 'editorial-text', headingText)
  if (hasEditorialPath) addEvidence(evidence, 'editorial-path')
  if (hasProjectText) addEvidence(evidence, 'project-text', headingText)
  if (hasProjectPath) addEvidence(evidence, 'project-path')
  if (hasServiceText) addEvidence(evidence, 'service-text', headingText)
  if (hasServicePath) addEvidence(evidence, 'service-path')

  if ((hasEditorialText || hasEditorialPath) && hasDates && !hasProjectText) {
    return {
      intent: 'editorial_feed',
      evidence,
      allowedTypes: ['content-feed', 'blog-list', 'blog-post', 'article-header', 'related-posts'],
      deniedTypes: []
    }
  }

  if (hasProjectText || (hasProjectPath && !hasDates)) {
    return {
      intent: 'project_grid',
      evidence,
      allowedTypes: ['card-grid', 'card-item', 'logo-cloud', 'testimonials', 'reviews'],
      deniedTypes: ['content-feed']
    }
  }

  if (hasServiceText || hasServicePath) {
    return {
      intent: 'service_grid',
      evidence,
      allowedTypes: ['card-grid', 'card-item', 'feature-grid', 'feature-list', 'feature-showcase'],
      deniedTypes: ['content-feed']
    }
  }

  if (NAV_TERMS.test(input.componentType ?? '') || NAV_TERMS.test(headingText)) {
    return { intent: 'navigation', evidence: ['navigation'], allowedTypes: ['navbar'], deniedTypes: [] }
  }
  if (FOOTER_TERMS.test(input.componentType ?? '') || FOOTER_TERMS.test(headingText)) {
    return { intent: 'footer', evidence: ['footer'], allowedTypes: ['footer'], deniedTypes: [] }
  }
  if (HERO_TERMS.test(input.componentType ?? '')) {
    return {
      intent: 'hero',
      evidence: ['hero'],
      allowedTypes: ['hero-simple', 'hero-banner', 'hero-carousel', 'hero-split', 'hero-with-image'],
      deniedTypes: []
    }
  }

  return {
    intent: 'unknown',
    evidence,
    allowedTypes: [],
    deniedTypes: []
  }
}

export function classifyRouteIntent(pageUrl: string | undefined): SectionTaxonomyResult {
  return classifySectionIntent({ content: { href: pageUrl ?? '' }, pageUrl })
}
