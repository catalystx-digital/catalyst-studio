/**
 * Mobile Menu Component Definition
 *
 * Mobile navigation drawer with hierarchical items, supporting left/right slide or fade animations.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { MenuItemSchema } from '../../_core/value-objects'

/**
 * Mobile Menu component definition
 */
export const MobileMenuDef = defineComponent({
  type: ComponentType.MobileMenu,
  category: ComponentCategory.Navigation,

  // Zod schema (single source of truth for props)
  schema: z.object({
    menuItems: z.array(MenuItemSchema).describe('Navigation items displayed in the mobile drawer, managed as nav-menu-item subcomponents'),
    position: z.enum(['left', 'right']).optional().describe('Side of the viewport where the mobile drawer appears'),
    animation: z.enum(['slide', 'fade']).optional().describe('Transition style applied when toggling the mobile menu'),
  }),

  // Detection metadata
  detection: {
    keywords: ['mobile-menu', 'hamburger', 'burger-menu', 'mobile-nav', 'drawer', 'slide-menu'],
    patterns: [
      'mobile.*menu',
      'hamburger.*menu',
      'burger.*menu',
      'drawer.*menu',
      'slide.*menu',
    ],
    commonNames: ['mobile menu', 'hamburger menu', 'burger menu', 'drawer menu'],
    pageLocation: ['header'],
    confidence: 0.85,
    suggestedVariants: ['default', 'minimal'],
    semanticRole: 'navigation',
    accessibility: {
      ariaLabel: 'Mobile navigation menu',
      role: 'navigation',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use mobile-menu for mobile/responsive navigation drawers',
    'Extract: menuItems as nav-menu-item subcomponents mirroring primary navigation',
    'Extract: position from drawer slide direction (left or right)',
    'Extract: animation style if visible (slide or fade)',
    'RELATIONSHIP: Mobile menu typically mirrors navbar menuItems',
    'ACTIVATION: Triggered by hamburger icon at mobile breakpoints',
    'NEVER use for desktop navigation - use navbar instead',
  ],

  // Sample content for AI tools and testing
  sample: {
    menuItems: [
      { label: 'Home', href: '/' },
      {
        label: 'Products',
        href: '/products',
        children: [
          { label: 'Software', href: '/products/software' },
          { label: 'Hardware', href: '/products/hardware' },
        ],
      },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
    position: 'left',
    animation: 'slide',
  },

  // Human-readable description
  description: 'Mobile navigation drawer with hierarchical items, supporting left/right slide or fade animations.',
})

// Export inferred TypeScript type
export type MobileMenuContent = z.infer<typeof MobileMenuDef.schema>
