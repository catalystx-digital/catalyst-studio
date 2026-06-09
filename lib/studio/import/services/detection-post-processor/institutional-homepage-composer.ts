import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { SmartLink } from '@/lib/studio/components/cms/_core/value-objects'
import { CardGridDef } from '@/lib/studio/components/cms/content/card-grid/card-grid.def'
import { HeroWithImageDef } from '@/lib/studio/components/cms/heroes/hero-with-image/hero-with-image.def'
import { NavBarDef } from '@/lib/studio/components/cms/navigation/nav-bar/nav-bar.def'
import type { DetectedComponent, PageMetadata } from '@/lib/studio/import/detection/types'
import type { ImportDesignProfile, PresentationSkeletonSelection } from '@/lib/studio/import/types/design-profile.types'
import { isHomePath, normalizePath } from '@/lib/studio/import/utils/path-utils'
import { cloneComponent, cloneValue, isPlainObject, normalizeHref } from './utils'

const MIN_SKELETON_CONFIDENCE = 0.65
const MIN_DESIGN_PROFILE_CONFIDENCE = 0.35
const INSTITUTIONAL_PATTERN =
  /\b(?:hospital|health|clinic|medical|patient|education|school|university|college|government|council|public sector|community|research|department|service)\b/i
const HERO_TYPES = new Set<string>([
  ComponentType.HeroWithImage,
  ComponentType.HeroCarousel,
  ComponentType.HeroSimple,
  ComponentType.HeroBanner,
  ComponentType.HeroSplit,
])

type HomepageComposerStatus = 'applied' | 'skipped'

interface HomepageComposerAudit {
  composer: 'institutional-homepage'
  status: HomepageComposerStatus
  reason: string
  confidence: number
  selected?: {
    navIndex?: number
    heroIndex?: number
    quickLinksIndex?: number
    titleSource?: string
    imageSource?: string
    primaryColorSource?: string
  }
  preservedComponentCount: number
  removedDuplicateCount: number
  consumedFingerprints: string[]
  diagnostics: string[]
}

interface ComposerOptions {
  pageUrl?: string
  pageMetadata?: PageMetadata
  domSnapshot?: string | null
  designProfile?: ImportDesignProfile | null
  presentationSkeleton?: PresentationSkeletonSelection | null
}

export interface InstitutionalHomepageComposerResult {
  components: DetectedComponent[]
  applied: boolean
  audit: HomepageComposerAudit
}

interface SelectedHero {
  component: DetectedComponent
  index: number
  title: string
  titleSource: string
  content: Record<string, unknown>
  image?: unknown
  imageSource?: string
}

interface SelectedQuickLinks {
  component: DetectedComponent
  index?: number
  score: number
}

function attachAudit(component: DetectedComponent, audit: HomepageComposerAudit): DetectedComponent {
  return {
    ...component,
    metadata: {
      ...(component.metadata ?? {}),
      homepageComposer: audit,
    } as DetectedComponent['metadata'],
  }
}

function skipped(
  components: DetectedComponent[],
  reason: string,
  diagnostics: string[] = [],
): InstitutionalHomepageComposerResult {
  const audit: HomepageComposerAudit = {
    composer: 'institutional-homepage',
    status: 'skipped',
    reason,
    confidence: 0,
    preservedComponentCount: components.length,
    removedDuplicateCount: 0,
    consumedFingerprints: [],
    diagnostics,
  }
  return {
    components: components.length > 0 ? [attachAudit(components[0], audit), ...components.slice(1)] : components,
    applied: false,
    audit,
  }
}

function isUsableDesignProfile(profile: ImportDesignProfile | null | undefined): boolean {
  if (!profile || profile.confidence < MIN_DESIGN_PROFILE_CONFIDENCE) return false
  return !profile.diagnostics.some(diagnostic =>
    diagnostic.code === 'DESIGN_PROFILE_MISSING_PROBE' ||
    diagnostic.code === 'DESIGN_PROFILE_LOW_CONFIDENCE'
  )
}

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : undefined
}

function normalizeFingerprintText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function componentFingerprint(component: DetectedComponent): string {
  const content = isPlainObject(component.content) ? component.content : {}
  const pieces: string[] = [String(component.type)]

  for (const key of ['heading', 'title', 'subheading', 'body', 'description']) {
    const normalized = normalizeFingerprintText(content[key])
    if (normalized) pieces.push(normalized)
  }

  const link = normalizeHref(content.link ?? content.href)
  if (link) pieces.push(link)

  if (Array.isArray(content.cards)) {
    for (const card of content.cards.slice(0, 8)) {
      if (!isPlainObject(card)) continue
      const title = normalizeFingerprintText(card.title ?? card.label ?? card.heading)
      const href = normalizeHref(card.href ?? card.link)
      if (title || href) pieces.push(`${title}:${href ?? ''}`)
    }
  }

  return pieces.join('|')
}

function sourceCorpus(components: DetectedComponent[], metadata?: PageMetadata): string {
  const pieces: string[] = [
    metadata?.title,
    metadata?.description,
    metadata?.pageType,
    metadata?.primaryPurpose,
    metadata?.targetAudience,
    metadata?.visualStyle,
  ].filter((value): value is string => typeof value === 'string')

  for (const component of components) {
    try {
      pieces.push(JSON.stringify(component.content))
    } catch {
      // Detection content should be JSON-safe; ignore unusual non-serializable input.
    }
  }
  return pieces.join(' ')
}

