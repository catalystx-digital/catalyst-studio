/**
 * Related Posts Component Definition
 *
 * Related posts section showing selected or automatically related articles.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { BlogPostItemSchema } from '../../_core/value-objects'

/**
 * Related Posts component definition
 */
export const RelatedPostsDef = defineComponent({
  type: ComponentType.RelatedPosts,
  category: ComponentCategory.Blog,

  // Zod schema (single source of truth for props)
  schema: z.object({
    title: z.string().optional().describe('Section title'),
    posts: z.array(BlogPostItemSchema).optional().describe('List of related blog card content items'),
    manualPosts: z.array(BlogPostItemSchema).optional().describe('Pinned related posts supplied by an editor'),
    displayMode: z.enum(['grid', 'list', 'carousel']).optional().describe('Display layout mode'),
    maxPosts: z.number().optional().describe('Maximum number of posts to display'),
    showExcerpt: z.boolean().optional().describe('Show post excerpts'),
    showAuthor: z.boolean().optional().describe('Show author information'),
    showDate: z.boolean().optional().describe('Show publication date'),
    showReadingTime: z.boolean().optional().describe('Show reading time estimate'),
    showCategories: z.boolean().optional().describe('Show post categories'),
    selectionMode: z.enum(['manual', 'automatic']).optional().describe('How posts are selected'),
    relatedBy: z.enum(['categories', 'tags', 'both']).optional().describe('Criteria for automatic selection'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'related',
      'you may also like',
      'more articles',
      'similar posts',
      'recommended',
      'related posts',
      'related articles',
      'suggested reading',
      'more from',
      'you might like',
    ],
    patterns: [
      'related.*posts',
      'related.*articles',
      'similar.*posts',
      'recommended.*reading',
      'you.*may.*like',
      'more.*articles',
      'suggested.*posts',
    ],
    commonNames: [
      'RelatedPosts',
      'RelatedArticles',
      'SuggestedPosts',
      'RecommendedReading',
      'MoreArticles',
      'SimilarPosts',
    ],
    pageLocation: ['main', 'sidebar', 'footer'],
    confidence: 0.80,
    suggestedVariants: ['default', 'minimal', 'compact', 'expanded'],
    relatedComponents: [
      ComponentType.BlogCard,
      ComponentType.BlogList,
      ComponentType.BlogPost,
    ],
    industry: ['Publishing', 'Media', 'Technology', 'Business', 'Education'],
    semanticRole: 'complementary',
    accessibility: {
      ariaLabel: 'Related articles',
      role: 'complementary',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use related-posts for "related articles" or "you may also like" sections',
    'Extract: posts as array of blog-card components',
    'Extract: title from section heading (default: "Related Posts")',
    'Extract: displayMode from layout (grid, list, carousel)',
    'Extract: maxPosts from number of items shown',
    'Extract: visibility flags (showExcerpt, showAuthor, etc.) from card content',
    'CONTENT: Prefer automatic selection with manual override capability',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'You May Also Like',
    displayMode: 'grid',
    maxPosts: 3,
    showExcerpt: true,
    showAuthor: true,
    showDate: true,
    showReadingTime: true,
    showCategories: false,
    selectionMode: 'automatic',
    relatedBy: 'both',
  },

  // Human-readable description
  description: 'Related posts section showing selected or automatically related articles. Hybrid related content module that auto-suggests posts and supports editorial overrides.',
})

// Export inferred TypeScript type
export type RelatedPostsContent = z.infer<typeof RelatedPostsDef.schema>
