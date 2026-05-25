import { z } from 'zod'

/**
 * Schema for FAQ value object
 * Used in: FAQAccordion, FAQSection
 */
export const FAQSchema = z.object({
  /** Question text */
  question: z.string().trim().min(1, 'FAQ question must be non-empty').describe('FAQ question'),
  /** Answer text or HTML (RichText) */
  answer: z.string().trim().min(1, 'FAQ answer must be non-empty').describe('FAQ answer'),
  /** Optional category for grouping */
  category: z.string().optional().describe('FAQ category'),
})

// Derived TypeScript type
export type FAQ = z.infer<typeof FAQSchema>