function hasInstitutionalEvidence(components: DetectedComponent[], metadata?: PageMetadata): boolean {
  return INSTITUTIONAL_PATTERN.test(sourceCorpus(components, metadata))
}

function isHomepageCandidate(pageUrl: string | undefined, _metadata?: PageMetadata): boolean {
  const path = normalizePath(pageUrl)
  return (
    isHomePath(path) ||
    path === '/home' ||
    path === '/index'
  )
}

function smartLinkFrom(value: unknown, pageUrl?: string): SmartLink | undefined {
  const href = normalizeHref(value, pageUrl)
  if (!href) return undefined
  if (/^https?:\/\//i.test(href)) {
    if (pageUrl) {
      try {
        const sourceUrl = new URL(pageUrl)
        const targetUrl = new URL(href)
        if (sourceUrl.origin === targetUrl.origin) {
          return {
            type: 'internal',
            pageId: `imported:${targetUrl.pathname}`,
            path: targetUrl.pathname || '/',
          }
        }
      } catch {
        // Fall through to external link handling for malformed URL context.
      }
    }
    return { type: 'external', url: href }
  }
  if (href.startsWith('mailto:')) {
    return { type: 'email', href }
  }
  if (href.startsWith('tel:')) {
    return { type: 'phone', href }
  }
  if (href.startsWith('#')) {
    return { type: 'anchor', href }
  }
  return { type: 'internal', pageId: `imported:${href}`, path: href.startsWith('/') ? href : `/${href}` }
}

function hasRealHref(value: unknown, pageUrl?: string): boolean {
  return Boolean(smartLinkFrom(value, pageUrl))
}

function normalizeHeroCtaButtons(value: unknown, pageUrl?: string): Array<{ label: string; href: SmartLink; variant?: 'primary' | 'secondary' | 'outline' }> {
  const items = Array.isArray(value)
    ? value
    : isPlainObject(value)
      ? [value]
      : []

  return items
    .map((item) => {
      if (!isPlainObject(item)) return null
      const label = text(item.label ?? item.text ?? item.title ?? item.name)
      const href = smartLinkFrom(item.href ?? item.url ?? item.link ?? item.path, pageUrl)
      if (!label || !href) return null
      const variant = normalizeHeroCtaVariant(item.variant ?? item.style ?? item.buttonStyle)
      return {
        label,
        href,
        ...(variant ? { variant } : {}),
      }
    })
    .filter((item): item is { label: string; href: SmartLink; variant?: 'primary' | 'secondary' | 'outline' } => Boolean(item))
}

function normalizeHeroCtaVariant(value: unknown): 'primary' | 'secondary' | 'outline' | undefined {
  const variant = text(value)?.toLowerCase()
  if (variant === 'primary' || variant === 'secondary' || variant === 'outline') return variant
  if (variant === 'default' || variant === 'accent' || variant === 'filled' || variant === 'solid') return 'primary'
  if (variant === 'neutral') return 'secondary'
  if (variant === 'ghost' || variant === 'link') return 'outline'
  return undefined
}

function normalizeMenuItems(items: unknown, pageUrl?: string): unknown[] {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      if (!isPlainObject(item)) return null
      const label = text(item.label ?? item.text ?? item.title)
      const href = smartLinkFrom(item.href ?? item.url ?? item.link, pageUrl)
      if (!label || !href) return null
      return {
        label,
        href,
        ...(typeof item.description === 'string' ? { description: text(item.description) } : {}),
        ...(item.external === true ? { external: true } : {}),
      }
    })
    .filter(Boolean)
}

function selectNav(
  components: DetectedComponent[],
  options: { pageUrl?: string; pageMetadata?: PageMetadata; domSnapshot?: string | null } = {},
): { component: DetectedComponent; index?: number } | undefined {
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index]
    if (component.type !== ComponentType.NavBar) continue
    const content = isPlainObject(component.content) ? component.content : {}
    const menuItems = normalizeMenuItems(content.menuItems, options.pageUrl)
    const utilityNav = normalizeMenuItems(content.utilityNav, options.pageUrl)
    const ctaHref = isPlainObject(content.cta) ? smartLinkFrom(content.cta.href, options.pageUrl) : undefined
    if (menuItems.length === 0 && utilityNav.length === 0) continue

    return {
      index,
      component: {
        ...component,
        content: {
          ...content,
          menuItems,
          ...(utilityNav.length > 0 ? { utilityNav } : {}),
          layout: utilityNav.length > 0 ? 'multi-row' : content.layout,
          sticky: false,
          transparent: false,
          ...(content.search ? { search: content.search } : {}),
          ...(content.logo ? { logo: normalizeLogoValue(content.logo, options.pageUrl) } : {}),
          ...(content.cta && isPlainObject(content.cta) && text(content.cta.label) && ctaHref
            ? {
                cta: {
                  ...content.cta,
                  label: text(content.cta.label),
                  href: ctaHref,
                },
              }
            : {}),
        },
        metadata: { ...(component.metadata ?? {}), region: 'header' } as DetectedComponent['metadata'],
      },
    }
  }
  return recoverNavFromDom(options)
}

