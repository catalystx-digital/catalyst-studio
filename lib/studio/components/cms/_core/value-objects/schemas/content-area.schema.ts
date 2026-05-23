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
})

/**
 * Schema for ContentArea value object
 * Used by components like Accordion and Tabs to define flexible content slots
 *
 * Content areas are named slots (e.g., "items", "panels") that contain arrays of component instances.
 * This allows components to have child components in a structured, type-safe way.
 *
 * Example:
 * ```typescript
 * {
 *   items: [
 *     { id: 'i1', type: 'accordion-item', content: { title: 'A', content: 'A1' } },
 *     { id: 'i2', type: 'accordion-item', content: { title: 'B', content: 'B1' } }
 *   ]
 * }
 * ```
 */
export const ContentAreaSchema = z.record(
  z.string(),
  z.array(ComponentInstanceSchema)
).describe('Named content slots containing component instances')

// Derived TypeScript type
export type ContentArea = z.infer<typeof ContentAreaSchema>
