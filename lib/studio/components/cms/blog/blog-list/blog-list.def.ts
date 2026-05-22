/**
 * Blog List Component Definition
 *
 * List or grid of blog posts with pagination, filters, and sorting options.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { BlogPostItemSchema, AutoFillSchema } from '../../_core/value-objects'

/**
 * Blog List component definition
 */
export const BlogListDef = defineComponent({
  type: ComponentType.BlogList,
  category: ComponentCategory.Blog,

  // Zod schema (single source of truth for props)
  schema: z.object({
    posts: z.array(BlogPostItemSchema).optional().describe('List of blog card content items'),
    manualPosts: z.array(BlogPostItemSchema).optional().describe('Pinned posts that should always appear before auto-filled results'),
    title: z.string().optional().describe('Section title'),
    description: z.string().optional().describe('Section description'),
    viewMode: z.enum(['grid', 'list']).optional().describe('Display mode for posts'),
    columns: z.number().int().min(1).max(4).optional().describe('Number of columns in grid mode (1-4)'),
    showPagination: z.boolean().optional().describe('Show pagination controls'),
    postsPerPage: z.number().optional().describe('Number of posts per page'),
    currentPage: z.number().optional().describe('Current page number'),
    totalPages: z.number().optional().describe('Total number of pages'),
    showFilters: z.boolean().optional().describe('Show category/tag filters'),
    selectedCategories: z.array(z.string()).optional().describe('Currently selected categories'),
    selectedTags: z.array(z.string()).optional().describe('Currently selected tags'),
    sortBy: z.enum(['date', 'popularity', 'readingTime']).optional().describe('Sort criteria'),
    sortOrder: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
    autoFill: AutoFillSchema.describe('Hint to load posts automatically when the curated list is incomplete'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'blog',
      'articles',
      'news',
      'posts',
      'latest articles',
      'blog posts',
      'article list',
      'news feed',
      'blog archive',
      'posts archive',
      'recent posts',
      'all posts',
    ],
    patterns: [
      'blog.*list',
      'article.*grid',
      'post.*archive',
      'news.*feed',
      'latest.*articles',
      'recent.*posts',
      'all.*blogs',
    ],
    commonNames: [
      'BlogList',
      'ArticleList',
      'PostArchive',
      'NewsFeed',
      'BlogGrid',
      'ArticleGrid',
    ],
    pageLocation: ['main', 'sidebar'],
    confidence: 0.85,
    suggestedVariants: ['default', 'minimal', 'detailed', 'compact'],
    relatedComponents: [
      ComponentType.BlogCard,
      ComponentType.ArticleHeader,
    ],
    industry: ['Publishing', 'Media', 'Technology', 'Business', 'Education'],
    semanticRole: 'article-list',
    accessibility: {
      ariaLabel: 'Blog posts list',
      role: 'feed',
    },
  },

  // LLM extraction directives
  directives: [
    '*** Use blog-list for blog index pages, news listing pages, article archives, and resource overviews. ***',
    'Data requirements: Populate posts[] (or manualPosts[] for pinned content) with blog-card child components for every visible article teaser.',
    'Each blog-card MUST include: id (prefixed "blog-card-<slug>"), title, excerpt, slug, publishDate (if shown), author object, categories[], tags[], and featured boolean.',
    'When the page displays article teasers in a grid or list format, extract each one into posts[] in DOM order.',
    'Section-level title and description should populate the top-level title/description fields.',
    'Set viewMode to "grid" or "list" based on the visual layout. Set columns to match the grid column count (2, 3, or 4).',
    'When pagination is visible, set showPagination=true and extract currentPage/totalPages/postsPerPage if available.',
    'If category or tag filters are shown, set showFilters=true and populate selectedCategories[]/selectedTags[] with active filter values.',
    'For auto-filled content, populate autoFill with { enabled: true, strategy: "latest"|"category"|"tag", desiredCount: N }.',
    'Never return blog-list with empty posts[] when the page displays article cards. Re-fetch the section until posts[] is populated.',
    'Example payload:',
    '  {',
    '    "title": "Latest News",',
    '    "description": "Stay updated with our recent announcements.",',
    '    "viewMode": "grid",',
    '    "columns": 3,',
    '    "posts": [',
    '      {',
    '        "type": "blog-card",',
    '        "id": "blog-card-community-event",',
    '        "title": "Community Event Announced",',
    '        "excerpt": "Join us for our annual gathering...",',
    '        "slug": "community-event",',
    '        "publishDate": "2024-02-15",',
    '        "categories": ["Events"],',
    '        "featured": true',
    '      }',
    '    ],',
    '    "showPagination": true,',
    '    "currentPage": 1,',
    '    "totalPages": 5',
    '  }',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'Latest Articles',
    description: 'Explore our collection of technical articles and tutorials',
    viewMode: 'grid',
    columns: 3,
    showPagination: true,
    postsPerPage: 9,
    currentPage: 1,
    totalPages: 5,
    showFilters: true,
    selectedCategories: ['Web Development'],
    sortBy: 'date',
    sortOrder: 'desc',
    autoFill: {
      enabled: true,
      strategy: 'latest',
      desiredCount: 9,
    },
  },

  // Human-readable description
  description: 'List or grid of blog posts with pagination, filters, and sorting options. Auto-filled blog feed with optional manual pins for editorial control.',

  // Aliases for LLM canonicalization
  aliases: [
    'bloglist',
    'blog-index',
    'article-list',
    'articlelist',
    'post-list',
    'news-list'
  ],
})

// Export inferred TypeScript type
export type BlogListContent = z.infer<typeof BlogListDef.schema>
