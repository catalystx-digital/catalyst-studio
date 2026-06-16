/**
 * Navigation Processor
 *
 * Handles navigation component processing including:
 * - Multi-row navigation splitting (utility nav vs primary nav) - DELEGATED TO ProcessingEngine
 * - Section sidemenu detection and conversion
 *
 * @module navigation-processor
 */

import { canonicalizeComponentType } from '../page-builder/component-helpers'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { SmartLink } from '@/lib/studio/components/cms/_core/value-objects'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { SIDEMENU_LABEL_INDICATORS, type MenuItemLike } from './navigation-patterns'
import { normalizeString, isPlainObject, normalizeHref } from './utils'
import { executeMultiRowDetection } from './processing-engine'
import { NavBarDef } from '@/lib/studio/components/cms/navigation/nav-bar/nav-bar.def'

/**
 * Checks if a navbar component is actually a section-specific sidemenu
 * that was misclassified. Returns true if it looks like a sidemenu.
 */
export function looksLikeSectionSidemenu(menuItems: MenuItemLike[], pageUrl?: string): boolean {
  if (menuItems.length === 0) {
    return false
  }

  // Check if hrefs all share a deep common prefix (e.g., /about/, /departments/cardiology/)
  const hrefs = menuItems
    .map(item => normalizeString(item.href ?? item.url))
    .filter((href): href is string => Boolean(href))

  if (hrefs.length < 3) {
    return false
  }

  // Find common prefix
  const pathParts = hrefs.map(href => {
    try {
      const url = new URL(href, 'https://example.com')
      return url.pathname.toLowerCase().split('/').filter(Boolean)
    } catch {
      return href.toLowerCase().split('/').filter(Boolean)
    }
  })

  // Check if all paths share at least 2-level deep common prefix
  if (pathParts.length > 0 && pathParts[0].length >= 2) {
    const firstTwo = pathParts[0].slice(0, 2).join('/')
    const allSharePrefix = pathParts.every(parts =>
      parts.length >= 2 && parts.slice(0, 2).join('/') === firstTwo
    )

    if (allSharePrefix) {
      // All items are under a deep path like /cah/xxx - likely a sidemenu
      return true
    }
  }

  // Check for sidemenu-like labels
  const labels = menuItems
    .map(item => normalizeString(item.label ?? item.text)?.toLowerCase())
    .filter((label): label is string => Boolean(label))

  const sidemenuLabelCount = labels.filter(label =>
    SIDEMENU_LABEL_INDICATORS.some(indicator => label.includes(indicator))
  ).length

  // If more than 30% of labels are sidemenu indicators, it's probably a sidemenu
  if (sidemenuLabelCount > 0 && sidemenuLabelCount / labels.length >= 0.3) {
    return true
  }

  // Check if page URL itself is deep (indicates we're on a section page)
  if (pageUrl) {
    try {
      const url = new URL(pageUrl)
      const pathSegments = url.pathname.split('/').filter(Boolean)
      // If page is 2+ levels deep and navbar hrefs match that path, likely sidemenu
      if (pathSegments.length >= 2) {
        const pagePrefix = `/${pathSegments.slice(0, 2).join('/')}`
        const matchingHrefs = hrefs.filter(href => href.toLowerCase().startsWith(pagePrefix.toLowerCase()))
        if (matchingHrefs.length / hrefs.length >= 0.6) {
          return true
        }
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  return false
}

/**
 * Normalizes multi-row navigation structures in navbar components.
 *
 * Delegates multi-row detection to ProcessingEngine using declarative rules from NavBarDef.
 * Handles sidemenu detection locally as it's navbar-specific logic.
 *
 * @param components - Array of detected components to process
 * @param pageUrl - Optional page URL for sidemenu detection context
 */
export function normalizeMultiRowNavigation(components: DetectedComponent[], pageUrl?: string): void {
  // First pass: Handle sidemenu detection (navbar-specific logic)
  for (const component of components) {
    const canonical = canonicalizeComponentType(String(component.type))
    if (canonical !== 'navbar') {
      continue
    }

    if (!isPlainObject(component.content)) {
      continue
    }

    const content = component.content as Record<string, any>
    const menuItems = content.menuItems
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      continue
    }

    // Check if this navbar is actually a misclassified section sidemenu
    if (looksLikeSectionSidemenu(menuItems, pageUrl)) {
      // Convert to sidebar-nav component instead
      component.type = ComponentType.SidebarNav as DetectedComponent['type']
      component.component = ComponentType.SidebarNav
      const existingMeta = (component.metadata ?? {}) as Record<string, unknown>
      component.metadata = {
        ...existingMeta,
        convertedFrom: 'navbar',
        conversionReason: 'detected-as-section-sidemenu',
        region: 'sidebar'
      } as unknown as typeof component.metadata
      // Transform content structure for sidebar-nav
      content.items = menuItems.map((item: MenuItemLike) => ({
        label: item.label ?? item.text,
        href: item.href ?? item.url ?? '#',
        children: Array.isArray(item.children) ? item.children.map((child: MenuItemLike) => ({
          label: child.label ?? child.text,
          href: child.href ?? child.url ?? '#'
        })) : undefined
      }))
      // Remove navbar-specific fields
      delete content.menuItems
      delete content.utilityNav
      delete content.logo
      delete content.cta
    }
  }

  // Second pass: Delegate multi-row detection to ProcessingEngine
  // Uses declarative rules from NavBarDef.processing.multiRowDetection
  if (NavBarDef.processing?.multiRowDetection) {
    executeMultiRowDetection(components, NavBarDef.processing.multiRowDetection, pageUrl)
  }
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
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
        // Fall through to external link handling.
      }
    }
    return { type: 'external', url: href }
  }
  if (href.startsWith('mailto:')) return { type: 'email', href }
  if (href.startsWith('tel:')) return { type: 'phone', href }
  if (href.startsWith('#')) return { type: 'anchor', href }
  return { type: 'internal', pageId: `imported:${href}`, path: href.startsWith('/') ? href : `/${href}` }
}

