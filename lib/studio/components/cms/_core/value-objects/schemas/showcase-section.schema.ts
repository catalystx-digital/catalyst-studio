/**
 * ShowcaseSection Schema
 *
 * Represents a section in a feature showcase with image, text, checklist, and CTA.
 */

import { z } from 'zod'
import { ImageSchema } from './image.schema'
import { SmartLinkSchema } from './smart-link.schema'

/**
 * Showcase Section Schema
 */
export const ShowcaseSectionSchema = z.object({
  image: ImageSchema.optional().describe('Section image with alt text and metadata'),
  title: z.string().optional().describe('Section title'),
  description: z.string().optional().describe('Section description'),
  checklist: z.array(z.string()).optional().describe('List of features or benefits'),
  cta: z.object({
    text: z.string().optional(),
    href: SmartLinkSchema.optional(),
  }).optional().describe('Optional call-to-action (internal page or external URL)'),
  layout: z.enum(['image-left', 'image-right']).optional().describe('Section layout orientation'),
})

export type ShowcaseSection = z.infer<typeof ShowcaseSectionSchema>
