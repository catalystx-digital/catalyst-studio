/**
 * Side Menu Component Definition
 *
 * Vertical navigation menu for secondary pages or dashboard layouts.
 * Supports grouped sections with headings or flat navigation items.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { SideMenuSectionSchema, MenuItemSchema } from '../../_core/value-objects'

/**
 * Side Menu component definition
 */
export const SideMenuDef = defineComponent({
  type: ComponentType.SideMenu,
  category: ComponentCategory.Navigation,

  // Zod schema (single source of truth for props)
  schema: z.object({
    title: z.string().optional().describe('Optional heading for the sidemenu (e.g., "Resources", "In this section")'),
    sections: z.array(SideMenuSectionSchema).optional().describe('Grouped navigation sections with headings and nested links'),
    items: z.array(MenuItemSchema).optional().describe('Flat navigation items (alternative to sections)'),
    currentPath: z.string().optional().describe('Current page path for highlighting active items'),
    showExpandIcons: z.boolean().optional().describe('Whether to show expand/collapse icons for items with children'),
    defaultCollapsed: z.boolean().optional().describe('Whether to collapse all expandable items by default'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'sidemenu',
      'side menu',
      'sidebar',
      'side navigation',
      'secondary nav',
      'docs nav',
      'menu',
    ],
    patterns: [
      'side.*menu',
      'sidebar.*nav',
      'secondary.*navigation',
      'docs.*navigation',
      'left.*menu',
      'right.*menu',
    ],
    commonNames: [
      'sidemenu',
      'sidebar-nav',
      'side-navigation',
      'docs-menu',
      'secondary-nav',
    ],
    pageLocation: ['sidebar'],
    confidence: 0.85,
    relatedComponents: [ComponentType.NavMenuItem, ComponentType.SidebarNav],
    semanticRole: 'navigation',
    accessibility: {
      ariaLabel: 'Side navigation menu',
      role: 'navigation',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use sidemenu for vertical navigation in sidebar or secondary layouts',
    'Extract: title from sidebar heading or section title',
    'Extract: sections from grouped navigation blocks with headings',
    'Extract: items from flat list structures (use when no section grouping)',
    'CurrentPath: Extract from active/current class or data attributes',
    'Nested Items: Extract children from collapsible/expandable menu structures',
    'PREFER sections over items when content has clear groupings',
    'ALWAYS place in sidebar layout, not main content area',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'Documentation',
    sections: [
      {
        heading: 'Getting Started',
        items: [
          { label: 'Introduction', href: '/docs/intro' },
          { label: 'Installation', href: '/docs/installation' },
          { label: 'Quick Start', href: '/docs/quickstart' },
        ],
      },
      {
        heading: 'Guides',
        items: [
          { label: 'Components', href: '/docs/components' },
          { label: 'Styling', href: '/docs/styling' },
          { label: 'Deployment', href: '/docs/deployment' },
        ],
      },
    ],
    currentPath: '/docs/intro',
    showExpandIcons: true,
    defaultCollapsed: false,
  },

  // Human-readable description
  description: 'Vertical navigation menu for secondary pages or dashboard layouts with grouped sections or flat items.',
})

// Export inferred TypeScript type
export type SideMenuContent = z.infer<typeof SideMenuDef.schema>
