import { z } from 'zod'

/**
 * Schema for Author value object
 * Used in: BlogPost, AuthorBio, Articles
 */
export const AuthorSchema = z.object({
  /** Author name */
  name: z.string().optional().describe('Author full name'),
  /** Profile photo URL */
  avatar: z.string().optional().describe('Author avatar image'),
  /** Author bio/description */
  bio: z.string().optional().describe('Author biography'),
  /** Author job title */
  title: z.string().optional().describe('Author job title'),
  /** Author profile page URL */
  url: z.string().optional().describe('Author profile URL'),
})

// Derived TypeScript type
export type Author = z.infer<typeof AuthorSchema>
