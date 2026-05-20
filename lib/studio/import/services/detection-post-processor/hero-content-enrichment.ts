/**
 * Hero Content Enrichment Processor
 *
 * Enriches hero components with text content extracted from DOM when
 * LLM detection fails to extract heading/subheading from overlaid text.
 *
 * This addresses the common issue where text is rendered on top of a
 * CSS background image and the LLM extracts the image but misses the text.
 *
 * @module detection-post-processor/hero-content-enrichment
 */

import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { canonicalizeComponentType } from '../page-builder/component-helpers'
import { isPlainObject, normalizeString, resolveAssetUrl } from './utils'

/**
 * Options for hero content enrichment
 */
export interface HeroContentEnrichmentOptions {
  domSnapshot?: string | null
  pageUrl?: string
}

/**
 * Extracted hero content from DOM
 */
interface ExtractedHeroContent {
  heading?: string
  subheading?: string
  body?: string
  eyebrow?: string
  ctaLabel?: string
  ctaHref?: string
}

/**
 * Hero element selectors to search in DOM
 * Ordered by priority - first match wins
 */
const HERO_SELECTORS = [
  // Common hero container patterns
  'hero',
  'hero-banner',
  'hero-section',
  'banner',
  'jumbotron',
  'masthead',
  'main-banner',
  'splash',
  'intro-section',
  // Class-based patterns
  'plhBanner',
  'hero-content',
  'hero-text',
  'banner-content',
]

/**
 * Heading selectors within hero containers
 */
const HEADING_SELECTORS = [
  'h1',
  'h2',
  '.hero-title',
  '.hero-heading',
  '.banner-title',
  '.display-1',
  '.display-2',
  '[class*="heading"]',
  '[class*="title"]',
]

/**
 * Subheading/description selectors
 */
const SUBHEADING_SELECTORS = [
  'h2',
  'h3',
  '.hero-subtitle',
  '.hero-description',
  '.lead',
  'p.lead',
  '.subheading',
  '.tagline',
  '[class*="subtitle"]',
  '[class*="description"]',
]

/**
 * CTA button selectors
 */
const CTA_SELECTORS = [
  '.btn-primary',
  '.cta-button',
  'a.btn',
  'button.btn',
  '.hero-cta',
  '[class*="cta"]',
]

/**
 * Main function: Enriches hero components with text content from DOM
 *
 * @param components - Array of detected components
 * @param options - Options including DOM snapshot and page URL
 */
export function enrichHeroContent(
  components: DetectedComponent[],
  options: HeroContentEnrichmentOptions
): void {
  const { domSnapshot, pageUrl } = options

  if (!domSnapshot) {
    return
  }

  for (const component of components) {
    const canonical = canonicalizeComponentType(String(component.type))
    const isHero = [
      'hero-with-image',
      'hero-banner',
      'hero-simple',
      'hero-minimal',
      'hero-split',
      'hero-carousel',
      'hero-video',
    ].includes(canonical ?? '')

    if (!isHero) {
      continue
    }

    if (!isPlainObject(component.content)) {
      component.content = {}
    }

    const content = component.content as Record<string, unknown>

    // Check if hero is missing text content but has image
    const hasImage = Boolean(
      content.image ||
      content.backgroundImage ||
      content.background
    )
    const hasHeading = Boolean(normalizeString(content.heading as string))
    const needsEnrichment = hasImage && !hasHeading

    // Also enrich if heading is generic/placeholder
    const heading = normalizeString(content.heading as string)
    const isPlaceholder = heading && (
      heading.toLowerCase() === 'welcome' ||
      heading.toLowerCase() === 'home' ||
      heading.toLowerCase().includes('imported page')
    )

    if (!needsEnrichment && !isPlaceholder) {
      continue
    }

    // Extract hero content from DOM
    const extracted = extractHeroContentFromDom(domSnapshot)

    if (!extracted) {
      continue
    }

    // Apply extracted content (only if better than existing)
    if (extracted.heading && (!heading || isPlaceholder)) {
      content.heading = extracted.heading
    }

    if (extracted.subheading && !normalizeString(content.subheading as string)) {
      content.subheading = extracted.subheading
    }

    if (extracted.body && !normalizeString(content.body as string)) {
      content.body = extracted.body
    }

    if (extracted.eyebrow && !normalizeString(content.eyebrow as string)) {
      content.eyebrow = extracted.eyebrow
    }

    // Add CTA if missing
    if (extracted.ctaLabel && extracted.ctaHref) {
      const existingCtas = content.ctaButtons as unknown[]
      if (!Array.isArray(existingCtas) || existingCtas.length === 0) {
        content.ctaButtons = [{
          label: extracted.ctaLabel,
          href: resolveAssetUrl(extracted.ctaHref, pageUrl),
          variant: 'primary'
        }]
      }
    }

    // Mark as enriched
    const metadata = (component.metadata ?? {}) as Record<string, unknown>
    metadata.heroContentEnriched = true
    component.metadata = metadata as typeof component.metadata
  }
}

/**
 * Extracts hero text content from DOM HTML
 */
