/**
 * Statistics Component Definition
 *
 * Key performance indicators and metrics displayed as stats with labels, delta trends, and optional icons.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'
import { StatItemSchema } from '../../_core/value-objects'

/**
 * Statistics component definition
 */
export const StatisticsDef = defineComponent({
  type: ComponentType.Statistics,
  category: ComponentCategory.Data,

  // Zod schema (single source of truth for props)
  schema: z.object({
    title: z.string().optional().describe('Section title above statistics'),
    subtitle: z.string().optional().describe('Section subtitle'),
    stats: z.array(StatItemSchema).describe('Array of statistics to display'),
    animateOnScroll: z.boolean().optional().describe('Whether to animate when scrolling into view'),
    animationDuration: z.number().optional().describe('Default animation duration for all stats'),
    layout: z.enum(['grid', 'row']).optional().describe('Layout style for statistics'),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional().describe('Number of columns in grid layout'),
  }),

  // Detection metadata (replaces statistics.ai.ts)
  detection: {
    keywords: [
      'statistics',
      'numbers',
      'metrics',
      'counter',
      'achievements',
      'stats',
      'key metrics',
      'performance',
      'results',
      'data points',
      'kpis',
      'milestones',
      'facts',
      'figures',
    ],
    patterns: [
      'statistics?\\s*(section|block|display)?',
      'key\\s+(metrics?|numbers?|stats?)',
      'performance\\s+(metrics?|indicators?)',
      'achievements?\\s*(section)?',
      'counter\\s*(section|block)?',
      'by\\s+the\\s+numbers?',
      'our\\s+(results?|numbers?|impact)',
    ],
    commonNames: [
      'statistics',
      'stats-counter',
      'metrics-display',
      'number-counter',
      'achievements',
      'key-metrics',
    ],
    pageLocation: ['main', 'hero'],
    confidence: 0.75,
    relatedComponents: [ComponentType.Chart, ComponentType.DataTable],
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use statistics for displaying key metrics, KPIs, and achievement numbers',
    'Extract: title from section heading',
    'Extract: stats from numeric values with labels',
    'Extract: value from the number itself (convert to number)',
    'Extract: label from text describing the stat',
    'Extract: prefix/suffix from symbols near the number (e.g., "$", "%", "K", "M")',
    'Extract: delta from change indicators (e.g., "+12%", "↑ 15%")',
    'Detect trend direction from symbols (↑/↓, +/-, green/red colors)',
    'Detect layout from visual arrangement (grid vs row)',
    'Count columns in grid layout (2, 3, or 4)',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'Our Impact',
    subtitle: 'Key metrics showing our growth',
    stats: [
      {
        id: 'users',
        value: 50000,
        label: 'Active Users',
        suffix: '+',
        icon: 'users',
        delta: { value: 12, label: 'vs last month', trend: 'up' },
      },
      {
        id: 'revenue',
        value: 2.5,
        label: 'Revenue',
        prefix: '$',
        suffix: 'M',
        decimalPlaces: 1,
        delta: { value: 8, label: 'vs last quarter', trend: 'up' },
      },
      {
        id: 'satisfaction',
        value: 98,
        label: 'Customer Satisfaction',
        suffix: '%',
        icon: 'star',
      },
      {
        id: 'countries',
        value: 45,
        label: 'Countries',
        icon: 'globe',
      },
    ],
    animateOnScroll: true,
    animationDuration: 2000,
    layout: 'grid',
    columns: 4,
  },

  // Human-readable description
  description: 'Key performance indicators and metrics displayed as stats with labels, delta trends, and optional icons.',
})

// Export inferred TypeScript type
export type StatisticsContent = z.infer<typeof StatisticsDef.schema>
