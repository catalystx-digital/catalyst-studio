/**
 * Content Feed Component Definition
 *
 * Dynamic provider-backed content feed that supports pinned items, sorting, and list or grid layouts.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { SmartLinkSchema, ImageSchema } from '../../_core/value-objects'

/**
 * Schema for content feed items (used for pinned items)
 */
const ContentItemSchema = z.object({
  title: z.string().describe('Content item title'),
  excerpt: z.string().optional().describe('Content excerpt or summary'),
  date: z.string().optional().describe('Publication date'),
  href: SmartLinkSchema.optional().describe('Link to full content (internal page or external URL)'),
  image: ImageSchema.optional().describe('Optional thumbnail image'),
  category: z.string().optional().describe('Content category'),
})

/**
 * Content Feed component definition
 */
export const ContentFeedDef = defineComponent({
  type: ComponentType.ContentFeed,
  category: ComponentCategory.Content,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().optional().describe('Section title for the content feed'),
    subheading: z.string().optional().describe('Supporting text displayed below the heading'),
    layout: z.enum(['list', 'card-grid']).optional().describe('Display as list or tile grid'),
    limit: z.number().optional().describe('Maximum items when pagination is disabled (default 10)'),
    pagination: z.object({
      enabled: z.boolean().optional(),
      pageSize: z.number().optional(),
      currentPage: z.number().optional(),
    }).optional().describe('Enable pagination with page size and current page'),
    sorting: z.object({
      field: z.string().optional(),
      direction: z.enum(['asc', 'desc']).optional(),
    }).optional().describe('Sorting configuration with field and direction'),
    source: z.object({
      contentTypes: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      categories: z.array(z.string()).optional(),
      ancestor: z.string().optional(),
      path: z.string().optional(),
      locale: z.string().optional(),
      site: z.string().optional(),
    }).describe('Provider query configuration including contentTypes, tags/categories, ancestor/path scope, and locale/site scoping'),
    pinned: z.array(ContentItemSchema).optional().describe('Pinned curated items rendered ahead of provider results with deduplication'),
    emptyCopy: z.string().optional().describe('Custom message for empty feeds'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'news',
      'news section',
      'news feed',
      'latest news',
      'recent news',
      'news articles',
      'blog',
      'blog feed',
      'blog posts',
      'latest posts',
      'recent posts',
      'articles',
      'article list',
      'article feed',
      'announcements',
      'updates',
      'whats new',
      'content feed',
      'listing',
      'resource feed',
    ],
    patterns: [
      'class.*news',
      'class.*latest-news',
      'class.*news-feed',
      'class.*news-section',
      'class.*blog-posts',
      'class.*article-list',
      'id.*news',
      'data-news',
    ],
    commonNames: [
      'NewsFeed',
      'NewsSection',
      'LatestNews',
      'BlogFeed',
      'BlogPosts',
      'ArticleFeed',
      'ArticleList',
      'ContentFeed',
      'Announcements',
    ],
    pageLocation: ['main'],
    confidence: 0.92,
    relatedComponents: [ComponentType.CardGrid, ComponentType.BlogList],
    industry: ['general', 'news', 'blog', 'corporate'],
    semanticRole: 'content-display',
    accessibility: {
      ariaLabel: 'Content feed',
      role: 'list',
    },
  },

  // LLM extraction directives
  directives: [
    '*** PRIORITY SELECTION: Use content-feed (NOT card-grid) for any section that displays news articles, blog posts, announcements, updates, or chronologically-ordered content listings. ***',
    'Content-feed is the CORRECT component for:',
    '  - "Latest News", "Recent News", "News & Updates" sections',
    '  - Blog post listings, article feeds, announcement boards',
    '  - Any grid/list of items that link to article/post detail pages',
    '  - Content with dates, excerpts, "Read more" links, or chronological ordering',
    '  - Sections with titles like: News, Blog, Posts, Articles, Updates, Announcements, What\'s New',
    'Use card-grid ONLY for static feature/service/team/product cards WITHOUT chronological nature.',
    'Data requirements: Populate items[] with every visible article/post in DOM order. Each item MUST include:',
    '  - id: stable kebab-case identifier prefixed with "feed-item-" (e.g., "feed-item-school-holidays-2024")',
    '  - title: the article headline exactly as rendered',
    '  - href: the link URL to the article detail page',
    '  - excerpt: the summary/teaser text (if shown)',
    '  - image: { src, alt } for thumbnail images - MANDATORY when <img> exists in item markup',
    '  - date: publication date if displayed (ISO format or as rendered)',
    '  - category: category/tag label if shown',
    '*** IMAGE EXTRACTION: For EVERY feed item, scan for <img> tags and extract the URL into image.src. Do NOT omit images when they exist in the DOM. ***',
    'For imported/static content, populate items[] directly. The source field is optional and only needed for dynamic provider queries.',
    'Never return content-feed with empty items[] when the section displays articles. Re-fetch and populate every visible item.',
    'Example payload for a news section:',
    '  {',
    '    "heading": "Latest News",',
    '    "layout": "card-grid",',
    '    "items": [',
    '      {',
    '        "id": "feed-item-community-event-2024",',
    '        "title": "Community Event Announced for March",',
    '        "href": "/news/community-event-2024",',
    '        "excerpt": "Join us for our annual community gathering...",',
    '        "image": { "src": "https://...", "alt": "Event banner" },',
    '        "date": "2024-02-15",',
    '        "category": "Events"',
    '      }',
    '    ],',
    '    "limit": 6',
    '  }',
    'Section title heuristics: If the section heading contains any of these words, use content-feed: news, blog, posts, articles, updates, announcements, latest, recent, stories, press, media.',
    'Link pattern heuristics: If items link to paths containing /news/, /blog/, /article/, /post/, /story/, use content-feed.',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Latest News',
    subheading: 'Stay up to date with our latest announcements and updates',
    layout: 'card-grid',
    limit: 6,
    source: {
      contentTypes: ['news', 'blog-post'],
      tags: ['updates', 'announcements'],
    },
    pinned: [
      {
        title: 'Major Product Launch',
        excerpt: 'Introducing our newest innovation...',
        date: '2025-12-15',
        href: { type: 'internal', pageId: 'product-launch-news' },
      },
    ],
    sorting: {
      field: 'publishDate',
      direction: 'desc',
    },
  },

  // Human-readable description
  description: 'Dynamic provider-backed content feed that supports pinned items, sorting, and list or grid layouts.',

  // Processing rules for post-detection transformations
  processing: {
    contentFeedPromotion: {
      enabled: true,
      promotionPatterns: ['/news/', '/blog/', '/articles/'],
      sourceComponents: ['card-grid', 'blog-list', 'feature-grid'],
      minItems: 3,
      urlMatchRatio: 0.6
    }
  },
})

// Export inferred TypeScript type
export type ContentFeedContent = z.infer<typeof ContentFeedDef.schema>
