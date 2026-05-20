/**
 * Blog Card Component Definition
 *
 * Blog summary card with title, excerpt, author, dates, categories/tags, and stats.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { AuthorSchema, ImageSchema } from '../../_core/value-objects'

/**
 * Blog Card component definition
 */
export const BlogCardDef = defineComponent({
  type: ComponentType.BlogCard,
  category: ComponentCategory.Blog,

  // Zod schema (single source of truth for props)
  schema: z.object({
    title: z.string().describe('Blog post title'),
    excerpt: z.string().describe('Short summary or excerpt'),
    thumbnail: ImageSchema.optional().describe('Thumbnail image with alt text and metadata'),
    author: AuthorSchema.describe('Post author information'),
    publishDate: z.string().describe('Publication date'),
    updatedDate: z.string().optional().describe('Last updated date'),
    readingTime: z.number().optional().describe('Estimated reading time in minutes'),
    categories: z.array(z.string()).optional().describe('Post categories'),
    tags: z.array(z.string()).optional().describe('Post tags'),
    slug: z.string().describe('URL slug for the post'),
    featured: z.boolean().optional().describe('Featured post flag'),
    likes: z.number().optional().describe('Number of likes'),
    comments: z.number().optional().describe('Number of comments'),
    views: z.number().optional().describe('Number of views'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'article',
      'post',
      'blog entry',
      'news item',
      'story',
      'blog card',
      'article card',
      'post preview',
      'article preview',
      'blog preview',
    ],
    patterns: [
      'blog.*card',
      'article.*card',
      'post.*preview',
      'news.*item',
      'story.*card',
      'blog.*item',
      'article.*item',
    ],
    commonNames: [
      'BlogCard',
      'ArticleCard',
      'PostCard',
      'NewsCard',
      'BlogItem',
      'ArticlePreview',
    ],
    pageLocation: ['main', 'sidebar'],
    confidence: 0.80,
    suggestedVariants: ['default', 'minimal', 'detailed', 'compact'],
    relatedComponents: [
      ComponentType.BlogList,
      ComponentType.RelatedPosts,
    ],
    industry: ['Publishing', 'Media', 'Technology', 'Business', 'Education'],
    semanticRole: 'article',
    accessibility: {
      ariaLabel: 'Blog post preview',
      role: 'article',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use blog-card for blog post previews in listings or grids',
    'Extract: title from heading or link text',
    'Extract: excerpt from summary or description text',
    'Extract: thumbnail from preview image or featured image',
    'Extract: author including name and avatar',
    'Extract: publishDate from time element or date text',
    'Extract: readingTime from time indicator',
    'Extract: categories and tags from meta elements or links',
    'Extract: slug from post URL or link href',
    'Extract: stats (likes, comments, views) from engagement indicators',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'Getting Started with Next.js 14',
    excerpt: 'Learn how to build modern web applications with Next.js 14, featuring server components, improved routing, and enhanced performance.',
    thumbnail: '/images/blog/nextjs-14.jpg',
    author: {
      name: 'John Smith',
      avatar: '/images/authors/john.jpg',
      bio: 'Frontend Developer',
      url: '/authors/john-smith',
    },
    publishDate: '2024-03-10',
    readingTime: 5,
    categories: ['Web Development', 'React'],
    tags: ['Next.js', 'Server Components', 'Performance'],
    slug: 'getting-started-nextjs-14',
    featured: true,
    likes: 142,
    comments: 23,
    views: 3450,
  },

  // Human-readable description
  description: 'Blog summary card with title, excerpt, author, dates, categories/tags, and stats.',
})

// Export inferred TypeScript type
export type BlogCardContent = z.infer<typeof BlogCardDef.schema>
