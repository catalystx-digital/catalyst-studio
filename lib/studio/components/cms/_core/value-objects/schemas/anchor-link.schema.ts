import { z } from 'zod'

/**
 * Schema for Anchor Link
 * Used for in-page anchor links (#section-id)
 */
export const AnchorLinkSchema = z.object({
  /** Discriminator for union types */
  type: z.literal('anchor').describe('Indicates this is an anchor link'),
  /** The anchor reference (#section-id) */
  href: z.string().describe('Anchor reference (e.g., #section-id)'),
  /** Optional display label for the link */
  label: z.string().optional().describe('Display text for the link'),
})

// Derived TypeScript type
export type AnchorLink = z.infer<typeof AnchorLinkSchema>
