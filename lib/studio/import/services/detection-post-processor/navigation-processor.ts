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
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { SIDEMENU_LABEL_INDICATORS, type MenuItemLike } from './navigation-patterns'
import { normalizeString, isPlainObject } from './utils'
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

  // Check if hrefs all share a deep common prefix (e.g., /cah/, /rch/department/)
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
