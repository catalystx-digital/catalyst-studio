import { z } from 'zod'

/**
 * Schema for FooterNewsletter value object
 * Newsletter signup form configuration for the footer
 */
export const FooterNewsletterSchema = z.object({
  heading: z.string().describe('Newsletter section heading'),
  description: z.string().optional().describe('Newsletter description text'),
  placeholder: z.string().optional().describe('Email input placeholder'),
  buttonText: z.string().optional().describe('Submit button text'),
})

// Derived TypeScript type
export type FooterNewsletter = z.infer<typeof FooterNewsletterSchema>