function hasRealMenuItem(value: unknown, pageUrl?: string): boolean {
  if (!isPlainObject(value)) return false
  const label = normalizeString(value.label ?? value.text ?? value.title)
  return Boolean(label && smartLinkFrom(value.href ?? value.url ?? value.link ?? value.path, pageUrl))
}

function hasMeaningfulLogo(value: unknown): boolean {
  if (!isPlainObject(value)) return false
  return (
    hasNonEmptyString(value.text) ||
    hasNonEmptyString(value.alt) ||
    hasNonEmptyString(value.src) ||
    (isPlainObject(value.src) && (
      hasNonEmptyString(value.src.url) ||
      hasNonEmptyString(value.src.src) ||
      hasNonEmptyString(value.src.originalUrl)
    ))
  )
}

export function hasMeaningfulNavbarContent(content: unknown, pageUrl?: string): boolean {
  if (!isPlainObject(content)) return false
  const menuItems = Array.isArray(content.menuItems) ? content.menuItems : []
  const utilityNav = Array.isArray(content.utilityNav) ? content.utilityNav : []
  const search = isPlainObject(content.search) ? content.search : undefined
  const cta = isPlainObject(content.cta) ? content.cta : undefined

  return (
    menuItems.some(item => hasRealMenuItem(item, pageUrl)) ||
    utilityNav.some(item => hasRealMenuItem(item, pageUrl)) ||
    hasMeaningfulLogo(content.logo) ||
    Boolean(search?.enabled === true) ||
    Boolean(cta && normalizeString(cta.label) && smartLinkFrom(cta.href, pageUrl))
  )
}

function hasMeaningfulNavbarLinks(content: unknown, pageUrl?: string): boolean {
  if (!isPlainObject(content)) return false
  const menuItems = Array.isArray(content.menuItems) ? content.menuItems : []
  const utilityNav = Array.isArray(content.utilityNav) ? content.utilityNav : []
  return menuItems.some(item => hasRealMenuItem(item, pageUrl)) || utilityNav.some(item => hasRealMenuItem(item, pageUrl))
}

