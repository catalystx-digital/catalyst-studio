/**
 * CTA Processor
 *
 * Handles CTA component processing including:
 * - Removal of inline CTAs that duplicate content in adjacent components (delegated to ProcessingEngine)
 *
 * @module cta-processor
 */

import { executeDeduplication } from './processing-engine'
import { CTASimpleDef } from '@/lib/studio/components/cms/cta/cta-simple/cta-simple.def'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'

const LISTING_COMPONENT_TYPES = new Set([
  'card-grid',
  'content-feed',
  'blog-list',
  'feature-grid',
  'feature-list',
])

const CTA_CONTENT_FIELDS = [
  'subheading',
  'description',
  'text',
  'body',
  'bodyHtml',
  'button',
  'buttons',
  'primaryButton',
  'secondaryButton',
  'actions',
  'links',
  'image',
  'media',
  'backgroundImage',
]

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  if (Array.isArray(value)) {
    return value.some(hasMeaningfulValue)
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(hasMeaningfulValue)
  }

  return value !== null && value !== undefined
}

function isHeadingOnlyCtaBanner(component: DetectedComponent): boolean {
  if (component.type !== 'cta-banner' && component.component !== 'cta-banner') {
    return false
  }

  const content = component.content ?? {}
  const heading = content.heading ?? content.title

  if (!hasMeaningfulValue(heading)) {
    return true
  }

  return CTA_CONTENT_FIELDS.every(field => !hasMeaningfulValue(content[field]))
}

function isListingComponent(component: DetectedComponent | undefined): boolean {
  if (!component) {
    return false
  }

  return LISTING_COMPONENT_TYPES.has(String(component.type || component.component))
}

/**
 * Removes CTA components that are duplicated inline in adjacent two-column or timeline components.
 * Delegates to ProcessingEngine.executeDeduplication using declarative rules.
 */
export function removeInlineCtas(components: DetectedComponent[]): void {
  const rules = CTASimpleDef.processing?.deduplication
  if (!rules) {
    return
  }

  executeDeduplication(components, rules)
}

/**
 * Drops CTA banner artifacts that only contain a heading and are adjacent to a
 * real listing/content section. These are usually section-label detections, not
 * actionable CTAs, and otherwise render as large empty visual bands.
 */
export function removeHollowCtaBanners(components: DetectedComponent[]): void {
  for (let index = components.length - 1; index >= 0; index -= 1) {
    const component = components[index]

    if (!isHeadingOnlyCtaBanner(component)) {
      continue
    }

    const previous = components[index - 1]
    const next = components[index + 1]

    if (!isListingComponent(previous) && !isListingComponent(next)) {
      continue
    }

    components.splice(index, 1)
  }
}

export function cleanupCtas(components: DetectedComponent[]): void {
  removeInlineCtas(components)
  removeHollowCtaBanners(components)
}
