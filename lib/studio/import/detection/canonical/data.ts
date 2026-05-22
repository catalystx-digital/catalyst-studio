import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { registerCanonicalComponent } from './registry'
import type { CanonicalComponentDefinition } from './registry'

let registered = false

export const dataCanonicalDefinitions: CanonicalComponentDefinition[] = [
  {
    canonicalType: ComponentType.Chart,
    componentType: ComponentType.Chart,
    summary: 'Data visualization block supporting bar, line, or pie charts driven by structured datasets.',
    fragments: ['chart-area', 'legend', 'data-series'],
    cues: ['chart', 'data visualization', 'analytics'],
    sampleContent: {
      title: 'Quarterly growth',
      description: 'Comparison of ARR by quarter.',
      type: 'bar',
      categories: ['Q1', 'Q2', 'Q3', 'Q4'],
      series: [
        { name: '2023', values: [1.2, 1.6, 2.1, 2.8] },
        { name: '2024', values: [2.0, 2.5, 3.1, 3.7] }
      ],
      yAxisLabel: 'ARR (in millions)'
    }
  },
  {
    canonicalType: ComponentType.Statistics,
    componentType: ComponentType.Statistics,
    summary: 'Statistics section for metrics, KPIs, impact numbers, or quantified proof points.',
    fragments: ['stat', 'stat-label'],
    cues: ['statistics', 'kpi', 'metrics'],
    sampleContent: {
      title: 'Impact by the numbers',
      stats: [
        { id: 'velocity', value: 4, suffix: 'x', label: 'Faster publishing cycles' },
        { id: 'adoption', value: 92, suffix: '%', label: 'Editor adoption across teams' }
      ],
      layout: 'grid'
    }
  },
  {
    canonicalType: ComponentType.DataTable,
    componentType: ComponentType.DataTable,
    summary: 'Data table for structured rows and columns such as feature matrices or comparisons.',
    fragments: ['table-header', 'table-row'],
    cues: ['data table', 'spec table', 'comparison table'],
    sampleContent: {
      title: 'Feature matrix',
      columns: [
        { key: 'feature', label: 'Feature' },
        { key: 'starter', label: 'Starter' },
        { key: 'enterprise', label: 'Enterprise' }
      ],
      rows: [
        { id: 'workflow', feature: 'Workflow automation', starter: '—', enterprise: '✔' },
        { id: 'roles', feature: 'Advanced roles', starter: '—', enterprise: '✔' }
      ],
      pagination: { enabled: false }
    }
  }
]

export function registerDataCanonicalComponents(): void {
  if (registered) {
    return
  }

  for (const definition of dataCanonicalDefinitions) {
    registerCanonicalComponent(definition)
  }

  registered = true
}
