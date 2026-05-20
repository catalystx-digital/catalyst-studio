/**
 * Region Assignment Processor
 *
 * Functions for assigning page regions (header, hero, main, footer) to detected components.
 *
 * @module region-processor
 */

import { canonicalizeComponentType } from '../page-builder/component-helpers'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { isPlainObject } from './utils'
import { getHeroComponentTypes, getHeaderEligibleComponentTypes } from '@/lib/studio/components/cms/_core/definition-loader'

/**
 * Component region type.
 */
export type ComponentRegion = 'header' | 'hero' | 'main' | 'footer'

/**
 * Assigns header regions to components before and adjacent to navbar.
 *
 * @param components - Array of detected components
 */
export function assignHeaderRegions(components: DetectedComponent[]): void {
  const navbarIndex = components.findIndex(component =>
    canonicalizeComponentType(String(component.type)) === 'navbar'
  )
  if (navbarIndex === -1) {
    return
  }

  const headerEligible = getHeaderEligibleComponentTypes()
  for (let index = 0; index < components.length && index < navbarIndex; index += 1) {
    const component = components[index]
    const canonical = canonicalizeComponentType(String(component.type))
    if (!canonical || !headerEligible.has(canonical)) {
      continue
    }
    applyRegion(component, 'header')
  }
}

/**
 * Assigns hero regions to hero-type components that don't have a region.
 * Should be called after header regions are assigned.
 *
 * @param components - Array of detected components
 */
export function assignHeroRegions(components: DetectedComponent[]): void {
  const heroTypes = getHeroComponentTypes()

  for (const component of components) {
    const canonical = canonicalizeComponentType(String(component.type))
    if (!canonical || !heroTypes.has(canonical)) {
      continue
    }

    // Check if already has a region
    const existingRegion = component.metadata?.region ??
      (component.content as Record<string, any>)?.region
    if (existingRegion) {
      continue
    }

    applyRegion(component, 'hero')
  }
}

/**
 * Applies a region to a component and its content/metadata.
 *
 * @param component - Component to update
 * @param region - Region to apply
 */
export function applyRegion(component: DetectedComponent, region: ComponentRegion): void {
  ;(component as any).location = region
  component.metadata = { ...(component.metadata ?? {}), region }

  if (isPlainObject(component.content)) {
    const content = component.content as Record<string, any>
    content.region = region
    if (isPlainObject(content.metadata)) {
      (content.metadata as Record<string, any>).region = region
    } else {
      content.metadata = { region }
    }
  }
}

/**
 * Gets the region from a component.
 *
 * @param component - Component to check
 * @returns Region or undefined
 */
export function getComponentRegion(component: DetectedComponent): ComponentRegion | undefined {
  const region = component.metadata?.region
  if (typeof region === 'string') {
    const lower = region.toLowerCase()
    if (lower === 'header' || lower === 'hero' || lower === 'main' || lower === 'footer') {
      return lower as ComponentRegion
    }
  }
  return undefined
}
