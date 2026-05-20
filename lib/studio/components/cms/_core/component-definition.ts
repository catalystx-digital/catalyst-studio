/**
 * Component Definition System
 *
 * Provides a Zod-first approach to defining CMS components. All component metadata
 * (schema, detection, samples) lives in a single definition file with Zod as the
 * single source of truth.
 *
 * This replaces the old pattern of 3-4 files per component:
 * - *.propsmeta.ts → Zod schema
 * - *.ai.ts → detection field in definition
 * - *.types.ts → Generated from Zod schema
 * - canonical/*.ts → Not needed (Zod provides validation)
 *
 * @example
 * ```typescript
 * import { defineComponent } from '../../_core/component-definition'
 * import { ComponentType, ComponentCategory } from '../../_core/types'
 *
 * export const HeroWithImageDef = defineComponent({
 *   type: ComponentType.HeroWithImage,
 *   category: ComponentCategory.Heroes,
 *   schema: z.object({
 *     heading: z.string().describe('Primary headline'),
 *     subheading: z.string().optional()
 *   }),
 *   detection: {
 *     keywords: ['hero', 'image hero'],
 *     patterns: ['hero.*image']
 *   },
 *   sample: {
 *     heading: 'Transform Your Digital Experiences'
 *   }
 * })
 *
 * // Type is automatically inferred
 * export type HeroWithImageProps = z.infer<typeof HeroWithImageDef.schema>
 * ```
 */

import { z } from 'zod'
import { ComponentType, ComponentCategory, AIComponentMetadata, ComponentProcessingRules, ComponentNormalizationRules } from './types'
import { PropertyMeta, PropsMeta } from './propsmeta'

/**
 * Component detection metadata for AI-powered component matching
 */
export interface ComponentDetectionMetadata {
  /** Keywords that identify this component */
  keywords: string[]
  /** Regex patterns for component detection */
  patterns?: string[]
  /** Common names for this component */
  commonNames?: string[]
  /** Where this component typically appears on a page */
  pageLocation?: Array<'header' | 'hero' | 'main' | 'sidebar' | 'footer'>
  /** Confidence score for AI detection (0-1) */
  confidence?: number
  /** Related component types */
  relatedComponents?: ComponentType[]
  /** Industry-specific usage */
  industry?: string[]
  /** Semantic role for accessibility */
  semanticRole?: string
  /** Suggested visual variants */
  suggestedVariants?: string[]
  /** Accessibility metadata */
  accessibility?: {
    role?: string
    ariaLabel?: string
    ariaDescribedBy?: string
  }
}

/**
 * Complete component definition
 */
export interface ComponentDefinition<T extends z.ZodObject<any>> {
  /** Component type identifier */
  type: ComponentType
  /** Component category */
  category: ComponentCategory
  /** Zod schema defining component props (single source of truth) */
  schema: T
  /** Optional detection metadata for AI-powered matching */
  detection?: ComponentDetectionMetadata
  /** Optional LLM extraction directives */
  directives?: string[]
  /** Optional sample data for testing/demos */
  sample?: z.infer<T>
  /** Optional: Mark as sub-component only (cannot be top-level) */
  subOnly?: boolean
  /** Optional: Human-readable description */
  description?: string
  /** Optional: Type aliases for component type resolution (e.g., ['nav', 'navbar', 'navigation']) */
  aliases?: string[]
  /** Optional: Processing rules for post-processor pipeline (replaces hardcoded logic) */
  processing?: ComponentProcessingRules
  /** Optional: Normalization rules for component data transformation */
  normalization?: ComponentNormalizationRules
}

/**
 * Define a component with Zod-first metadata
 *
 * This helper provides type safety and a consistent API for defining components.
 * The Zod schema is the single source of truth - TypeScript types, PropsMeta,
 * and validation are all derived from it.
 *
 * @param def - Component definition object
 * @returns The same definition (for type inference)
 *
 * @example
 * ```typescript
 * export const MyComponentDef = defineComponent({
 *   type: ComponentType.MyComponent,
 *   category: ComponentCategory.Content,
 *   schema: z.object({
 *     title: z.string().describe('Component title'),
 *     description: z.string().optional().describe('Optional description')
 *   }),
 *   detection: {
 *     keywords: ['my-component', 'content'],
 *     confidence: 0.9
 *   },
 *   directives: [
 *     'Extract title from h2 or h3 heading tags',
 *     'Use first paragraph for description if not explicitly provided'
 *   ],
 *   sample: {
 *     title: 'Sample Title'
 *   }
 * })
 *
 * // Infer TypeScript type from schema
 * export type MyComponentProps = z.infer<typeof MyComponentDef.schema>
 * ```
 */
export function defineComponent<T extends z.ZodObject<any>>(
  def: ComponentDefinition<T>
): ComponentDefinition<T> {
  return def
}

