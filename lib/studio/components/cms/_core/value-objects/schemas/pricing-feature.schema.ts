import { z } from 'zod'

/**
 * Schema for PricingFeature value object
 * Used in: Pricing components to represent individual plan features
 */
export const PricingFeatureSchema = z.object({
  /** Feature text/description */
  text: z.string().describe('Feature text'),
  /** Whether feature is included in this tier */
  included: z.boolean().describe('Feature availability'),
  /** Optional tooltip/explanation */
  tooltip: z.string().optional().describe('Feature tooltip'),
})

// Derived TypeScript type
export type PricingFeature = z.infer<typeof PricingFeatureSchema>
