/**
 * Page Mapper - Maps Umbraco content to SnapshotPage
 *
 * Transforms Umbraco Compose page content into the page format
 * expected by the site generator.
 */

import type { SnapshotPage, SnapshotPageMetadata, SnapshotRegionSummary } from '@/lib/studio/headless/site-snapshot/types'
import type { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { MapperOptions, UmbracoContentItem } from '../types'
import { mapInlineComponents, extractSharedComponentIds, extractComponentType } from './component-mapper'

/**
 * Default template mapping from Umbraco types to template keys.
 */
const DEFAULT_TEMPLATE_MAP: Record<string, string> = {
  'page': 'default',
  'home': 'home',
  'landing': 'landing',
  'blog': 'blog',
  'article': 'article',
  'contact': 'contact',
  'about': 'about'
}

/**
 * Extract slug from content ID or data.
 * ID pattern: {type}-{slug}-{timestamp}
 */
export function extractSlugFromId(id: string): string {
  // Pattern: page-home-abc123 -> home
  // Pattern: page-about-us-abc123 -> about-us
  const parts = id.split('-')

  if (parts.length < 3) {
    // Fallback: use ID as slug
    return id.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  }

  // Remove first part (type) and last part (timestamp)
  const slugParts = parts.slice(1, -1)
  return slugParts.join('-')
}

/**
 * Build full path from slug, handling home page.
 */
export function buildFullPath(slug: string): string {
  if (slug === 'home' || slug === '/' || slug === '') {
    return '/'
  }
  return `/${slug}`
}

/**
 * Extract metadata from Umbraco content data.
 */
function extractMetadata(data: Record<string, unknown>): SnapshotPageMetadata {
  return {
    seoTitle: asStringOrNull(data.metaTitle ?? data.seoTitle ?? data.title),
    seoDescription: asStringOrNull(data.metaDescription ?? data.seoDescription ?? data.description),
    seoKeywords: asStringArrayOrNull(data.keywords ?? data.seoKeywords),
    ogImage: asStringOrNull(data.ogImage ?? data.socialImage ?? data.featuredImage),
    draft: asBooleanOrUndefined(data.draft ?? data.isDraft)
  }
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asStringArrayOrNull(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string')
  }
  if (typeof value === 'string') {
    return value.split(',').map(s => s.trim()).filter(Boolean)
  }
  return null
}

function asBooleanOrUndefined(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

/**
 * Map Umbraco page type to template key.
 */
function mapTypeToTemplate(
  type: string,
  options: MapperOptions
): string | null {
  const templateMap = { ...DEFAULT_TEMPLATE_MAP, ...options.templateMap }
  return templateMap[type] ?? 'default'
}

/**
 * Extract content data from Umbraco content item.
 * Handles both nested `data` field and flat structure.
 */
function extractContentData(content: UmbracoContentItem): Record<string, unknown> {
  // If there's a data field, use it
  if (content.data && typeof content.data === 'object') {
    return content.data
  }

  // Otherwise, use the content itself (excluding internal fields)
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(content)) {
    if (key !== 'id' && key !== '__typename' && key !== 'type') {
      data[key] = value
    }
  }
  return data
}

/**
 * Build region summary from components.
 */
function buildRegionSummary(
  components: { componentType: string }[]
): SnapshotRegionSummary[] {
  // Group components by region (default to 'main' for now)
  const componentTypes = components.map(c => c.componentType as ComponentType)

  if (componentTypes.length === 0) {
    return []
  }

  return [
    {
      region: 'main',
      componentTypes: [...new Set(componentTypes)]
    }
  ]
}

/**
 * Map a single Umbraco content item to a SnapshotPage.
 */
export function mapUmbracoPage(
  content: UmbracoContentItem,
  options: MapperOptions
): SnapshotPage {
  const data = extractContentData(content)
  const type = extractComponentType(content, 'page')

  // Extract slug and path
  const slug = typeof data.slug === 'string'
    ? data.slug
    : extractSlugFromId(content.id)
  const fullPath = buildFullPath(slug)

  // Extract title
  const title = typeof data.title === 'string'
    ? data.title
    : slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')

  // Map inline components
  const components = mapInlineComponents(data, options)

  // Extract shared component references
  const sharedComponentIds = extractSharedComponentIds(data)

  // Build metadata
  const metadata = extractMetadata(data)

  // Build region summary
  const regions = buildRegionSummary(components)

  return {
    id: content.id,
    title,
    fullPath,
    templateKey: mapTypeToTemplate(type, options),
    templateProps: {},
    regions,
    components,
    metadata,
    sharedComponentIds: sharedComponentIds.length > 0 ? sharedComponentIds : undefined
  }
}

/**
 * Check if a content item represents a page (vs a shared component).
 */
export function isPageContent(content: UmbracoContentItem): boolean {
  const type = extractComponentType(content, '')

  // Pages have type 'page' or ID starting with 'page-'
  if (type === 'page' || content.id?.startsWith('page-')) {
    return true
  }

  // Exclude known shared component types
  const sharedTypes = ['navbar', 'footer', 'header', 'sidebar']
  if (sharedTypes.includes(type)) {
    return false
  }

  // Exclude items with shared- prefix
  if (content.id?.startsWith('shared-')) {
    return false
  }

  // Default to page if has title/slug
  const data = extractContentData(content)
  return Boolean(data.title || data.slug)
}

export { DEFAULT_TEMPLATE_MAP }