/**
 * Convert a Zod schema to a type string representation for LLM prompts
 *
 * This function converts Zod schemas to type strings that match the format
 * expected by LLM prompts and other consumers needing string representations.
 *
 * Handles:
 * - Primitives: z.string() → 'string'
 * - Optionals: z.string().optional() → 'string' (optional handled separately)
 * - Enums: z.enum(['left', 'center']) → "'left' | 'center'"
 * - Arrays: z.array(z.string()) → 'Array<string>'
 * - Unions: z.union([z.string(), z.number()]) → 'string | number'
 * - Objects: z.object({...}) → 'object' (for MVP)
 * - Nullables: z.string().nullable() → 'string | null'
 * - Defaults: Unwraps to underlying type
 * - Registry Value Objects: Looks up registered name (e.g., CTAButtonSchema → 'CTAButton')
 *
 * @param schema - Zod schema to convert
 * @returns Type string representation
 *
 * @example
 * ```typescript
 * zodSchemaToTypeString(z.string()) // 'string'
 * zodSchemaToTypeString(z.enum(['left', 'center'])) // "'left' | 'center'"
 * zodSchemaToTypeString(z.array(z.string())) // 'Array<string>'
 * zodSchemaToTypeString(CTAButtonSchema) // 'CTAButton' (from registry)
 * ```
 */
export function zodSchemaToTypeString(schema: z.ZodTypeAny): string {
  // Import registry function at runtime to avoid circular dependency
  const { isRegisteredSchema, getRegisteredSchemaName } = require('./value-objects/registry-lookup')

  // Handle ZodOptional first - unwrap (optional marker handled separately in PropsMeta)
  if (schema instanceof z.ZodOptional) {
    return zodSchemaToTypeString(schema.unwrap())
  }

  // Handle ZodNullable - add null to union
  if (schema instanceof z.ZodNullable) {
    const innerType = zodSchemaToTypeString(schema.unwrap())
    return `${innerType} | null`
  }

  // Handle ZodDefault - unwrap to underlying type
  if (schema instanceof z.ZodDefault) {
    return zodSchemaToTypeString(schema._def.innerType)
  }

  // Primitives
  if (schema instanceof z.ZodString) {
    return 'string'
  }
  if (schema instanceof z.ZodNumber) {
    return 'number'
  }
  if (schema instanceof z.ZodBoolean) {
    return 'boolean'
  }

  // Enums - "'value1' | 'value2'"
  if (schema instanceof z.ZodEnum) {
    const values = (schema as z.ZodEnum<any>)._def.values
    return values.map((v: string) => `'${v}'`).join(' | ')
  }

  // Arrays - 'Array<innerType>' - check BEFORE registry lookup
  // This ensures array schemas (like ComponentListSchema) are correctly identified as arrays
  // even if they are registered in the value object registry
  if (schema instanceof z.ZodArray) {
    const elementType = zodSchemaToTypeString(schema.element)
    return `Array<${elementType}>`
  }

  // Check if this is a registered value object schema (for non-array schemas)
  if (isRegisteredSchema && typeof isRegisteredSchema === 'function') {
    const registeredName = isRegisteredSchema(schema)
    if (registeredName) {
      return registeredName
    }
  }

  // Unions - 'type1 | type2'
  if (schema instanceof z.ZodUnion) {
    const options = (schema as z.ZodUnion<any>)._def.options
    return options.map((opt: z.ZodTypeAny) => zodSchemaToTypeString(opt)).join(' | ')
  }

  // Objects - check if registered, otherwise return 'object'
  // Note: Inline component-specific schemas (like FooterColumnSchema, CardMetadataSchema)
  // are intentionally NOT registered and should be treated as 'object' (JSON string)
  if (schema instanceof z.ZodObject) {
    return 'object'
  }

  // Fallback
  return 'unknown'
}

/**
 * Convert component detection metadata to AIComponentMetadata format
 *
 * Maps the simplified ComponentDetectionMetadata to the full AIComponentMetadata
 * interface used by the component registry.
 *
 * @param detection - Detection metadata from component definition
 * @param type - Component type
 * @returns Full AIComponentMetadata object
 */
export function detectionToAIMetadata(
  detection: ComponentDetectionMetadata,
  type: ComponentType
): AIComponentMetadata {
  return {
    keywords: detection.keywords,
    patterns: detection.patterns || [],
    commonNames: detection.commonNames || [],
    pageLocation: detection.pageLocation || ['main'],
    confidence: detection.confidence || 0.8,
    relatedComponents: detection.relatedComponents,
    industry: detection.industry,
    semanticRole: detection.semanticRole,
    suggestedVariants: detection.suggestedVariants,
    accessibility: detection.accessibility
  }
}
