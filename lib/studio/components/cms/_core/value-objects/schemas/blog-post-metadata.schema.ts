import { z } from 'zod'

/**
 * Schema for BlogPost Metadata
 *
 * Structured metadata for blog posts including SEO, Open Graph, and Twitter Card fields.
 * Used in: BlogPost component
 */
export const BlogPostMetadataSchema = z.object({
  // SEO Fields
  /** SEO title (overrides main title if provided) */
  seoTitle: z.string().optional().describe('SEO-optimized title tag'),
  /** SEO meta description */
  seoDescription: z.string().optional().describe('SEO meta description'),
  /** SEO keywords (comma-separated or array) */
  seoKeywords: z.string().optional().describe('SEO keywords'),
  /** Canonical URL for duplicate content */
  canonicalUrl: z.string().optional().describe('Canonical URL'),

  // Open Graph (Facebook, LinkedIn, etc.)
  /** Open Graph title */
  ogTitle: z.string().optional().describe('Open Graph title'),
  /** Open Graph description */
  ogDescription: z.string().optional().describe('Open Graph description'),
  /** Open Graph image URL */
  ogImage: z.string().optional().describe('Open Graph image URL'),
  /** Open Graph type (article, website, etc.) */
  ogType: z.string().optional().describe('Open Graph type'),
  /** Open Graph URL */
  ogUrl: z.string().optional().describe('Open Graph URL'),

  // Twitter Card
  /** Twitter card type (summary, summary_large_image, etc.) */
  twitterCard: z.string().optional().describe('Twitter card type'),
  /** Twitter handle (@username) */
  twitterHandle: z.string().optional().describe('Twitter handle'),
  /** Twitter image URL (if different from og:image) */
  twitterImage: z.string().optional().describe('Twitter card image'),

  // Publishing Metadata
  /** Original publication date (ISO format) */
  publishedAt: z.string().optional().describe('Publication date'),
  /** Last updated date (ISO format) */
  updatedAt: z.string().optional().describe('Last updated date'),
  /** Article author name */
  author: z.string().optional().describe('Article author'),

  // Analytics & Engagement
  /** View count */
  viewCount: z.number().optional().describe('Number of views'),
  /** Like/upvote count */
  likeCount: z.number().optional().describe('Number of likes'),
  /** Comment count */
  commentCount: z.number().optional().describe('Number of comments'),
}).passthrough() // Allow additional fields for extensibility

// Derived TypeScript type
export type BlogPostMetadata = z.infer<typeof BlogPostMetadataSchema>
