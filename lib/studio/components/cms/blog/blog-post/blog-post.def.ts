/**
 * Blog Post Component Definition
 *
 * Long-form article component combining hero details, rich body content, and author metadata.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { ImageSchema, AuthorSchema, BlogPostMetadataSchema, SmartLinkSchema } from '../../_core/value-objects'

/**
 * Related link schema
 */
const RelatedLinkSchema = z.object({
  label: z.string(),
  href: SmartLinkSchema,
})

/**
 * Blog Post component definition
 */
export const BlogPostDef = defineComponent({
  type: ComponentType.BlogPost,
  category: ComponentCategory.Blog,

  // Zod schema (single source of truth for props)
  schema: z.object({
    title: z.string().optional().describe('Article title'),
    subtitle: z.string().optional().describe('Article subtitle'),
    excerpt: z.string().optional().describe('Short summary or excerpt'),
    bodyHtml: z.string().describe('Rich text content body (HTML)'),
    bodyText: z.string().optional().describe('Plain text version of body'),
    sourceUrl: z.string().optional().describe('Original source URL if republished'),
    publishDate: z.string().optional().describe('Publication date'),
    updatedDate: z.string().optional().describe('Last updated date'),
    readingTime: z.string().optional().describe('Estimated reading time'),
    tags: z.array(z.string()).optional().describe('Article tags'),
    categories: z.array(z.string()).optional().describe('Article categories'),
    heroImage: ImageSchema.optional().describe('Hero image'),
    author: AuthorSchema.optional().describe('Article author'),
    relatedLinks: z.array(RelatedLinkSchema).optional().describe('Related resource links'),
    attachments: z.array(RelatedLinkSchema).optional().describe('Downloadable attachments'),
    metadata: BlogPostMetadataSchema.optional().describe('SEO and social metadata (structured)'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'blog post',
      'article detail',
      'news story',
      'press release',
      'case study',
      'long form content',
      'editorial',
    ],
    patterns: [
      'blog.*post',
      'article.*body',
      'story.*content',
      'news.*article',
      'press.*release',
      'case.*study',
      'longform',
      'rich.*text',
    ],
    commonNames: [
      'BlogPost',
      'ArticleBody',
      'StoryContent',
      'EditorialContent',
      'NewsArticle',
    ],
    pageLocation: ['main', 'sidebar', 'footer'],
    confidence: 0.93,
    suggestedVariants: ['default', 'detailed', 'minimal'],
    relatedComponents: [
      ComponentType.ArticleHeader,
      ComponentType.AuthorBio,
      ComponentType.RelatedPosts,
      ComponentType.CTAButtonGroup,
    ],
    industry: ['Retail', 'Publishing', 'Corporate', 'Education', 'Hospitality'],
    semanticRole: 'article',
    accessibility: {
      ariaLabel: 'Blog post content',
      role: 'article',
    },
  },

  // LLM extraction directives
  directives: [
    '*** Use blog-post for article detail pages, news stories, press releases, and long-form content pages. ***',
    'Data requirements: Extract the full article content including title, subtitle, excerpt, and complete body content.',
    'bodyHtml is REQUIRED: capture the entire article body as HTML, preserving paragraphs, headings, lists, links, and inline formatting.',
    'bodyText is optional: provide a plain-text version of the body content for search/preview purposes.',
    'Extract publishDate and updatedDate in ISO format (YYYY-MM-DD) when displayed.',
    'Populate categories[] and tags[] with all visible taxonomy labels.',
    'For hero images, populate heroImage with { src, alt, caption, dominantColor } when available.',
    'Author information should populate author with { name, title, avatar, bio, url }.',
    'Extract related links into relatedLinks[] with { label, url } objects.',
    'Attachments (PDFs, downloads) should populate attachments[] with { label, url }.',
    'sourceUrl should contain the original page URL for reference.',
    'Never return blog-post with empty bodyHtml when the page has article content.',
    'Example payload:',
    '  {',
    '    "title": "Community Partnership Announced",',
    '    "subtitle": "Local organizations join forces for new initiative",',
    '    "excerpt": "A new partnership aims to strengthen community ties...",',
    '    "bodyHtml": "<p>Opening paragraph...</p><h2>Background</h2><p>Details...</p>",',
    '    "publishDate": "2024-07-12",',
    '    "readingTime": "5 min read",',
    '    "categories": ["Community", "Partnerships"],',
    '    "tags": ["Local news"],',
    '    "heroImage": { "src": "https://...", "alt": "Partnership signing ceremony" },',
    '    "author": { "name": "Jane Smith", "title": "Community Reporter" }',
    '  }',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'Building Scalable Web Applications with Next.js',
    subtitle: 'A comprehensive guide to modern web development',
    excerpt: 'Learn how to build production-ready web applications using Next.js 14 and best practices for scalability.',
    bodyHtml: '<p>Next.js has revolutionized the way we build web applications...</p><h2>Getting Started</h2><p>First, install the latest version...</p>',
    publishDate: '2024-03-15',
    readingTime: '12 minutes',
    tags: ['Next.js', 'React', 'Web Development'],
    categories: ['Technology', 'Tutorial'],
    heroImage: {
      src: '/images/blog/nextjs-scalable.jpg',
      alt: 'Next.js application architecture',
    },
    author: {
      name: 'Alex Chen',
      avatar: '/images/authors/alex.jpg',
      bio: 'Full Stack Developer & Tech Lead',
      url: '/authors/alex-chen',
    },
    relatedLinks: [
      { label: 'Next.js Documentation', href: { type: 'external', url: 'https://nextjs.org/docs' } },
      { label: 'React Server Components', href: { type: 'external', url: 'https://react.dev/rsc' } },
    ],
  },

  // Human-readable description
  description: 'Long-form article component combining hero details, rich body content, and author metadata.',

  // Aliases for LLM canonicalization
  aliases: [
    'blogpost',
    'blogposts',
    'blog-article',
    'blogarticle',
    'article',
    'articlebody',
    'article-content',
    'articlecontent',
    'post',
    'news-article',
    'news-post',
    'article-post',
    'blog-post'
  ],
})

// Export inferred TypeScript type
export type BlogPostContent = z.infer<typeof BlogPostDef.schema>
