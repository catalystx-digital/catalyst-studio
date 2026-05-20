import { z } from 'zod'

/**
 * Schema for Tag value object
 * Used in: BlogPost, ContentFeed, Filters
 */
export const TagSchema = z.object({
  /** Tag display text */
  label: z.string().describe('Tag label'),
  /** URL-friendly slug */
  slug: z.string().optional().describe('URL slug'),
  /** Tag color (hex or named color) */
  color: z.string().optional().describe('Tag color'),
})

// Derived TypeScript type
export type Tag = z.infer<typeof TagSchema>
