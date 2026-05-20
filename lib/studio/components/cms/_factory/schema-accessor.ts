/**
 * Schema Accessor - Unified Content Schema Access
 *
 * Provides a single function to get FieldSchema[] for ANY content type
 * (components, pages, media). Converts Zod schemas to property editor format.
 *
 * This replaces scattered schema access patterns with one unified API:
 * - getSchemaForContent('HeroBanner') → FieldSchema[]
 * - getSchemaForContent('HomePage') → FieldSchema[]
 * - getSchemaForContent('Image') → FieldSchema[]
 */

import { getDefinition, loadAllDefinitions, getDefinitionStats } from '../_core/definition-loader'
import { zodToFieldSchema } from '../_core/value-objects/utils/zod-to-field-schema'
import type { FieldSchema } from '@/lib/studio/components/site-builder/property-editor/schema/types'
import type { ComponentType } from '../_core/types'

/**
 * Initialization state for definitions
 */
let initPromise: Promise<void> | null = null

/**
 * Ensure definitions are loaded before accessing schemas
 */
async function ensureInitialized(): Promise<void> {
  const stats = getDefinitionStats()
  if (stats.isInitialized) {
    return
  }

  if (!initPromise) {
    initPromise = loadAllDefinitions()
  }

  await initPromise
}

/**
 * Cache for converted schemas
 * Maps content type → FieldSchema[]
 */
const schemaCache = new Map<string, FieldSchema[]>()

/**
 * Get FieldSchema[] for any content type (component, page, media)
 *
 * This is the unified accessor for all content schemas. It:
 * 1. Ensures component definitions are loaded
 * 2. Looks up the component definition (from *.def.ts files)
 * 3. Converts the Zod schema to FieldSchema[] using zodToFieldSchema
 * 4. Caches the result for performance
 *
 * @param type - Content type identifier (e.g., 'hero-banner', 'HomePage', 'Image')
 * @returns Promise resolving to array of FieldSchema for property editor, or empty array if type not found
 *
 * @example
 * ```typescript
 * // Get schema for a component
 * const heroSchema = await getSchemaForContent('hero-banner')
 * // Returns: [{ name: 'heading', type: 'string', ... }, ...]
 *
 * // Get schema for a page template (if exists)
 * const pageSchema = await getSchemaForContent('HomePage')
 *
 * // Get schema for media type (if exists)
 * const imageSchema = await getSchemaForContent('Image')
 *
 * // Unknown type returns empty array
 * const unknown = await getSchemaForContent('NonExistent')
 * // Returns: []
 * ```
 */
export async function getSchemaForContent(type: string): Promise<FieldSchema[]> {
  // Check cache first
  const cached = schemaCache.get(type)
  if (cached) {
    return cached
  }

  // Ensure definitions are loaded
  await ensureInitialized()

  // Get component definition
  const definition = getDefinition(type as ComponentType)
  if (!definition) {
    // Type not found - return empty array
    // This is expected for unknown types, no need to log in production
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[getSchemaForContent] No definition found for type: ${type}`)
    }
    return []
  }

  // Convert Zod schema to FieldSchema[]
  const schema = definition.schema
  const shape = schema.shape as Record<string, any>
  const fields: FieldSchema[] = []

  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    fields.push(zodToFieldSchema(fieldName, fieldSchema))
  }

  // Cache the result
  schemaCache.set(type, fields)

  return fields
}

/**
 * Clear schema cache for a specific type
 *
 * Useful when component definitions are reloaded or updated.
 *
 * @param type - Content type to clear from cache
 * @returns true if entry was removed, false if it didn't exist
 */
export function clearSchemaCache(type: string): boolean {
  return schemaCache.delete(type)
}

/**
 * Clear entire schema cache
 *
 * Useful for testing or when reloading all component definitions.
 */
export function clearAllSchemaCaches(): void {
  schemaCache.clear()
}

/**
 * Get cache statistics
 *
 * Useful for debugging and monitoring cache performance.
 *
 * @returns Object with cache stats
 */
export function getSchemaCacheStats(): {
  size: number
  types: string[]
} {
  return {
    size: schemaCache.size,
    types: Array.from(schemaCache.keys()),
  }
}
