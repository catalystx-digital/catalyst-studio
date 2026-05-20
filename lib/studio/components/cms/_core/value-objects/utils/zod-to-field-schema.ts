/**
 * Zod to Field Schema Converter
 *
 * Converts Zod schemas to FieldSchema for the property editor system.
 * Maps Zod types to primitive field types and extracts metadata like
 * descriptions, defaults, and validation rules.
 *
 * Supports type hints via `.describe('typeHint:Label')` format to override
 * auto-detected types with specific editor types (richText, image, etc.).
 *
 * Handles recursive z.lazy() types by expanding them up to MAX_LAZY_DEPTH
 * levels to provide proper nested editors instead of JSON fallback.
 *
 * Examples:
 * - z.string() → { type: 'string' }
 * - z.string().describe('Name') → { type: 'string', label: 'Name' }
 * - z.string().describe('richText:Biography') → { type: 'richText', label: 'Biography' }
 * - z.object({ mediaId: z.string() }).describe('image:Hero Image') → { type: 'image', label: 'Hero Image' }
 * - z.array(z.any()).describe('componentArray:Sections') → { type: 'componentArray', label: 'Sections' }
 * - z.string().default('hello') → { type: 'string', defaultValue: 'hello' }
 * - z.number().min(0).max(100) → { type: 'number', min: 0, max: 100 }
 * - z.enum(['a', 'b']) → { type: 'select', options: [...] }
 * - z.array(z.string()) → { type: 'array', items: { type: 'string' } }
 * - z.object({ ... }) → { type: 'object', fields: [...] }
 * - z.lazy(() => Schema) → Expands up to 3 levels, then falls back to JSON
 */

import { z } from 'zod'
import type { FieldSchema, FieldType, SelectOption } from '@/lib/studio/components/site-builder/property-editor/schema/types'

/**
 * Maximum depth to expand z.lazy() recursive types.
 * Prevents infinite recursion while allowing reasonable nesting.
 * Value of 3 allows: parent → child → grandchild → JSON fallback
 */
const MAX_LAZY_DEPTH = 3

/** Track schemas currently being processed to detect circular references */
type ConversionContext = {
  lazyDepth: number
  processingSchemas: WeakSet<z.ZodTypeAny>
}

/**
 * Convert a Zod schema to a FieldSchema for property editor
 *
 * @param name - Field name (used as key in data object)
 * @param schema - Zod schema to convert
 * @param context - Optional context for tracking recursion depth
 * @returns FieldSchema configuration for property editor
 */
