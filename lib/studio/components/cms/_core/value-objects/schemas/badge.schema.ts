import { z } from 'zod'

/**
 * Schema for Badge value object
 * Used in: PricingTable, Cards, Labels, Tags
 */
export const BadgeSchema = z.object({
  /** Badge text content */
  text: z.string().describe('Badge text'),
  /** Visual variant/style */
  variant: z.enum(['default', 'primary', 'secondary', 'success', 'warning', 'danger', 'info']).optional().describe('Badge style variant'),
  /** Optional icon */
  icon: z.string().optional().describe('Icon identifier'),
})

// Derived TypeScript type
export type Badge = z.infer<typeof BadgeSchema>
