import { z } from 'zod'

/**
 * Schema for MediaReference value object
 * Used to reference media assets from the media library
 * Provides a lightweight reference with optional resolved metadata
 */
export const MediaReferenceSchema = z.object({
  /** Media asset ID from media library */
  mediaId: z.string().describe('Media library asset ID'),
  /** Type of media asset */
  mediaType: z.enum(['image', 'video', 'file']).describe('Type of media asset'),
  /** Resolved URL (may be computed from mediaId) */
  url: z.string().optional().describe('Resolved media URL'),
  /** Alt text for images */
  alt: z.string().optional().describe('Alternative text for accessibility'),
  /** Title attribute */
  title: z.string().optional().describe('Title text for tooltip'),
  /** Width in pixels (for images/videos) */
  width: z.number().optional().describe('Media width in pixels'),
  /** Height in pixels (for images/videos) */
  height: z.number().optional().describe('Media height in pixels'),
})

// Derived TypeScript type
export type MediaReference = z.infer<typeof MediaReferenceSchema>