export function zodToFieldSchema(
  name: string,
  schema: z.ZodTypeAny,
  context?: ConversionContext
): FieldSchema {
  // Initialize context if not provided (top-level call)
  const ctx: ConversionContext = context ?? {
    lazyDepth: 0,
    processingSchemas: new WeakSet(),
  }
  const baseSchema: FieldSchema = {
    name,
    type: 'string', // Will be overridden below
  }

  // Extract description and parse type hint if present
  // Format: "typeHint:Label" → { typeHint: 'richText', label: 'Label' }
  const description = schema.description
  let typeHint: string | undefined
  if (description) {
    const hintMatch = description.match(/^(\w+):(.+)$/)
    if (hintMatch) {
      typeHint = hintMatch[1]
      baseSchema.label = hintMatch[2].trim()
    } else {
      baseSchema.label = description
    }
  }

  // Unwrap optional/nullable and mark as not required
  let workingSchema = schema
  let isOptional = false

  if (schema instanceof z.ZodOptional) {
    isOptional = true
    workingSchema = schema.unwrap()
  }

  if (workingSchema instanceof z.ZodNullable) {
    isOptional = true
    workingSchema = workingSchema.unwrap()
  }

  baseSchema.required = !isOptional

  // Extract default value if present
  if (workingSchema instanceof z.ZodDefault) {
    baseSchema.defaultValue = workingSchema._def.defaultValue()
    workingSchema = workingSchema._def.innerType
  }

  // Map Zod types to FieldSchema types
  // String types
  if (workingSchema instanceof z.ZodString) {
    baseSchema.type = 'string'

    // Extract string constraints
    const checks = workingSchema._def.checks || []
    for (const check of checks) {
      if (check.kind === 'min') {
        baseSchema.minLength = check.value
      } else if (check.kind === 'max') {
        baseSchema.maxLength = check.value
      } else if (check.kind === 'email') {
        baseSchema.type = 'email'
      } else if (check.kind === 'url') {
        baseSchema.type = 'externalUrl'
      } else if (check.kind === 'regex') {
        baseSchema.pattern = check.regex.source
      }
    }

    // Apply type hint override if present
    if (typeHint) {
      baseSchema.type = typeHint as FieldType
    }

    return baseSchema
  }

  // Number types
  if (workingSchema instanceof z.ZodNumber) {
    baseSchema.type = 'number'

    // Extract number constraints
    const checks = workingSchema._def.checks || []
    for (const check of checks) {
      if (check.kind === 'min') {
        baseSchema.min = check.value
      } else if (check.kind === 'max') {
        baseSchema.max = check.value
      } else if (check.kind === 'int') {
        baseSchema.type = 'integer'
      }
    }

    return baseSchema
  }

  // Boolean type
  if (workingSchema instanceof z.ZodBoolean) {
    baseSchema.type = 'boolean'
    return baseSchema
  }

  // Date type
  if (workingSchema instanceof z.ZodDate) {
    baseSchema.type = 'date'
    return baseSchema
  }

  // Enum types → select field
  if (workingSchema instanceof z.ZodEnum) {
    baseSchema.type = 'select'
    const values = workingSchema._def.values as string[]
    baseSchema.options = values.map(
      (value): SelectOption => ({
        label: value,
        value: value,
      })
    )
    return baseSchema
  }

  // Literal type → select with single option (or could use const field)
  if (workingSchema instanceof z.ZodLiteral) {
    const value = workingSchema._def.value
    baseSchema.type = 'select'
    baseSchema.options = [
      {
        label: String(value),
        value: value as string | number,
      },
    ]
    baseSchema.defaultValue = value
    return baseSchema
  }

  // Union types → select field (if all literals/enums)
  if (workingSchema instanceof z.ZodUnion) {
    const options = workingSchema._def.options as z.ZodTypeAny[]

    // Check if all union members are literals or enums
    const allLiterals = options.every(
      (opt) => opt instanceof z.ZodLiteral || opt instanceof z.ZodEnum
    )

    if (allLiterals) {
      baseSchema.type = 'select'
      const selectOptions: SelectOption[] = []

      for (const option of options) {
        if (option instanceof z.ZodLiteral) {
          const value = option._def.value
          selectOptions.push({
            label: String(value),
            value: value as string | number,
          })
        } else if (option instanceof z.ZodEnum) {
          const values = option._def.values as string[]
          for (const value of values) {
            selectOptions.push({
              label: value,
              value: value,
            })
          }
        }
      }

      baseSchema.options = selectOptions
      return baseSchema
    }

    // Non-literal union - check for type hint override before falling back to JSON
    // Type hints like 'image:Image URL' or 'externalUrl:Target URL' can override union → simple editor
    if (typeHint) {
      baseSchema.type = typeHint as FieldType
      return baseSchema
    }

    // Fallback: treat as JSON for complex unions without type hints
    baseSchema.type = 'json'
    baseSchema.description = 'Complex union type - edit as JSON'
    return baseSchema
  }

  // Discriminated union → JSON (too complex for simple editor)
  if (workingSchema instanceof z.ZodDiscriminatedUnion) {
    baseSchema.type = 'json'
    baseSchema.description = 'Discriminated union - edit as JSON'
    return baseSchema
  }

  // Array types
  if (workingSchema instanceof z.ZodArray) {
    baseSchema.type = 'array'

    // Extract array constraints
    const minLength = workingSchema._def.minLength
    const maxLength = workingSchema._def.maxLength

    if (minLength) {
      baseSchema.minItems = minLength.value
    }

    if (maxLength) {
      baseSchema.maxItems = maxLength.value
    }

    // Recursively convert item schema, passing context for depth tracking
    const itemSchema = workingSchema.element
    baseSchema.items = zodToFieldSchema('item', itemSchema, ctx)

    // Apply type hint override if present (e.g., componentArray)
    if (typeHint) {
      baseSchema.type = typeHint as FieldType
    }

    return baseSchema
  }

  // Object types
  if (workingSchema instanceof z.ZodObject) {
    baseSchema.type = 'object'

    const shape = workingSchema.shape as Record<string, z.ZodTypeAny>
    const fields: FieldSchema[] = []

    for (const [fieldName, fieldSchema] of Object.entries(shape)) {
      fields.push(zodToFieldSchema(fieldName, fieldSchema, ctx))
    }

    baseSchema.fields = fields

    // Apply type hint override if present (e.g., image, video, mediaReference, contentReference)
    if (typeHint) {
      baseSchema.type = typeHint as FieldType
    }

    return baseSchema
  }

  // Record types → JSON (no direct field editor for records)
  if (workingSchema instanceof z.ZodRecord) {
    baseSchema.type = 'json'
    baseSchema.description = 'Record type - edit as JSON'
    return baseSchema
  }

  // Tuple types → JSON (no direct field editor for tuples)
  if (workingSchema instanceof z.ZodTuple) {
    baseSchema.type = 'json'
    baseSchema.description = 'Tuple type - edit as JSON'
    return baseSchema
  }

  // Intersection types → JSON (complex type)
  if (workingSchema instanceof z.ZodIntersection) {
    baseSchema.type = 'json'
    baseSchema.description = 'Intersection type - edit as JSON'
    return baseSchema
  }

  // Lazy types - expand with depth tracking to provide proper nested editors
  if (workingSchema instanceof z.ZodLazy) {
    // Check if we've exceeded max depth for lazy expansion
    if (ctx.lazyDepth >= MAX_LAZY_DEPTH) {
      baseSchema.type = 'json'
      baseSchema.description = `Recursive type (depth ${ctx.lazyDepth}) - edit as JSON`
      return baseSchema
    }

    // Check for circular reference within the same expansion path
    if (ctx.processingSchemas.has(workingSchema)) {
      baseSchema.type = 'json'
      baseSchema.description = 'Circular reference - edit as JSON'
      return baseSchema
    }

    // Mark this schema as being processed
    ctx.processingSchemas.add(workingSchema)

    try {
      // Unwrap the lazy schema and convert with incremented depth
      const innerSchema = workingSchema._def.getter()
      const innerCtx: ConversionContext = {
        lazyDepth: ctx.lazyDepth + 1,
        processingSchemas: ctx.processingSchemas,
      }
      const result = zodToFieldSchema(name, innerSchema, innerCtx)
      // Preserve label from description if present
      if (baseSchema.label) {
        result.label = baseSchema.label
      }
      return result
    } finally {
      // Remove from processing set to allow same schema in different branches
      ctx.processingSchemas.delete(workingSchema)
    }
  }

  // Effects (transform, refine, etc.) - unwrap to base schema
  if (workingSchema instanceof z.ZodEffects) {
    return zodToFieldSchema(name, workingSchema._def.schema, ctx)
  }

  // Branded types - use the underlying schema
  if (workingSchema instanceof z.ZodBranded) {
    return zodToFieldSchema(name, workingSchema.unwrap(), ctx)
  }

  // Catch types - use the inner type
  if (workingSchema instanceof z.ZodCatch) {
    return zodToFieldSchema(name, workingSchema._def.innerType, ctx)
  }

  // Pipeline types - use the output schema
  if (workingSchema instanceof z.ZodPipeline) {
    return zodToFieldSchema(name, workingSchema._def.out, ctx)
  }

  // Any/Unknown types → JSON editor
  if (
    workingSchema instanceof z.ZodAny ||
    workingSchema instanceof z.ZodUnknown
  ) {
    baseSchema.type = 'json'
    return baseSchema
  }

  // Fallback for unknown types
  baseSchema.type = 'json'
  baseSchema.description = 'Unknown type - edit as JSON'
  return baseSchema
}
