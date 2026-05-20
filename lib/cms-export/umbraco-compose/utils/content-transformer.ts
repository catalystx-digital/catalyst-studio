/**
 * Umbraco Compose Content Transformer
 *
 * Transforms CMS content to Umbraco ingestion format.
 *
 * Key transformations:
 * - Pages with inline and shared components
 * - Shared component extraction
 * - Media reference handling
 * - Deterministic ID generation
 */

import type { UnifiedContent, ExtractedComponent } from '@/lib/services/export/content-orchestrator';
import type { UmbracoIngestionEntry } from '../types';
import {
  generatePageId,
  generateSharedComponentId,
  sanitizeForId,
} from './id-generator';

/**
 * Transform a page to Umbraco ingestion entry
 */
export function transformPageToEntry(
  page: UnifiedContent,
  sharedRefs: Record<string, string>,
  timestamp: string
): UmbracoIngestionEntry {
  const slug = resolveSlug(page);
  const pageId = generatePageId(slug, timestamp);

  const data: Record<string, unknown> = {
    title: page.title || slug,
    slug,
  };

  // Add metadata fields
  if (page.url) data.url = page.url;
  if (page.metadata?.summary) data.summary = page.metadata.summary;
  if (page.metadata?.description) data.description = page.metadata.description;

  // Add shared component references
  if (sharedRefs.navbar) {
    data.navbarRef = sharedRefs.navbar;
  }
  if (sharedRefs.footer) {
    data.footerRef = sharedRefs.footer;
  }

  // Transform inline components
  const components = page.components || [];
  for (const component of components) {
    if (!component.isShared) {
      const key = resolveComponentKey(component);
      data[key] = transformInlineComponent(component);
    }
  }

  return {
    id: pageId,
    type: 'page',
    action: 'upsert',
    data,
  };
}

/**
 * Transform a shared component to Umbraco ingestion entry
 */
export function transformSharedComponentToEntry(
  component: ExtractedComponent,
  timestamp: string
): UmbracoIngestionEntry {
  const componentType = component.type || 'component';
  const identifier = component.sharedId || component.id || componentType;
  const entryId = generateSharedComponentId(componentType, identifier, timestamp);

  return {
    id: entryId,
    type: componentType,
    action: 'upsert',
    data: transformComponentProperties(component),
  };
}

/**
 * Transform component properties (inline)
 */
export function transformInlineComponent(
  component: ExtractedComponent
): Record<string, unknown> {
  return transformComponentProperties(component);
}

/**
 * Transform component properties to Umbraco format
 */
export function transformComponentProperties(
  component: ExtractedComponent
): Record<string, unknown> {
  const properties = component.properties || {};
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    const transformedKey = sanitizePropertyKey(key);
    result[transformedKey] = transformPropertyValue(value);
  }

  return result;
}

/**
 * Transform a property value
 */
function transformPropertyValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => transformPropertyValue(item));
  }

  if (typeof value === 'object') {
    // Check if it's a media object
    if (isMediaObject(value as Record<string, unknown>)) {
      return transformMediaValue(value as Record<string, unknown>);
    }

    // Check if it's a link object
    if (isLinkObject(value as Record<string, unknown>)) {
      return transformLinkValue(value as Record<string, unknown>);
    }

    // Recursively transform object properties
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = transformPropertyValue(v);
    }
    return result;
  }

  return value;
}

/**
 * Check if value is a media object
 */
function isMediaObject(value: Record<string, unknown>): boolean {
  return Boolean(value.src && typeof value.src === 'string');
}

/**
 * Check if value is a link object
 */
function isLinkObject(value: Record<string, unknown>): boolean {
  return Boolean(value.url && typeof value.url === 'string' && value.label);
}

/**
 * Transform media value
 */
function transformMediaValue(media: Record<string, unknown>): Record<string, unknown> {
  return {
    src: media.src,
    alt: media.alt || '',
    width: media.width,
    height: media.height,
  };
}

/**
 * Transform link value
 */
function transformLinkValue(link: Record<string, unknown>): Record<string, unknown> {
  return {
    label: link.label || link.text,
    url: link.url || link.href,
    target: link.target,
  };
}

/**
 * Resolve a component key for inline embedding
 */
function resolveComponentKey(component: ExtractedComponent): string {
  const type = component.type || 'component';
  return sanitizePropertyKey(type);
}

/**
 * Resolve page slug
 */
export function resolveSlug(page: UnifiedContent): string {
  if (page.url) {
    const trimmed = page.url.replace(/^\/+|\/+$/g, '');
    if (trimmed) return sanitizeForId(trimmed, 'page');
  }
  if (page.title) {
    return sanitizeForId(page.title, 'page');
  }
  return sanitizeForId(page.id || 'page', 'page');
}

/**
 * Sanitize property key for Umbraco (camelCase)
 */
function sanitizePropertyKey(key: string): string {
  let value = (key || '').toString();

  // Convert kebab-case or snake_case to camelCase
  value = value.replace(/[-_]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');

  // Remove non-alphanumeric
  value = value.replace(/[^a-zA-Z0-9]/g, '');

  // Ensure starts with lowercase
  if (value.length > 0) {
    value = value[0].toLowerCase() + value.slice(1);
  }

  return value || 'field';
}

/**
 * Extract shared components from unified content array
 */
export function extractSharedComponents(
  content: UnifiedContent[]
): Map<string, ExtractedComponent> {
  const shared = new Map<string, ExtractedComponent>();

  for (const page of content) {
    const components = page.components || [];
    for (const component of components) {
      if (component.isShared && component.sharedId) {
        // Deduplicate by sharedId
        if (!shared.has(component.sharedId)) {
          shared.set(component.sharedId, component);
        }
      }
    }
  }

  return shared;
}

/**
 * Build shared component reference map
 */
export function buildSharedRefMap(
  sharedComponents: Map<string, ExtractedComponent>,
  timestamp: string
): Record<string, string> {
  const refs: Record<string, string> = {};

  for (const [sharedId, component] of sharedComponents) {
    const componentType = component.type || 'component';
    const entryId = generateSharedComponentId(componentType, sharedId, timestamp);

    // Map by type for common references (navbar, footer)
    if (componentType === 'navbar' || componentType === 'footer') {
      refs[componentType] = entryId;
    }

    // Also map by sharedId
    refs[sharedId] = entryId;
  }

  return refs;
}

/**
 * Group content by type for batch processing
 */
export function groupContentByType(
  entries: UmbracoIngestionEntry[]
): Map<string, UmbracoIngestionEntry[]> {
  const groups = new Map<string, UmbracoIngestionEntry[]>();

  for (const entry of entries) {
    const existing = groups.get(entry.type) || [];
    existing.push(entry);
    groups.set(entry.type, existing);
  }

  return groups;
}
