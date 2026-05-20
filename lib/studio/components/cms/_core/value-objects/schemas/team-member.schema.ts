import { z } from 'zod'
import { SocialLinkSchema } from './social-link.schema'

/**
 * Schema for Team Member value object
 * Used in: TeamGrid, TeamMember, AboutPage
 */
export const TeamMemberSchema = z.object({
  /** Unique identifier */
  id: z.string().optional(),
  /** Full name */
  name: z.string().describe('Team member name'),
  /** Job title */
  title: z.string().optional().describe('Job title'),
  /** Department name */
  department: z.string().optional().describe('Department'),
  /** Biography or description (RichText) */
  bio: z.string().optional().describe('Biography'),
  /** Profile photo */
  photo: z.string().optional().describe('Profile photo URL'),
  /** Photo alt text */
  photoAlt: z.string().optional().describe('Photo alt text'),
  /** Social media links */
  socialLinks: z.array(SocialLinkSchema).optional().describe('Social media profiles'),
  /** Email address */
  email: z.string().email().optional().describe('Email address'),
  /** Phone number */
  phone: z.string().optional().describe('Phone number'),
  /** LinkedIn profile URL */
  linkedin: z.string().optional().describe('LinkedIn URL'),
  /** Twitter handle or URL */
  twitter: z.string().optional().describe('Twitter handle or URL'),
  /** Profile page URL */
  profileUrl: z.string().optional().describe('Team member profile page'),
})

// Derived TypeScript type
export type TeamMember = z.infer<typeof TeamMemberSchema>
