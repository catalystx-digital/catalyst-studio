import { z } from 'zod'

/**
 * Schema for NavBar Search configuration
 * Used in: NavBar
 */
export const NavBarSearchSchema = z.object({
  /** Enable search functionality */
  enabled: z.boolean().optional().describe('Enable search functionality'),
  /** Search input placeholder text */
  placeholder: z.string().optional().describe('Search input placeholder text'),
  /** Search form action URL */
  action: z.string().optional().describe('Search form action URL'),
  /** Enable search suggestions */
  showSuggestions: z.boolean().optional().describe('Enable search suggestions'),
})

// Derived TypeScript type
export type NavBarSearch = z.infer<typeof NavBarSearchSchema>
