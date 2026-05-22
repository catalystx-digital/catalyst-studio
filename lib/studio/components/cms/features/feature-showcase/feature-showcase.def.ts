/**
 * Feature Showcase Component Definition
 *
 * Interactive showcase with multiple sections combining images, descriptive text, checklists, and CTAs.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { ShowcaseSectionSchema } from '../../_core/value-objects'

/**
 * Feature Showcase component definition
 */
export const FeatureShowcaseDef = defineComponent({
  type: ComponentType.FeatureShowcase,
  category: ComponentCategory.Features,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().optional().describe('Optional section heading'),
    subheading: z.string().optional().describe('Optional section subheading'),
    sections: z.array(ShowcaseSectionSchema).describe('Array of showcase sections with alternating layout'),
  }),

  // Detection metadata (replaces feature-showcase.ai.ts)
  detection: {
    keywords: ['showcase', 'feature', 'product', 'solution', 'highlight', 'presentation'],
    patterns: [
      'showcase',
      'feature[\\s-]?highlight',
      'product[\\s-]?(showcase|presentation)',
      'solution[\\s-]?overview',
      'alternating[\\s-]?layout',
    ],
    commonNames: ['FeatureShowcase', 'ProductShowcase', 'SolutionShowcase', 'AlternatingFeatures'],
    pageLocation: ['main'],
    confidence: 0.82,
    relatedComponents: [ComponentType.FeatureGrid],
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use feature-showcase for alternating image/text layout sections',
    'Extract: heading from section title or h2 tag',
    'Extract: sections from alternating content blocks with images and text',
    'Layout: Detect left/right alternating pattern',
    'NEVER nest feature-showcase - must be top-level section',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Powerful Features',
    subheading: 'Everything you need in one place',
    sections: [
      {
        image: {
          src: { mediaId: 'sample-feature-1', mediaType: 'image', url: '/images/feature-1.jpg' },
          alt: 'Advanced analytics feature preview',
          originalUrl: '/images/feature-1.jpg',
        },
        title: 'Advanced Analytics',
        description: 'Deep insights into your data',
        checklist: ['Real-time reporting', 'Custom dashboards', 'Export capabilities'],
      },
    ],
  },

  // Human-readable description
  description: 'Interactive showcase with multiple sections combining images, descriptive text, checklists, and CTAs.',
})

// Export inferred TypeScript type
export type FeatureShowcaseContent = z.infer<typeof FeatureShowcaseDef.schema>
