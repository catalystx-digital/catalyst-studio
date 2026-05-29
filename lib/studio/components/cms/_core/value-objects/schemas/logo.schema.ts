import { z } from 'zod'
import { MediaReferenceSchema } from './media-reference.schema'

/**
 * Schema for Logo value object
 * Used in: NavBar, Footer, ContactInfo
 */
export const LogoSchema = z.object({
  /** Image source - MediaReference object from media library */
  src: MediaReferenceSchema.optional().describe('Logo image URL'),
  /** Alt text for accessibility */
  alt: z.string().optional().describe('Alternative text for screen readers'),
  /** Text to display if no image provided */
  text: z.string().optional().describe('Fallback text when no image'),
  /** Link destination when logo is clicked */
  href: z.string().optional().describe('URL to navigate when clicked'),
  /** Logo image width in pixels */
  width: z.number().nullable().optional().describe('Image width in pixels'),
  /** Logo image height in pixels */
  height: z.number().nullable().optional().describe('Image height in pixels'),
  /** Original source URL before CDN rewriting */
  originalUrl: z.string().optional().describe('Original URL before CDN processing'),
  /** Generated rendition variants */
  renditions: z.array(z.object({
    src: z.string().optional(),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
  })).optional().describe('Responsive image variants'),
})

// Derived TypeScript type
export type Logo = z.infer<typeof LogoSchema>
