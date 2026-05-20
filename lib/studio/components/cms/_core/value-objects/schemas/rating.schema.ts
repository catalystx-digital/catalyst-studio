import { z } from 'zod'

/**
 * Schema for Rating value object
 * Used in: Testimonials, Reviews, ProductCards
 */
export const RatingSchema = z.object({
  /** Rating value */
  value: z.number().min(0).describe('Rating value'),
  /** Maximum possible rating */
  max: z.number().min(1).optional().describe('Maximum rating (default 5)'),
  /** Whether to show count */
  showCount: z.boolean().optional().describe('Display review count'),
  /** Number of reviews/ratings */
  count: z.number().min(0).optional().describe('Total number of ratings'),
})

// Derived TypeScript type
export type Rating = z.infer<typeof RatingSchema>
