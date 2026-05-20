/**
 * Tests for shadcn-transformer
 *
 * Tests the Brand + Polish approach:
 * - Brand identity colors (primary, secondary, ring) are extracted from source
 * - UI polish variables use shadcn defaults for consistent, modern appearance
 */

import { describe, it, expect } from 'vitest'
import {
  toShadcnVariables,
  generateExportCss,
  BRAND_VARIABLES,
  UI_POLISH_VARIABLES,
  type ShadcnDesignSystemTokens,
} from '../shadcn-transformer'
import { SHADCN_DEFAULTS, SHADCN_VARIABLE_NAMES } from '../shadcn-defaults'
import type { DomDesignSystemCapture, DomPaletteCapture } from '../dom-probe/types'

// Helper to create minimal capture data
function createMockCapture(palette: Partial<DomPaletteCapture> = {}): DomDesignSystemCapture {
  return {
    metadata: {
      baseline: 'test',
      url: 'https://example.com',
      timestamp: new Date().toISOString(),
      runId: 'test-run',
      runnerVersion: '1.0.0',
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      browser: { name: 'chromium', version: '1.0', userAgent: 'test' },
      timings: [],
      captureDurationMs: 1000,
      cached: false,
      artifacts: { runLog: '', captureJson: '', domSnapshot: '', screenshots: [], manifest: '' },
      configuration: { refreshRequested: false, evaluationRequested: false, flags: {}, playwright: {} },
    },
    typography: [],
    palette: {
      colors: [],
      primary: null,
      secondary: null,
      neutrals: [],
      accent: [],
      surface: [],
      ...palette,
    },
    spacing: { baseUnitPx: null, scale: [] },
    components: [],
    diagnostics: { errors: [], warnings: [], infos: [], missingFonts: [], consoleErrors: [] },
    rawDomSnapshotPath: '',
  }
}

describe('toShadcnVariables', () => {
  it('should return all shadcn variable names', () => {
    const capture = createMockCapture()
    const result = toShadcnVariables(capture)

    // Should have all required variable names
    for (const varName of SHADCN_VARIABLE_NAMES) {
      expect(result.variables).toHaveProperty(varName)
    }
  })

  it('should extract primary color from palette', () => {
    const capture = createMockCapture({
      primary: { hex: '#ff0000', rgb: 'rgb(255,0,0)', occurrences: 10, cssProperties: [], sampleSelectors: [] },
    })
    const result = toShadcnVariables(capture)

    // Primary should be converted to HSL (red = 0 100% 50%)
    expect(result.variables['--primary']).toBe('0 100% 50%')
    expect(result.extraction.source).toBe('mixed')
    expect(result.extraction.detectedCount).toBe(3) // primary, primary-foreground, ring
  })

  it('should use defaults for missing colors', () => {
    const capture = createMockCapture() // Empty palette
    const result = toShadcnVariables(capture)

    // Should fall back to SHADCN_DEFAULTS for ALL colors including primary
    expect(result.variables['--primary']).toBe(SHADCN_DEFAULTS['--primary'])
    expect(result.extraction.source).toBe('default')
    expect(result.extraction.detectedCount).toBe(0)
  })

  it('should include extraction metadata', () => {
    const capture = createMockCapture()
    const result = toShadcnVariables(capture)

    expect(result.extraction).toHaveProperty('timestamp')
    expect(result.extraction).toHaveProperty('confidence')
    expect(result.extraction).toHaveProperty('source')
    expect(result.extraction).toHaveProperty('detectedCount')
    expect(result.extraction).toHaveProperty('defaultCount')
  })
})

