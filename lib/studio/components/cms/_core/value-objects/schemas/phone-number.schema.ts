import { z } from 'zod'

/**
 * Schema for Phone Number value object
 * Used in: ContactInfo, TeamMember, ContactForm
 */
export const PhoneNumberSchema = z.object({
  /** Phone number string */
  number: z.string().describe('Phone number'),
  /** Type of phone number */
  type: z.enum(['mobile', 'office', 'home', 'fax', 'main', 'sales', 'support']).optional().describe('Phone type'),
  /** Display label */
  label: z.string().optional().describe('Label (e.g., "Main", "Sales")'),
})

// Derived TypeScript type
export type PhoneNumber = z.infer<typeof PhoneNumberSchema>
