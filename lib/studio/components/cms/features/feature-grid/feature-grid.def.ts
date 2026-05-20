/**
 * Feature Grid Component Definition
 *
 * Grid layout highlighting multiple features with optional headers and configurable columns.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { FeatureItemSchema } from '../../_core/value-objects'

/**
 * Feature Grid component definition
 */
export const FeatureGridDef = defineComponent({
  type: ComponentType.FeatureGrid,
  category: ComponentCategory.Features,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().optional().describe('Optional section heading'),
    subheading: z.string().optional().describe('Optional section subheading'),
    features: z.array(FeatureItemSchema).describe('Array of feature items to display in grid'),
    columns: z.number().int().min(2).max(4).optional().describe('Number of columns in grid layout (2-4)'),
  }),

  // Detection metadata (replaces feature-grid.ai.ts)
  detection: {
    keywords: ['features', 'services', 'offerings', 'capabilities', 'what we do', 'solutions'],
    patterns: [
      'features?[\\s-]?(grid|list|section)',
      'services?[\\s-]?(overview|summary)',
      'our[\\s-]?capabilities',
      'what[\\s-]?we[\\s-]?(do|offer)',
      'solutions?[\\s-]?overview',
    ],
    commonNames: ['FeatureGrid', 'ServiceGrid', 'CapabilitiesGrid', 'SolutionsGrid'],
    pageLocation: ['main'],
    confidence: 0.85,
    relatedComponents: [ComponentType.FeatureList, ComponentType.CardGrid],
  },

  // LLM extraction directives
  directives: [
    'Data requirements: "features[]" must list every visible card in order. Each entry MUST be type "feature-item" and include icon, title, description, and optional link { text, url } pulled from the UI.',
    'Do not respond with summary-only feature grids. Populate the required array and nested fields exactly as rendered.',
    'Example payload:',
    '  "features": [',
    '    {',
    '      "type": "feature-item",',
    '      "icon": "/icons/welcoming.svg",',
    '      "title": "Welcoming schools",',
    '      "description": "Every child is known, valued, and cared for from day one.",',
    '      "link": { "text": "Learn more", "url": "/why-us/welcoming-schools" }',
    '    }',
    '  ]',
    'Mapping guidance: read each feature tile/card in DOM order. Use the feature headline for feature-item.title, supporting text for description, icon/img src for icon, and CTA anchors as link { text, url }. Preserve ordering exactly.',
    'If the layout shows additional metadata (e.g., columns count), capture it using the documented props.',
    'If features[] comes back empty, fetch the section again and continue until each feature-item is captured.',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Our Core Features',
    subheading: 'Everything you need to succeed',
    features: [
      { icon: 'zap', title: 'Fast Performance', description: 'Lightning-fast load times' },
      { icon: 'shield', title: 'Secure', description: 'Enterprise-grade security' },
      { icon: 'users', title: 'Collaborative', description: 'Built for teams' },
    ],
    columns: '3',
  },

  // Human-readable description
  description: 'Grid layout highlighting multiple features with optional headers and configurable columns.',
})

// Export inferred TypeScript type
export type FeatureGridContent = z.infer<typeof FeatureGridDef.schema>
