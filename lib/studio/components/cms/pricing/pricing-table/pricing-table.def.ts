/**
 * Pricing Table Component Definition
 *
 * Pricing table with multiple plans and optional feature comparison matrix.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { PricingTierSchema } from '../../_core/value-objects'

/**
 * Feature comparison row schema
 */
const FeatureComparisonSchema = z.object({
  name: z.string().describe('Feature name'),
  availability: z.array(z.boolean()).describe('Feature availability per plan (true/false array)'),
  tooltip: z.string().optional().describe('Optional tooltip explaining the feature'),
})

/**
 * Pricing Table component definition
 */
export const PricingTableDef = defineComponent({
  type: ComponentType.PricingTable,
  category: ComponentCategory.Pricing,

  // Zod schema (single source of truth for props)
  schema: z.object({
    title: z.string().optional().describe('Section title above the pricing table'),
    subtitle: z.string().optional().describe('Subtitle providing context or value proposition'),
    plans: z.array(PricingTierSchema).describe('Array of pricing plan tiers to display'),
    features: z.array(FeatureComparisonSchema).optional().describe('Feature comparison matrix showing which features are included in each plan'),
    showComparison: z.boolean().optional().describe('Whether to display the feature comparison table'),
    highlightDifferences: z.boolean().optional().describe('Whether to visually emphasize differences between plans'),
  }),

  // Detection metadata (replaces pricing-table.ai.ts)
  detection: {
    keywords: [
      'pricing',
      'plans',
      'compare',
      'subscription',
      'tiers',
      'packages',
      'pricing table',
      'pricing comparison',
      'plan comparison',
      'pricing plans',
      'subscription plans',
      'membership',
      'pricing options',
    ],
    patterns: [
      'pricing\\s+(table|comparison|plans?|options?)',
      'compare\\s+plans?',
      'subscription\\s+(plans?|tiers?|options?)',
      'choose\\s+(your\\s+)?plan',
      'plan\\s+comparison',
      'membership\\s+(levels?|tiers?|plans?)',
    ],
    commonNames: [
      'pricing-table',
      'pricing-comparison',
      'plan-selector',
      'subscription-plans',
      'pricing-grid',
      'plan-comparison',
    ],
    pageLocation: ['main'],
    confidence: 0.85,
    relatedComponents: [ComponentType.PricingCard],
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use pricing-table for multiple pricing plans displayed together',
    'Extract: title from section heading above pricing plans',
    'Extract: subtitle from supporting text below title',
    'Extract: plans from each pricing plan card/column',
    'Extract: features from feature comparison matrix if present',
    'Each plan should include name, price, currency, period, features, and CTA',
    'Detect showComparison from presence of feature comparison matrix',
    'Feature availability array should align with plan order (left to right)',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'Choose Your Plan',
    subtitle: 'Select the perfect plan for your needs',
    plans: [
      {
        id: 'starter',
        name: 'Starter',
        price: 0,
        currency: 'USD',
        period: 'monthly',
        features: ['5 projects', 'Basic support', '1 user'],
        ctaText: 'Get Started',
        ctaUrl: '/signup?plan=starter',
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 49,
        currency: 'USD',
        period: 'monthly',
        features: ['Unlimited projects', 'Priority support', '5 users'],
        ctaText: 'Start Trial',
        ctaUrl: '/signup?plan=pro',
        badge: 'Popular',
        highlighted: true,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 199,
        currency: 'USD',
        period: 'monthly',
        features: ['Unlimited everything', '24/7 support', 'Unlimited users'],
        ctaText: 'Contact Sales',
        ctaUrl: '/contact',
      },
    ],
    showComparison: true,
    highlightDifferences: true,
  },

  // Human-readable description
  description: 'Pricing table with multiple plans and optional feature comparison matrix.',
})

// Export inferred TypeScript type
export type PricingTableContent = z.infer<typeof PricingTableDef.schema>
