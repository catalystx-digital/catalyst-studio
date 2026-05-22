/**
 * Feature Item Component Definition
 *
 * Feature item with icon, title, description and optional link.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { CTAButtonSchema } from '../../_core/value-objects'

/**
 * Feature Item component definition
 */
export const FeatureItemDef = defineComponent({
  type: ComponentType.FeatureItem,
  category: ComponentCategory.Features,

  // Zod schema (single source of truth for props)
  schema: z.object({
    icon: z.string().describe('Icon identifier or emoji representing the feature'),
    title: z.string().describe('Feature title or heading'),
    description: z.string().describe('Feature description or explanation'),
    link: CTAButtonSchema.optional().describe('Optional call-to-action button or link'),
  }),

  // Detection metadata
  detection: {
    keywords: ['feature', 'item', 'benefit', 'service', 'capability'],
    patterns: [
      'feature[\\s-]?item',
      'service[\\s-]?card',
      'benefit[\\s-]?item',
    ],
    commonNames: ['FeatureItem', 'ServiceCard', 'BenefitCard'],
    pageLocation: ['main'],
    confidence: 0.75,
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Sub-component only - used within feature-grid or feature-list',
    'Extract: icon from icon element or emoji',
    'Extract: title from heading (h3-h5)',
    'Extract: description from paragraph text',
    'Extract: link from call-to-action button if present',
  ],

  // Sample content for AI tools and testing
  sample: {
    icon: 'zap',
    title: 'Lightning Fast',
    description: 'Our platform delivers blazing fast performance',
    link: { label: 'Learn More', href: { type: 'internal', pageId: 'features', path: '/features' }, variant: 'outline' },
  },

  // Mark as sub-component only
  subOnly: true,

  // Human-readable description
  description: 'Feature item with icon, title, description and optional link.',
})

// Export inferred TypeScript type
export type FeatureItemContent = z.infer<typeof FeatureItemDef.schema>
