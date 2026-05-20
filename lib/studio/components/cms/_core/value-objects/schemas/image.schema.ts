import { z } from 'zod'
import { MediaReferenceSchema } from './media-reference.schema'

/**
 * Schema for Image value object
 * Used in: HeroBanner, HeroWithImage, HeroSimple, CardItem, Gallery, BlogPost
 * Unifies HeroWithImageImage, HeroBannerBackgroundImage, CardMedia patterns
 *
 * @example
 * const image: Image = {
 *   src: { mediaId: 'media-123', mediaType: 'image', url: '...' },
 *   alt: "Example"
 * }
 */
export const ImageSchema = z.object({
  /** Image source - MediaReference object from media library */
  src: MediaReferenceSchema.optional().describe('image:Image URL'),
  /** Alt text for accessibility */
  alt: z.string().optional().describe('Alternative text for screen readers'),
  /** Image width in pixels */
  width: z.number().optional().describe('Image width'),
  /** Image height in pixels */
  height: z.number().optional().describe('Image height'),
  /** Original source URL before CDN rewriting */
  originalUrl: z.string().optional().describe('Original URL before CDN processing'),
  /** Media library ID reference */
  mediaId: z.string().optional().describe('Reference to media library item'),
  /** Generated rendition variants */
  renditions: z.array(z.object({
    src: z.string().optional(),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
  })).optional().describe('Responsive image variants'),
  /** Background position for hero images */
  backgroundPosition: z.enum(['center', 'top', 'bottom', 'left', 'right']).optional().describe('Image alignment'),
  /** Object fit mode */
  objectFit: z.enum(['cover', 'contain']).optional().describe('How image fits container'),
  /** Overlay color for hero images */
  overlayColor: z.string().optional().describe('Hex color for overlay'),
  /** Caption text for blog/gallery images */
  caption: z.string().optional().describe('Image caption'),
  /** Photo credit attribution */
  credit: z.string().optional().describe('Photo credit'),
  /** Dominant color for placeholders */
  dominantColor: z.string().optional().describe('Dominant color hex code'),
})

// Derived TypeScript type
export type Image = z.infer<typeof ImageSchema>
