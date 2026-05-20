/**
 * Zod to Type String Converter
 *
 * Converts Zod schemas to LLM-friendly type strings that match the format
 * used in lib/studio/components/cms/_core/type-strings.ts
 *
 * Examples:
 * - z.string() → "string"
 * - z.number() → "number"
 * - z.boolean() → "boolean"
 * - z.optional(z.string()) → field becomes optional (adds "?" to field name)
 * - z.array(z.string()) → "Array<string>"
 * - z.object({ name: z.string(), age: z.number() }) → "{ name: string; age: number }"
 * - z.enum(['a', 'b']) → "'a'|'b'"
 * - z.literal('value') → "'value'"
 * - z.union([z.string(), z.number()]) → "string|number"
 * - z.lazy(() => schema) → expands once, marks recursive references as "(recursive)"
 */

import { z } from 'zod'

/**
 * Internal implementation with cycle detection
 *
 * @param schema - Zod schema to convert
 * @param seen - WeakSet tracking evaluated lazy schemas to detect cycles
 * @returns Type string in format matching type-strings.ts
 */
function zodToTypeStringInternal(
  schema: z.ZodTypeAny,
  seen: WeakSet<z.ZodTypeAny>
): string {
  // Handle ZodOptional - unwrap and mark as optional
  if (schema instanceof z.ZodOptional) {
    return zodToTypeStringInternal(schema.unwrap(), seen)
  }

  // Handle ZodNullable - unwrap (we treat nullable as optional)
  if (schema instanceof z.ZodNullable) {
    return zodToTypeStringInternal(schema.unwrap(), seen)
  }

  // Handle ZodDefault - unwrap and use inner type
  if (schema instanceof z.ZodDefault) {
    return zodToTypeStringInternal(schema._def.innerType, seen)
  }

  // Primitive types
  if (schema instanceof z.ZodString) {
    return 'string'
  }

  if (schema instanceof z.ZodNumber) {
    return 'number'
  }

  if (schema instanceof z.ZodBoolean) {
    return 'boolean'
  }

  if (schema instanceof z.ZodDate) {
    return 'Date'
  }

  if (schema instanceof z.ZodUndefined) {
    return 'undefined'
  }

  if (schema instanceof z.ZodNull) {
    return 'null'
  }

  if (schema instanceof z.ZodAny) {
    return 'any'
  }

  if (schema instanceof z.ZodUnknown) {
    return 'unknown'
  }

  // Array types - "Array<innerType>"
  if (schema instanceof z.ZodArray) {
    const itemType = zodToTypeStringInternal(schema.element, seen)
    return `Array<${itemType}>`
  }

  // Object types - "{ field: type; field2?: type2 }"
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>
    const fields = Object.entries(shape).map(([key, fieldSchema]) => {
      const isOptional =
        fieldSchema instanceof z.ZodOptional ||
        fieldSchema instanceof z.ZodNullable
      const typeStr = zodToTypeStringInternal(fieldSchema, seen)
      const optionalMarker = isOptional ? '?' : ''
      return `${key}${optionalMarker}: ${typeStr}`
    })

    return `{ ${fields.join('; ')} }`
  }

  // Record types - "Record<string, valueType>"
  if (schema instanceof z.ZodRecord) {
    const keyType = schema._def.keyType
      ? zodToTypeStringInternal(schema._def.keyType, seen)
      : 'string'
    const valueType = zodToTypeStringInternal(schema._def.valueType, seen)
    return `Record<${keyType}, ${valueType}>`
  }

  // Enum types - "'value1'|'value2'|'value3'"
  if (schema instanceof z.ZodEnum) {
    const values = schema._def.values as string[]
    return values.map((v) => `'${v}'`).join('|')
  }

  // Literal types - "'value'"
  if (schema instanceof z.ZodLiteral) {
    const value = schema._def.value
    if (typeof value === 'string') {
      return `'${value}'`
    }
    return String(value)
  }

  // Union types - "type1|type2|type3"
  if (schema instanceof z.ZodUnion) {
    const options = schema._def.options as z.ZodTypeAny[]
    return options.map((opt) => zodToTypeStringInternal(opt, seen)).join('|')
  }

  // Discriminated union - expand each option fully
  if (schema instanceof z.ZodDiscriminatedUnion) {
    const options = Array.from(schema.options.values()) as z.ZodTypeAny[]
    return options.map((opt) => zodToTypeStringInternal(opt, seen)).join('|')
  }

  // Intersection types - combine object types
  if (schema instanceof z.ZodIntersection) {
    const left = zodToTypeStringInternal(schema._def.left, seen)
    const right = zodToTypeStringInternal(schema._def.right, seen)

    // If both are objects, merge them
    if (left.startsWith('{') && right.startsWith('{')) {
      const leftFields = left.slice(2, -2).trim() // Remove "{ " and " }"
      const rightFields = right.slice(2, -2).trim()
      return `{ ${leftFields}; ${rightFields} }`
    }

    // Otherwise, use intersection notation (not common in our type strings)
    return `${left} & ${right}`
  }

  // Tuple types - "[type1, type2, type3]"
  if (schema instanceof z.ZodTuple) {
    const items = schema._def.items as z.ZodTypeAny[]
    const types = items.map((item) => zodToTypeStringInternal(item, seen))
    return `[${types.join(', ')}]`
  }

  // Lazy types - expand once, detect cycles to prevent infinite recursion
  if (schema instanceof z.ZodLazy) {
    // Track the ZodLazy wrapper itself, not the evaluated result
    // This handles cases like z.lazy(() => MenuItemSchema) where the getter
    // returns the same schema reference each time
    if (seen.has(schema)) {
      return '(recursive)'
    }

    // Mark this lazy wrapper as seen before evaluating
    seen.add(schema)
    const inner = schema._def.getter()
    return zodToTypeStringInternal(inner, seen)
  }

  // Effects (transform, refine, etc.) - unwrap to base type
  if (schema instanceof z.ZodEffects) {
    return zodToTypeStringInternal(schema._def.schema, seen)
  }

  // Branded types - use the underlying type
  if (schema instanceof z.ZodBranded) {
    return zodToTypeStringInternal(schema.unwrap(), seen)
  }

  // Catch types - use the inner type
  if (schema instanceof z.ZodCatch) {
    return zodToTypeStringInternal(schema._def.innerType, seen)
  }

  // Pipeline types - use the output type
  if (schema instanceof z.ZodPipeline) {
    return zodToTypeStringInternal(schema._def.out, seen)
  }

  // Fallback for unknown types
  return 'unknown'
}

/**
 * Convert a Zod schema to an LLM-friendly type string
 *
 * @param schema - Zod schema to convert
 * @returns Type string in format matching type-strings.ts
 */
export function zodToTypeString(schema: z.ZodTypeAny): string {
  return zodToTypeStringInternal(schema, new WeakSet())
}
