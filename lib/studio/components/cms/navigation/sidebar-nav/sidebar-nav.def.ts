/**
 * Sidebar Navigation Component Definition
 *
 * Hierarchical sidebar navigation for "In this section" style navigation.
 * Commonly used on documentation pages, content hubs, and service detail pages.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { MenuItemSchema, SmartLinkSchema } from '../../_core/value-objects'

/**
 * Back link configuration schema
 */
const SidebarNavBackLinkSchema = z.object({
  label: z.string().describe('Back link label text'),
  href: z.union([SmartLinkSchema, z.string()]).describe('Back link destination URL'),
})

/**
 * Sidebar Navigation component definition
 */
export const SidebarNavDef = defineComponent({
  type: ComponentType.SidebarNav,
  category: ComponentCategory.Navigation,

  // Zod schema (single source of truth for props)
  schema: z.object({
    title: z.string().optional().describe('Optional heading for the sidebar section (e.g., "In this section")'),
    items: z.array(MenuItemSchema).describe('Navigation items with labels, hrefs, and optional children'),
    currentPath: z.string().optional().describe('Current page path for highlighting active items'),
    showExpandIcons: z.boolean().optional().describe('Whether to show expand/collapse icons for items with children'),
    defaultCollapsed: z.boolean().optional().describe('Whether to collapse all expandable items by default'),
    showBackLink: z.boolean().optional().describe('Whether to show a back/parent navigation link'),
    backLink: SidebarNavBackLinkSchema.optional().describe('Configuration for the back link (label and href)'),
    maxDepth: z.number().optional().describe('Maximum nesting depth to display'),
  }),

  // Detection metadata
  detection: {
    keywords: ['sidebar', 'navigation', 'toc', 'in this section', 'on this page', 'table of contents', 'section nav'],
    patterns: ['sidebar-nav', 'side-nav(?:igation)?', 'section-nav', 'toc', 'table.*contents'],
    commonNames: ['Sidebar Nav', 'Section Navigation', 'Table of Contents', 'In This Section', 'On This Page'],
    pageLocation: ['sidebar'],
    confidence: 0.8,
    relatedComponents: [ComponentType.NavBar, ComponentType.Breadcrumbs, ComponentType.Footer],
    semanticRole: 'navigation',
    suggestedVariants: ['default', 'minimal', 'bordered', 'filled'],
    accessibility: {
      role: 'navigation',
      ariaLabel: 'Section navigation',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use sidebar-nav for hierarchical section navigation in sidebars',
    'Extract: title from sidebar heading (e.g., "In this section", "On this page")',
    'Extract: items as nav-menu-item subcomponents with nested hierarchy',
    'Extract: showExpandIcons if collapse/expand UI is present',
    'Extract: backLink configuration if parent/back navigation link exists',
    'Common use cases: Documentation sites, content hubs, service pages',
    'Position: Typically in left or right sidebar adjacent to main content',
    'NEVER use for primary site navigation - use navbar instead',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'In this section',
    items: [
      {
        label: 'Getting Started',
        href: '/docs/getting-started',
        children: [
          { label: 'Installation', href: '/docs/getting-started/installation' },
          { label: 'Configuration', href: '/docs/getting-started/configuration' },
        ],
      },
      {
        label: 'Components',
        href: '/docs/components',
        children: [
          { label: 'Button', href: '/docs/components/button' },
          { label: 'Card', href: '/docs/components/card' },
        ],
      },
      {
        label: 'API Reference',
        href: '/docs/api',
      },
    ],
    currentPath: '/docs/getting-started/installation',
    showExpandIcons: true,
    defaultCollapsed: false,
    showBackLink: true,
    backLink: {
      label: 'Back to Documentation',
      href: '/docs',
    },
    maxDepth: 3,
  },

  // Human-readable description
  description: 'Hierarchical sidebar navigation for "In this section" style navigation. Commonly used on documentation pages, content hubs, and service detail pages.',
})

// Export inferred TypeScript type
export type SidebarNavContent = z.infer<typeof SidebarNavDef.schema>