function extractHeroContentFromDom(html: string): ExtractedHeroContent | null {
  // Find hero container
  const heroHtml = findHeroContainer(html)
  if (!heroHtml) {
    return null
  }

  const result: ExtractedHeroContent = {}

  // Extract heading (h1 or largest heading in hero)
  const heading = extractTextBySelectors(heroHtml, HEADING_SELECTORS)
  if (heading && heading.length > 3) {
    result.heading = cleanText(heading)
  }

  // Extract subheading
  const subheading = extractTextBySelectors(heroHtml, SUBHEADING_SELECTORS, result.heading)
  if (subheading && subheading.length > 3 && subheading !== result.heading) {
    result.subheading = cleanText(subheading)
  }

  // Extract CTA button
  const cta = extractCtaFromHtml(heroHtml)
  if (cta) {
    result.ctaLabel = cta.label
    result.ctaHref = cta.href
  }

  // Only return if we found meaningful content
  if (result.heading || result.subheading) {
    return result
  }

  return null
}

/**
 * Finds the hero container in HTML
 */
function findHeroContainer(html: string): string | null {
  // Try to find hero section by common class/id patterns
  for (const selector of HERO_SELECTORS) {
    // Try as ID
    const idMatch = new RegExp(
      `<[^>]*id=["']${escapeRegex(selector)}["'][^>]*>([\\s\\S]*?)(?=<\\/(?:section|div|header))`,
      'i'
    ).exec(html)
    if (idMatch) {
      return idMatch[0]
    }

    // Try as class
    const classMatch = new RegExp(
      `<[^>]*class=["'][^"']*\\b${escapeRegex(selector)}\\b[^"']*["'][^>]*>([\\s\\S]*?)(?=<\\/(?:section|div|header))`,
      'i'
    ).exec(html)
    if (classMatch) {
      return classMatch[0]
    }
  }

  // Fallback: look for first section with background-image
  const bgMatch = /<(section|div)[^>]*style=["'][^"']*background-image[^>]*>([\s\S]*?)<\/\1>/i.exec(html)
  if (bgMatch) {
    return bgMatch[0]
  }

  // Last resort: first 5000 chars (likely contains hero)
  return html.slice(0, 5000)
}

/**
 * Extracts text content by trying multiple selectors
 */
function extractTextBySelectors(
  html: string,
  selectors: string[],
  exclude?: string
): string | null {
  for (const selector of selectors) {
    const text = extractTextFromElement(html, selector)
    if (text && text.length > 3) {
      if (exclude && text.toLowerCase() === exclude.toLowerCase()) {
        continue
      }
      return text
    }
  }
  return null
}

/**
 * Extracts text from an element matching a tag or class pattern
 */
function extractTextFromElement(html: string, selector: string): string | null {
  let pattern: RegExp

  if (selector.startsWith('.')) {
    // Class selector
    const className = selector.slice(1)
    pattern = new RegExp(
      `<[^>]*class=["'][^"']*\\b${escapeRegex(className)}\\b[^"']*["'][^>]*>([^<]+)`,
      'i'
    )
  } else if (selector.startsWith('[')) {
    // Attribute selector like [class*="heading"]
    const attrMatch = /\[(\w+)\*="([^"]+)"\]/.exec(selector)
    if (attrMatch) {
      const [, attr, value] = attrMatch
      pattern = new RegExp(
        `<[^>]*${attr}=["'][^"']*${escapeRegex(value)}[^"']*["'][^>]*>([^<]+)`,
        'i'
      )
    } else {
      return null
    }
  } else {
    // Tag selector (h1, h2, p, etc.)
    pattern = new RegExp(`<${selector}[^>]*>([^<]+)<\\/${selector}>`, 'i')
  }

  const match = pattern.exec(html)
  if (match && match[1]) {
    return match[1].trim()
  }

  return null
}

/**
 * Extracts CTA button label and href
 */
function extractCtaFromHtml(html: string): { label: string; href: string } | null {
  for (const selector of CTA_SELECTORS) {
    let pattern: RegExp

    if (selector.startsWith('.')) {
      const className = selector.slice(1)
      pattern = new RegExp(
        `<a[^>]*class=["'][^"']*\\b${escapeRegex(className)}\\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([^<]+)`,
        'i'
      )
    } else if (selector.startsWith('[')) {
      const attrMatch = /\[(\w+)\*="([^"]+)"\]/.exec(selector)
      if (attrMatch) {
        const [, attr, value] = attrMatch
        pattern = new RegExp(
          `<a[^>]*${attr}=["'][^"']*${escapeRegex(value)}[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([^<]+)`,
          'i'
        )
      } else {
        continue
      }
    } else {
      // Element pattern like 'a.btn'
      const tagClass = selector.split('.')
      if (tagClass.length === 2) {
        pattern = new RegExp(
          `<${tagClass[0]}[^>]*class=["'][^"']*\\b${escapeRegex(tagClass[1])}\\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([^<]+)`,
          'i'
        )
      } else {
        continue
      }
    }

    const match = pattern.exec(html)
    if (match && match[1] && match[2]) {
      const label = cleanText(match[2])
      const href = match[1].trim()
      if (label.length >= 2 && href.length >= 1) {
        return { label, href }
      }
    }
  }

  return null
}

/**
 * Cleans extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/**
 * Escapes special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
