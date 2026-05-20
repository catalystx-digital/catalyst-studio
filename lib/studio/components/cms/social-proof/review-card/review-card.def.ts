/**
 * Review Card Component Definition
 *
 * Individual review with rating, author, date, and optional platform metadata.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { RatingSchema } from '../../_core/value-objects'

/**
 * Helpful votes schema
 */
const HelpfulVotesSchema = z.object({
  yes: z.number().describe('Number of helpful votes'),
  no: z.number().describe('Number of not helpful votes'),
})

/**
 * Review Card component definition
 */
export const ReviewCardDef = defineComponent({
  type: ComponentType.Reviews,
  category: ComponentCategory.SocialProof,

  // Zod schema (single source of truth for props)
  schema: z.object({
    rating: z.union([RatingSchema, z.number()]).describe('Star rating or rating object'),
    reviewText: z.string().describe('The review content text'),
    author: z.string().describe('Name of the reviewer'),
    date: z.union([z.date(), z.string()]).describe('Review date'),
    verified: z.boolean().optional().describe('Whether this is a verified purchase/review'),
    platform: z.enum(['google', 'trustpilot', 'yelp', 'facebook', 'custom']).optional().describe('Review platform source'),
    platformName: z.string().optional().describe('Custom platform name (when platform is "custom")'),
    platformLogo: z.string().optional().describe('URL to platform logo image'),
    helpful: HelpfulVotesSchema.optional().describe('Helpful/not helpful vote counts'),
  }),

  // Detection metadata (replaces review-card.ai.ts)
  detection: {
    keywords: ['review', 'rating', 'star', 'feedback', 'customer', 'testimonial', 'verified', 'score'],
    patterns: [
      'review[\\s-]?(card|box|section)',
      'rating[\\s-]?(display|stars?|score)',
      'customer[\\s-]?review',
      '\\d+[\\s-]?star[\\s-]?rating',
      'product[\\s-]?review',
      'verified[\\s-]?review',
    ],
    commonNames: ['ReviewCard', 'RatingCard', 'CustomerReview', 'ReviewBox', 'ProductReview'],
    pageLocation: ['main'],
    confidence: 0.85,
    suggestedVariants: ['default', 'minimal', 'detailed'],
    relatedComponents: [ComponentType.Reviews, ComponentType.Testimonials],
    semanticRole: 'article',
    accessibility: {
      ariaLabel: 'Customer review',
      role: 'article',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use review-card for individual customer reviews with ratings',
    'Extract: rating from star display or numeric score (1-5 scale)',
    'Extract: reviewText from main review content',
    'Extract: author from reviewer name',
    'Extract: date from review timestamp (convert to ISO string if needed)',
    'Extract: verified flag if "Verified Purchase" or similar badge present',
    'Extract: platform from review source indicators (Google, Trustpilot, etc.)',
    'Extract: helpful votes from thumbs up/down counters if present',
  ],

  // Sample content for AI tools and testing
  sample: {
    rating: 5,
    reviewText: 'Excellent product! Exceeded all my expectations. The quality is outstanding and delivery was fast.',
    author: 'Alex Thompson',
    date: '2024-01-15',
    verified: true,
    platform: 'google',
    helpful: { yes: 24, no: 2 },
  },

  // Mark as sub-component only
  subOnly: true,

  // Human-readable description
  description: 'Individual review with rating, author, date, and optional platform metadata.',
})

// Export inferred TypeScript type
export type ReviewCardContent = z.infer<typeof ReviewCardDef.schema>
