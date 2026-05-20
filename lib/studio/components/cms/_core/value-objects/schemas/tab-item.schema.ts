/**
 * TabItem Schema
 *
 * Represents a single tab with label, content, and optional icon.
 */

import { z } from 'zod'

/**
 * Schema for individual tab items
 */
export const TabItemSchema = z.object({
  label: z.string().describe('Tab label text'),
  content: z.string().optional().describe('Tab content panel text'),
  icon: z.string().optional().describe('Optional icon for the tab'),
})

export type TabItem = z.infer<typeof TabItemSchema>
