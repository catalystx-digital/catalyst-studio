import { z } from 'zod'
import { ImageSchema } from './image.schema'
import { AuthorSchema } from './author.schema'

/**
 * Blog Post Item Schema
 *
 * Represents a blog post item for use in lists, grids, and related posts sections.
 * Used by BlogList and RelatedPosts components.
 *
 * @example
 * ```typescript
 * {
 *   title: "Community Event Announced",
 *   slug: "community-event",
 *   excerpt: "Join us for our annual gathering...",
 *   image: { src: "/blog/event.jpg", alt: "Event banner" },
 *   date: "2024-02-15",
 *   author: { name: "John Doe", role: "Editor" },
 *   category: "Events",
 *   tags: ["community", "annual-event"]
 * }
 * ```
 */
export const BlogPostItemSchema = z.object({
  title: z.string().optional().describe('Blog post title'),
  slug: z.string().optional().describe('URL-friendly slug for the post'),
  excerpt: z.string().optional().describe('Brief summary or preview text'),
  image: ImageSchema.optional().describe('Featured image for the post'),
  date: z.string().optional().describe('Publication date (ISO 8601 format)'),
  author: AuthorSchema.optional().describe('Post author information'),
  category: z.string().optional().describe('Primary category'),
  tags: z.array(z.string()).optional().describe('Associated tags'),
})

/**
 * Derived TypeScript type
 */
export type BlogPostItem = z.infer<typeof BlogPostItemSchema>
