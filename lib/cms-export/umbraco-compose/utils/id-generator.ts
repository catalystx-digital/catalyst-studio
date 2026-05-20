/**
 * Umbraco Compose ID Generator
 *
 * Generates deterministic content IDs for Umbraco Compose.
 * Format: {type}-{slug}-{timestamp_base36}
 *
 * Features:
 * - Human-readable IDs
 * - Deterministic generation for deduplication
 * - Safe for Umbraco's ID requirements
 */

/**
 * Sanitize a string for use in IDs
 * - Converts to lowercase
 * - Replaces non-alphanumeric chars with hyphens
 * - Removes leading/trailing hyphens
 * - Ensures starts with letter
 */
export function sanitizeForId(input: string, fallback: string = 'item'): string {
  let value = (input || '').toString().toLowerCase();

  // Replace non-alphanumeric with hyphens
  value = value.replace(/[^a-z0-9]+/g, '-');

  // Remove leading/trailing hyphens
  value = value.replace(/^-+|-+$/g, '');

  // Use fallback if empty
  if (!value) {
    value = fallback;
  }

  // Ensure starts with letter
  if (/^[0-9]/.test(value)) {
    value = `${fallback}-${value}`;
  }

  // Limit length
  return value.slice(0, 50);
}

/**
 * Generate a timestamp suffix in base36
 */
export function generateTimestampSuffix(): string {
  return Date.now().toString(36);
}

/**
 * Generate a content ID
 */
export function generateContentId(
  type: string,
  identifier: string,
  timestamp?: string
): string {
  const sanitizedType = sanitizeForId(type, 'content');
  const sanitizedIdentifier = sanitizeForId(identifier, 'item');
  const suffix = timestamp || generateTimestampSuffix();

  return `${sanitizedType}-${sanitizedIdentifier}-${suffix}`;
}

/**
 * Generate a page ID
 */
export function generatePageId(slug: string, timestamp?: string): string {
  return generateContentId('page', slug, timestamp);
}

/**
 * Generate a shared component ID
 */
export function generateSharedComponentId(
  componentType: string,
  identifier?: string,
  timestamp?: string
): string {
  const id = identifier || componentType;
  return generateContentId(`shared-${componentType}`, id, timestamp);
}

/**
 * Generate a component ID (for inline components within a page)
 */
export function generateInlineComponentId(
  pageId: string,
  componentType: string,
  index: number
): string {
  // Include page context to avoid collisions
  const pageSlug = pageId.replace(/^page-/, '').split('-').slice(0, -1).join('-');
  return `${componentType}-${pageSlug}-${index}`;
}

/**
 * Extract type from a content ID
 */
export function extractTypeFromId(contentId: string): string | null {
  const match = contentId.match(/^([a-z-]+?)-[a-z0-9-]+-[a-z0-9]+$/);
  return match ? match[1] : null;
}

/**
 * Check if an ID looks like a shared component ID
 */
export function isSharedComponentId(contentId: string): boolean {
  return contentId.startsWith('shared-');
}

/**
 * Generate a deterministic hash suffix for deduplication
 */
export function generateHashSuffix(content: string): string {
  // Simple hash function for deterministic IDs
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a deterministic content ID based on content hash
 */
export function generateDeterministicId(
  type: string,
  identifier: string,
  content: unknown
): string {
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  const hashSuffix = generateHashSuffix(contentStr);
  return generateContentId(type, identifier, hashSuffix);
}
