import { z } from 'zod'

/**
 * Schema for Social Link value object
 * Used in: ContactInfo, Footer, TeamMember, AuthorBio
 */
export const SocialLinkSchema = z.object({
  /** Social media platform */
  platform: z.enum(['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'github', 'website']).describe('Social media platform'),
  /** Profile or page URL */
  url: z.string().describe('Social media URL'),
  /** Optional icon identifier */
  icon: z.string().optional().describe('Icon identifier'),
  /** Optional display label */
  label: z.string().optional().describe('Link label'),
})

// Derived TypeScript type
export type SocialLink = z.infer<typeof SocialLinkSchema>
