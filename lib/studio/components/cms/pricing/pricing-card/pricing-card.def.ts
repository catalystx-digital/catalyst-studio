/**
 * Pricing Card Component Definition
 *
 * Single pricing card with price, features, and call-to-action.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { PricingFeatureSchema, BadgeSchema } from '../../_core/value-objects'

/**
 * Pricing Card component definition
 */
export const PricingCardDef = defineComponent({
  type: ComponentType.PricingCard,
  category: ComponentCategory.Pricing,

  // Zod schema (single source of truth for props)
  schema: z.object({
    name: z.string().describe('Plan name (e.g., "Professional", "Enterprise")'),
    description: z.string().optional().describe('Brief description of the plan'),
    price: z.number().describe('Plan price amount'),
    originalPrice: z.number().optional().describe('Original price before discount for showing savings'),
    currency: z.string().describe('Currency code (e.g., "USD", "EUR")'),
    period: z.enum(['monthly', 'annual', 'one-time']).describe('Billing period'),
    features: z.array(PricingFeatureSchema).describe('List of plan features'),
    ctaText: z.string().optional().describe('Call-to-action button text'),
    ctaUrl: z.string().optional().describe('Call-to-action button destination URL'),
    badge: BadgeSchema.optional().describe('Optional badge (e.g., "Popular", "Best Value")'),
    highlighted: z.boolean().optional().describe('Whether to visually emphasize this plan'),
    disabled: z.boolean().optional().describe('Whether the plan is disabled/unavailable'),
  }),

  // Detection metadata (replaces pricing-card.ai.ts)
  detection: {
    keywords: [
      'price',
      'plan',
      'package',
      'subscription',
      'tier',
      'pricing card',
      'pricing option',
      'membership',
      'cost',
      'billing',
      'pricing box',
    ],
    patterns: [
      'pricing\\s+(card|box|option)',
      'price\\s+plan',
      'subscription\\s+(card|box)',
      'plan\\s+(card|details)',
      'membership\\s+(option|card)',
      'package\\s+details',
    ],
    commonNames: [
      'pricing-card',
      'price-box',
      'plan-card',
      'subscription-card',
      'pricing-option',
      'package-card',
    ],
    pageLocation: ['main'],
    confidence: 0.80,
    relatedComponents: [ComponentType.PricingTable],
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use pricing-card for individual pricing plan cards',
    'Extract: name from plan title/heading',
    'Extract: description from plan subtitle or description text',
    'Extract: price from pricing amount (convert to number)',
    'Extract: originalPrice from strikethrough or "was" price if present',
    'Extract: currency from currency symbol or code',
    'Extract: period from billing period text (monthly/annual/one-time)',
    'Extract: features from feature list items',
    'Extract: ctaText from primary button label',
    'Extract: ctaUrl from button href',
    'Extract: badge from label like "Popular", "Best Value", "Recommended"',
    'Detect highlighted status from visual emphasis or "popular" indicators',
  ],

  // Sample content for AI tools and testing
  sample: {
    name: 'Professional',
    description: 'Perfect for growing teams',
    price: 49,
    originalPrice: 69,
    currency: 'USD',
    period: 'monthly',
    features: [
      { text: 'Unlimited projects', included: true },
      { text: 'Priority support', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Custom integrations', included: false },
    ],
    ctaText: 'Start Free Trial',
    ctaUrl: '/signup?plan=pro',
    badge: { text: 'Popular', variant: 'primary' },
    highlighted: true,
  },

  // Human-readable description
  description: 'Single pricing card with price, features, and call-to-action.',
})

// Export inferred TypeScript type
export type PricingCardContent = z.infer<typeof PricingCardDef.schema>
