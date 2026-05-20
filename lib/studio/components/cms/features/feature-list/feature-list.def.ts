/**
 * Feature List Component Definition
 *
 * List-based feature presentation with icons, titles, descriptions, and optional links.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { FeatureItemSchema } from '../../_core/value-objects'

/**
 * Feature List component definition
 */
export const FeatureListDef = defineComponent({
  type: ComponentType.FeatureList,
  category: ComponentCategory.Features,

  // Zod schema (single source of truth for props)
  schema: z.object({
    heading: z.string().optional().describe('Optional section heading'),
    subheading: z.string().optional().describe('Optional section subheading'),
    items: z.array(FeatureItemSchema).describe('Array of feature items to display in list'),
    layout: z.enum(['vertical', 'horizontal']).optional().describe('Layout orientation for feature items'),
  }),

  // Detection metadata (replaces feature-list.ai.ts)
  detection: {
    keywords: ['benefits', 'features', 'list', 'advantages', 'highlights', 'points'],
    patterns: [
      'benefits?[\\s-]?(list|section)',
      'features?[\\s-]?list',
      'advantages?',
      'key[\\s-]?points',
      'highlights?',
      'bullet[\\s-]?points',
    ],
    commonNames: ['FeatureList', 'BenefitsList', 'AdvantagesList', 'KeyPoints'],
    pageLocation: ['main', 'sidebar'],
    confidence: 0.80,
    relatedComponents: [ComponentType.FeatureGrid],
  },

  // LLM extraction directives
  directives: [
    'Leverage feature-list for icon-based quick links and utility tiles that sit beside the hero or underneath the trading-hours strip. Map each tile (Opening Hours, Store Directory, Centre Map, Getting Here, etc.) to feature-item entries with heading=label, description/body when present, icon text/emoji, and link.url/link.text populated from the actual anchor.',
    '*** IMAGE/ICON EXTRACTION: When feature items contain <img> tags (not just emoji/text icons), extract the image URL into feature-item.icon or feature-item.image. Convert relative URLs to absolute. ***',
    'When the quick-link rail renders in the header, force region="header" and order the feature-list between the trading-hours CTA and the navbar so export preserves the multi-row structure.',
    'Do not collapse multiple rows of quick links into prose; keep every tile as its own feature-item and retain the DOM order so analytics and navigation parity hold across centres.',
  ],

  // Sample content for AI tools and testing
  sample: {
    heading: 'Key Benefits',
    subheading: 'Why choose our platform',
    items: [
      { icon: 'check', title: 'Easy to Use', description: 'Intuitive interface for everyone' },
      { icon: 'star', title: 'Best in Class', description: 'Industry-leading performance' },
      { icon: 'trending-up', title: 'Scalable', description: 'Grows with your business' },
    ],
    layout: 'vertical',
  },

  // Human-readable description
  description: 'List-based feature presentation with icons, titles, descriptions, and optional links.',
})

// Export inferred TypeScript type
export type FeatureListContent = z.infer<typeof FeatureListDef.schema>
