import { z } from 'zod'

/**
 * Schema for Contact Info value object
 * Used in: ContactInfo component, Footer
 */
export const ContactInfoSchema = z.object({
  /** Primary email address */
  email: z.string().email().optional().describe('Email address'),
  /** Primary phone number */
  phone: z.string().optional().describe('Phone number'),
  /** Physical address */
  address: z.string().optional().describe('Street address'),
  /** Business hours description */
  hours: z.string().optional().describe('Operating hours'),
  /** Business name */
  businessName: z.string().optional().describe('Business or organization name'),
})

// Derived TypeScript type
export type ContactInfo = z.infer<typeof ContactInfoSchema>