describe('toShadcnVariables - Brand + Polish approach', () => {
  it('should extract primary color as brand identity', () => {
    const capture = createMockCapture({
      primary: { hex: '#ff6600', rgb: 'rgb(255,102,0)', occurrences: 10, cssProperties: [], sampleSelectors: [] },
    })
    const result = toShadcnVariables(capture)

    // Primary should be extracted (brand color)
    expect(result.variables['--primary']).toBe('24 100% 50%') // Orange in HSL
    expect(result.extraction.detectedCount).toBe(3) // primary, primary-foreground, ring
  })

  it('should use shadcn defaults for UI polish variables', () => {
    const capture = createMockCapture({
      primary: { hex: '#ff6600', rgb: 'rgb(255,102,0)', occurrences: 10, cssProperties: [], sampleSelectors: [] },
      // Even if neutrals are provided, they should be IGNORED
      neutrals: [{ hex: '#3d5567', rgb: 'rgb(61,85,103)', occurrences: 5, cssProperties: [], sampleSelectors: [] }],
    })
    const result = toShadcnVariables(capture)

    // UI polish should use shadcn defaults, NOT extracted values
    expect(result.variables['--muted']).toBe(SHADCN_DEFAULTS['--muted'])
    expect(result.variables['--muted-foreground']).toBe(SHADCN_DEFAULTS['--muted-foreground'])
    expect(result.variables['--border']).toBe(SHADCN_DEFAULTS['--border'])
    expect(result.variables['--accent']).toBe(SHADCN_DEFAULTS['--accent'])
  })

  it('should NOT extract background/foreground from source', () => {
    const capture = createMockCapture({
      surface: [{ hex: '#f5f5dc', rgb: 'rgb(245,245,220)', occurrences: 10, cssProperties: [], sampleSelectors: [] }],
    })
    const result = toShadcnVariables(capture)

    // Should use shadcn default white, not extracted beige
    expect(result.variables['--background']).toBe(SHADCN_DEFAULTS['--background'])
    expect(result.variables['--foreground']).toBe(SHADCN_DEFAULTS['--foreground'])
  })

  it('should extract secondary color when available', () => {
    const capture = createMockCapture({
      primary: { hex: '#ff6600', rgb: 'rgb(255,102,0)', occurrences: 10, cssProperties: [], sampleSelectors: [] },
      secondary: { hex: '#0066ff', rgb: 'rgb(0,102,255)', occurrences: 5, cssProperties: [], sampleSelectors: [] },
    })
    const result = toShadcnVariables(capture)

    expect(result.variables['--secondary']).toBeDefined()
    // secondary should NOT equal the shadcn default since it was extracted
    expect(result.variables['--secondary']).not.toBe(SHADCN_DEFAULTS['--secondary'])
    expect(result.extraction.detectedCount).toBe(5) // primary(3) + secondary(2)
  })

  it('should set ring to match primary brand color', () => {
    const capture = createMockCapture({
      primary: { hex: '#ff6600', rgb: 'rgb(255,102,0)', occurrences: 10, cssProperties: [], sampleSelectors: [] },
    })
    const result = toShadcnVariables(capture)

    expect(result.variables['--ring']).toBe(result.variables['--primary'])
  })

  it('should NOT extract accent or destructive colors (use defaults)', () => {
    const capture = createMockCapture({
      primary: { hex: '#ff6600', rgb: 'rgb(255,102,0)', occurrences: 10, cssProperties: [], sampleSelectors: [] },
      accent: [{ hex: '#00ff00', rgb: 'rgb(0,255,0)', occurrences: 5, cssProperties: [], sampleSelectors: [] }],
      // Even red-ish colors should not be extracted as destructive
      colors: [{ hex: '#ff0000', rgb: 'rgb(255,0,0)', occurrences: 3, cssProperties: [], sampleSelectors: [], role: 'error' }],
    })
    const result = toShadcnVariables(capture)

    // Accent and destructive should use shadcn defaults
    expect(result.variables['--accent']).toBe(SHADCN_DEFAULTS['--accent'])
    expect(result.variables['--destructive']).toBe(SHADCN_DEFAULTS['--destructive'])
  })

  it('should preserve brand colors in dark mode', () => {
    const capture = createMockCapture({
      primary: { hex: '#ff6600', rgb: 'rgb(255,102,0)', occurrences: 10, cssProperties: [], sampleSelectors: [] },
    })
    const result = toShadcnVariables(capture)

    // Dark mode should also have the brand primary color
    expect(result.darkVariables!['--primary']).toBe(result.variables['--primary'])
    // But UI polish should use shadcn dark defaults
    expect(result.darkVariables!['--background']).not.toBe(result.variables['--background'])
  })

  it('should classify variables correctly', () => {
    // Verify the constants are defined correctly
    expect(BRAND_VARIABLES).toContain('--primary')
    expect(BRAND_VARIABLES).toContain('--secondary')
    expect(BRAND_VARIABLES).toContain('--ring')

    expect(UI_POLISH_VARIABLES).toContain('--muted')
    expect(UI_POLISH_VARIABLES).toContain('--border')
    expect(UI_POLISH_VARIABLES).toContain('--background')
    expect(UI_POLISH_VARIABLES).toContain('--accent')
    expect(UI_POLISH_VARIABLES).toContain('--destructive')
  })
})

describe('generateExportCss', () => {
  it('should generate valid CSS with :root and .dark selectors', () => {
    const tokens: ShadcnDesignSystemTokens = {
      variables: { '--primary': '240 5.9% 10%', '--background': '0 0% 100%' },
      darkVariables: { '--primary': '0 0% 98%', '--background': '240 10% 3.9%' },
      extraction: { timestamp: '', confidence: 1, source: 'detected', detectedCount: 2, defaultCount: 0 },
    }
    const css = generateExportCss(tokens)

    expect(css).toContain(':root {')
    expect(css).toContain('.dark {')
    expect(css).toContain('--primary: 240 5.9% 10%')
    expect(css).toContain('--background: 0 0% 100%')
  })

  it('should use dark defaults when darkVariables not provided', () => {
    const tokens: ShadcnDesignSystemTokens = {
      variables: { '--primary': '240 5.9% 10%' },
      extraction: { timestamp: '', confidence: 1, source: 'default', detectedCount: 0, defaultCount: 1 },
    }
    const css = generateExportCss(tokens)

    // Should have both :root and .dark selectors
    expect(css).toContain(':root {')
    expect(css).toContain('.dark {')
    // Should use SHADCN_DEFAULTS_DARK for dark mode
    expect(css).toContain('--primary: 240 5.9% 10%')
  })
})
