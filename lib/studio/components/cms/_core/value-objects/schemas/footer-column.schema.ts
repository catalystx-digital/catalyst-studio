import { z } from 'zod'
import { MenuItemSchema } from './menu-item.schema'

/**
 * Schema for FooterColumn value object
 * Represents a navigation column in the footer with optional title and links
 */
export const FooterColumnSchema = z.object({
  title: z.string().optional().describe('Column heading/title'),
  links: z.array(MenuItemSchema).optional().describe('Navigation links in this column'),
})

// Derived TypeScript type
export type FooterColumn = z.infer<typeof FooterColumnSchema>
