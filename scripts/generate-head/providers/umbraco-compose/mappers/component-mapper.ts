/**
 * Component Mapper - Maps Umbraco content to ComponentInstance
 *
 * Transforms Umbraco Compose content data into the component format
 * expected by the site generator.
 */

import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import type { MapperOptions, UmbracoContentItem } from '../types'
import { nanoid } from 'nanoid'

/**
 * Default mapping from Umbraco type schema aliases to component types.
 * Override via componentTypeMap option.
 */
const DEFAULT_TYPE_MAP: Record<string, string> = {
  'hero': 'hero',
  'card-grid': 'card-grid',
  'text-block': 'text',
  'text': 'text',
  'navbar': 'navbar',
  'footer': 'footer',
  'nav-item': 'nav-item',
  'card-item': 'card-item',
  'cta': 'cta',
  'image': 'image',
  'gallery': 'gallery',
  'testimonial': 'testimonial',
  'pricing': 'pricing',
  'faq': 'faq',
  'contact-form': 'contact-form',
  'feature': 'feature',
  'features': 'features',
  'team': 'team',
  'stats': 'stats'
}

/**
 * Extract component type from Umbraco content.
 */
function extractComponentType(
  content: UmbracoContentItem | Record<string, unknown>,
  fallbackType?: string
): string {
  // Check __typename first
  if ('__typename' in content && typeof content.__typename === 'string') {
    return content.__typename.toLowerCase()
  }

  // Check type field
  if ('type' in content && typeof content.type === 'string') {
    return content.type
  }

  // Extract from ID (pattern: {type}-{slug}-{timestamp})
  if ('id' in content && typeof content.id === 'string') {
    const match = content.id.match(/^([a-z-]+)-/)
    if (match) {
      return match[1]
    }
  }

  return fallbackType ?? 'unknown'
}

/**
 * Generate a unique component ID.
 */
function generateComponentId(
  data: Record<string, unknown>,
  componentType: string
): string {
  // Use existing ID if available
  if ('id' in data && typeof data.id === 'string') {
    return data.id
  }

  // Generate new ID
  return `${componentType}-${nanoid(8)}`
}

/**
 * Transform props from Umbraco format to component props.
 * Handles common transformations like field name mappings.
 */
function transformProps(
  data: Record<string, unknown>,
  componentType: string
): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  // Copy all data fields
  for (const [key, value] of Object.entries(data)) {
    // Skip internal fields
    if (key === 'id' || key === '__typename' || key === 'type') {
      continue
    }

    // Transform specific fields based on component type
    if (componentType === 'hero') {
      if (key === 'headline') {
        props['title'] = value
      } else if (key === 'subheadline') {
        props['subtitle'] = value
      } else if (key === 'ctaText') {
        props['ctaText'] = value
      } else if (key === 'ctaUrl') {
        props['ctaHref'] = value
      } else {
        props[key] = value
      }
    } else if (componentType === 'text' || componentType === 'text-block') {
      if (key === 'heading') {
        props['title'] = value
      } else if (key === 'bodyText') {
        props['content'] = value
      } else {
        props[key] = value
      }
    } else if (componentType === 'card-grid') {
      if (key === 'gridTitle') {
        props['title'] = value
      } else if (key === 'cards' && Array.isArray(value)) {
        // Transform card items
        props['cards'] = value.map((card, index) => ({
          id: `card-${index}`,
          title: card.cardTitle ?? card.title,
          description: card.cardDescription ?? card.description,
          image: card.cardImage ?? card.image
        }))
      } else {
        props[key] = value
      }
    } else if (componentType === 'navbar') {
      if (key === 'navItems' && Array.isArray(value)) {
        props['items'] = value.map((item, index) => ({
          id: `nav-${index}`,
          label: item.label,
          href: item.url ?? item.href
        }))
      } else {
        props[key] = value
      }
    } else if (componentType === 'footer') {
      if (key === 'links' && Array.isArray(value)) {
        props['links'] = value.map((link, index) => ({
          id: `link-${index}`,
          label: link.label,
          href: link.url ?? link.href
        }))
      } else {
        props[key] = value
      }
    } else {
      // Default: copy as-is
      props[key] = value
    }
  }

  return props
}

/**
 * Map a single Umbraco content item to a ComponentInstance.
 */
export function mapUmbracoComponent(
  data: Record<string, unknown>,
  componentType: string,
  options: MapperOptions
): ComponentInstance {
  // Resolve mapped component type
  const typeMap = { ...DEFAULT_TYPE_MAP, ...options.componentTypeMap }
  const mappedType = typeMap[componentType] ?? componentType

  const id = generateComponentId(data, mappedType)
  const props = transformProps(data, mappedType)

  return {
    id,
    componentType: mappedType,
    props,
    position: 0 // Set by parent
  }
}

/**
 * Map an array of inline components (e.g., hero, cardGrid in page data).
 */
export function mapInlineComponents(
  pageData: Record<string, unknown>,
  options: MapperOptions
): ComponentInstance[] {
  const components: ComponentInstance[] = []
  let position = 0

  // Known component fields in page data
  const componentFields = ['hero', 'cardGrid', 'textBlock', 'content', 'sections']

  for (const field of componentFields) {
    const value = pageData[field]
    if (!value || typeof value !== 'object') {
      continue
    }

    // Map field name to component type
    const typeFromField = fieldToComponentType(field)

    if (Array.isArray(value)) {
      // Array of components (like sections)
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          const itemType = extractComponentType(item as Record<string, unknown>, typeFromField)
          const component = mapUmbracoComponent(
            item as Record<string, unknown>,
            itemType,
            options
          )
          component.position = position++
          components.push(component)
        }
      }
    } else {
      // Single component
      const component = mapUmbracoComponent(
        value as Record<string, unknown>,
        typeFromField,
        options
      )
      component.position = position++
      components.push(component)
    }
  }

  return components
}

/**
 * Map a field name to a component type.
 */
function fieldToComponentType(field: string): string {
  const mapping: Record<string, string> = {
    'hero': 'hero',
    'cardGrid': 'card-grid',
    'textBlock': 'text',
    'content': 'content',
    'sections': 'section'
  }
  return mapping[field] ?? field
}

/**
 * Check if a content item is a shared component (navbar, footer).
 */
export function isSharedComponent(content: UmbracoContentItem): boolean {
  // Check ID prefix pattern
  if (content.id?.startsWith('shared-')) {
    return true
  }

  // Check type
  const type = extractComponentType(content)
  return type === 'navbar' || type === 'footer'
}

/**
 * Extract shared component IDs from page data.
 */
export function extractSharedComponentIds(pageData: Record<string, unknown>): string[] {
  const ids: string[] = []

  // Check reference fields
  if (typeof pageData.navbarRef === 'string') {
    ids.push(pageData.navbarRef)
  }
  if (typeof pageData.footerRef === 'string') {
    ids.push(pageData.footerRef)
  }
  if (typeof pageData.headerRef === 'string') {
    ids.push(pageData.headerRef)
  }

  return ids
}

export { extractComponentType, DEFAULT_TYPE_MAP }
