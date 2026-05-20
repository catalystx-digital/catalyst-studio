/**
 * Zod Schema Utilities
 *
 * Provides clean, public API-based utilities for working with Zod schemas,
 * particularly for handling ZodLazy (recursive schemas) and unwrapping wrappers.
 *
 * Uses Zod's public `.schema` property for ZodLazy instead of internal `_def.getter()`.
 *
 * @see https://zod.dev/api - Zod documentation
 */

import { z, type ZodTypeAny } from 'zod'

/**
 * Unwraps a Zod schema to get its "inner" or "core" type.
 *
 * Handles:
 * - ZodLazy: Uses `.schema` property (public API) to get the inner schema
 * - ZodOptional: Uses `.unwrap()` to get the non-optional type
 * - ZodNullable: Uses `.unwrap()` to get the non-nullable type
 * - ZodDefault: Uses `.removeDefault()` to get the base schema
 * - ZodEffects (refine/transform): Uses `.innerType()` to get the base schema
 * - ZodBranded: Uses `.unwrap()` to get the base schema
 * - ZodReadonly: Uses `.unwrap()` to get the base schema
 * - ZodCatch: Uses `.removeCatch()` to get the base schema
 * - ZodPipeline: Uses `.in` to get the input schema
 *
 * @param schema - Any Zod schema
 * @param deep - If true, recursively unwraps all layers (default: true)
 * @returns The innermost/unwrapped schema
 */
export function unwrapZodSchema(schema: ZodTypeAny, deep = true): ZodTypeAny {
  let current = schema

  const unwrapOnce = (s: ZodTypeAny): ZodTypeAny => {
    // ZodLazy - use public .schema property
    if (s instanceof z.ZodLazy) {
      return s.schema
    }

    // ZodOptional - use .unwrap()
    if (s instanceof z.ZodOptional) {
      return s.unwrap()
    }

    // ZodNullable - use .unwrap()
    if (s instanceof z.ZodNullable) {
      return s.unwrap()
    }

    // ZodDefault - use .removeDefault()
    if (s instanceof z.ZodDefault) {
      return s.removeDefault()
    }

    // ZodEffects (refine/transform) - use .innerType()
    if (s instanceof z.ZodEffects) {
      return s.innerType()
    }

    // ZodBranded - use .unwrap()
    if (s instanceof z.ZodBranded) {
      return s.unwrap()
    }

    // ZodReadonly - use .unwrap()
    if (s instanceof z.ZodReadonly) {
      return s.unwrap()
    }

    // ZodCatch - use .removeCatch()
    if (s instanceof z.ZodCatch) {
      return s.removeCatch()
    }

    // ZodPipeline - use .in for input schema
    if (s instanceof z.ZodPipeline) {
      return s._def.in
    }

    // No wrapper found, return as-is
    return s
  }

  if (!deep) {
    return unwrapOnce(current)
  }

  // Deep unwrap - keep going until we can't unwrap anymore
  let prev: ZodTypeAny | null = null
  while (prev !== current) {
    prev = current
    current = unwrapOnce(current)
  }

  return current
}

/**
 * Gets the shape (property schemas) of a ZodObject, handling ZodLazy wrappers.
 *
 * @param schema - Any Zod schema (will be unwrapped to find ZodObject)
 * @returns The shape record if it's a ZodObject, undefined otherwise
 */
export function getZodObjectShape(
  schema: ZodTypeAny
): Record<string, ZodTypeAny> | undefined {
  const unwrapped = unwrapZodSchema(schema)

  if (unwrapped instanceof z.ZodObject) {
    return unwrapped.shape as Record<string, ZodTypeAny>
  }

  return undefined
}

/**
 * Gets the element schema of a ZodArray.
 *
 * @param schema - Any Zod schema (will be unwrapped to find ZodArray)
 * @returns The element schema if it's a ZodArray, undefined otherwise
 */
export function getZodArrayElement(schema: ZodTypeAny): ZodTypeAny | undefined {
  const unwrapped = unwrapZodSchema(schema)

  if (unwrapped instanceof z.ZodArray) {
    return unwrapped.element
  }

  return undefined
}

/**
 * Checks if a schema is or contains a ZodObject (after unwrapping).
 *
 * @param schema - Any Zod schema
 * @returns True if the unwrapped schema is a ZodObject
 */
export function isZodObject(schema: ZodTypeAny): boolean {
  const unwrapped = unwrapZodSchema(schema)
  return unwrapped instanceof z.ZodObject
}

/**
 * Checks if a schema is or contains a ZodArray (after unwrapping).
 *
 * @param schema - Any Zod schema
 * @returns True if the unwrapped schema is a ZodArray
 */
export function isZodArray(schema: ZodTypeAny): boolean {
  const unwrapped = unwrapZodSchema(schema)
  return unwrapped instanceof z.ZodArray
}

/**
 * Checks if a schema is a ZodLazy (recursive schema).
 *
 * @param schema - Any Zod schema
 * @returns True if the schema is ZodLazy
 */
export function isZodLazy(schema: ZodTypeAny): boolean {
  return schema instanceof z.ZodLazy
}
