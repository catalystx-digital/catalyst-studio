/**
 * Breadcrumbs Component Definition
 *
 * Automatically generated breadcrumb trail reflecting the current page hierarchy with optional display tweaks.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { LinkSchema } from '../../_core/value-objects'

/**
 * Breadcrumbs component definition
 */
export const BreadcrumbsDef = defineComponent({
  type: ComponentType.Breadcrumbs,
  category: ComponentCategory.Navigation,

  // Zod schema (single source of truth for props)
  schema: z.object({
    items: z.array(LinkSchema).optional().describe('System-generated breadcrumb entries derived from site structure. Typically read-only.'),
    separator: z.enum(['/', '>', '→', '•']).optional().describe('Visual separator rendered between breadcrumb links'),
    showHome: z.boolean().optional().describe('Whether to prepend a home link automatically'),
    homeLabel: z.string().optional().describe('Text label to use for the optional home breadcrumb'),
  }),

  // Detection metadata
  detection: {
    keywords: ['breadcrumbs', 'breadcrumb', 'navigation-path', 'trail', 'path'],
    patterns: [
      'breadcrumb',
      'navigation.*path',
      'trail',
      'page.*path',
    ],
    commonNames: ['breadcrumbs', 'breadcrumb trail', 'navigation path'],
    pageLocation: ['header', 'main'],
    confidence: 0.90,
    suggestedVariants: ['default', 'minimal'],
    semanticRole: 'navigation',
    accessibility: {
      ariaLabel: 'Breadcrumb navigation',
      role: 'navigation',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use breadcrumbs for hierarchical navigation trails',
    'Extract: items as array of links showing page ancestry (Home > Section > Page)',
    'Extract: separator character if custom (default is >)',
    'Extract: showHome and homeLabel if home link is explicitly shown',
    'SYSTEM-GENERATED: Items are typically auto-generated from site structure',
    'READ-ONLY: Breadcrumb items usually derived from page hierarchy, not manually edited',
    'Position: Usually appears below header and above main content',
  ],

  // Sample content for AI tools and testing
  sample: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Products', href: '/products' },
      { label: 'Software', href: '/products/software' },
    ],
    separator: '>',
    showHome: true,
    homeLabel: 'Home',
  },

  // Human-readable description
  description: 'Automatically generated breadcrumb trail reflecting the current page hierarchy with optional display tweaks.',
})

// Export inferred TypeScript type
export type BreadcrumbsContent = z.infer<typeof BreadcrumbsDef.schema>
