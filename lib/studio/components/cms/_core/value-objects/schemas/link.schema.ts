import { z } from 'zod'
import { SmartLinkSchema } from './smart-link.schema'

/**
 * Schema for Link value object
 * Used in: Navigation, Footer, ContentFeed, BlogPost
 */
export const LinkSchema = z.object({
  /** Structured link destination */
  href: SmartLinkSchema.optional().describe('externalUrl:Target URL'),
  /** Display text for the link */
  label: z.string().optional().describe('Link text label'),
  /** Whether the link opens in a new tab */
  external: z.boolean().optional().describe('Opens in new tab when true'),
  /** Explicit target attribute */
  target: z.enum(['_self', '_blank', '_parent', '_top']).optional().describe('Link target attribute'),
}).strict()

// Derived TypeScript type
export type Link = z.infer<typeof LinkSchema>
