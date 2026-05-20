/**
 * Hero Slide Schema
 *
 * Represents a single slide in a hero carousel with heading, subheading,
 * body content, imagery, overlay settings, and call-to-action buttons.
 */

import { z } from 'zod'
import { CTAButtonSchema } from './cta-button.schema'
import { ImageSchema } from './image.schema'

/**
 * Hero slide overlay schema
 */
export const HeroSlideOverlaySchema = z.object({
  color: z.string().optional().describe('Overlay color (hex/rgba)'),
  opacity: z.number().optional().describe('Overlay opacity (0-1)'),
  gradient: z.string().optional().describe('CSS gradient overlay'),
})

/**
 * Hero slide schema
 */
export const HeroSlideSchema = z.object({
  id: z.string().optional().describe('Unique identifier for the slide'),
  heading: z.string().optional().describe('Primary headline for the slide'),
  subheading: z.string().optional().describe('Supporting statement below heading'),
  eyebrow: z.string().optional().describe('Small text above heading'),
  kicker: z.string().optional().describe('Alternative eyebrow text'),
  body: z.string().optional().describe('Main body content'),
  summary: z.string().optional().describe('Alternative to body text'),
  description: z.string().optional().describe('Alternative description field'),
  theme: z.enum(['light', 'dark', 'auto']).optional().describe('Color theme for slide content'),
  alignment: z.enum(['left', 'center', 'right']).optional().describe('Horizontal alignment of slide content'),
  backgroundColor: z.string().optional().describe('Background color for the slide'),
  image: ImageSchema.optional().describe('Background image for the slide'),
  overlay: HeroSlideOverlaySchema.optional().describe('Image overlay settings'),
  ctaButtons: z.array(CTAButtonSchema).optional().describe('Call-to-action buttons for the slide'),
  analyticsId: z.string().optional().describe('Analytics tracking identifier'),
})

export type HeroSlideOverlay = z.infer<typeof HeroSlideOverlaySchema>
export type HeroSlide = z.infer<typeof HeroSlideSchema>
