import { z } from 'zod'

/**
 * Schema for Email Link
 * Used for mailto: links in the CMS
 */
export const EmailLinkSchema = z.object({
  /** Discriminator for union types */
  type: z.literal('email').describe('Indicates this is an email link'),
  /** The email address (mailto:x@y.com or just the email) */
  href: z.string().describe('Email address or mailto: URL'),
  /** Optional display label for the link */
  label: z.string().optional().describe('Display text for the link'),
})

// Derived TypeScript type
export type EmailLink = z.infer<typeof EmailLinkSchema>
