/**
 * Tabs Component Definition
 *
 * Tabbed content interface with labeled tabs, orientation, and alignment options.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { TabItemSchema } from '../../_core/value-objects'

/**
 * Tabs component definition
 */
export const TabsDef = defineComponent({
  type: ComponentType.Tabs,
  category: ComponentCategory.Content,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().optional().describe('Section heading displayed above the tabs'),
    subheading: z.string().optional().describe('Supporting text displayed below the heading'),
    tabs: z.array(TabItemSchema).describe('List of tab items with labels and content panels'),
    defaultTab: z.string().optional().describe('ID of the tab that should be active by default'),
    defaultActiveTab: z.string().optional().describe('Alias for defaultTab (alternative naming)'),
    orientation: z.enum(['horizontal', 'vertical']).optional().describe('Tabs layout direction'),
    align: z.enum(['left', 'center', 'right', 'justified']).optional().describe('Horizontal alignment of tab labels'),
  }),

  // Detection metadata
  detection: {
    keywords: [
      'tabs',
      'tab panel',
      'tabbed content',
      'tab navigation',
      'tab switcher',
      'tabbed interface',
      'tab control',
      'tab menu',
      'switchable content',
      'tab list',
      'tabpanel',
      'nav tabs',
      'content tabs',
    ],
    patterns: [
      'class.*tabs',
      'class.*tab-',
      'role.*tablist',
      'role.*tab',
      'role.*tabpanel',
      'aria-selected',
      'data-tabs',
      'nav.*tabs',
      'tab-content',
      'tab-pane',
      'tabpanel',
      'tab-button',
    ],
    commonNames: [
      'Tabs',
      'TabPanel',
      'TabbedContent',
      'TabNavigation',
      'TabContainer',
      'TabGroup',
      'TabList',
      'TabSwitcher',
      'ContentTabs',
      'NavigationTabs',
    ],
    pageLocation: ['main', 'hero'],
    confidence: 0.88,
    relatedComponents: [ComponentType.Accordion, ComponentType.TextBlock],
    industry: ['general', 'documentation', 'product', 'education'],
    semanticRole: 'navigation-content',
    accessibility: {
      ariaLabel: 'Content Tabs',
      role: 'tablist',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use tabs for switchable content panels with labeled navigation',
    'Extract: heading from section title above tabs',
    'Extract: tabs from role="tablist" or tab navigation elements',
    'Extract: defaultTab from aria-selected or active class on tab',
    'Extract: orientation from horizontal or vertical tab layout',
    'Extract: align from tab label alignment (left/center/right/justified)',
    'NEVER nest tabs components - use flat list of tab-item components',
    'Map aria-selected and role="tab" attributes to tab items',
    'Ideal for product features, documentation sections, categorized content',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Product Features',
    subheading: 'Explore our key capabilities',
    tabs: [
      {
        id: 'performance',
        label: 'Performance',
        content: 'Lightning-fast performance with optimized code and caching.',
      },
      {
        id: 'security',
        label: 'Security',
        content: 'Enterprise-grade security with encryption and compliance.',
      },
      {
        id: 'scalability',
        label: 'Scalability',
        content: 'Scale seamlessly from startup to enterprise.',
      },
    ],
    defaultTab: 'performance',
    orientation: 'horizontal',
    align: 'left',
  },

  // Human-readable description
  description: 'Tabbed content interface with labeled tabs, orientation, and alignment options.',
})

// Export inferred TypeScript type
export type TabsContent = z.infer<typeof TabsDef.schema>
