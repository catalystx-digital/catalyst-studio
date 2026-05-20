import { z } from 'zod'
import { ImageSchema } from './image.schema'
import { SmartLinkSchema } from './smart-link.schema'

/**
 * Feature Item Schema
 *
 * Represents a feature item for use in feature lists and grids.
 * Supports both title/description and heading/body naming conventions.
 * Used by FeatureList and FeatureGrid components.
 *
 * @example
 * ```typescript
 * {
 *   type: "feature-item",
 *   icon: "check",
 *   title: "Easy to Use",
 *   description: "Intuitive interface for everyone",
 *   link: {
 *     text: "Learn more",
 *     href: "/features/ease-of-use"
 *   },
 *   image: { src: "/icons/ease.svg", alt: "Easy to use icon" }
 * }
 * ```
 */
export const FeatureItemSchema = z.object({
  type: z.literal('feature-item').optional().describe('Literal type identifier'),
  icon: z.string().optional().describe('Icon identifier or image URL'),
  title: z.string().optional().describe('Feature title'),
  heading: z.string().optional().describe('Feature heading (alias for title)'),
  description: z.string().optional().describe('Feature description'),
  body: z.string().optional().describe('Feature body text (alias for description)'),
  link: z.object({
    text: z.string().optional(),
    href: SmartLinkSchema.optional(),
  }).optional().describe('Optional link with text and destination (internal page or external URL)'),
  image: ImageSchema.optional().describe('Optional image with alt text and metadata'),
})

/**
 * Derived TypeScript type
 */
export type FeatureItem = z.infer<typeof FeatureItemSchema>