function recoverNavFromDom(
  options: { pageUrl?: string; pageMetadata?: PageMetadata; domSnapshot?: string | null },
): { component: DetectedComponent } | undefined {
  if (!options.domSnapshot) return undefined
  const candidates = extractNavCandidateHtmls(options.domSnapshot)

  let best: { html: string; anchors: Array<{ label: string; href: SmartLink }>; score: number } | undefined
  for (const candidate of candidates) {
    const anchors = extractAnchorItems(candidate.html, options.pageUrl)
    if (anchors.length < 2) continue
    if (countPrimaryNavItems(anchors) < 2) continue
    const score = scoreDomNavCandidate(candidate.source, candidate.html, anchors)
    if (!best || score > best.score) {
      best = { html: candidate.html, anchors, score }
    }
  }
  if (!best || best.score < 8 || !hasHeaderLikeEvidence(best.html)) return undefined

  const utilityNav = best.anchors.filter(item => isUtilityNavLabel(String(item.label))).slice(0, 8)
  const primary = best.anchors.filter(item => !isUtilityNavLabel(String(item.label))).slice(0, 8)
  const menuItems = primary.length > 0 ? primary : best.anchors.slice(0, 8)
  if (menuItems.length === 0) return undefined

  const donate = best.anchors.find(item => /donate/i.test(String(item.label)))
  const siteName = cleanDuplicatedTitle(text(options.pageMetadata?.title)) ?? text(options.pageMetadata?.title)
  const hasSearch = hasSearchControl(best.html)

  return {
    component: {
      component: ComponentType.NavBar,
      type: ComponentType.NavBar,
      confidence: 0.75,
      content: {
        ...(siteName ? { logo: { text: siteName, href: '/' } } : {}),
        menuItems,
        ...(utilityNav.length > 0 ? { utilityNav } : {}),
        ...(donate ? { cta: { label: donate.label, href: donate.href, variant: 'primary' } } : {}),
        layout: utilityNav.length > 0 ? 'multi-row' : 'single-row',
        sticky: false,
        transparent: false,
        ...(hasSearch ? { search: { enabled: true, placeholder: 'Search' } } : {}),
      },
      metadata: {
        region: 'header',
        source: 'institutional-homepage-dom-nav',
      },
    },
  }
}

function extractNavCandidateHtmls(domSnapshot: string): Array<{ source: string; html: string }> {
  const candidates: Array<{ source: string; html: string }> = []
  const add = (source: string, html: string | undefined) => {
    if (!html) return
    const trimmed = html.trim()
    if (trimmed.length < 50) return
    if (candidates.some(candidate => candidate.html === trimmed)) return
    candidates.push({ source, html: trimmed })
  }

  const headerMatch = /<header\b[\s\S]*?<\/header>/i.exec(domSnapshot)
  add('header-tag', headerMatch?.[0])

  const navPattern = /<nav\b[\s\S]*?<\/nav>/gi
  let navMatch: RegExpExecArray | null
  while ((navMatch = navPattern.exec(domSnapshot)) !== null) {
    add('nav-tag', navMatch[0])
  }

  const ulNavPattern = /<ul\b[^>]*(?:id|class)\s*=\s*(["'])[^"']*(?:nav|menu)[^"']*\1[^>]*>[\s\S]*?<\/ul>/gi
  let ulMatch: RegExpExecArray | null
  while ((ulMatch = ulNavPattern.exec(domSnapshot)) !== null) {
    add('nav-list', ulMatch[0])
  }

  for (const marker of ['site-header', 'brand-header', 'mini-nav', 'primary-nav', 'main-nav', 'sidenav', 'side-nav', 'footer']) {
    const index = domSnapshot.toLowerCase().indexOf(marker.toLowerCase())
    if (index >= 0) {
      const elementHtml = extractElementContainingMarker(domSnapshot, marker)
      add(`marker:${marker}`, elementHtml ?? domSnapshot.slice(Math.max(0, index - 500), Math.min(domSnapshot.length, index + 5000)))
    }
  }

  return candidates
}

function extractElementContainingMarker(domSnapshot: string, marker: string): string | undefined {
  const lower = domSnapshot.toLowerCase()
  const markerIndex = lower.indexOf(marker.toLowerCase())
  if (markerIndex < 0) return undefined
  const tagStart = domSnapshot.lastIndexOf('<', markerIndex)
  if (tagStart < 0) return undefined

  const opening = /^<([a-z][a-z0-9-]*)\b[^>]*>/i.exec(domSnapshot.slice(tagStart, Math.min(domSnapshot.length, tagStart + 500)))
  const tagName = opening?.[1]
  if (!tagName) return undefined

  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi')
  tagPattern.lastIndex = tagStart
  let depth = 0
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(domSnapshot)) !== null) {
    if (match[0].startsWith('</')) {
      depth -= 1
      if (depth === 0) {
        return domSnapshot.slice(tagStart, tagPattern.lastIndex)
      }
    } else if (!match[0].endsWith('/>')) {
      depth += 1
    }
  }

  return undefined
}

