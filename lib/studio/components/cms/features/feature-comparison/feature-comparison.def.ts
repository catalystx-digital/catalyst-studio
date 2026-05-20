/**
 * Feature Comparison Component Definition
 *
 * Side-by-side comparison table for features/plans with optional highlights.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { ComparisonProductSchema, ComparisonFeatureSchema } from '../../_core/value-objects'

/**
 * Feature Comparison component definition
 */
export const FeatureComparisonDef = defineComponent({
  type: ComponentType.FeatureComparison,
  category: ComponentCategory.Features,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().optional().describe('Main heading for the comparison section'),
    subheading: z.string().optional().describe('Supporting text below the heading'),
    products: z.array(ComparisonProductSchema).describe('List of products/plans being compared (columns)'),
    features: z.array(ComparisonFeatureSchema).describe('List of features to compare (rows)'),
  }),

  // Detection metadata
  detection: {
    keywords: ['comparison', 'compare', 'vs', 'versus', 'pricing', 'plans', 'tiers', 'matrix'],
    patterns: [
      'compar(e|ison)',
      'vs\\.?|versus',
      'pricing[\\s-]?(table|grid|comparison)',
      'plan[\\s-]?comparison',
      'feature[\\s-]?matrix',
      'product[\\s-]?comparison',
    ],
    commonNames: ['FeatureComparison', 'PricingTable', 'ComparisonTable', 'PlanComparison'],
    pageLocation: ['main'],
    confidence: 0.88,
    relatedComponents: [ComponentType.PricingTable],
    semanticRole: 'table',
    accessibility: {
      ariaLabel: 'Feature comparison table',
      role: 'table',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use feature-comparison for side-by-side product/plan comparisons',
    'Extract: products from table column headers with names and pricing',
    'Extract: features from table rows with name and per-product values',
    'Values: Use boolean (true/false) for checkmarks, string for text, number for quantities',
    'Recommended: Mark featured/highlighted columns with recommended: true',
    'CTA: Extract call-to-action buttons from column footers',
    'ENSURE: values array length matches products array length for alignment',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Compare Our Plans',
    subheading: 'Choose the perfect plan for your team',
    products: [
      { name: 'Starter', price: '$9/month', recommended: false, cta: { text: 'Get Started', href: { type: 'internal', pageId: 'signup-starter' } } },
      { name: 'Professional', price: '$29/month', recommended: true, cta: { text: 'Start Trial', href: { type: 'internal', pageId: 'signup-pro' } } },
      { name: 'Enterprise', price: 'Custom', recommended: false, cta: { text: 'Contact Sales', href: { type: 'internal', pageId: 'contact-sales' } } },
    ],
    features: [
      { name: 'Users', description: 'Number of team members', values: [5, 25, 'Unlimited'] },
      { name: 'Storage', description: 'Cloud storage space', values: ['10 GB', '100 GB', '1 TB'] },
      { name: 'Advanced Analytics', values: [false, true, true] },
      { name: 'Priority Support', values: [false, false, true] },
    ],
  },

  // Human-readable description
  description: 'Side-by-side comparison table for features/plans with optional highlights.',
})

// Export inferred TypeScript type
export type FeatureComparisonContent = z.infer<typeof FeatureComparisonDef.schema>
