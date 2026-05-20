import { z } from 'zod'
import { SmartLinkSchema } from './smart-link.schema'

/**
 * Schema for CTA Button value object
 * Used in: NavBar, HeroBanner, HeroWithImage, HeroVideo
 *
 * Standard fields: `label` for button text, `href` for destination URL.
 */
export const CTAButtonSchema = z.object({
  /** Button display label */
  label: z.string().describe('Button label (required)'),
  /**
   * Target URL for the button action
   * Supports both SmartLink objects (PageReference | ExternalLink) and raw strings for backwards compatibility
   */
  href: z.union([SmartLinkSchema, z.string()]).optional().describe('externalUrl:Destination URL'),
  /** Visual style variant for the button */
  variant: z.enum(['primary', 'secondary', 'outline']).optional().describe('Button style variant'),
  /** Optional icon or emoji shown with the label */
  icon: z.string().optional().describe('Icon identifier or emoji'),
  /** Whether the link opens in a new tab */
  external: z.boolean().optional().describe('Opens in new tab when true'),
})

// Derived TypeScript type
export type CTAButton = z.infer<typeof CTAButtonSchema>
