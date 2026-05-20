/**
 * Filter Schema
 *
 * Configuration for filter chips/buttons used to filter content lists.
 */

import { z } from 'zod'

/**
 * Schema for filter chips
 */
export const FilterSchema = z.object({
  label: z.string().describe('Filter label text'),
  value: z.string().describe('Filter value'),
})

export type Filter = z.infer<typeof FilterSchema>
