/**
 * JSON Unwrap Processor
 *
 * Fixes issues where LLM detection outputs JSON objects/arrays as raw content
 * instead of properly structured components.
 *
 * Specifically handles:
 * 1. Nav-menu-item arrays that should be sidebar-nav components
 * 2. BodyHtml content wrapped in JSON objects
 *
 * @module json-unwrap-processor
 */

import type { DetectedComponent } from '@/lib/studio/import/detection/types'

interface NavMenuItem {
  type: string
  label: string
  href: string
  [key: string]: unknown
}

interface BodyHtmlWrapper {
  title?: string
  bodyHtml?: string
  [key: string]: unknown
}

/**
 * Checks if a value is a plain object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Checks if a value looks like a nav-menu-item object
 */
function isNavMenuItem(value: unknown): value is NavMenuItem {
  if (!isRecord(value)) {
    return false
  }
  return (
    value.type === 'nav-menu-item' ||
    (typeof value.label === 'string' && typeof value.href === 'string')
  )
}

/**
 * Checks if a value looks like a bodyHtml wrapper object
 */
function isBodyHtmlWrapper(value: unknown): value is BodyHtmlWrapper {
  if (!isRecord(value)) {
    return false
  }
  // Has bodyHtml and either title or just bodyHtml
  return typeof value.bodyHtml === 'string' && value.bodyHtml.trim().length > 0
}

/**
 * Detects and unwraps JSON content in a single component (text-block or html-block)
 */
function unwrapComponentJsonContent(component: DetectedComponent): void {
  const content = component.content
  if (!isRecord(content)) {
    return
  }

  // Check body/bodyHtml fields for JSON-wrapped content
  const bodyField = content.body || content.bodyHtml

  if (typeof bodyField === 'string') {
    const trimmed = bodyField.trim()

    // Try to parse as JSON
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)

        // Case 1: bodyHtml wrapper { "title": "...", "bodyHtml": "..." }
        if (isBodyHtmlWrapper(parsed)) {
          // Extract the bodyHtml and optionally title
          if (parsed.title && !content.title && !content.heading) {
            content.heading = parsed.title
          }
          // CRITICAL: text-block expects 'body' field, not 'bodyHtml'
          // Set body for text-block, keep bodyHtml for html-block
          content.body = parsed.bodyHtml
          content.bodyHtml = parsed.bodyHtml

          console.log('[JSONUnwrap] Extracted bodyHtml from JSON wrapper')
          return
        }

        // Case 2: Array of nav-menu-items that should be a sidebar-nav
        if (Array.isArray(parsed) && parsed.every(isNavMenuItem)) {
          // This is likely nav-menu items that should be a sidebar component
          // Convert to sidebar-nav content structure
          const title = content.title || content.heading || 'Navigation'
          content.title = typeof title === 'string' ? title : 'Navigation'
          content.items = parsed

          // Remove the body/bodyHtml field
          if ('body' in content) {
            delete content.body
          }
          if ('bodyHtml' in content) {
            delete content.bodyHtml
          }

          // Change component type to sidebar-nav
          component.componentType = 'sidebar-nav'

          console.log('[JSONUnwrap] Converted nav-menu-item array to sidebar-nav component')
          return
        }

        // Case 3: Single object with title and items array
        if (isRecord(parsed) && Array.isArray(parsed.items)) {
          if (parsed.items.every(isNavMenuItem)) {
            // Extract title from wrapper
            const title = parsed.title || content.title || content.heading || 'Navigation'
            content.title = typeof title === 'string' ? title : 'Navigation'
            content.items = parsed.items

            // Remove the body/bodyHtml field
            if ('body' in content) {
              delete content.body
            }
            if ('bodyHtml' in content) {
              delete content.bodyHtml
            }

            // Change component type to sidebar-nav
            component.componentType = 'sidebar-nav'

            console.log('[JSONUnwrap] Converted wrapped nav-menu-item array to sidebar-nav component')
            return
          }
        }

        // Case 4: Metadata-only JSON object (e.g., { "heading": "..." } without bodyHtml)
        // This handles cases where LLM outputs just metadata as JSON instead of content
        if (isRecord(parsed) && !('bodyHtml' in parsed) && !('body' in parsed)) {
          // Extract heading/title if present
          const heading = parsed.heading || parsed.title
          if (typeof heading === 'string') {
            if (!content.heading) {
              content.heading = heading
            }
          }

          // Clear the body fields - no actual body content exists
          if ('body' in content) {
            delete content.body
          }
          if ('bodyHtml' in content) {
            delete content.bodyHtml
          }

          console.log('[JSONUnwrap] Extracted metadata from JSON-only body, cleared body content')
          return
        }
      } catch (e) {
        // Not valid JSON, leave as-is
        return
      }
    }
  }
}

/**
 * Main processor: scans all components and unwraps JSON content where appropriate
 */
export function unwrapJsonContent(components: DetectedComponent[]): void {
  for (const component of components) {
    const componentType = component.componentType

    // Only process text-block and html-block components (where JSON might appear)
    if (componentType === 'text-block' || componentType === 'html-block') {
      unwrapComponentJsonContent(component)
    }

    // Also check two-column nested content
    if (componentType === 'two-column') {
      const content = component.content
      if (isRecord(content)) {
        // Check leftColumn and rightColumn arrays
        const processColumn = (columnArray: unknown) => {
          if (Array.isArray(columnArray)) {
            for (const child of columnArray) {
              if (isRecord(child)) {
                const childComponent = child as DetectedComponent
                const childType = childComponent.type || childComponent.componentType
                if (childType === 'text-block' || childType === 'html-block') {
                  unwrapComponentJsonContent(childComponent)
                }
              }
            }
          }
        }

        processColumn(content.leftColumn)
        processColumn(content.rightColumn)

        // Also check areas.left and areas.right
        if (isRecord(content.areas)) {
          processColumn(content.areas.left)
          processColumn(content.areas.right)
        }
      }
    }
  }
}
