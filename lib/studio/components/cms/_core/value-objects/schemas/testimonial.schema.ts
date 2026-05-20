import { z } from 'zod'

/**
 * Schema for Testimonial value object
 * Used in: TestimonialSlider, TestimonialGrid
 */
export const TestimonialSchema = z.object({
  /** Unique identifier */
  id: z.string().optional(),
  /** Testimonial quote text (supports RichText/HTML) */
  quote: z.string().describe('Testimonial quote'),
  /** Author name */
  author: z.string().describe('Person who gave testimonial'),
  /** Author job title */
  role: z.string().optional().describe('Job title or role'),
  /** Author company name */
  company: z.string().optional().describe('Company name'),
  /** Author avatar image URL */
  avatar: z.string().optional().describe('Profile photo URL'),
  /** Star rating (1-5) */
  rating: z.number().min(1).max(5).optional().describe('Rating out of 5'),
})

// Derived TypeScript type
export type Testimonial = z.infer<typeof TestimonialSchema>
