/**
 * ComparisonProduct Schema
 *
 * Represents a product or plan in a feature comparison table.
 */

import { z } from 'zod'
import { SmartLinkSchema } from './smart-link.schema'

/**
 * Product/plan schema for comparison
 */
export const ComparisonProductSchema = z.object({
  name: z.string().describe('Product or plan name'),
  price: z.string().optional().describe('Pricing information or label'),
  recommended: z.boolean().optional().describe('Mark this product as recommended/featured'),
  cta: z.object({
    text: z.string().describe('Call-to-action button label'),
    href: SmartLinkSchema.describe('Link destination for CTA (internal page or external URL)'),
  }).optional().describe('Call-to-action for this product'),
})

/**
 * Feature row schema
 */
export const ComparisonFeatureSchema = z.object({
  name: z.string().describe('Feature name or category'),
  description: z.string().optional().describe('Additional context about the feature'),
  values: z.array(z.union([z.boolean(), z.string(), z.number()])).describe('Feature availability or value for each product (order matches products array)'),
})

export type ComparisonProduct = z.infer<typeof ComparisonProductSchema>
export type ComparisonFeature = z.infer<typeof ComparisonFeatureSchema>
