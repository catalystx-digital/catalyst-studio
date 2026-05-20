/**
 * Testimonial Item Component Definition
 *
 * Testimonial item with quote, author, and optional role/company/avatar/rating.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'

/**
 * Testimonial Item component definition
 */
export const TestimonialItemDef = defineComponent({
  type: ComponentType.TestimonialItem,
  category: ComponentCategory.SocialProof,

  // Zod schema (single source of truth for props)
  schema: z.object({
    quote: z.string().describe('The testimonial quote or feedback text'),
    author: z.string().describe('Name of the person providing the testimonial'),
    role: z.string().optional().describe('Job title or role of the author'),
    company: z.string().optional().describe('Company or organization name'),
    avatar: z.string().optional().describe('URL to author avatar image'),
    rating: z.number().optional().describe('Star rating (typically 1-5)'),
  }),

  // Detection metadata
  detection: {
    keywords: ['testimonial', 'review', 'quote', 'feedback', 'customer'],
    patterns: [
      'testimonial[\\s-]?item',
      'review[\\s-]?card',
      'customer[\\s-]?quote',
    ],
    commonNames: ['TestimonialItem', 'ReviewCard', 'TestimonialCard'],
    pageLocation: ['main'],
    confidence: 0.75,
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Sub-component only - used within testimonial-grid or testimonial-slider',
    'Extract: quote from blockquote or main text content',
    'Extract: author from name/citation element',
    'Extract: role from job title or position text',
    'Extract: company from organization/company name',
    'Extract: avatar from image URL if present',
    'Extract: rating from star rating or numeric score',
  ],

  // Sample content for AI tools and testing
  sample: {
    quote: 'This product has transformed our workflow. Highly recommend!',
    author: 'Jane Smith',
    role: 'VP of Operations',
    company: 'Acme Corp',
    avatar: '/avatars/jane.jpg',
    rating: 5,
  },

  // Mark as sub-component only
  subOnly: true,

  // Human-readable description
  description: 'Testimonial item with quote, author, and optional role/company/avatar/rating.',
})

// Export inferred TypeScript type
export type TestimonialItemContent = z.infer<typeof TestimonialItemDef.schema>
