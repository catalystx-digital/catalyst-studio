import { z } from 'zod'

/**
 * Symbol used to mark Zod schemas that should be excluded during CMS export.
 * This prevents internal metadata, AI-generated fields, and other non-content
 * data from being included in exported content items.
 */
const EXPORT_IGNORE_BRAND = Symbol('exportIgnore')

/**
 * Marks a Zod schema to be excluded during CMS export operations.
 *
 * This is used to annotate fields that should not be exported to external CMS systems,
 * such as:
 * - AI confidence scores
 * - Internal metadata
 * - Processing artifacts
 * - Region/section identifiers used only during import
 *
 * The function works by wrapping the schema with a branded type that carries
 * the export-ignore metadata without affecting the schema's parsing behavior.
 *
 * @example
 * ```typescript
 * const ComponentSchema = z.object({
 *   title: z.string(),
 *   content: z.string(),
 *   // These fields will be excluded during export:
 *   confidence: exportIgnore(z.number()),
 *   metadata: exportIgnore(z.object({ ... })),
 *   region: exportIgnore(z.string()),
 * })
 * ```
 *
 * @example
 * ```typescript
 * // Works with optional and other modifiers:
 * const schema = exportIgnore(z.string().optional())
 * const schema2 = z.string().optional().transform(exportIgnore)
 * ```
 *
 * @param schema - Any Zod schema to mark for export exclusion
 * @returns The same schema with export-ignore metadata attached
 */
export function exportIgnore<T extends z.ZodTypeAny>(schema: T): T {
  // Use Zod's .brand() to attach metadata without affecting parsing
  // @ts-expect-error - brand() exists but TypeScript doesn't always recognize the override
  return schema.brand(EXPORT_IGNORE_BRAND)
}

/**
 * Checks if a Zod schema has been marked for export exclusion.
 *
 * This function is used by export pipelines to determine which fields
 * should be stripped from the exported content.
 *
 * @example
 * ```typescript
 * const normalSchema = z.string()
 * const ignoredSchema = exportIgnore(z.string())
 *
 * isExportIgnored(normalSchema)  // false
 * isExportIgnored(ignoredSchema) // true
 * ```
 *
 * @example
 * ```typescript
 * // Usage in export pipeline:
 * function exportObject(schema: z.ZodObject<any>, data: any) {
 *   const shape = schema.shape
 *   const filtered: any = {}
 *
 *   for (const [key, fieldSchema] of Object.entries(shape)) {
 *     if (!isExportIgnored(fieldSchema)) {
 *       filtered[key] = data[key]
 *     }
 *   }
 *
 *   return filtered
 * }
 * ```
 *
 * @param schema - The Zod schema to check
 * @returns true if the schema is marked for export exclusion, false otherwise
 */
export function isExportIgnored(schema: z.ZodTypeAny): boolean {
  // Check if the schema has been branded with the export-ignore marker
  // Zod's branded types store brands in a _def.brand property
  const def = schema._def as any

  // Handle branded schemas
  if (def.typeName === 'ZodBranded' && def.brand) {
    // The brand can be a symbol or a Set of symbols
    if (typeof def.brand === 'symbol') {
      return def.brand === EXPORT_IGNORE_BRAND
    }
    if (def.brand instanceof Set) {
      return def.brand.has(EXPORT_IGNORE_BRAND)
    }
  }

  // Handle wrapped types (optional, nullable, default, etc.)
  // These types wrap an inner schema, so check the inner schema recursively
  if (def.innerType) {
    return isExportIgnored(def.innerType)
  }

  return false
}

/**
 * Type helper to extract the schema type while preserving export-ignore metadata.
 *
 * @example
 * ```typescript
 * type MySchema = ExportIgnored<z.ZodString>
 * // Equivalent to z.ZodString with export-ignore branding
 * ```
 */
export type ExportIgnored<T extends z.ZodTypeAny> = z.ZodBranded<T, typeof EXPORT_IGNORE_BRAND>
