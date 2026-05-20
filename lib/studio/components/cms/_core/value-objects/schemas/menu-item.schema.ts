import { z } from 'zod'
import { SmartLinkSchema } from './smart-link.schema'

// Forward reference for recursive MenuItem type
const MenuItemGroupSchema: z.ZodType<any> = z.lazy(() => z.object({
  /** Optional title displayed above the grouped links */
  title: z.string().optional().describe('Group title'),
  /** Supporting copy for the group */
  description: z.string().optional().describe('Group description'),
  /** Menu items contained in the group */
  items: z.array(MenuItemSchema).optional(),
}))

/**
 * Schema for MenuItem value object (recursive)
 * Used in: NavBar, Footer, SiteMap
 */
export const MenuItemSchema: z.ZodType<any> = z.lazy(() => z.object({
  /** Display label for the menu item */
  label: z.string().describe('Menu item text'),
  /**
   * Target URL for the menu item
   * Supports both SmartLink objects (PageReference | ExternalLink) and raw strings for backwards compatibility
   */
  href: z.union([SmartLinkSchema, z.string()]).optional().describe('externalUrl:Destination URL'),
  /** Short description or supporting copy */
  description: z.string().optional().describe('Optional description'),
  /** Optional icon or emoji shown with the label */
  icon: z.string().optional().describe('Icon identifier or emoji'),
  /** Nested menu items for dropdown/submenu */
  children: z.array(z.lazy(() => MenuItemSchema)).optional().describe('Nested menu items'),
  /** Optional grouped submenu sections */
  groups: z.array(MenuItemGroupSchema).optional().describe('Grouped menu sections'),
  /** Whether the link opens in a new tab */
  external: z.boolean().optional().describe('Opens in new tab when true'),
  /** Optional horizontal offset (px) applied to the submenu viewport */
  panelOffset: z.number().optional().describe('Submenu horizontal offset in pixels'),
  /** Optional explicit width (px or CSS size) for the submenu viewport */
  panelWidth: z.union([z.number(), z.string()]).optional().describe('Submenu width'),
  /** Alignment preference for the submenu viewport relative to the trigger */
  panelAlign: z.enum(['start', 'center', 'end']).optional().describe('Submenu alignment'),
}))

// Derived TypeScript type
export type MenuItem = z.infer<typeof MenuItemSchema>
export type MenuItemGroup = z.infer<typeof MenuItemGroupSchema>
