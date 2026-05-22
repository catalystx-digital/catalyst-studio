/**
 * Hero-CTA Merger Processor
 *
 * Merges a hero component followed by a simple CTA banner into a single hero
 * with subheading. This handles cases where site names or organization names
 * are detected as separate CTA banners instead of being part of the hero.
 *
 * Pattern detected:
 * - Hero component (hero-with-image, hero-simple, hero-banner)
 * - Followed by CTA banner with only a heading (no buttons, no body)
 * - CTA heading looks like an organization/site name
 *
 * Result:
 * - Hero gets the CTA heading as its subheading
 * - CTA banner is removed from the component list
 *
 * @module hero-cta-merger
 */

import { canonicalizeComponentType } from '../page-builder/component-helpers'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { isPlainObject, normalizeString } from './utils'

/**
 * Hero component types that can receive a subheading from an adjacent CTA
 */
const HERO_TYPES = new Set([
  'hero-with-image',
  'hero-simple',
  'hero-banner',
  'hero-split',
  'hero-minimal'
])

/**
 * Checks if a component type is a hero variant
 */
function isHeroComponent(type: string): boolean {
  const canonical = canonicalizeComponentType(type)
  return canonical ? HERO_TYPES.has(canonical) : false
}

/**
 * Checks if a component is a simple CTA banner (heading only, no buttons)
 */
function isSimpleCtaBanner(component: DetectedComponent): boolean {
  const type = canonicalizeComponentType(component.type)
  if (type !== 'cta-banner') {
    return false
  }

  const content = component.content as Record<string, unknown> | undefined
  if (!isPlainObject(content)) {
    return false
  }

  // Must have a heading
  const heading = typeof content.heading === 'string' ? normalizeString(content.heading) : undefined
  if (!heading) {
    return false
  }

  // Must NOT have buttons or body text (that would make it a real CTA)
  const hasButtons = Boolean(content.primaryButton) ||
                     Boolean(content.secondaryButton) ||
                     (Array.isArray(content.buttons) && content.buttons.length > 0) ||
                     (Array.isArray(content.ctaButtons) && content.ctaButtons.length > 0)

  const hasBody = (typeof content.body === 'string' && Boolean(normalizeString(content.body))) ||
                  (typeof content.description === 'string' && Boolean(normalizeString(content.description)))

  // Simple CTA = has heading but no buttons and no body
  return !hasButtons && !hasBody
}

/**
 * Checks if heading looks like a name/title rather than a call-to-action.
 *
 * Uses generic heuristics:
 * 1. Excludes CTA-like patterns (universal: "Get Started", "Learn More", etc.)
 * 2. Accepts Title Case short phrases (2-6 words, mostly capitalized)
 *
 * NOTE: Industry-specific patterns (hospital, university, etc.) were intentionally
 * removed to keep this detection generic across all website types.
 */
function looksLikeNameNotCta(heading: string): boolean {
  const normalized = heading.toLowerCase().trim()

  // CTA-like patterns to exclude (these ARE universal across industries)
  const ctaPatterns = [
    /^(get|start|try|learn|discover|explore|join|sign|contact|subscribe)/i,
    /^(ready to|want to|need to|looking for)/i,
    /(today|now|free|started|more|us)$/i,
    /\?$/  // Questions are usually CTAs
  ]

  for (const pattern of ctaPatterns) {
    if (pattern.test(normalized)) {
      return false
    }
  }

  // Generic heuristic: short Title Case phrases are likely names/titles
  // (Works for any industry: "Acme Corp", "Mountain View Bakery", "Dr. Smith's Practice")
  const wordCount = heading.split(/\s+/).length
  if (wordCount >= 2 && wordCount <= 6) {
    const words = heading.split(/\s+/)
    const capitalizedWords = words.filter(w => /^[A-Z]/.test(w))
    // At least 50% of words start with capital letter
    if (capitalizedWords.length >= words.length * 0.5) {
      return true
    }
  }

  return false
}

/**
 * Merges a hero followed by a simple CTA banner into a single hero with subheading.
 *
 * This processor:
 * 1. Finds hero components
 * 2. Checks if the next component is a simple CTA banner (heading only)
 * 3. If the CTA heading looks like an org name, merges it as the hero's subheading
 * 4. Removes the CTA banner from the component list
 *
 * @param components - Array of detected components (mutated in place)
 */
export function mergeHeroWithAdjacentCta(components: DetectedComponent[]): void {
  // Track indices to remove (process in reverse to avoid index shifting)
  const indicesToRemove: number[] = []

  for (let i = 0; i < components.length - 1; i++) {
    const current = components[i]
    const next = components[i + 1]

    // Check if current is a hero and next is a simple CTA banner
    if (!isHeroComponent(current.type)) {
      continue
    }

    if (!isSimpleCtaBanner(next)) {
      continue
    }

    const ctaContent = next.content as Record<string, unknown>
    const ctaHeading = typeof ctaContent.heading === 'string' ? normalizeString(ctaContent.heading) : undefined

    if (!ctaHeading) {
      continue
    }

    // Check if the CTA heading looks like a name (not a CTA phrase)
    if (!looksLikeNameNotCta(ctaHeading)) {
      continue
    }

    // Get hero content
    const heroContent = (current.content ?? {}) as Record<string, unknown>

    // Only merge if hero doesn't already have a subheading
    const existingSubheading = typeof heroContent.subheading === 'string'
      ? normalizeString(heroContent.subheading)
      : undefined
    if (existingSubheading) {
      continue
    }

    // Merge: add CTA heading as hero subheading
    current.content = {
      ...heroContent,
      subheading: ctaHeading
    }

    // Mark CTA for removal
    indicesToRemove.push(i + 1)

    // Skip the next component since we've processed it
    i++
  }

  // Remove merged CTAs in reverse order to maintain correct indices
  for (let i = indicesToRemove.length - 1; i >= 0; i--) {
    components.splice(indicesToRemove[i], 1)
  }
}
