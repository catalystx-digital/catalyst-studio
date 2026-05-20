/**
 * Timeline Event Schema
 *
 * Represents a single event in a timeline with date, title, description,
 * optional imagery, and actions.
 */

import { z } from 'zod'
import { ImageSchema } from './image.schema'
import { SmartLinkSchema } from './smart-link.schema'

/**
 * Timeline action schema
 */
export const TimelineActionSchema = z.object({
  text: z.string().describe('Action button text'),
  href: SmartLinkSchema.describe('Link destination'),
  variant: z.enum(['primary', 'secondary', 'link', 'accent', 'neutral', 'outline']).optional().describe('Button visual variant'),
})

/**
 * Timeline event schema
 */
export const TimelineEventSchema = z.object({
  id: z.string().describe('Unique event identifier'),
  date: z.union([z.date(), z.string()]).describe('Event date'),
  title: z.string().describe('Event title'),
  description: z.string().optional().describe('Event description'),
  icon: z.union([z.string(), z.function()]).optional().describe('Icon identifier or component'),
  type: z.enum(['milestone', 'event', 'achievement', 'default']).optional().describe('Event type classification'),
  link: z.object({
    text: z.string(),
    href: SmartLinkSchema,
  }).optional().describe('Optional link for the event'),
  image: ImageSchema.optional().describe('Optional event image'),
  actions: z.array(TimelineActionSchema).optional().describe('Call-to-action buttons for the event'),
})

export type TimelineAction = z.infer<typeof TimelineActionSchema>
export type TimelineEvent = z.infer<typeof TimelineEventSchema>
