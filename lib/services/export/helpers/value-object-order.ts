/**
 * Value Object Creation Order Helper
 *
 * Computes topological sort order for value object schemas based on their
 * dependencies. Ensures that schemas are created in the correct order during
 * export (dependencies before dependents).
 *
 * Uses Kahn's algorithm for topological sorting with cycle detection.
 */

import { z } from 'zod'
import {
  getAllRegisteredSchemas,
  isRegisteredSchema,
} from '@/lib/studio/components/cms/_core/value-objects/registry-lookup'
import { type ValueObjectName } from '@/lib/studio/components/cms/_core/value-objects/registry'

/**
 * Value object definition with creation order
 */
export interface ValueObjectDefinition {
  schema: z.ZodTypeAny
  name: ValueObjectName
  creationOrder: number
}

/**
 * Unwrap Zod schema wrappers to get the base schema
 * Handles: ZodEffects (.describe()), ZodOptional, ZodNullable, ZodDefault
 *
 * @param schema - Zod schema to unwrap
 * @returns Unwrapped base schema
 */
function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodEffects) {
    return unwrapSchema(schema._def.schema)
  }
  if (schema instanceof z.ZodOptional) {
    return unwrapSchema(schema._def.innerType)
  }
  if (schema instanceof z.ZodNullable) {
    return unwrapSchema(schema._def.innerType)
  }
  if (schema instanceof z.ZodDefault) {
    return unwrapSchema(schema._def.innerType)
  }
  return schema
}

/**
 * Extract all registered schema dependencies from a Zod schema
 *
 * Walks the schema tree to find all referenced registered schemas.
 * Handles: ZodObject, ZodArray, ZodUnion, ZodDiscriminatedUnion, ZodOptional, ZodNullable
 * SKIPS: ZodLazy (self-references, not external dependencies)
 *
 * @param schema - Zod schema to analyze
 * @param rootSchema - The root schema being analyzed (to exclude self-references)
 * @returns Array of dependency names (ValueObjectName)
 */
export function extractSchemaDependencies(schema: z.ZodTypeAny): ValueObjectName[] {
  const dependencies = new Set<ValueObjectName>()
  const visited = new WeakSet<z.ZodTypeAny>()
  const rootSchema = unwrapSchema(schema) // Track unwrapped root to exclude self-references

  function walk(s: z.ZodTypeAny, isRoot: boolean = false): void {
    // Prevent infinite recursion
    if (visited.has(s)) return
    visited.add(s)

    // Unwrap wrappers first
    const unwrapped = unwrapSchema(s)

    // Check if this is a registered schema (dependency)
    const registeredName = isRegisteredSchema(unwrapped)
    if (registeredName) {
      // Only add if this is NOT the root schema itself (avoid self-reference)
      if (!isRoot && unwrapped !== rootSchema) {
        dependencies.add(registeredName)
      }
      // Don't walk into registered schemas (except root) - we only care about top-level references
      if (!isRoot) return
    }

    // Walk into composite types
    if (unwrapped instanceof z.ZodObject) {
      // Walk object shape
      const shape = unwrapped._def.shape()
      for (const key in shape) {
        walk(shape[key], false)
      }
    } else if (unwrapped instanceof z.ZodArray) {
      // Walk array element type
      walk(unwrapped._def.type, false)
    } else if (unwrapped instanceof z.ZodUnion) {
      // Walk union options
      for (const option of unwrapped._def.options) {
        walk(option, false)
      }
    } else if (unwrapped instanceof z.ZodDiscriminatedUnion) {
      // Walk discriminated union options
      for (const option of unwrapped._def.options) {
        walk(option, false)
      }
    } else if (unwrapped instanceof z.ZodLazy) {
      // SKIP ZodLazy - these are self-references (e.g., MenuItem.children: MenuItem[])
      // Not external dependencies, so don't walk into them
    }
    // For all other types (primitives, etc.), no dependencies to extract
  }

  walk(schema, true) // Start with isRoot=true
  return Array.from(dependencies)
}

/**
 * Compute creation order for all registered value objects using topological sort
 *
 * Uses Kahn's algorithm:
 * 1. Build dependency graph
 * 2. Start with nodes that have no dependencies (in-degree 0)
 * 3. Remove them from graph, update in-degrees
 * 4. Repeat until all nodes processed
 * 5. If nodes remain but all have dependencies → circular dependency
 *
 * @returns Array of ValueObjectDefinition sorted by creation order
 * @throws Error if circular dependency detected
 */
export function computeValueObjectCreationOrder(): ValueObjectDefinition[] {
  // Get all registered schemas
  const allSchemas = getAllRegisteredSchemas()

  // Build dependency graph
  const dependencyMap = new Map<ValueObjectName, ValueObjectName[]>()
  const inDegree = new Map<ValueObjectName, number>()

  // Initialize maps
  for (const [schema, name] of allSchemas) {
    const deps = extractSchemaDependencies(schema)
    dependencyMap.set(name, deps)
    inDegree.set(name, deps.length)
  }

  // Kahn's algorithm
  const result: ValueObjectDefinition[] = []
  const queue: ValueObjectName[] = []

  // Find all nodes with no dependencies (in-degree 0)
  for (const [name, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(name)
    }
  }

  // Process queue
  while (queue.length > 0) {
    const current = queue.shift()!
    const currentSchema = allSchemas.find(([, name]) => name === current)![0]

    // Add to result with creation order (index in result array)
    result.push({
      schema: currentSchema,
      name: current,
      creationOrder: result.length,
    })

    // Update in-degrees for dependents
    // Find all schemas that depend on current
    for (const [schema, name] of allSchemas) {
      const deps = dependencyMap.get(name)!
      if (deps.includes(current)) {
        const newDegree = inDegree.get(name)! - 1
        inDegree.set(name, newDegree)
        if (newDegree === 0) {
          queue.push(name)
        }
      }
    }
  }

  // Check for circular dependencies
  if (result.length !== allSchemas.length) {
    const remaining = allSchemas
      .map(([, name]) => name)
      .filter(name => !result.some(def => def.name === name))

    throw new Error(
      `Circular dependency detected in value object schemas. ` +
      `Remaining schemas: ${remaining.join(', ')}. ` +
      `Check dependencies: ${remaining.map(name =>
        `${name} -> [${dependencyMap.get(name)!.join(', ')}]`
      ).join('; ')}`
    )
  }

  return result
}
