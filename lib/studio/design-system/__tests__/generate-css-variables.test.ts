import { generateDesignSystemCSSVariables } from '../generate-css-variables'
import type { DesignSystem } from '@/lib/studio/import/types/design-system.types'

describe('generateDesignSystemCSSVariables', () => {
  const baseDesignSystem: DesignSystem = {
    palette: {
      primary: [{ value: '#ff5500', confidence: 1, source: 'css-var', name: 'primary' }],
      secondary: [{ value: '#0044ff', confidence: 1, source: 'css-var', name: 'secondary' }],
      accent: [{ value: '#00cc88', confidence: 1, source: 'css-var', name: 'accent' }],
      neutral: [{ value: '#111111', confidence: 1, source: 'css-var', name: 'neutral' }],
      surface: [{ value: '#ffffff', confidence: 1, source: 'css-var', name: 'surface' }]
    },
    typography: {
      heading: [{
        name: 'display',
        fontFamily: 'Open Sans, sans-serif',
        fontSize: '48px',
        fontWeight: 700,
        lineHeight: '120%',
        letterSpacing: '0px',
        confidence: 1,
        source: 'css'
      }],
      body: [{
        name: 'body',
        fontFamily: '"PT Serif", Georgia, serif',
        fontSize: '16px',
        fontWeight: 400,
        lineHeight: '160%',
        confidence: 1,
        source: 'css'
      }],
      ui: [{
        name: 'ui',
        fontFamily: 'Inter, "SF Pro Text", -apple-system, system-ui',
        fontSize: '14px',
        fontWeight: 500,
        lineHeight: '140%',
        confidence: 1,
        source: 'css'
      }]
    },
    spacing: {
      name: 'spacing',
      unit: 'px',
      values: [
        { step: 0, value: 0, name: 'none' },
        { step: 1, value: 8, name: 'sm' }
      ],
      confidence: 1,
      source: 'css'
    },
    radii: {
      name: 'radius',
      unit: 'px',
      values: [
        { step: 0, value: 0, name: 'none' },
        { step: 1, value: 4, name: 'sm' }
      ],
      confidence: 1,
      source: 'css'
    },
    shadows: [
      { name: 'sm', value: '0 1px 2px rgba(0,0,0,0.08)', confidence: 1, source: 'css' }
    ],
    effects: [],
    metadata: {
      sourceUrls: ['https://example.com'],
      capturedAt: '2024-01-01T00:00:00.000Z',
      confidence: 1,
      extractionMethod: 'deterministic',
      version: '1.0.0'
    },
    diagnostics: [],
    version: '1.0.0'
  }

  it('wraps multi-word font family names in quotes and escapes existing quotes', () => {
    const aliasOverride = {
      '--font-heading': 'Open Sans, sans-serif',
      '--font-body': '"PT Serif", Georgia, serif'
    }

    const { canonical, aliases, sections } = generateDesignSystemCSSVariables(baseDesignSystem, aliasOverride)

    expect(canonical).toContain('--ds-heading-display: "Open Sans", sans-serif;')
    expect(canonical).toContain('--ds-body-body: "PT Serif", Georgia, serif;')
    expect(canonical).toContain('--ds-ui-ui: Inter, "SF Pro Text", -apple-system, system-ui;')
    expect(canonical).toContain('--ds-heading-font: "Open Sans", sans-serif;')
    expect(canonical).toContain('--ds-body-font: "PT Serif", Georgia, serif;')
    expect(canonical).toContain('--ds-ui-font: Inter, "SF Pro Text", -apple-system, system-ui;')
    expect(canonical).toContain('--ds-heading-heading-1-size: 48px;')
    expect(canonical).toContain('--ds-heading-heading-1-line-height: 120%;')
    expect(canonical).toContain('--ds-heading-heading-1-weight: 700;')
    expect(canonical).toContain('--ds-heading-heading-1-letter-spacing: 0px;')
    expect(canonical).toContain('--ds-body-body-1-size: 16px;')
    expect(canonical).toContain('--ds-body-body-1-line-height: 160%;')
    expect(canonical).toContain('--ds-body-body-1-weight: 400;')
    expect(canonical).toContain('--ds-body-body-1-letter-spacing: 0;')

    expect(aliases).toContain('--font-heading: "Open Sans", sans-serif;')
    expect(aliases).toContain('--font-body: "PT Serif", Georgia, serif;')
    expect(sections.dark).toContain('color-scheme: dark;')
    expect(sections.dark).not.toEqual(sections.root)
    expect(sections.themeLight).toContain('--color-bg-primary')
    expect(sections.themeDark).toContain('color-scheme: dark;')
  })

  it('applies alias overrides to dark-theme sections when provided', () => {
    const aliasOverride = {
      '--color-bg-primary': '#101010',
      '--color-text-primary': '#f5f5f5',
      '--color-border-default': 'rgba(255, 255, 255, 0.12)',
      '--color-border-active': '#ff9900'
    }

    const { sections } = generateDesignSystemCSSVariables(baseDesignSystem, aliasOverride)

    expect(sections.dark).toContain('--color-bg-primary: #101010;')
    expect(sections.dark).toContain('--color-text-primary: #f5f5f5;')
    expect(sections.dark).toContain('--color-border-default: rgba(255, 255, 255, 0.12);')
    expect(sections.themeDark).toContain('--color-bg-primary: #101010;')
    expect(sections.themeDark).toContain('--color-border-active: #ff9900;')
    expect(sections.themeInverted).toContain('--color-border-default: rgba(255, 255, 255, 0.12);')
  })

  it('sanitizes malformed token values before emitting CSS', () => {
    const noisyDesignSystem: DesignSystem = JSON.parse(JSON.stringify(baseDesignSystem))
    noisyDesignSystem.typography.body[0].fontFamily = '"object-fit'
    noisyDesignSystem.shadows[0].value = '0 0 0 2px #0000001a}@media (forced-colors'

    const { canonical } = generateDesignSystemCSSVariables(noisyDesignSystem)

    expect(canonical).toContain('--ds-body-body: sans-serif;')
    expect(canonical).toContain('--ds-body-font: sans-serif;')
    expect(canonical).toContain('--ds-shadow-sm: 0 0 0 2px #0000001a;')
    expect(canonical).not.toMatch(/object-fit/)
    expect(canonical).not.toMatch(/@media/)
  })

  it('includes typography metric fallbacks when canonical tokens are missing', () => {
    const emptyDesignSystem: DesignSystem = {
      palette: {
        primary: [],
        secondary: [],
        accent: [],
        neutral: [],
        surface: []
      },
      typography: {
        heading: [],
        body: [],
        ui: []
      },
      spacing: {
        name: 'spacing',
        unit: 'px',
        values: [],
        confidence: 0,
        source: 'css'
      },
      radii: {
        name: 'radius',
        unit: 'px',
        values: [],
        confidence: 0,
        source: 'css'
      },
      shadows: [],
      effects: [],
      metadata: {
        sourceUrls: [],
        capturedAt: '1970-01-01T00:00:00.000Z',
        confidence: 0,
        extractionMethod: 'deterministic',
        version: '0.0.0'
      },
      diagnostics: [],
      version: '0.0.0'
    }

    const { sections } = generateDesignSystemCSSVariables(emptyDesignSystem)

    expect(sections.root).toContain('--ds-heading-heading-1-size: 3rem;')
    expect(sections.root).toContain('--ds-heading-heading-6-letter-spacing: 0.08em;')
    expect(sections.root).toContain('--ds-body-body-1-weight: 400;')
    expect(sections.root).toContain('--ds-body-body-4-letter-spacing: 0;')
  })
})
