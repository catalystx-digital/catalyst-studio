/**
 * Testimonial Slider Component Definition
 *
 * Carousel-style slider for testimonials with autoplay and navigation controls.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { TestimonialSchema } from '@/lib/studio/components/cms/_core/value-objects'

/**
 * Testimonial Slider component definition
 */
export const TestimonialSliderDef = defineComponent({
  type: ComponentType.Testimonials,
  category: ComponentCategory.SocialProof,

  // Zod schema (single source of truth for props)
  schema: z.object({
    testimonials: z.array(TestimonialSchema).describe('Array of testimonial items to display in carousel'),
    autoPlayInterval: z.number().optional().describe('Auto-play interval in milliseconds (0 to disable)'),
    showNavigation: z.boolean().optional().describe('Whether to show previous/next navigation buttons'),
    showDots: z.boolean().optional().describe('Whether to show dot indicators for slides'),
    pauseOnHover: z.boolean().optional().describe('Whether to pause autoplay on hover'),
  }),

  // Detection metadata (replaces testimonial-slider.ai.ts)
  detection: {
    keywords: ['testimonial', 'review', 'customer', 'quote', 'feedback', 'carousel', 'slider', 'rotator'],
    patterns: [
      'testimonial[\\s-]?(slider|carousel|rotator)',
      'customer[\\s-]?(reviews?|feedback|quotes?)',
      'what[\\s-]?(our[\\s-]?)?(customers?|clients?)[\\s-]?say',
      'client[\\s-]?testimonials?',
      'review[\\s-]?carousel',
    ],
    commonNames: ['TestimonialSlider', 'ReviewCarousel', 'CustomerQuotes', 'TestimonialCarousel'],
    pageLocation: ['main'],
    confidence: 0.85,
    suggestedVariants: ['default', 'minimal', 'detailed'],
    relatedComponents: [ComponentType.Testimonials],
    semanticRole: 'complementary',
    accessibility: {
      ariaLabel: 'Customer testimonials',
      role: 'region',
    },
  },

  // LLM extraction directives
  directives: [
    'Treat testimonial-slider the same as testimonials: populate testimonials[] with testimonial-item entries that include stable "testimonial-item-<slug>" ids, quote, author, role/company, rating (when shown), and avatar string URLs.',
    'Flatten slide imagery into avatar; never return nested image objects inside testimonial items.',
    'Respect DOM order for testimonials[] and include autoplay/navigation flags per the rendered configuration.',
    'Every testimonial-item MUST include a stable "id" prefixed with "testimonial-item-". Derive the slug from the visible author name; when duplicates appear, append a short suffix derived from the testimonial quote.',
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
    'Extract: autoPlayInterval from carousel configuration (convert seconds to milliseconds)',
    'Extract: showNavigation, showDots, pauseOnHover from carousel controls',
  ],

  // Sample content for AI tools and testing
  sample: {
    testimonials: [
      {
        quote: 'The best decision we made for our business.',
        author: 'Emily Roberts',
        role: 'Marketing Director',
        company: 'GrowthCo',
        avatar: '/avatars/emily.jpg',
        rating: 5,
      },
      {
        quote: 'Exceptional quality and fantastic support.',
        author: 'David Park',
        role: 'Founder',
        company: 'InnovateLabs',
        rating: 5,
      },
    ],
    autoPlayInterval: 5000,
    showNavigation: true,
    showDots: true,
    pauseOnHover: true,
  },

  // Human-readable description
  description: 'Carousel-style slider for testimonials with autoplay and navigation controls.',
})

// Export inferred TypeScript type
export type TestimonialSliderContent = z.infer<typeof TestimonialSliderDef.schema>
