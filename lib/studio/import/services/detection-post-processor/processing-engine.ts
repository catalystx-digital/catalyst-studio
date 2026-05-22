/**
 * Component Processing Engine
 *
 * Generic processing engine that executes declarative rules from ComponentDefinition.processing field.
 * Replaces hardcoded logic in specialized post-processors with rule-driven transformations.
 *
 * Design: Pure functional approach - each processor is a pure function that reads rules
 * from ComponentDefinition and applies transformations to DetectedComponent[].
 *
 * @module processing-engine
 */

import { canonicalizeComponentType } from '../page-builder/component-helpers'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type {
  MultiRowDetectionRules,
  BackgroundPromotionRules,
  DeduplicationRules,
  ContentFeedPromotionRules
} from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import type { ComponentDefinition } from '@/lib/studio/components/cms/_core/component-definition'
import { normalizeString, isPlainObject, escapeRegex, resolveAssetUrl } from './utils'
import type { MenuItemLike } from './navigation-patterns'

// ============================================================================
// Multi-Row Navigation Detection
// ============================================================================

interface MenuSplitResult {
  shouldSplit: boolean
  utilityItems: MenuItemLike[]
  primaryItems: MenuItemLike[]
  reason?: string
}

/**
 * Executes multi-row navigation detection based on declarative rules.
 *
 * Analyzes menuItems array and splits into utilityNav + menuItems when:
 * 1. Rules are enabled in ComponentDefinition
 * 2. Total items exceed minimum threshold (7)
 * 3. Mix of utility items (Login, About, Contact) and primary items (Services, Products)
 * 4. At least 2 utility AND 2 primary items detected
 *
 * @param components - Array of detected components to process
 * @param rules - Multi-row detection rules from ComponentDefinition
 * @param pageUrl - Optional page URL for sidemenu detection context
 *
 * @example
 * ```typescript
 * const rules = { enabled: true, utilityPatterns: ['login', 'signup', 'home'] }
 * executeMultiRowDetection(components, rules)
 * // Splits navbar menuItems: [Home, About, Login] → utilityNav
 * //                          [Products, Services, Contact] → menuItems
 * ```
 */
export function executeMultiRowDetection(
  components: DetectedComponent[],
  rules: MultiRowDetectionRules,
  pageUrl?: string
): void {
  if (!rules.enabled) {
    return
  }

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

    // Skip if already has utilityNav populated
    if (Array.isArray(content.utilityNav) && content.utilityNav.length > 0) {
      continue
    }

    // Analyze the menu items to detect multi-row pattern
    const analysis = analyzeMenuItemsForSplit(menuItems, rules)

    if (!analysis.shouldSplit) {
      continue
    }

    // Perform the split
    content.utilityNav = analysis.utilityItems
    content.menuItems = analysis.primaryItems
    content.layout = 'multi-row'

    // Update metadata
    const existingMeta = (component.metadata ?? {}) as Record<string, unknown>
    component.metadata = {
      ...existingMeta,
      navbarLayout: 'multi-row',
      utilityNavCount: analysis.utilityItems.length,
      primaryNavCount: analysis.primaryItems.length,
      splitReason: analysis.reason
    } as unknown as typeof component.metadata
  }
}

/**
 * Analyzes menu items to determine if they should be split into utility and primary nav.
 *
 * Split criteria:
 * 1. Total items > 6 (typical single-row nav has 4-6 items)
 * 2. Mix of utility-like items (patterns from rules) and category items
 * 3. At least 2 utility items AND 2 primary items detected
 */
