/**
 * Chart Component Definition
 *
 * Data visualization card supporting bar, line, and donut charts with multi-series support.
 * Single source of truth for all metadata.
 */

import { z } from 'zod'
import { defineComponent } from '../../_core/component-definition'
import { ComponentType, ComponentCategory } from '../../_core/types'

/**
 * Chart data point schema (single-series)
 */
const ChartDataPointSchema = z.object({
  id: z.string().optional().describe('Unique data point identifier'),
  label: z.string().optional().describe('Data point label'),
  value: z.union([z.number(), z.string()]).describe('Data point value'),
  tone: z.enum(['accent', 'positive', 'negative', 'neutral']).optional().describe('Visual tone for styling'),
})

/**
 * Chart series schema (multi-series)
 */
const ChartSeriesSchema = z.object({
  id: z.string().optional().describe('Unique series identifier'),
  name: z.string().optional().describe('Series name for legend'),
  values: z.array(z.union([z.number(), z.string()])).optional().describe('Series data values aligned with categories'),
  tone: z.enum(['accent', 'positive', 'negative', 'neutral']).optional().describe('Visual tone for styling'),
  icon: z.string().optional().describe('Optional icon for legend'),
})

/**
 * Chart component definition
 */
export const ChartDef = defineComponent({
  type: ComponentType.Chart,
  category: ComponentCategory.Data,

  // Zod schema (single source of truth for props)
  schema: z.object({
    title: z.string().optional().describe('Chart heading displayed above the visualization'),
    description: z.string().optional().describe('Rich text description shown under the heading for additional context'),
    type: z.enum(['bar', 'line', 'donut']).optional().describe('Chart visualization type (currently only bar charts render fully)'),
    categories: z.array(z.string()).optional().describe('Category axis labels for multi-series data (auto-generated if omitted)'),
    data: z.array(ChartDataPointSchema).optional().describe('Simple data list for single-series charts (use when series is not provided)'),
    series: z.array(ChartSeriesSchema).optional().describe('Multi-series dataset for grouped comparisons (values align with categories)'),
    unitLabel: z.string().optional().describe('Units appended to values (e.g., "%", "ms") in tooltips and labels'),
    footnote: z.string().optional().describe('Caption text rendered beneath the visualization for methodology notes'),
  }),

  // Detection metadata (replaces chart.ai.ts)
  detection: {
    keywords: [
      'chart',
      'bar chart',
      'line chart',
      'donut chart',
      'graph',
      'data viz',
      'analytics',
      'kpi',
      'metrics',
      'visualization',
    ],
    patterns: [
      'bar\\s+chart',
      'line\\s+chart',
      'donut\\s+chart',
      'data\\s+(visualization|viz)',
      'analytics\\s+chart',
      'performance\\s+(graph|chart)',
    ],
    commonNames: [
      'chart',
      'data-chart',
      'metrics-chart',
      'analytics-card',
      'kpi-chart',
    ],
    pageLocation: ['main', 'sidebar'],
    confidence: 0.78,
    relatedComponents: [ComponentType.Statistics, ComponentType.DataTable],
    semanticRole: 'figure',
    accessibility: {
      role: 'region',
      ariaLabel: 'Data visualization card',
    },
  },

  // LLM extraction directives
  directives: [
    'PRIORITY: Use chart for data visualizations (bar, line, donut charts)',
    'Extract: title from heading above chart',
    'Extract: description from descriptive text near chart',
    'Extract: type from chart visual style (bar/line/donut)',
    'Extract: data from single-series chart data points',
    'Extract: series from multi-series chart data (multiple datasets)',
    'Extract: categories from x-axis labels or category names',
    'Extract: unitLabel from value suffixes (%, $, ms, etc.)',
    'Extract: footnote from small text below chart',
    'For multi-series charts, align series values with category labels',
    'Detect tone from color coding (accent/positive/negative/neutral)',
  ],

  // Sample content for AI tools and testing
  sample: {
    title: 'Quarterly Revenue',
    description: 'Revenue growth across all product lines for Q1-Q4 2023',
    type: 'bar',
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [
      {
        id: 'product-a',
        name: 'Product A',
        values: [120, 145, 180, 210],
        tone: 'accent',
      },
      {
        id: 'product-b',
        name: 'Product B',
        values: [90, 110, 125, 140],
        tone: 'positive',
      },
    ],
    unitLabel: 'K',
    footnote: 'All values in thousands of USD',
  },

  // Human-readable description
  description: 'Data visualization card supporting bar, line, and donut charts with multi-series support.',
})

// Export inferred TypeScript type
export type ChartContent = z.infer<typeof ChartDef.schema>
