/**
 * Testimonial Grid Component Definition
 *
 * Grid of short testimonials with author details and optional star ratings.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { TestimonialSchema } from '@/lib/studio/components/cms/_core/value-objects'

/**
 * Columns configuration schema
 */
const ColumnsSchema = z.object({
  desktop: z.number().optional().describe('Number of columns on desktop'),
  tablet: z.number().optional().describe('Number of columns on tablet'),
  mobile: z.number().optional().describe('Number of columns on mobile'),
})

/**
 * Testimonial Grid component definition
 */
export const TestimonialGridDef = defineComponent({
  type: ComponentType.Testimonials,
  category: ComponentCategory.SocialProof,

  // Zod schema (single source of truth for props)
  schema: z.object({
    testimonials: z.array(TestimonialSchema).describe('Array of testimonial items to display in grid'),
    columns: ColumnsSchema.optional().describe('Responsive column configuration for grid layout'),
    showRating: z.boolean().optional().describe('Whether to display star ratings for testimonials'),
  }),

  // Detection metadata (replaces testimonial-grid.ai.ts)
  detection: {
    keywords: ['testimonials', 'reviews', 'feedback', 'grid', 'customers', 'clients', 'ratings'],
    patterns: [
      'testimonial[\\s-]?grid',
      'review[\\s-]?grid',
      'customer[\\s-]?(testimonials?|reviews?)[\\s-]?grid',
      'what[\\s-]?(our[\\s-]?)?(customers?|clients?)[\\s-]?say',
      'client[\\s-]?feedback',
      'testimonial[\\s-]?section',
    ],
    commonNames: ['TestimonialGrid', 'ReviewGrid', 'CustomerGrid', 'FeedbackGrid', 'TestimonialSection'],
    pageLocation: ['main'],
    confidence: 0.80,
    suggestedVariants: ['default', 'minimal', 'detailed'],
    relatedComponents: [ComponentType.Testimonials],
    semanticRole: 'complementary',
    accessibility: {
      ariaLabel: 'Customer testimonials',
      role: 'list',
    },
  },

  // LLM extraction directives
  directives: [
    'Data requirements: "testimonials[]" must enumerate every testimonial in visual order. Each entry MUST be type "testimonial-item" and populate quote, author, role/company (when shown), rating, and avatar.',
    'Every testimonial-item MUST include a stable "id" prefixed with "testimonial-item-". Derive the slug from the visible author name; when duplicates appear, append a short suffix derived from the testimonial quote (e.g., testimonial-item-julie-waddell-culture). Never leave ids empty or rely on importer-generated values.',
    'Flatten imagery into the contract avatar field: provide the absolute image URL string in "avatar". Do not return nested objects such as image{src,alt} or media[]. Keep all other fields contract-aligned.',
    'Example payload:',
    '  "testimonials": [',
    '    {',
    '      "type": "testimonial-item",',
    '      "id": "testimonial-item-julie-waddell",',
    '      "quote": "We encourage our students to have the courage and confidence to embrace their culture.",',
    '      "author": "Julie Waddell",',
    '      "role": "Jarara Indigenous Education Unit",',
    '      "avatar": "https://.../testimonial-julie.jpg"',
    '    }',
    '  ]',
    'If the page exposes richer metadata (company, rating, links) include those fields per contract. Re-read the section when testimonials[] comes back empty or missing ids.',
  ],

  // Sample content for AI tools and testing
  sample: {
    testimonials: [
      {
        quote: 'This product changed how we work. Highly recommended!',
        author: 'Sarah Johnson',
        role: 'CEO',
        company: 'TechCorp',
        rating: 5,
      },
      {
        quote: 'Outstanding service and support team.',
        author: 'Mike Chen',
        role: 'Product Manager',
        company: 'StartupXYZ',
        rating: 5,
      },
    ],
    columns: { desktop: 3, tablet: 2, mobile: 1 },
    showRating: true,
  },

  // Human-readable description
  description: 'Grid of short testimonials with author details and optional star ratings.',
})

// Export inferred TypeScript type
export type TestimonialGridContent = z.infer<typeof TestimonialGridDef.schema>