function navbarScore(component: DetectedComponent): number {
  const content = isPlainObject(component.content) ? component.content as Record<string, unknown> : {}
  const menuItems = arrayLength(content.menuItems)
  const utilityNav = arrayLength(content.utilityNav)
  const hasLogo = isPlainObject(content.logo) ? 1 : 0
  const hasSearch = isPlainObject(content.search) ? 1 : 0
  const hasCta = isPlainObject(content.cta) ? 1 : 0

  return menuItems * 4 + utilityNav * 2 + hasLogo + hasSearch + hasCta
}

function normalizedLabels(component: DetectedComponent, key: 'menuItems' | 'utilityNav'): Set<string> {
  const content = isPlainObject(component.content) ? component.content as Record<string, unknown> : {}
  const items = Array.isArray(content[key]) ? content[key] : []
  return new Set(items
    .filter(isPlainObject)
    .map(item => normalizeString(item.label ?? item.text)?.toLowerCase())
    .filter((label): label is string => Boolean(label)))
}

function isGlobalNavbar(component: DetectedComponent): boolean {
  return canonicalizeComponentType(String(component.type)) === 'navbar'
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  const smaller = a.size <= b.size ? a : b
  const larger = a.size <= b.size ? b : a
  if (smaller.size === 0) {
    return larger.size === 0 ? 1 : 0
  }

  let overlap = 0
  smaller.forEach(label => {
    if (larger.has(label)) {
      overlap += 1
    }
  })
  return overlap / smaller.size
}

function shouldCollapseAdjacentNavbars(previous: DetectedComponent, current: DetectedComponent): boolean {
  const previousPrimary = normalizedLabels(previous, 'menuItems')
  const currentPrimary = normalizedLabels(current, 'menuItems')
  const previousUtility = normalizedLabels(previous, 'utilityNav')
  const currentUtility = normalizedLabels(current, 'utilityNav')

  if (previousPrimary.size === 0 || currentPrimary.size === 0) {
    if (previousUtility.size === 0 || currentUtility.size === 0) {
      return false
    }
    return overlapRatio(previousUtility, currentUtility) >= 0.5
  }

  return overlapRatio(previousPrimary, currentPrimary) >= 0.75
}

/**
 * Drops duplicate adjacent global navbars produced when the source header is
 * split into overlapping desktop/mobile/header-logo regions.
 */
export function collapseDuplicateGlobalNavigation(components: DetectedComponent[]): DetectedComponent[] {
  const result: DetectedComponent[] = []
  let changed = false

  for (let index = 0; index < components.length; index += 1) {
    const component = components[index]
    const previous = result[result.length - 1]

    if (
      previous &&
      isGlobalNavbar(previous) &&
      isGlobalNavbar(component) &&
      shouldCollapseAdjacentNavbars(previous, component)
    ) {
      const previousScore = navbarScore(previous)
      const currentScore = navbarScore(component)
      if (currentScore > previousScore) {
        result[result.length - 1] = component
      }
      changed = true
      console.log('[NavigationProcessor] Dropped duplicate adjacent navbar:', {
        keptScore: Math.max(previousScore, currentScore),
        droppedScore: Math.min(previousScore, currentScore),
      })
      continue
    }

    result.push(component)
  }

  return changed ? result : components
}

interface SourceNavItem {
  label: string
  href: SmartLink
}

