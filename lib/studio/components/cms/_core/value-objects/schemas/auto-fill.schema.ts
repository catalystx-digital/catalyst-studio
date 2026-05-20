/**
 * AutoFill Schema
 *
 * Configuration for automatically filling content lists from the database
 * (e.g., latest blog posts, filtered by category/tag).
 */

import { z } from 'zod'

/**
 * Auto-fill configuration schema
 */
export const AutoFillSchema = z.object({
  enabled: z.boolean().optional().describe('Whether auto-fill is enabled'),
  strategy: z.enum(['latest', 'category', 'tag', 'mixed']).optional().describe('Strategy for selecting content'),
  categories: z.array(z.string()).optional().describe('Categories to filter by'),
  tags: z.array(z.string()).optional().describe('Tags to filter by'),
  desiredCount: z.number().optional().describe('Desired number of items to fetch'),
}).optional()

export type AutoFill = z.infer<typeof AutoFillSchema>
