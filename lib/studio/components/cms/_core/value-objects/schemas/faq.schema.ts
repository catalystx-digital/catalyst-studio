import { z } from 'zod'

/**
 * Schema for FAQ value object
 * Used in: FAQAccordion, FAQSection
 */
export const FAQSchema = z.object({
  /** Question text */
  question: z.string().describe('FAQ question'),
  /** Answer text or HTML (RichText) */
  answer: z.string().describe('FAQ answer'),
  /** Optional category for grouping */
  category: z.string().optional().describe('FAQ category'),
})

// Derived TypeScript type
export type FAQ = z.infer<typeof FAQSchema>