function scoreDomNavCandidate(
  source: string,
  html: string,
  anchors: Array<{ label: string; href: SmartLink }>,
): number {
  let score = Math.min(anchors.length, 10)
  if (/\b(?:header|primary-nav|main-nav|mini-nav|brand)\b/i.test(source)) score += 4
  if (/\b(?:header|primary-nav|main-nav|mini-nav|navbar|nav-justified)\b/i.test(html)) score += 3
  if (/\b(?:side|sidenav|side-nav|secondary|breadcrumb|footer)\b/i.test(source)) score -= 5
  if (/\b(?:breadcrumb|footer|secondary-nav|side-?nav|in this section)\b/i.test(html)) score -= 4
  if (/\bsearch\b/i.test(html)) score += 1

  for (const item of anchors) {
    const label = item.label.toLowerCase()
    if (/\b(?:patients?|families|health professionals?|departments?|services?|research|about|contact|donate|portal|careers?|news)\b/.test(label)) {
      score += 2
    }
    if (/\b(?:read more|learn more|find out more|share|print)\b/.test(label)) {
      score -= 2
    }
  }

  return score
}

function hasHeaderLikeEvidence(html: string): boolean {
  return /\b(?:header|primary-nav|main-nav|mini-nav|brand|navbar|nav-justified)\b/i.test(html)
}

function countPrimaryNavItems(anchors: Array<{ label: string; href: SmartLink }>): number {
  return anchors.filter(item => !isUtilityNavLabel(item.label)).length
}

