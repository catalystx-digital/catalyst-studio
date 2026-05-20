import { z } from 'zod'

/**
 * Stat Delta/Trend Schema
 *
 * Represents change indicators showing trend direction and magnitude.
 */
const StatDeltaSchema = z.object({
  value: z.number().optional().describe('Delta value (percentage or absolute)'),
  label: z.string().optional().describe('Delta label text'),
  trend: z.enum(['up', 'down']).optional().describe('Trend direction'),
})

/**
 * Stat Item Schema
 *
 * Represents a single statistic or metric display.
 * Supports both numeric and string values to accommodate different use cases.
 * Used by Statistics and AboutSection components.
 *
 * @example
 * ```typescript
 * // Numeric value (Statistics component)
 * {
 *   id: "users",
 *   value: 50000,
 *   label: "Active Users",
 *   suffix: "+",
 *   icon: "users",
 *   delta: { value: 12, label: "vs last month", trend: "up" },
 *   decimalPlaces: 0,
 *   animationDuration: 2000
 * }
 *
 * // String value (AboutSection component)
 * {
 *   value: "500",
 *   label: "Clients Served",
 *   suffix: "+",
 *   prefix: "$"
 * }
 * ```
 */
export const StatItemSchema = z.object({
  id: z.string().optional().describe('Unique stat identifier'),
  value: z.union([z.number(), z.string()]).describe('Stat value (numeric or string)'),
  label: z.string().describe('Stat label/name'),
  prefix: z.string().optional().describe('Prefix symbol (e.g., "$", "+")'),
  suffix: z.string().optional().describe('Suffix symbol (e.g., "%", "K", "M")'),
  icon: z.string().optional().describe('Icon name or identifier'),
  description: z.string().optional().describe('Additional description text'),
  animationDuration: z.number().optional().describe('Animation duration in milliseconds'),
  decimalPlaces: z.number().optional().describe('Number of decimal places to display'),
  delta: StatDeltaSchema.optional().describe('Change indicator showing trend'),
})

/**
 * Derived TypeScript type
 */
export type StatItem = z.infer<typeof StatItemSchema>

/**
 * Derived type for delta configuration
 */
export type StatDelta = z.infer<typeof StatDeltaSchema>
