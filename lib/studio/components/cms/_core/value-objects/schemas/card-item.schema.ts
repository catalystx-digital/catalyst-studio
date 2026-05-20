/**
 * CardItem Schema
 *
 * Represents an individual card in a grid with title, description, image, link, and optional icon.
 */

import { z } from 'zod'
import { ImageSchema } from './image.schema'
import { SmartLinkSchema } from './smart-link.schema'

/**
 * Schema for individual card items in the grid
 */
export const CardItemSchema = z.object({
  title: z.string().optional().describe('Card title'),
  description: z.string().optional().describe('Card description text'),
  image: ImageSchema.optional().describe('Card image with alt text and metadata'),
  href: SmartLinkSchema.optional().describe('Card link destination (internal page or external URL)'),
  icon: z.string().optional().describe('Card icon identifier'),
})

export type CardItem = z.infer<typeof CardItemSchema>