function analyzeMenuItemsForSplit(
  menuItems: MenuItemLike[],
  rules: MultiRowDetectionRules
): MenuSplitResult {
  const noSplit: MenuSplitResult = { shouldSplit: false, utilityItems: [], primaryItems: [] }

  // Need enough items to warrant a split
  if (menuItems.length < 7) {
    return noSplit
  }

  const utilityPatterns = rules.utilityPatterns ?? []
  const utilityItems: MenuItemLike[] = []
  const primaryItems: MenuItemLike[] = []
  const unclassified: MenuItemLike[] = []

  for (const item of menuItems) {
    const label = normalizeString(item.label ?? item.text)
    if (!label) {
      unclassified.push(item)
      continue
    }

    const labelLower = label.toLowerCase()
    const isUtility = utilityPatterns.some(pattern =>
      labelLower.includes(pattern.toLowerCase())
    )

    if (isUtility) {
      utilityItems.push(item)
    } else {
      // Check href patterns for additional classification
      const href = normalizeString(item.href ?? item.url) ?? ''
      const hrefLower = href.toLowerCase()

      // External links or simple paths tend to be utility
      if (item.external === true || /^(https?:)?\/\/(shop|store|blog)\./i.test(href)) {
        utilityItems.push(item)
      } else if (/^\/(home|about|news|careers?|contact|shop|faq|help)(\/?$|\/)/i.test(hrefLower)) {
        utilityItems.push(item)
      } else if (item.children && Array.isArray(item.children) && item.children.length > 2) {
        // Items with many children are likely primary nav sections
        primaryItems.push(item)
      } else {
        unclassified.push(item)
      }
    }
  }

  // Need a meaningful split: at least 2 utility AND 2 primary
  if (utilityItems.length < 2 || primaryItems.length < 2) {
    return noSplit
  }

  // Check if the split makes sense structurally
  // Utility items should be roughly the first portion of the list
  const utilityPositions = menuItems
    .map((item, index) => utilityItems.includes(item) ? index : -1)
    .filter(index => index >= 0)
  const primaryPositions = menuItems
    .map((item, index) => primaryItems.includes(item) ? index : -1)
    .filter(index => index >= 0)

  // Calculate average positions
  const avgUtilityPos = utilityPositions.length > 0
    ? utilityPositions.reduce((a, b) => a + b, 0) / utilityPositions.length
    : 0
  const avgPrimaryPos = primaryPositions.length > 0
    ? primaryPositions.reduce((a, b) => a + b, 0) / primaryPositions.length
    : menuItems.length

  // Utility items should generally appear before primary items
  const positionDiff = avgPrimaryPos - avgUtilityPos
  if (positionDiff < 1) {
    // Primary items appear before utility - unusual, don't split
    return noSplit
  }

  // Distribute unclassified items based on position
  for (const item of unclassified) {
    const index = menuItems.indexOf(item)
    const splitPoint = (avgUtilityPos + avgPrimaryPos) / 2
    if (index <= splitPoint) {
      utilityItems.push(item)
    } else {
      primaryItems.push(item)
    }
  }

  // Sort items back into original order
  const sortByOriginalOrder = (a: MenuItemLike, b: MenuItemLike) => {
    return menuItems.indexOf(a) - menuItems.indexOf(b)
  }
  utilityItems.sort(sortByOriginalOrder)
  primaryItems.sort(sortByOriginalOrder)

  return {
    shouldSplit: true,
    utilityItems,
    primaryItems,
    reason: `detected ${utilityItems.length} utility items and ${primaryItems.length} primary items`
  }
}

// ============================================================================
// Background Image Promotion
// ============================================================================

interface BackgroundPromotionOptions {
  domSnapshot?: string | null
  pageUrl?: string
}

/**
 * Executes background image promotion based on declarative rules.
 *
 * Promotes hero-simple → hero-banner when:
 * 1. Rules are enabled in ComponentDefinition
 * 2. Component doesn't already have a background image
 * 3. Background image found in DOM snapshot (via domSelectors rules)
 *
 * @param components - Array of detected components to process
 * @param rules - Background promotion rules from ComponentDefinition
 * @param options - Processing options (domSnapshot, pageUrl)
 *
 * @example
 * ```typescript
 * const rules = { enabled: true, domSelectors: ['banner-wrap', 'hero-bg'] }
 * executeBackgroundPromotion(components, rules, { domSnapshot: html, pageUrl })
 * // Extracts background from DOM and upgrades hero-simple → hero-banner
 * ```
 */
export function executeBackgroundPromotion(
  components: DetectedComponent[],
  rules: BackgroundPromotionRules,
  options: BackgroundPromotionOptions
): void {
  if (!rules.enabled || !options.domSnapshot) {
    return
  }

  const heroIndex = components.findIndex(component =>
    canonicalizeComponentType(String(component.type)) === 'hero-simple'
  )
  if (heroIndex === -1) {
    return
  }

  const hero = components[heroIndex]
  if (!isPlainObject(hero.content)) {
    return
  }

  const content = hero.content as Record<string, any>
  const hasBackground =
    Boolean(normalizeString(content.backgroundImage)) ||
    Boolean(normalizeString(content.background?.image)) ||
    Boolean(normalizeString(content.background?.src))

  if (hasBackground) {
    return
  }

  // Extract background using rules-based selectors
  const background = extractHeroBackgroundWithRules(
    options.domSnapshot,
    rules.domSelectors ?? [],
    options.pageUrl
  )
  if (!background) {
    return
  }

  const targetImage = background.desktop ?? background.mobile
  if (!targetImage) {
    return
  }

  const resolvedImage = resolveAssetUrl(targetImage, options.pageUrl)
  content.backgroundImage = resolvedImage
  if (background.mobile) {
    content.metadata = {
      ...(isPlainObject(content.metadata) ? content.metadata : {}),
      mobileBackgroundImage: resolveAssetUrl(background.mobile, options.pageUrl)
    }
  }

  hero.content = content
  hero.component = 'hero-banner'
  hero.type = 'hero-banner' as DetectedComponent['type']
  hero.metadata = {
    ...(hero.metadata ?? {}),
    variant: 'banner',
    region: hero.metadata?.region ?? 'hero'
  }
}