function hasSearchControl(html: string): boolean {
  return (
    /<a\b[^>]*\bhref\s*=\s*(["'])[^"']*\/search\/?[^"']*\1/i.test(html) ||
    /<form\b[^>]*\baction\s*=\s*(["'])[^"']*search[^"']*\1/i.test(html) ||
    /<input\b[^>]*(?:\bname|\bid|\bplaceholder)\s*=\s*(["'])[^"']*search[^"']*\1/i.test(html)
  )
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractAnchorItems(headerHtml: string, pageUrl?: string): Array<{ label: string; href: SmartLink }> {
  const items: Array<{ label: string; href: SmartLink }> = []
  const seen = new Set<string>()
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = anchorPattern.exec(headerHtml)) !== null) {
    const attrs = match[1] ?? ''
    const body = match[2] ?? ''
    const hrefRaw = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2]
    const label =
      stripHtml(body) ||
      /\b(?:aria-label|title)\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2] ||
      /\b(?:alt|aria-label|title)\s*=\s*(["'])(.*?)\1/i.exec(body)?.[2]
    const href = smartLinkFrom(hrefRaw, pageUrl)
    const cleanLabel = text(label)
    if (!href || !cleanLabel || cleanLabel.length > 60) continue
    if (/^(skip|menu|search|home)\b/i.test(cleanLabel) || /\blogo\b/i.test(cleanLabel)) continue
    const key = `${cleanLabel.toLowerCase()}|${JSON.stringify(href)}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ label: cleanLabel, href })
  }
  return items
}

function isUtilityNavLabel(label: string): boolean {
  return /\b(?:donate|contact|careers?|shop|about|news|login|portal|search)\b/i.test(label)
}

function slugFromUrl(value: string, fallback: string): string {
  const base = (() => {
    try {
      const url = new URL(value)
      return url.pathname.split('/').filter(Boolean).pop() ?? fallback
    } catch {
      return value.split('/').filter(Boolean).pop() ?? fallback
    }
  })()
  const slug = base
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

function mediaReferenceFromUrl(value: string | undefined, pageUrl: string | undefined, fallback: string): Record<string, unknown> | undefined {
  const url = normalizeMediaUrl(value, pageUrl)
  if (!url) return undefined
  return {
    mediaId: `detected:${slugFromUrl(url, fallback)}`,
    mediaType: 'image',
    url,
  }
}

function normalizeMediaUrl(value: unknown, pageUrl: string | undefined): string | undefined {
  const href = normalizeHref(value, pageUrl)
  if (!href) return undefined
  try {
    return new URL(href, pageUrl || 'https://example.com').toString()
  } catch {
    return href
  }
}

function normalizeImageValue(value: unknown, pageUrl: string | undefined, fallback: string): Record<string, unknown> | undefined {
  if (!value) return undefined
  if (typeof value === 'string') {
    const src = mediaReferenceFromUrl(value, pageUrl, fallback)
    return src ? { src, originalUrl: src.url } : undefined
  }
  if (!isPlainObject(value)) return undefined

  const srcValue = isPlainObject(value.src) ? value.src : undefined
  const src = srcValue?.mediaId && srcValue.mediaType
    ? cloneValue(srcValue)
    : mediaReferenceFromUrl(
        typeof srcValue?.url === 'string' ? srcValue.url : typeof value.url === 'string' ? value.url : typeof value.originalUrl === 'string' ? value.originalUrl : undefined,
        pageUrl,
        fallback,
      )
  if (!src) return undefined

  return {
    src,
    ...(typeof value.alt === 'string' ? { alt: value.alt } : {}),
    ...(typeof value.width === 'number' ? { width: value.width } : {}),
    ...(typeof value.height === 'number' ? { height: value.height } : {}),
    ...(typeof value.originalUrl === 'string' ? { originalUrl: normalizeHref(value.originalUrl, pageUrl) ?? value.originalUrl } : { originalUrl: (src as { url?: string }).url }),
    ...(typeof value.objectFit === 'string' && ['cover', 'contain'].includes(value.objectFit) ? { objectFit: value.objectFit } : {}),
    ...(typeof value.backgroundPosition === 'string' && ['center', 'top', 'bottom', 'left', 'right'].includes(value.backgroundPosition)
      ? { backgroundPosition: value.backgroundPosition }
      : {}),
  }
}

function normalizeLogoValue(value: unknown, pageUrl: string | undefined): unknown {
  if (!isPlainObject(value)) return value
  const logo = cloneValue(value) as Record<string, unknown>
  if (logo.src) {
    const srcValue = isPlainObject(logo.src) ? logo.src : undefined
    const src = srcValue?.mediaId && srcValue.mediaType
      ? {
          ...cloneValue(srcValue),
          ...(typeof srcValue.url === 'string' ? { url: normalizeMediaUrl(srcValue.url, pageUrl) ?? srcValue.url } : {}),
        }
      : mediaReferenceFromUrl(
          typeof srcValue?.url === 'string' ? srcValue.url : typeof logo.originalUrl === 'string' ? logo.originalUrl : undefined,
          pageUrl,
          'logo',
        )
    if (src) {
      logo.src = src
      const normalizedOriginalUrl = normalizeMediaUrl(logo.originalUrl, pageUrl)
      if (normalizedOriginalUrl) {
        logo.originalUrl = normalizedOriginalUrl
      } else if (typeof (src as { url?: string }).url === 'string') {
        logo.originalUrl = (src as { url?: string }).url
      }
    }
  }
  return logo
}

function firstHeroSlide(content: Record<string, unknown>): Record<string, unknown> | undefined {
  const slides = content.slides
  if (!Array.isArray(slides)) return undefined
  for (const slide of slides) {
    if (!isPlainObject(slide)) continue
    const slideContent = isPlainObject(slide.content) ? slide.content : slide
    if (text(slideContent.heading ?? slideContent.title)) {
      return slideContent
    }
  }
  return undefined
}

function hasPreservableTopHeroCarousel(components: DetectedComponent[]): boolean {
  const firstHero = components.find(component => HERO_TYPES.has(String(component.type)))
  if (!firstHero || firstHero.type !== ComponentType.HeroCarousel) {
    return false
  }

  const content = isPlainObject(firstHero.content) ? firstHero.content : {}
  const slides = Array.isArray(content.slides) ? content.slides : []
  const meaningfulSlides = slides.filter((slide) => {
    if (!isPlainObject(slide)) return false
    const slideContent = isPlainObject(slide.content) ? slide.content : slide
    const heading = text(slideContent.heading ?? slideContent.title)
    const image = slideContent.image ?? slideContent.backgroundImage
    return Boolean(heading && image)
  })

  return meaningfulSlides.length >= 2
}

function institutionalTitle(metadata: PageMetadata | undefined, fallback: unknown): { title?: string; source?: string } {
  const metadataTitle = text(metadata?.title)
  const cleanMetadataTitle = cleanDuplicatedTitle(metadataTitle)
  if (cleanMetadataTitle && !/^home$/i.test(cleanMetadataTitle)) {
    const fallbackTitle = text(fallback)
    if (fallbackTitle && cleanMetadataTitle.length > 80) {
      return { title: fallbackTitle, source: 'hero.heading' }
    }
    return { title: cleanMetadataTitle, source: 'pageMetadata.title' }
  }
  const fallbackTitle = text(fallback)
  if (fallbackTitle) {
    return { title: fallbackTitle, source: 'hero.heading' }
  }
  return {}
}

function cleanDuplicatedTitle(value: string | undefined): string | undefined {
  if (!value) return undefined
  const separators = /\s+(?::|\|-)\s+/g
  const parts = value.split(separators).map(part => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const first = parts[0].toLowerCase()
    const duplicate = parts.find(part => part.toLowerCase() === first)
    if (duplicate) return parts[0]
  }
  return value
}

function selectHero(
  components: DetectedComponent[],
  metadata?: PageMetadata,
  pageUrl?: string,
): SelectedHero | undefined {
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index]
    if (!HERO_TYPES.has(String(component.type))) continue
    const content = isPlainObject(component.content) ? component.content : {}
    const slide = component.type === ComponentType.HeroCarousel ? firstHeroSlide(content) : undefined
    const heroContent = slide ?? content
    const { title, source } = institutionalTitle(metadata, heroContent.heading ?? heroContent.title)
    if (!title || !source) continue

    return {
      component,
      index,
      title,
      titleSource: source,
      content: heroContent,
      image: normalizeImageValue(heroContent.image ?? heroContent.backgroundImage, pageUrl, 'hero-image'),
      imageSource: heroContent.image ? `${component.type}.image` : heroContent.backgroundImage ? `${component.type}.backgroundImage` : undefined,
    }
  }
  return undefined
}

function cardHref(card: Record<string, unknown>, pageUrl?: string): string | undefined {
  return normalizeHref(card.href ?? card.link ?? card.url, pageUrl)
}

function selectQuickLinks(
  components: DetectedComponent[],
  consumedIndices: Set<number>,
  pageUrl?: string,
  domSnapshot?: string | null,
): SelectedQuickLinks | undefined {
  let best: SelectedQuickLinks | undefined
  for (let index = 0; index < components.length; index += 1) {
    if (consumedIndices.has(index)) continue
    const component = components[index]
    if (component.type !== ComponentType.CardGrid && component.type !== ComponentType.FeatureGrid) continue
    const content = isPlainObject(component.content) ? component.content : {}
    if (!Array.isArray(content.cards)) continue
    const cards = content.cards
      .map(card => isPlainObject(card) ? card : null)
      .filter((card): card is Record<string, unknown> => Boolean(card))
      .filter(card => text(card.title ?? card.label ?? card.heading) && cardHref(card, pageUrl))

    if (cards.length < 3) continue

    const score = scoreQuickLinkCandidate(content, cards)
    if (score < 3) continue

    const candidate: SelectedQuickLinks = {
      index,
      score,
      component: {
        ...component,
        component: ComponentType.CardGrid,
        type: ComponentType.CardGrid,
        content: {
          ...(text(content.heading) ? { heading: text(content.heading) } : {}),
          cards: cards.slice(0, 6).map((card) => {
            const href = cardHref(card, pageUrl)!
            return {
              title: text(card.title ?? card.label ?? card.heading)!,
              ...(text(card.description ?? card.body) ? { description: text(card.description ?? card.body) } : {}),
              href: smartLinkFrom(href, pageUrl),
              ...(typeof card.icon === 'string' ? { icon: card.icon } : {}),
            }
          }),
          columns: cards.length >= 4 ? 4 : 3,
          gap: 'medium',
          cardStyle: 'vertical',
          imagePosition: 'top',
        },
        metadata: { ...(component.metadata ?? {}), region: 'main' } as DetectedComponent['metadata'],
      },
    }
    if (!best || candidate.score > best.score) {
      best = candidate
    }
  }
  return best ?? recoverQuickLinksFromDom(domSnapshot, pageUrl)
}

function scoreQuickLinkCandidate(content: Record<string, unknown>, cards: Record<string, unknown>[]): number {
  let score = 0
  const heading = normalizeFingerprintText(content.heading)
  if (/\b(?:quick|guide|portal|patients?|families|services?|information|resources|access)\b/.test(heading)) {
    score += 3
  }

  for (const card of cards) {
    const title = normalizeFingerprintText(card.title ?? card.label ?? card.heading)
    if (/\b(?:guide|portal|info|information|guidelines?|patients?|families|services?|resources|practice|emergency|telehealth|translation|appointments?|clinics?|access)\b/.test(title)) {
      score += 2
    }
    if (/\b(?:news|update|story|media|event|announcement)\b/.test(title)) {
      score -= 2
    }
    if (isPlainObject(card.metadata) && (card.metadata.date || card.metadata.category)) {
      score -= 1
    }
  }

  return score
}

function recoverQuickLinksFromDom(domSnapshot: string | null | undefined, pageUrl?: string): SelectedQuickLinks | undefined {
  if (!domSnapshot) return undefined
  const cards = extractHomepageQuickLinkCards(domSnapshot, pageUrl)
  if (cards.length < 3) return undefined

  const score = scoreQuickLinkCandidate({}, cards)
  if (score < 6) return undefined

  return {
    score,
    component: {
      component: ComponentType.CardGrid,
      type: ComponentType.CardGrid,
      confidence: 0.74,
      content: {
        cards: cards.slice(0, 6).map(card => ({
          title: text(card.title)!,
          ...(text(card.description) ? { description: text(card.description) } : {}),
          href: smartLinkFrom(card.href, pageUrl),
        })),
        columns: cards.length >= 4 ? 4 : 3,
        gap: 'medium',
        cardStyle: 'vertical',
        imagePosition: 'top',
      },
      metadata: {
        region: 'main',
        source: 'institutional-homepage-dom-quick-links',
      } as DetectedComponent['metadata'],
    },
  }
}

function extractHomepageQuickLinkCards(domSnapshot: string, pageUrl?: string): Record<string, unknown>[] {
  const blockCards = extractHomepageQuickLinkCardsFromBlocks(domSnapshot, pageUrl)
  if (blockCards.length >= 3) return blockCards

  const cards: Record<string, unknown>[] = []
  const seen = new Set<string>()
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  const sourceDom = domSnapshot.replace(/<!--[\s\S]*?-->/g, ' ')
  let match: RegExpExecArray | null
  while ((match = anchorPattern.exec(sourceDom)) !== null) {
    const attrs = match[1] ?? ''
    const body = match[2] ?? ''
    const start = Math.max(0, match.index - 240)
    const end = Math.min(sourceDom.length, anchorPattern.lastIndex + 1400)
    const context = sourceDom.slice(start, end)
    const afterAnchor = sourceDom.slice(anchorPattern.lastIndex, end)
    if (!isHomepageQuickLinkContext(context, attrs)) continue
    if (/\bMain\s+Feature\s+-/i.test(context) || /\bcarousel\b/i.test(context)) continue

    const hrefRaw = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2]
    const href = normalizeHref(hrefRaw, pageUrl)
    if (!href) continue

    const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(body)?.[1] ?? /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(afterAnchor)?.[1]
    const titleAttr = /\btitle\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2]
    const imageAlt = /\balt\s*=\s*(["'])(.*?)\1/i.exec(body)?.[2]
    const label = text(stripHtml(h2 ?? '')) ?? text(titleAttr) ?? text(stripHtml(body)) ?? text(imageAlt)
    if (!label || label.length > 80 || /^(click here|read more|find out more|learn more)$/i.test(label)) continue

    const paragraph = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(body)?.[1] ?? /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(afterAnchor)?.[1]
    const description = text(stripHtml(paragraph ?? ''))
    const key = `${label.toLowerCase()}|${href}`
    if (seen.has(key)) continue
    seen.add(key)
    cards.push({
      title: label,
      href,
      ...(description && description.toLowerCase() !== label.toLowerCase() ? { description } : {}),
    })
  }

  return cards
}

function extractHomepageQuickLinkCardsFromBlocks(domSnapshot: string, pageUrl?: string): Record<string, unknown>[] {
  const sourceDom = domSnapshot.replace(/<!--[\s\S]*?-->/g, ' ')
  const cards: Record<string, unknown>[] = []
  const seen = new Set<string>()
  const seenTitles = new Set<string>()
  const blockPattern = /<div\b[^>]*(?:class|id)\s*=\s*(["'])[^"']*(?:featured|quick|tile|home)[^"']*\1[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = blockPattern.exec(sourceDom)) !== null) {
    const block = extractElementFromStart(sourceDom, match.index)
    if (!block || /\b(?:site-header|brand-header|primary-nav|mini-nav|navbar|footer|social-icons|nav-justified|carousel)\b/i.test(block)) {
      continue
    }
    if (!/\b(?:InternetHomePage|homepage|featured|quicklink|quick-link)\b/i.test(block)) continue

    const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(block)
    const attrs = anchor?.[1] ?? ''
    const body = anchor?.[2] ?? ''
    const hrefRaw = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2]
    const href = normalizeHref(hrefRaw, pageUrl)
    if (!href) continue

    const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(block)?.[1]
    const titleAttr = /\btitle\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2]
    const imageAlt = /\balt\s*=\s*(["'])(.*?)\1/i.exec(body)?.[2]
    const label = text(stripHtml(h2 ?? '')) ?? text(titleAttr) ?? text(stripHtml(body)) ?? text(imageAlt)
    if (!label || label.length > 80 || /^(click here|read more|find out more|learn more)$/i.test(label)) continue

    const paragraph = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1]
    const description = text(stripHtml(paragraph ?? ''))
    const key = `${label.toLowerCase()}|${href}`
    const titleKey = label.toLowerCase()
    if (seen.has(key) || seenTitles.has(titleKey)) continue
    seen.add(key)
    seenTitles.add(titleKey)
    cards.push({
      title: label,
      href,
      ...(description && description.toLowerCase() !== label.toLowerCase() ? { description } : {}),
    })
  }

  return cards
}

function extractElementFromStart(domSnapshot: string, tagStart: number): string | undefined {
  const opening = /^<([a-z][a-z0-9-]*)\b[^>]*>/i.exec(domSnapshot.slice(tagStart, Math.min(domSnapshot.length, tagStart + 500)))
  const tagName = opening?.[1]
  if (!tagName) return undefined

  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi')
  tagPattern.lastIndex = tagStart
  let depth = 0
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(domSnapshot)) !== null) {
    if (match[0].startsWith('</')) {
      depth -= 1
      if (depth === 0) {
        return domSnapshot.slice(tagStart, tagPattern.lastIndex)
      }
    } else if (!match[0].endsWith('/>')) {
      depth += 1
    }
  }

  return undefined
}

function isHomepageQuickLinkContext(context: string, attrs: string): boolean {
  const source = `${context} ${attrs}`
  if (/\b(?:site-header|brand-header|primary-nav|mini-nav|navbar|footer|social-icons|nav-justified)\b/i.test(context)) {
    return false
  }
  return (
    /\b(?:quicklink|quick-link|featured|feature|resource|portal|patients?|families|telehealth|translation|emergency|guide|appointments?)\b/i.test(source) &&
    /\b(?:InternetHomePage|homepage|featured|quicklink|quick-link)\b/i.test(attrs)
  )
}

function makeHeroWithImage(hero: SelectedHero, pageUrl?: string): DetectedComponent {
  const content = hero.content
  const ctaButtons = normalizeHeroCtaButtons(content.ctaButtons, pageUrl)
  return {
    ...hero.component,
    component: ComponentType.HeroWithImage,
    type: ComponentType.HeroWithImage,
    content: {
      eyebrow: text(content.eyebrow),
      heading: hero.title,
      subheading: text(content.subheading),
      body: text(content.body ?? content.description),
      alignment: 'left',
      layout: 'image-left',
      ...(hero.image ? { image: cloneValue(hero.image) } : {}),
      ...(ctaButtons.length > 0 ? { ctaButtons } : {}),
    },
    metadata: { ...(hero.component.metadata ?? {}), region: 'hero' } as DetectedComponent['metadata'],
  }
}

function validateComposed(components: DetectedComponent[], pageUrl?: string): string[] {
  const diagnostics: string[] = []
  const nav = components[0]
  const hero = components[1]
  const quickLinks = components[2]
  if (nav?.type !== ComponentType.NavBar) diagnostics.push('first-component-not-navbar')
  if (hero?.type !== ComponentType.HeroWithImage) diagnostics.push('second-component-not-hero-with-image')
  if (quickLinks?.type !== ComponentType.CardGrid) diagnostics.push('third-component-not-card-grid')
  if (!text(hero?.content?.heading)) diagnostics.push('hero-heading-missing')
  if (!hero?.content?.image) diagnostics.push('hero-image-missing')

  const navItems = [
    ...(Array.isArray(nav?.content?.menuItems) ? nav.content.menuItems : []),
    ...(Array.isArray(nav?.content?.utilityNav) ? nav.content.utilityNav : []),
  ]
  if (navItems.some(item => !isPlainObject(item) || !text(item.label) || !hasRealHref(item.href, pageUrl))) {
    diagnostics.push('navbar-has-invalid-link')
  }
  const cards = Array.isArray(quickLinks?.content?.cards) ? quickLinks.content.cards : []
  if (cards.length < 3 || cards.some(card => !isPlainObject(card) || !text(card.title) || !hasRealHref(card.href, pageUrl))) {
    diagnostics.push('quick-links-invalid')
  }

  const navParse = NavBarDef.schema.safeParse(nav?.content)
  if (!navParse.success) {
    diagnostics.push(`navbar-schema-invalid:${navParse.error.issues.map(issue => issue.path.join('.') || 'root').join('|')}`)
  }
  const heroParse = HeroWithImageDef.schema.safeParse(hero?.content)
  if (!heroParse.success) {
    diagnostics.push(`hero-with-image-schema-invalid:${heroParse.error.issues.map(issue => issue.path.join('.') || 'root').join('|')}`)
  }
  const quickLinksParse = CardGridDef.schema.safeParse(quickLinks?.content)
  if (!quickLinksParse.success) {
    diagnostics.push(`card-grid-schema-invalid:${quickLinksParse.error.issues.map(issue => issue.path.join('.') || 'root').join('|')}`)
  }
  return diagnostics
}

export function composeInstitutionalHomepageIfEligible(
  components: DetectedComponent[] | undefined,
  options: ComposerOptions = {},
): InstitutionalHomepageComposerResult {
  const baseComponents = Array.isArray(components) ? components : []
  const pageUrl = options.pageUrl
  const skeleton = options.presentationSkeleton

  if (!isHomepageCandidate(pageUrl, options.pageMetadata)) {
    return skipped(baseComponents, 'non-homepage')
  }
  if (skeleton?.key !== 'institutional-home' || (skeleton.confidence ?? 0) < MIN_SKELETON_CONFIDENCE) {
    return skipped(baseComponents, 'institutional-skeleton-not-confident')
  }
  if (!isUsableDesignProfile(options.designProfile)) {
    return skipped(baseComponents, 'design-profile-not-usable')
  }
  if (!hasInstitutionalEvidence(baseComponents, options.pageMetadata)) {
    return skipped(baseComponents, 'institutional-evidence-missing')
  }
  if (hasPreservableTopHeroCarousel(baseComponents)) {
    return skipped(baseComponents, 'preserve-source-hero-carousel')
  }

  const cloned = baseComponents.map(component => cloneComponent(component))
  const nav = selectNav(cloned, {
    pageUrl,
    pageMetadata: options.pageMetadata,
    domSnapshot: options.domSnapshot,
  })
  if (!nav) {
    return skipped(cloned, 'source-navbar-missing')
  }

  const hero = selectHero(cloned, options.pageMetadata, pageUrl)
  if (!hero) {
    return skipped(cloned, 'source-hero-missing')
  }
  if (!hero.image) {
    return skipped(cloned, 'source-hero-image-missing')
  }

  const consumedIndices = new Set([hero.index])
  if (typeof nav.index === 'number') {
    consumedIndices.add(nav.index)
  }
  const quickLinks = selectQuickLinks(cloned, consumedIndices, pageUrl, options.domSnapshot)
  if (!quickLinks) {
    return skipped(cloned, 'source-quick-links-missing')
  }
  if (typeof quickLinks.index === 'number') {
    consumedIndices.add(quickLinks.index)
  }

  const navComponent = nav.component
  const heroComponent = makeHeroWithImage(hero, pageUrl)
  const quickLinkComponent = quickLinks.component
  const consumedFingerprints = [navComponent, hero.component, quickLinkComponent].map(componentFingerprint)
  const consumedFingerprintSet = new Set(consumedFingerprints)
  const remainder = cloned.filter((component, index) => {
    if (consumedIndices.has(index)) return false
    if (HERO_TYPES.has(String(component.type))) return false
    return !consumedFingerprintSet.has(componentFingerprint(component))
  })
  const composed = [navComponent, heroComponent, quickLinkComponent, ...remainder]
  const validationDiagnostics = validateComposed(composed, pageUrl)
  if (validationDiagnostics.length > 0) {
    throw new Error(
      `[InstitutionalHomepageComposer] Invalid composed homepage pageUrl=${pageUrl ?? 'unknown'} diagnostics=${validationDiagnostics.join(',')}`
    )
  }

  const audit: HomepageComposerAudit = {
    composer: 'institutional-homepage',
    status: 'applied',
    reason: 'institutional homepage evidence satisfied',
    confidence: Math.min(1, ((skeleton.confidence ?? 0) + (options.designProfile?.confidence ?? 0)) / 2),
    selected: {
      navIndex: nav.index,
      heroIndex: hero.index,
      quickLinksIndex: quickLinks.index,
      titleSource: hero.titleSource,
      ...(hero.imageSource ? { imageSource: hero.imageSource } : {}),
      ...(options.designProfile?.palette.primary?.source ? { primaryColorSource: options.designProfile.palette.primary.source } : {}),
    },
    preservedComponentCount: remainder.length,
    removedDuplicateCount: Math.max(0, cloned.length - composed.length),
    consumedFingerprints,
    diagnostics: [],
  }

  return {
    components: [attachAudit(composed[0], audit), ...composed.slice(1)],
    applied: true,
    audit,
  }
}
