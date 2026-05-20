/**
 * SideMenuSection Schema
 *
 * Represents a grouped section in a side navigation menu with heading and menu items.
 */

import { z } from 'zod'
import { MenuItemSchema } from './menu-item.schema'

/**
 * Side Menu section schema
 */
export const SideMenuSectionSchema = z.object({
  heading: z.string().optional().describe('Section heading text'),
  items: z.array(MenuItemSchema).describe('Navigation items within this section'),
})

export type SideMenuSection = z.infer<typeof SideMenuSectionSchema>