interface NavCandidate {
  source: string
  html: string
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

function extractNavCandidateHtmls(domSnapshot: string): NavCandidate[] {
  const candidates: NavCandidate[] = []
  const add = (source: string, html: string | undefined) => {
    const trimmed = html?.trim()
    if (!trimmed || trimmed.length < 50) return
    if (candidates.some(candidate => candidate.html === trimmed)) return
    candidates.push({ source, html: trimmed })
  }

  add('header-tag', /<header\b[\s\S]*?<\/header>/i.exec(domSnapshot)?.[0])

  const navPattern = /<nav\b[\s\S]*?<\/nav>/gi
  let navMatch: RegExpExecArray | null
  while ((navMatch = navPattern.exec(domSnapshot)) !== null) {
    add('nav-tag', navMatch[0])
  }

  const listPattern = /<ul\b[^>]*(?:id|class|role)\s*=\s*(["'])[^"']*(?:nav|menu|navigation)[^"']*\1[^>]*>[\s\S]*?<\/ul>/gi
  let listMatch: RegExpExecArray | null
  while ((listMatch = listPattern.exec(domSnapshot)) !== null) {
    add('nav-list', listMatch[0])
  }

  return candidates
}

function anchorLabel(attrs: string, body: string): string | undefined {
  const fromBody = normalizeString(stripHtml(body))
  if (fromBody && fromBody.length <= 80) return fromBody

  const attrLabel =
    /\b(?:aria-label|title|data-link-text)\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2] ??
    /\b(?:alt|aria-label|title)\s*=\s*(["'])(.*?)\1/i.exec(body)?.[2]
  const label = normalizeString(attrLabel)
  return label && label.length <= 80 ? label : undefined
}

function cleanLogoLabel(value: string | undefined): string | undefined {
  const label = normalizeString(value)
  if (!label) return undefined
  return label
    .replace(/\s*[-|:]\s*(?:home|homepage)\s*$/i, '')
    .replace(/\s+logo\s*$/i, '')
    .trim() || undefined
}

function isConsentVendorMarkup(value: string): boolean {
  return /\b(cookieyes|cookiebot|onetrust|trustarc|consent|privacy[-\s]?manager|powered\s*by\s*cky|poweredbtcky|cky-)\b/i.test(value)
}

function hasLogoToken(value: string): boolean {
  return /(?:^|[^a-z0-9])(?:logo|brand|lockup|wordmark)(?:[^a-z0-9]|$)/i.test(value)
}

function hasAnchorLogoEvidence(attrs: string): boolean {
  const evidenceAttrs = [
    /\bclass\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2],
    /\bid\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2],
    /\brole\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2],
    ...Array.from(attrs.matchAll(/\bdata-[\w-]+\s*=\s*(["'])(.*?)\1/gi)).map(match => match[2]),
  ].filter((value): value is string => Boolean(value))

  return evidenceAttrs.some(value => hasLogoToken(value))
}

function shouldSkipNavLabel(label: string): boolean {
  return /^(skip|menu|close|search)$/i.test(label) || /\blogo\b/i.test(label)
}

function isLogoAnchor(attrs: string, body: string): boolean {
  const combined = `${attrs} ${body}`
  if (isConsentVendorMarkup(combined)) return true
  return hasAnchorLogoEvidence(attrs)
}

function extractAnchorItems(html: string, pageUrl?: string, preferredOnly = false): SourceNavItem[] {
  const items: SourceNavItem[] = []
  const seen = new Set<string>()
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = anchorPattern.exec(html)) !== null) {
    const attrs = match[1] ?? ''
    const body = match[2] ?? ''
    if (isLogoAnchor(attrs, body)) continue
    const classOrRole = `${attrs} ${body}`
    const preferred = /\b(?:menu-title|nav-link|navigation-link|primary-nav|main-nav|navbar|global-nav|site-nav)\b/i.test(classOrRole)
    if (preferredOnly && !preferred) continue

    const label = anchorLabel(attrs, body)
    const hrefRaw = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2]
    const href = smartLinkFrom(hrefRaw, pageUrl)
    if (!label || !href || shouldSkipNavLabel(label)) continue

    const key = `${label.toLowerCase()}|${JSON.stringify(href)}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ label, href })
  }

  return items
}

function isUtilityNavLabel(label: string): boolean {
  return /\b(?:donate|contact|careers?|shop|about|news|login|portal|search|account|support)\b/i.test(label)
}

function scoreDomNavCandidate(source: string, html: string, anchors: SourceNavItem[]): number {
  let score = Math.min(anchors.length, 10)
  if (/\b(?:header|nav-tag|nav-list|primary-nav|main-nav|brand|navbar|navigation)\b/i.test(source)) score += 4
  if (/\b(?:header|primary-nav|main-nav|navbar|navigation|site-nav|global-nav)\b/i.test(html)) score += 3
  if (/\b(?:side|sidenav|side-nav|secondary|breadcrumb|footer)\b/i.test(source)) score -= 5
  if (/\b(?:breadcrumb|footer|secondary-nav|side-?nav|in this section)\b/i.test(html)) score -= 4
  if (/\bsearch\b/i.test(html)) score += 1
  return score
}

function normalizeMediaUrl(value: unknown, pageUrl?: string): string | undefined {
  const href = normalizeHref(value, pageUrl)
  if (!href) return undefined
  try {
    return new URL(href, pageUrl || 'https://example.com').toString()
  } catch {
    return href
  }
}

function slugFromUrl(value: string): string {
  try {
    const url = new URL(value)
    return url.pathname.split('/').filter(Boolean).pop() ?? 'nav-logo'
  } catch {
    return value.split('/').filter(Boolean).pop() ?? 'nav-logo'
  }
}

function makeLogoFromImageAttrs(
  imgAttrs: string,
  linkAttrs: string,
  pageUrl?: string,
): Record<string, unknown> | undefined {
  if (!imgAttrs) return undefined

  const src = normalizeMediaUrl(/\bsrc\s*=\s*(["'])(.*?)\1/i.exec(imgAttrs)?.[2], pageUrl)
  const alt = normalizeString(/\balt\s*=\s*(["'])(.*?)\1/i.exec(imgAttrs)?.[2])
  const href = normalizeHref(/\bhref\s*=\s*(["'])(.*?)\1/i.exec(linkAttrs)?.[2], pageUrl)
  const width = Number.parseInt(/\bwidth\s*=\s*(["']?)(\d+)\1/i.exec(imgAttrs)?.[2] ?? '', 10)
  const height = Number.parseInt(/\bheight\s*=\s*(["']?)(\d+)\1/i.exec(imgAttrs)?.[2] ?? '', 10)

  if (src) {
    return {
      ...(alt ? { alt } : {}),
      ...(href ? { href } : {}),
      ...(Number.isFinite(width) ? { width } : {}),
      ...(Number.isFinite(height) ? { height } : {}),
      src: {
        mediaId: `detected:${slugFromUrl(src).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
        mediaType: 'image',
        url: src,
      },
      originalUrl: src,
    }
  }

