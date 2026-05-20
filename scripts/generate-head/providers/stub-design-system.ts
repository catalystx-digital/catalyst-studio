import type { DesignSystem } from '@/lib/studio/import/types/design-system.types'

/**
 * Stub provider design system tokens.
 *
 * Update this file to tweak the default visual theme that the stub provider exports.
 * The structure matches the DesignSystem type captured during import.
 */
export const stubDesignSystemTokens: DesignSystem = {
  palette: {
    primary: [
      { name: 'brand-500', value: '#ef6820', confidence: 0.95, source: 'css-var', usageCount: 32, hex: '#ef6820' },
      { name: 'brand-600', value: '#e25713', confidence: 0.9, source: 'css-var', usageCount: 18, hex: '#e25713' }
    ],
    secondary: [
      { name: 'ink-900', value: '#0f172a', confidence: 0.92, source: 'css-var', usageCount: 24, hex: '#0f172a' },
      { name: 'ink-700', value: '#1e293b', confidence: 0.9, source: 'css-var', usageCount: 16, hex: '#1e293b' }
    ],
    accent: [
      { name: 'azure-500', value: '#0ea5e9', confidence: 0.9, source: 'css-var', usageCount: 12, hex: '#0ea5e9' },
      { name: 'emerald-500', value: '#10b981', confidence: 0.85, source: 'css-var', usageCount: 8, hex: '#10b981' },
      { name: 'danger-500', value: '#f43f5e', confidence: 0.85, source: 'css-var', usageCount: 6, hex: '#f43f5e' }
    ],
    neutral: [
      { name: 'graphite-900', value: '#111827', confidence: 0.95, source: 'css-var', usageCount: 40, hex: '#111827' },
      { name: 'graphite-700', value: '#334155', confidence: 0.93, source: 'css-var', usageCount: 32, hex: '#334155' },
      { name: 'graphite-500', value: '#64748b', confidence: 0.9, source: 'css-var', usageCount: 28, hex: '#64748b' },
      { name: 'graphite-300', value: '#94a3b8', confidence: 0.88, source: 'css-var', usageCount: 22, hex: '#94a3b8' }
    ],
    surface: [
      { name: 'canvas', value: '#fdf8f3', confidence: 0.92, source: 'css-var', usageCount: 14, hex: '#fdf8f3' },
      { name: 'panel', value: '#ffffff', confidence: 0.9, source: 'css-var', usageCount: 12, hex: '#ffffff' },
      { name: 'overlay', value: '#f1f5f9', confidence: 0.88, source: 'css-var', usageCount: 10, hex: '#f1f5f9' }
    ]
  },
  typography: {
    heading: [
      {
        name: 'display',
        fontFamily: '"Cal Sans", "Inter", sans-serif',
        fontSize: '3rem',
        fontWeight: 700,
        lineHeight: '1.1',
        confidence: 0.9,
        source: 'css',
        usageCount: 20
      }
    ],
    body: [
      {
        name: 'body',
        fontFamily: '"Inter", "SF Pro Text", -apple-system, sans-serif',
        fontSize: '1rem',
        fontWeight: 400,
        lineHeight: '1.6',
        confidence: 0.95,
        source: 'css',
        usageCount: 60
      },
      {
        name: 'body-strong',
        fontFamily: '"Inter", "SF Pro Text", -apple-system, sans-serif',
        fontSize: '1rem',
        fontWeight: 500,
        lineHeight: '1.6',
        confidence: 0.9,
        source: 'css',
        usageCount: 32
      }
    ],
    ui: [
      {
        name: 'ui',
        fontFamily: '"Inter", "SF Pro Text", -apple-system, sans-serif',
        fontSize: '0.95rem',
        fontWeight: 500,
        lineHeight: '1.5',
        confidence: 0.9,
        source: 'css',
        usageCount: 40
      }
    ]
  },
  spacing: {
    name: 'spacing-scale',
    unit: 'px',
    base: 4,
    confidence: 0.9,
    source: 'css',
    values: [
      { step: 1, value: 4, name: 'xs' },
      { step: 2, value: 8, name: 'sm' },
      { step: 3, value: 12, name: 'md' },
      { step: 4, value: 16, name: 'lg' },
      { step: 5, value: 24, name: 'xl' },
      { step: 6, value: 32, name: '2xl' },
      { step: 7, value: 48, name: '3xl' }
    ]
  },
  radii: {
    name: 'radius-scale',
    unit: 'px',
    base: 12,
    confidence: 0.88,
    source: 'css',
    values: [
      { step: 1, value: 6, name: 'sm' },
      { step: 2, value: 10, name: 'md' },
      { step: 3, value: 16, name: 'lg' },
      { step: 4, value: 9999, name: 'full' }
    ]
  },
  shadows: [
    { name: 'soft', value: '0 10px 30px rgba(15, 23, 42, 0.12)', confidence: 0.8, source: 'css', usageCount: 18 },
    { name: 'lifted', value: '0 25px 60px rgba(15, 23, 42, 0.18)', confidence: 0.78, source: 'css', usageCount: 12 }
  ],
  effects: [
    { name: 'transition-base', type: 'transition', value: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', confidence: 0.82, source: 'css' },
    { name: 'focus-ring', type: 'filter', value: 'drop-shadow(0 0 0 rgba(239, 104, 32, 0.4))', confidence: 0.65, source: 'css' }
  ],
  metadata: {
    sourceUrls: ['https://demo.catalyst.dev'],
    capturedAt: '2025-01-10T00:00:00.000Z',
    confidence: 0.92,
    extractionMethod: 'deterministic',
    version: '1.0.0'
  },
  diagnostics: [],
  version: '1.0.0'
}
