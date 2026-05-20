/**
 * Nav Menu Item Component Definition
 *
 * Navigation menu entry with optional external link, icon, and nested submenu items.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { MenuItemSchema, SmartLinkSchema } from '../../_core/value-objects'

/**
 * Nav Menu Item component definition (recursive for nested menus)
 */
export const NavMenuItemDef = defineComponent({
  type: ComponentType.NavMenuItem,
  category: ComponentCategory.Navigation,

  // Zod schema (single source of truth for props)
  // Redefine the schema to match MenuItemSchema structure while satisfying ZodObject requirement
  schema: z.object({
    label: z.string().describe('Display text for the menu item'),
    href: z.union([SmartLinkSchema, z.string()]).optional().describe('Destination URL (defaults to # when omitted)'),
    description: z.string().optional().describe('Optional description or supporting copy'),
    icon: z.string().optional().describe('Optional icon identifier or emoji displayed with the label'),
    children: z.array(MenuItemSchema).optional().describe('Nested submenu items rendered beneath this entry'),
    external: z.boolean().optional().describe('Opens the link in a new tab when true'),
    panelOffset: z.number().optional().describe('Horizontal offset (in pixels) applied to the submenu viewport'),
    panelWidth: z.union([z.number(), z.string()]).optional().describe('Explicit width for the submenu viewport (e.g., 320, "28rem")'),
    panelAlign: z.enum(['start', 'center', 'end']).optional().describe('Alignment preference for the submenu viewport relative to the trigger'),
  }),

  // Detection metadata
  detection: {
    keywords: ['nav item', 'menu item', 'navigation link', 'submenu'],
    patterns: ['menu\\s*item', 'nav\\s*item', 'submenu', 'dropdown\\s*item'],
    commonNames: ['menu item', 'navigation item', 'dropdown item'],
    pageLocation: ['header', 'footer', 'sidebar'],
    confidence: 0.8,
    relatedComponents: [ComponentType.NavBar, ComponentType.MegaMenu, ComponentType.MobileMenu],
    semanticRole: 'link',
    accessibility: {
      ariaLabel: 'Navigation menu item',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use nav-menu-item for individual navigation links within menus',
    'Extract: label from link text or button content',
    'Extract: href from anchor tag href attribute',
    'External: Detect from target="_blank" attribute or external URL patterns',
    'Icon: Extract from icon elements, emoji, or data attributes',
    'Children: Recursively extract nested menu items from dropdown/submenu structures',
    'ALWAYS nest within parent navigation components (navbar, sidemenu, etc.)',
    'NEVER use as standalone component - must be part of navigation hierarchy',
    'Data requirements: Provide label, href, external flag, icon (if present), and children[] for dropdown items. Use absolute URLs for external links and retain query/hash params.',
    'Include a stable id for every nav-menu-item using kebab-case of the label prefixed with "nav-menu-item-". Missing ids force importer fallbacks.',
    'Always include the external boolean: set to false for same-domain links and true when the anchor targets an external domain or opens in a new tab. Do not omit the field.',
    'If a menu item nests children, output them in children[] as nav-menu-item entries preserving DOM order.',
    'Mapping guidance: label = trimmed text node, href = full href attribute, external = true when target="_blank" or href starts with http(s) pointing off-site, icon = icon class or image ref when present.',
  ],

  // Sample content for AI tools and testing
  sample: {
    label: 'Products',
    href: '/products',
    external: false,
    icon: '📦',
    panelAlign: 'start',
    children: [
      { label: 'Software', href: '/products/software' },
      { label: 'Hardware', href: '/products/hardware' },
      { label: 'Services', href: '/products/services' },
    ],
  },

  // Human-readable description
  description: 'Navigation menu entry with optional external link, icon, and nested submenu items.',
})

// Export inferred TypeScript type
export type NavMenuItemContent = z.infer<typeof NavMenuItemDef.schema>
