/**
 * Strip AI Metadata Helper
 *
 * Removes AI/import metadata fields from component content before CMS export.
 *
 * Context:
 * - Component schemas define CONTENT fields (slides, title, buttons, etc.)
 * - Import process adds AI metadata fields NOT in schemas
 * - These AI fields should not be exported to external CMS systems
 * - Can't use Zod exportIgnore pattern (requires fields in schemas)
 *
 * @module lib/services/export/helpers/strip-ai-metadata
 */

/**
 * AI metadata fields added during import that should be stripped before export.
 *
 * These fields are NOT part of component content schemas - they're added
 * during the AI import/classification process.
 */
export const AI_METADATA_FIELDS = [
  'metadata',        // AI classification data object
  'region',          // AI placement hint (hero, main, footer)
  'confidence',      // AI confidence score (0-1)
  'hasForm',         // AI feature detection boolean
  'hasLogo',         // AI feature detection boolean
  'hasSearch',       // AI feature detection boolean
  'hasNavigation',   // AI feature detection boolean
  'linkCount',       // AI metrics number
  'buttonCount',     // AI metrics number
  'menuItemCount',   // AI metrics number
  'semanticTokens',  // AI classification array
  'placementBucket', // AI bucket string
  'styles',          // Empty placeholder object
] as const

/**
 * Fields to strip ONLY at root level (depth 0).
 *
 * The 'type' field has dual semantics:
 * - At root level: AI component classification (e.g., 'navbar') - SHOULD strip
 * - In nested objects: Link type discriminator (e.g., 'internal', 'external') - should NOT strip
 *
 * See TKT-033 for content reference architecture redesign.
 */
export const ROOT_ONLY_METADATA_FIELDS = [
  'type',            // Component type - strip only at root to preserve reference discriminators
  'componentType',   // Defensive - also strip componentType at root
] as const

/**
 * Recursively strips AI metadata fields from component data.
 *
 * Handles:
 * - Nested objects (recursively processes)
 * - Arrays (applies to each element)
 * - Null/undefined (returns as-is)
 * - Primitives (returns as-is)
 * - Root-only fields (type, componentType) stripped only at depth 0
 *
 * Does NOT mutate input - returns new objects.
 *
 * @param data - Component data to strip AI metadata from
 * @param isRoot - Whether this is the root level (default: true)
 * @returns New data structure with AI metadata removed
 *
 * @example
 * ```typescript
 * const input = {
 *   title: "My Hero",
 *   type: "hero",           // Stripped (root level)
 *   slides: [
 *     {
 *       heading: "Welcome",
 *       confidence: 0.95,
 *       region: "hero",
 *       metadata: { ai: "data" }
 *     }
 *   ],
 *   ctaButton: {
 *     type: "internal", // PRESERVED (link type discriminator)
 *     pageId: "abc123",
 *     path: "/about"
 *   },
 *   confidence: 0.9,
 *   metadata: { componentTypes: ["hero"] },
 *   hasLogo: true
 * }
 *
 * const result = stripAiMetadata(input)
 * // Result:
 * // {
 * //   title: "My Hero",
 * //   slides: [
 * //     { heading: "Welcome" }
 * //   ],
 * //   ctaButton: {
 * //     type: "internal",  // Preserved!
 * //     pageId: "abc123",
 * //     path: "/about"
 * //   }
 * // }
 * ```
 */
export function stripAiMetadata(data: unknown, isRoot: boolean = true): unknown {
  // Handle null/undefined
  if (data == null) {
    return data
  }

  // Handle arrays - recursively process each element (array elements are NOT root)
  if (Array.isArray(data)) {
    return data.map(item => stripAiMetadata(item, false))
  }

  // Handle objects
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(data)) {
      // Skip AI metadata fields (stripped at ALL levels)
      if (AI_METADATA_FIELDS.includes(key as typeof AI_METADATA_FIELDS[number])) {
        continue
      }

      // Skip root-only metadata fields (stripped ONLY at depth 0)
      if (isRoot && ROOT_ONLY_METADATA_FIELDS.includes(key as typeof ROOT_ONLY_METADATA_FIELDS[number])) {
        continue
      }

      // Recursively process nested values (nested = NOT root)
      result[key] = stripAiMetadata(value, false)
    }

    return result
  }

  // Primitives - return as-is
  return data
}
