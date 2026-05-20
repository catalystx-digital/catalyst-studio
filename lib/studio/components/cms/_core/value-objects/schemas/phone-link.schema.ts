import { z } from 'zod'

/**
 * Schema for Phone Link
 * Used for tel: links in the CMS
 */
export const PhoneLinkSchema = z.object({
  /** Discriminator for union types */
  type: z.literal('phone').describe('Indicates this is a phone link'),
  /** The phone number (tel:+1234567890 or just the number) */
  href: z.string().describe('Phone number or tel: URL'),
  /** Optional display label for the link */
  label: z.string().optional().describe('Display text for the link'),
})

// Derived TypeScript type
export type PhoneLink = z.infer<typeof PhoneLinkSchema>
