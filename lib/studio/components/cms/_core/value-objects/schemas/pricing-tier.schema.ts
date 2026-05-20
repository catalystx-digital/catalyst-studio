import { z } from 'zod'

/**
 * Schema for Pricing Tier value object
 * Used in: PricingTable, PricingCard
 * All 12 fields from PricingPlan interface
 */
export const PricingTierSchema = z.object({
  /** Unique identifier */
  id: z.string().describe('Unique plan identifier'),
  /** Plan name */
  name: z.string().describe('Plan name'),
  /** Plan description */
  description: z.string().optional().describe('Plan description'),
  /** Price amount */
  price: z.number().describe('Price in specified currency'),
  /** Original price (for showing discounts) */
  originalPrice: z.number().optional().describe('Original price before discount'),
  /** Currency code (USD, EUR, etc.) */
  currency: z.string().describe('Currency code'),
  /** Billing period */
  period: z.enum(['monthly', 'annual', 'one-time']).describe('Billing period'),
  /** List of included features */
  features: z.array(z.string()).describe('List of features'),
  /** Whether this tier is highlighted */
  highlighted: z.boolean().optional().describe('Visually highlight this plan'),
  /** Whether this is marked as popular */
  popular: z.boolean().optional().describe('Mark as most popular'),
  /** Call-to-action button text */
  ctaText: z.string().optional().describe('CTA button text'),
  /** Call-to-action URL */
  ctaUrl: z.string().optional().describe('CTA button URL'),
  /** Badge text (e.g., "Best Value") */
  badge: z.string().optional().describe('Badge label'),
  /** Whether the plan is disabled/unavailable */
  disabled: z.boolean().optional().describe('Disable selection'),
})

// Derived TypeScript type
export type PricingTier = z.infer<typeof PricingTierSchema>
