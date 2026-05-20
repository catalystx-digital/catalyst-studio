import { z } from 'zod'

/**
 * Schema for Category value object
 * Used in: BlogPost, ContentFeed, Navigation, Taxonomy
 */
export const CategorySchema = z.object({
  /** Category name */
  name: z.string().describe('Category name'),
  /** URL-friendly slug */
  slug: z.string().optional().describe('URL slug'),
  /** Category description */
  description: z.string().optional().describe('Category description'),
  /** Optional icon identifier */
  icon: z.string().optional().describe('Icon identifier'),
})

// Derived TypeScript type
export type Category = z.infer<typeof CategorySchema>
