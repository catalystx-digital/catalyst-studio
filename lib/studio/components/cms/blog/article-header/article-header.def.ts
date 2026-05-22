/**
 * Article Header Component Definition
 *
 * Article header with title, author, dates, categories/tags, and optional featured image.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { AuthorSchema, ImageSchema, LinkSchema } from '../../_core/value-objects'

/**
 * Article Header component definition
 */
export const ArticleHeaderDef = defineComponent({
  type: ComponentType.ArticleHeader,
  category: ComponentCategory.Blog,


  // Aliases for component type resolution
  aliases: [
    'articleheader',
  ],
  // Zod schema (single source of truth for props)
  schema: z.object({
    title: z.string().describe('Article title'),
    subtitle: z.string().optional().describe('Optional article subtitle'),
    author: AuthorSchema.describe('Article author information'),
    publishDate: z.string().describe('Publication date'),
    updatedDate: z.string().optional().describe('Last updated date'),
    readingTime: z.number().optional().describe('Estimated reading time in minutes'),
    categories: z.array(z.string()).optional().describe('Article categories'),
    tags: z.array(z.string()).optional().describe('Article tags'),
    featuredImage: ImageSchema.optional().describe('Featured header image'),
    shareButtons: z.boolean().optional().describe('Show social share buttons'),
    breadcrumbs: z.array(LinkSchema).optional().describe('Breadcrumb navigation links'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'article title',
      'post header',
      'blog header',
      'headline',
      'article heading',
      'post title',
      'blog title',
      'article meta',
      'post metadata',
      'article info',
    ],
    patterns: [
      'article.*header',
      'post.*header',
      'blog.*header',
      'article.*title',
      'post.*title',
      'headline',
      'article.*heading',
    ],
    commonNames: [
      'ArticleHeader',
      'PostHeader',
      'BlogHeader',
      'ArticleTitle',
      'PostTitle',
      'ArticleHeading',
    ],
    pageLocation: ['hero', 'main'],
    confidence: 0.75,
    suggestedVariants: ['default', 'minimal', 'detailed', 'expanded'],
    relatedComponents: [
      ComponentType.AuthorBio,
      ComponentType.BlogPost,
    ],
    industry: ['Publishing', 'Media', 'Technology', 'Business', 'Education'],
    semanticRole: 'banner',
    accessibility: {
      ariaLabel: 'Article header',
      role: 'banner',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use article-header for blog post headers with title, author, and metadata',
    'Extract: title from h1 tag, subtitle from h2 or paragraph',
    'Extract: author information including name, avatar, and bio link',
    'Extract: publishDate and updatedDate from time elements or meta tags',
    'Extract: categories and tags from links or meta elements',
    'Extract: featuredImage from hero image or first large image',
    'NEVER nest article-header components - must be top-level section',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'The Future of Web Development in 2025',
    subtitle: 'Exploring emerging trends and technologies',
    author: {
      name: 'Sarah Johnson',
      avatar: '/images/authors/sarah.jpg',
      bio: 'Senior Developer & Tech Writer',
      url: '/authors/sarah-johnson',
    },
    publishDate: '2024-01-15',
    updatedDate: '2024-02-20',
    readingTime: 8,
    categories: ['Technology', 'Web Development'],
    tags: ['React', 'Next.js', 'Performance'],
    featuredImage: {
      src: { mediaId: 'sample-web-dev-2025', mediaType: 'image', url: '/images/blog/web-dev-2025.jpg' },
      alt: 'Modern web development workspace',
      originalUrl: '/images/blog/web-dev-2025.jpg',
    },
    shareButtons: true,
    breadcrumbs: [
      { label: 'Home', href: { type: 'internal', pageId: 'home', path: '/' } },
      { label: 'Blog', href: { type: 'internal', pageId: 'blog', path: '/blog' } },
      { label: 'Technology', href: { type: 'internal', pageId: 'blog-technology', path: '/blog/technology' } },
    ],
  },

  // Human-readable description
  description: 'Article header with title, author, dates, categories/tags, and optional featured image.',
})

// Export inferred TypeScript type
export type ArticleHeaderContent = z.infer<typeof ArticleHeaderDef.schema>
