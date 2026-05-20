import { z } from 'zod'

/**
 * Schema for Internal Page Reference
 * Used for links that point to pages within the CMS
 */
export const PageReferenceSchema = z.object({
  /** Discriminator for union types */
  type: z.literal('internal').describe('Indicates this is an internal page reference'),
  /** The ID of the page being referenced */
  pageId: z.string().describe('CMS page ID'),
  /** The URL path to the page */
  path: z.string().describe('Page URL path'),
  /** Optional display label for the link */
  label: z.string().optional().describe('Display text for the link'),
})

/**
 * Schema for External Link Reference
 * Used for links that point to external URLs
 */
export const ExternalLinkSchema = z.object({
  /** Discriminator for union types */
  type: z.literal('external').describe('Indicates this is an external link'),
  /** The external URL */
  url: z.string().url().describe('External URL (must be valid URL format)'),
  /** Optional display label for the link */
  label: z.string().optional().describe('Display text for the link'),
  /** Whether to open in a new tab */
  openInNewTab: z.boolean().optional().describe('Opens in new tab when true'),
})

// Derived TypeScript types
export type PageReference = z.infer<typeof PageReferenceSchema>
export type ExternalLink = z.infer<typeof ExternalLinkSchema>