/**
 * Extracts hero background images from HTML using declarative selector rules.
 */
function extractHeroBackgroundWithRules(
  html: string,
  selectors: string[],
  pageUrl?: string
): { desktop?: string; mobile?: string } | null {
  let desktop: string | undefined
  let mobile: string | undefined

  // Try each selector from rules
  for (const selector of selectors) {
    const found = findBackgroundForSelector(html, selector)
    if (found) {
      // Heuristic: selectors with 'mobile' are mobile backgrounds
      if (selector.toLowerCase().includes('mobile')) {
        mobile = found
      } else {
        desktop = found
      }
    }
  }

  // Fallback: search for first background-image if no selectors matched
  if (!desktop && !mobile) {
    desktop = findFirstBackgroundImage(html)
  }

  if (!desktop && !mobile) {
    return null
  }

  return {
    desktop: desktop ? resolveAssetUrl(desktop, pageUrl) : undefined,
    mobile: mobile ? resolveAssetUrl(mobile, pageUrl) : undefined
  }
}

/**
 * Finds background image for a specific element ID.
 */
function findBackgroundForSelector(html: string, id: string): string | undefined {
  const tagRegex = /<[^>]*>/gi
  let tagMatch: RegExpExecArray | null
  while ((tagMatch = tagRegex.exec(html)) !== null) {
    const tag = tagMatch[0]
    const idMatch = /\bid\s*=\s*(["'])(.*?)\1/i.exec(tag)
    if (!idMatch || idMatch[2] !== id) {
      continue
    }
    const styleMatch = /\bstyle\s*=\s*(["'])(.*?)\1/i.exec(tag)
    const url = extractBackgroundUrl(styleMatch?.[2])
    if (url) {
      return url
    }
  }
  return undefined
}

/**
 * Finds the first background-image in HTML.
 */
function findFirstBackgroundImage(html: string): string | undefined {
  const regex = /\bstyle\s*=\s*(["'])(.*?)\1/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null) {
    const style = match[2]
    if (!/background-image\s*:/i.test(style)) {
      continue
    }
    const url = extractBackgroundUrl(style)
    if (url) {
      return url
    }
  }
  return undefined
}

/**
 * Extracts URL from background-image CSS property.
 */
function extractBackgroundUrl(style: string | undefined): string | undefined {
  if (!style) {
    return undefined
  }
  const match = /background-image\s*:\s*url\((['"]?)([^'")]+)\1\)/i.exec(style)
  if (!match) {
    return undefined
  }
  return match[2].trim()
}

// ============================================================================
// CTA Deduplication
// ============================================================================

/**
 * Executes CTA deduplication based on declarative rules.
 *
 * Removes CTA components when:
 * 1. Rules are enabled in ComponentDefinition
 * 2. CTA content is duplicated in adjacent component (specified in deduplicateWith)
 * 3. Context rules match (e.g., 'adjacent' means check prev/next components)
 *
 * @param components - Array of detected components to process
 * @param rules - Deduplication rules from ComponentDefinition
 *
 * @example
 * ```typescript
 * const rules = {
 *   enabled: true,
 *   deduplicateWith: [ComponentType.TwoColumn, ComponentType.Timeline],
 *   context: 'adjacent'
 * }
 * executeDeduplication(components, rules)
 * // Removes cta-simple if duplicate found in adjacent two-column/timeline
 * ```
 */
export function executeDeduplication(
  components: DetectedComponent[],
  rules: DeduplicationRules
): void {
  if (!rules.enabled) {
    return
  }

  const deduplicateWith = new Set(rules.deduplicateWith ?? [])
  const context = rules.context ?? 'adjacent'

  for (let index = 0; index < components.length; index += 1) {
    const component = components[index]
    const canonical = canonicalizeComponentType(String(component.type))
    if (canonical !== 'cta-simple') {
      continue
    }

    const primaryButton = getPrimaryButton(component.content)
    if (!primaryButton) {
      continue
    }

    if (context === 'adjacent') {
      const previous = index > 0 ? components[index - 1] : undefined
      const next = index + 1 < components.length ? components[index + 1] : undefined

      const prevMatch = previous && deduplicateWith.has(canonicalizeComponentType(String(previous.type)) as ComponentType)
      const nextMatch = next && deduplicateWith.has(canonicalizeComponentType(String(next.type)) as ComponentType)

      const container = prevMatch ? previous : nextMatch ? next : undefined

      if (!container || !isInlineDuplicate(container.content, primaryButton)) {
        continue
      }

      components.splice(index, 1)
      index -= 1
    }
  }
}

/**
 * Extracts the primary button from CTA content.
 */
function getPrimaryButton(content: unknown): { text: string; url: string } | null {
  if (!isPlainObject(content)) {
    return null
  }
  const record = content as Record<string, any>
  const primary =
    extractButton(record.primaryButton) ||
    extractButton(Array.isArray(record.ctaButtons) ? record.ctaButtons[0] : undefined)

  return primary
}

/**
 * Extracts button properties from a value.
 */
function extractButton(value: unknown): { text: string; url: string } | null {
  if (!isPlainObject(value)) {
    return null
  }
  const record = value as Record<string, any>
  const text = normalizeString(record.text ?? record.label ?? record.heading ?? record.title)
  const url = normalizeString(record.url ?? record.href ?? record.link)
  if (!text || !url) {
    return null
  }
  return { text, url }
}

/**
 * Checks if button content is duplicated in a container.
 */
function isInlineDuplicate(content: unknown, button: { text: string; url: string }): boolean {
  if (!isPlainObject(content)) {
    return false
  }
  const serialized = JSON.stringify(content).toLowerCase()
  const textMatch = Boolean(button.text && serialized.includes(button.text.toLowerCase()))
  const urlMatch = Boolean(button.url && serialized.includes(button.url.toLowerCase()))
  return textMatch || urlMatch
}

// ============================================================================
// Content Feed Promotion
// ============================================================================

/**
 * Executes content feed promotion based on declarative rules.
 *
 * Promotes card-grid/blog-list → content-feed when:
 * 1. Rules are enabled in ComponentDefinition
 * 2. Component matches promotion patterns (e.g., href patterns like '/news/', '/blog/')
 * 3. Sufficient items (3+) with matching patterns
 *
 * @param components - Array of detected components to process
 * @param rules - Content feed promotion rules from ComponentDefinition
 * @param pageUrl - Optional page URL for href resolution
 *
 * @example
 * ```typescript
 * const rules = {
 *   enabled: true,
 *   promotionPatterns: ['/news/', '/blog/', '/articles/']
 * }
 * executeContentFeedPromotion(components, rules, pageUrl)
 * // Promotes card-grid → content-feed when hrefs match /news/ patterns
 * ```
 */
export function executeContentFeedPromotion(
  components: DetectedComponent[],
  rules: ContentFeedPromotionRules,
  pageUrl?: string
): void {
  if (!rules.enabled) {
    return
  }

  const promotionPatterns = rules.promotionPatterns ?? []
  if (promotionPatterns.length === 0) {
    return
  }

  for (const component of components) {
    const canonical = canonicalizeComponentType(String(component.type))
    const isCardGrid = canonical === ComponentType.CardGrid
    const isBlogList = canonical === ComponentType.BlogList
    const isFeatureGrid = canonical === ComponentType.FeatureGrid

    if (!isCardGrid && !isBlogList && !isFeatureGrid) {
      continue
    }

    if (!isPlainObject(component.content)) {
      continue
    }

    const content = component.content as Record<string, any>
    const items = Array.isArray(content.items) ? content.items : []

    if (items.length < 3) {
      continue
    }

    // Extract hrefs from items
    const hrefs = items
      .map(item => {
        if (!isPlainObject(item)) {
          return null
        }
        const record = item as Record<string, any>
        return normalizeString(
          record.link ?? record.href ?? record.url ?? record.cta?.url ?? record.cta?.href
        )
      })
      .filter((href): href is string => Boolean(href))

    if (hrefs.length < 3) {
      continue
    }

    // Check if hrefs match promotion patterns
    const matchingHrefs = hrefs.filter(href =>
      promotionPatterns.some(pattern =>
        href.toLowerCase().includes(pattern.toLowerCase())
      )
    )

    const matchRatio = matchingHrefs.length / hrefs.length
    if (matchRatio < 0.6) {
      // Less than 60% match - don't promote
      continue
    }

    // Promote to content-feed
    component.type = ComponentType.ContentFeed as DetectedComponent['type']
    component.component = ComponentType.ContentFeed
    component.confidence = Math.max(component.confidence ?? 0.5, 0.7)

    // Transform content structure
    const existingMeta = (component.metadata ?? {}) as Record<string, unknown>
    component.metadata = {
      ...existingMeta,
      source: 'content-feed-promotion-engine',
      promotionPattern: promotionPatterns.find(pattern =>
        matchingHrefs[0]?.toLowerCase().includes(pattern.toLowerCase())
      ),
      matchRatio
    } as unknown as typeof component.metadata
  }
}