  return alt ? { text: alt, ...(href ? { href } : {}) } : undefined
}

function extractLogoFromNavHtml(html: string, pageUrl?: string): Record<string, unknown> | undefined {
  const linkedImagePattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let linkedMatch: RegExpExecArray | null
  while ((linkedMatch = linkedImagePattern.exec(html)) !== null) {
    const linkAttrs = linkedMatch[1] ?? ''
    const linkBody = linkedMatch[2] ?? ''
    if (isConsentVendorMarkup(`${linkAttrs} ${linkBody}`)) continue
    const imgAttrs = /<img\b([^>]*)>/i.exec(linkBody)?.[1] ?? ''
    const hasLinkLogoEvidence = hasAnchorLogoEvidence(linkAttrs)
    if (imgAttrs) {
      const linkBodyWithoutImages = linkBody.replace(/<img\b[^>]*>/gi, ' ')
      const imgAttrsWithoutAlt = imgAttrs.replace(/\balt\s*=\s*(["']).*?\1/gi, ' ')
      const hasLogoEvidence = hasLinkLogoEvidence || hasLogoToken(`${imgAttrsWithoutAlt} ${linkBodyWithoutImages}`)
      if (!hasLogoEvidence) continue
      const logo = makeLogoFromImageAttrs(imgAttrs, hasLinkLogoEvidence ? linkAttrs : '', pageUrl)
      if (logo) return logo
      continue
    }

    if (!hasLinkLogoEvidence) continue
    const label =
      cleanLogoLabel(/\b(?:aria-label|title)\s*=\s*(["'])(.*?)\1/i.exec(linkAttrs)?.[2]) ??
      cleanLogoLabel(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(linkBody)?.[1]) ??
      cleanLogoLabel(stripHtml(linkBody))
    const href = normalizeHref(/\bhref\s*=\s*(["'])(.*?)\1/i.exec(linkAttrs)?.[2], pageUrl)
    if (label) return { text: label, alt: label, ...(href ? { href } : {}) }
  }

  const imagePattern = /<img\b([^>]*)>/gi
  let imageMatch: RegExpExecArray | null
  while ((imageMatch = imagePattern.exec(html)) !== null) {
    const imgAttrs = imageMatch[1] ?? ''
    if (isConsentVendorMarkup(imgAttrs)) continue
    const imgAttrsWithoutAlt = imgAttrs.replace(/\balt\s*=\s*(["']).*?\1/gi, ' ')
    const hasLogoEvidence = hasLogoToken(imgAttrsWithoutAlt)
    if (!hasLogoEvidence) continue
    const logo = makeLogoFromImageAttrs(imgAttrs, '', pageUrl)
    if (logo) return logo
  }

  return undefined
}

function extractExplicitTextLogoFromDom(html: string | null | undefined, pageUrl?: string): Record<string, unknown> | undefined {
  if (!html) return undefined
  const linkedPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = linkedPattern.exec(html)) !== null) {
    const attrs = match[1] ?? ''
    if (!hasAnchorLogoEvidence(attrs) || isConsentVendorMarkup(attrs)) continue
    const body = match[2] ?? ''
    const label =
      cleanLogoLabel(/\b(?:aria-label|title)\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2]) ??
      cleanLogoLabel(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1]) ??
      cleanLogoLabel(stripHtml(body))
    const href = normalizeHref(/\bhref\s*=\s*(["'])(.*?)\1/i.exec(attrs)?.[2], pageUrl)
    if (label) {
      return {
        text: label,
        alt: label,
        ...(href ? { href } : {}),
      }
    }
  }
  return undefined
}

function logoImageUrlFrom(value: unknown): string | undefined {
  if (!isPlainObject(value)) return undefined
  const src = value.src
  if (typeof src === 'string' && src.trim()) return src.trim()
  if (isPlainObject(src)) {
    for (const key of ['url', 'src', 'originalUrl']) {
      const candidate = src[key]
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    }
  }
  for (const key of ['url', 'originalUrl']) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return undefined
}

function sourceBacksLogoUrl(domSnapshot: string | null | undefined, rawUrl: string | undefined, pageUrl?: string): boolean {
  if (!domSnapshot || !rawUrl) return true
  if (domSnapshot.includes(rawUrl)) return true

  try {
    const resolved = new URL(rawUrl, pageUrl || 'https://example.com')
    if (domSnapshot.includes(resolved.href)) return true
    if (resolved.pathname && domSnapshot.includes(resolved.pathname)) return true
  } catch {
    return true
  }

  return false
}

function equivalentLogoUrls(a: string | undefined, b: string | undefined, pageUrl?: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  try {
    const left = new URL(a, pageUrl || 'https://example.com')
    const right = new URL(b, pageUrl || 'https://example.com')
    return left.href === right.href || left.pathname === right.pathname
  } catch {
    return false
  }
}

function textLogoFrom(value: unknown, recoveredLogo?: unknown): Record<string, unknown> | undefined {
  const source = isPlainObject(recoveredLogo) ? recoveredLogo : isPlainObject(value) ? value : undefined
  if (!source) return undefined

  const label =
    normalizeString(source.text) ??
    normalizeString(source.alt) ??
    normalizeString(source.label) ??
    normalizeString(source.title) ??
    normalizeString(source.name)
  const href = normalizeHref(source.href)
  if (!label) return undefined
  return {
    text: label,
    alt: label,
    ...(href ? { href } : {}),
  }
}

function sanitizeNavbarLogoAgainstSource(
  component: DetectedComponent,
  options: { domSnapshot?: string | null; pageUrl?: string } = {},
): DetectedComponent {
  if (!options.domSnapshot) return component
  if (!isPlainObject(component.content)) return component
  const content = component.content as Record<string, unknown>
  const logo = content.logo
  const logoUrl = logoImageUrlFrom(logo)
  if (!logoUrl) {
    return component
  }

  const sourceLogo =
    extractExplicitTextLogoFromDom(options.domSnapshot, options.pageUrl) ??
    recoverNavbarFromDom(options.domSnapshot, options.pageUrl)?.content?.logo ??
    extractLogoFromNavHtml(options.domSnapshot ?? '', options.pageUrl)
  const sourceUrl = logoImageUrlFrom(sourceLogo)
  if (sourceLogo) {
    if (sourceUrl && equivalentLogoUrls(logoUrl, sourceUrl, options.pageUrl)) {
      return component
    }
  }

  const replacement = sourceUrl ? sourceLogo : textLogoFrom(logo, sourceLogo)

  if (!replacement) return component

  return {
    ...component,
    content: {
      ...content,
      logo: replacement,
    },
    metadata: {
      ...(component.metadata ?? {}),
      sanitizedUnbackedNavbarLogo: true,
      removedLogoUrl: logoUrl,
    } as DetectedComponent['metadata'],
  }
}

function extractFooterHtml(domSnapshot: string | null | undefined): string | undefined {
  if (!domSnapshot) return undefined
  return /<footer\b[\s\S]*?<\/footer>/i.exec(domSnapshot)?.[0]
}

function sanitizeFooterLogoAgainstSource(
  component: DetectedComponent,
  options: { domSnapshot?: string | null; pageUrl?: string } = {},
): DetectedComponent {
  if (canonicalizeComponentType(String(component.type)) !== 'footer') return component
  if (!isPlainObject(component.content)) return component
  const content = component.content as Record<string, unknown>
  const logo = content.logo
  const logoUrl = logoImageUrlFrom(logo)
  if (!logoUrl) return component

  const footerHtml = extractFooterHtml(options.domSnapshot)
  if (sourceBacksLogoUrl(footerHtml, logoUrl, options.pageUrl)) {
    return component
  }

  const replacement = textLogoFrom(logo)
  if (!replacement) return component

  return {
    ...component,
    content: {
      ...content,
      logo: replacement,
    },
    metadata: {
      ...(component.metadata ?? {}),
      sanitizedUnbackedFooterLogo: true,
      removedLogoUrl: logoUrl,
    } as DetectedComponent['metadata'],
  }
}

export function sanitizeGlobalLogosAgainstSource(
  components: DetectedComponent[],
  options: { domSnapshot?: string | null; pageUrl?: string } = {},
): DetectedComponent[] {
  let changed = false
  const sanitized = components.map(component => {
    const next = isGlobalNavbar(component)
      ? sanitizeNavbarLogoAgainstSource(component, options)
      : sanitizeFooterLogoAgainstSource(component, options)
    if (next !== component) changed = true
    return next
  })
  return changed ? sanitized : components
}

function recoverNavbarFromDom(domSnapshot: string | null | undefined, pageUrl?: string): DetectedComponent | undefined {
  if (!domSnapshot) return undefined

  let best: { candidate: NavCandidate; anchors: SourceNavItem[]; score: number } | undefined
  for (const candidate of extractNavCandidateHtmls(domSnapshot)) {
    const preferred = extractAnchorItems(candidate.html, pageUrl, true)
    const anchors = preferred.length >= 2 ? preferred : extractAnchorItems(candidate.html, pageUrl)
    if (anchors.length < 2) continue

    const score = scoreDomNavCandidate(candidate.source, candidate.html, anchors)
    if (!best || score > best.score) {
      best = { candidate, anchors, score }
    }
  }

  if (!best || best.score < 8) return undefined

  const utilityNav = best.anchors.filter(item => isUtilityNavLabel(item.label)).slice(0, 8)
  const primary = best.anchors.filter(item => !isUtilityNavLabel(item.label)).slice(0, 8)
  const menuItems = primary.length > 0 ? primary : best.anchors.slice(0, 8)
  if (menuItems.length + utilityNav.length < 2) return undefined

  const logo = extractLogoFromNavHtml(best.candidate.html, pageUrl) ?? extractLogoFromNavHtml(domSnapshot, pageUrl)
  const search = /\bsearch\b/i.test(best.candidate.html)
    ? { enabled: true, placeholder: 'Search' }
    : undefined

  return {
    component: ComponentType.NavBar,
    type: ComponentType.NavBar,
    confidence: 0.75,
    content: {
      ...(logo ? { logo } : {}),
      menuItems,
      ...(utilityNav.length > 0 ? { utilityNav } : {}),
      ...(search ? { search } : {}),
      layout: utilityNav.length > 0 ? 'multi-row' : 'single-row',
      sticky: false,
      transparent: false,
    },
    metadata: {
      region: 'header',
      source: 'dom-navigation-recovery',
    },
  }
}

export function recoverOrRemoveEmptyGlobalNavigation(
  components: DetectedComponent[],
  options: { domSnapshot?: string | null; pageUrl?: string } = {},
): DetectedComponent[] {
  const result: DetectedComponent[] = []
  let usedRecoveredNavbar = false
  let sawGlobalNavbar = false
  let changed = false

  for (const component of components) {
    if (!isGlobalNavbar(component)) {
      result.push(component)
      continue
    }

    sawGlobalNavbar = true

    if (hasMeaningfulNavbarContent(component.content, options.pageUrl)) {
      const sanitized = sanitizeNavbarLogoAgainstSource(component, options)
      if (sanitized !== component) {
        changed = true
      }
      if (!hasMeaningfulNavbarLinks(component.content, options.pageUrl) && !usedRecoveredNavbar) {
        const recovered = recoverNavbarFromDom(options.domSnapshot, options.pageUrl)
        if (recovered && hasMeaningfulNavbarLinks(recovered.content, options.pageUrl)) {
          result.push({
            ...recovered,
            metadata: {
              ...(component.metadata ?? {}),
              ...(recovered.metadata ?? {}),
              recoveredFromIncompleteNavbar: true,
            } as DetectedComponent['metadata'],
          })
          usedRecoveredNavbar = true
          changed = true
          console.log('[NavigationProcessor] Recovered linkless navbar from source DOM:', {
            menuItemCount: Array.isArray(recovered.content?.menuItems) ? recovered.content.menuItems.length : 0,
            utilityNavCount: Array.isArray(recovered.content?.utilityNav) ? recovered.content.utilityNav.length : 0,
          })
          continue
        }
      }
      result.push(sanitized)
      continue
    }

    if (!usedRecoveredNavbar) {
      const recovered = recoverNavbarFromDom(options.domSnapshot, options.pageUrl)
      if (recovered) {
        result.push({
          ...recovered,
          metadata: {
            ...(component.metadata ?? {}),
            ...(recovered.metadata ?? {}),
            recoveredFromEmptyNavbar: true,
          } as DetectedComponent['metadata'],
        })
        usedRecoveredNavbar = true
        changed = true
        console.log('[NavigationProcessor] Recovered empty navbar from source DOM:', {
          menuItemCount: Array.isArray(recovered.content?.menuItems) ? recovered.content.menuItems.length : 0,
          utilityNavCount: Array.isArray(recovered.content?.utilityNav) ? recovered.content.utilityNav.length : 0,
        })
        continue
      }
    }

    changed = true
    console.log('[NavigationProcessor] Dropped empty navbar artifact:', {
      droppedComponentType: component.type,
    })
  }

  if (!sawGlobalNavbar) {
    const recovered = recoverNavbarFromDom(options.domSnapshot, options.pageUrl)
    if (recovered) {
      changed = true
      result.unshift({
        ...recovered,
        metadata: {
          ...(recovered.metadata ?? {}),
          recoveredFromMissingNavbar: true,
        } as DetectedComponent['metadata'],
      })
      console.log('[NavigationProcessor] Recovered missing navbar from source DOM:', {
        menuItemCount: Array.isArray(recovered.content?.menuItems) ? recovered.content.menuItems.length : 0,
        utilityNavCount: Array.isArray(recovered.content?.utilityNav) ? recovered.content.utilityNav.length : 0,
      })
    }
  }

  return changed ? result : components
}
