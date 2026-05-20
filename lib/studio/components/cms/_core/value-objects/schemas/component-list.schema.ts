import { z } from 'zod'

/**
 * Schema for ComponentInstance - minimal structure for content areas
 * Full ComponentInstance type is defined in lib/studio/types/site-builder/component-instance.ts
 * This is a simplified schema for validation within content areas
 */
const ComponentInstanceSchema = z.object({
  id: z.string().describe('Unique component identifier'),
  type: z.string().describe('Component type identifier'),
  category: z.string().optional().describe('Component category'),
  parentId: z.string().nullable().optional().describe('Parent component ID for hierarchy'),
  position: z.number().optional().describe('Order within parent container'),
  props: z.record(z.unknown()).optional().describe('Component-specific properties'),
  content: z.record(z.unknown()).optional().describe('Content data for the component'),
  styles: z.record(z.unknown()).optional().describe('Responsive styles for the component'),
  metadata: z.record(z.unknown()).optional().describe('Component metadata and flags'),
  globalComponentId: z.string().optional().describe('Reference to global component ID'),
  sharedComponentId: z.string().optional().describe('Shared component reference'),
})

/**
 * Schema for ComponentList value object
 * Used by components that need a simple array of component instances (not named slots).
 *
 * Example: TwoColumn's leftColumn/rightColumn, which are just arrays of components
 * without the named slot wrapper that ContentArea provides.
 *
 * Example:
 * ```typescript
 * [
 *   { id: 'c1', type: 'text-block', content: { heading: 'Title', body: 'Content' } },
 *   { id: 'c2', type: 'image', props: { src: '/img.jpg', alt: 'Photo' } }
 * ]
 * ```
 */
export const ComponentListSchema = z
  .array(ComponentInstanceSchema)
  .describe('Array of component instances')

// Derived TypeScript type
export type ComponentList = z.infer<typeof ComponentListSchema>
