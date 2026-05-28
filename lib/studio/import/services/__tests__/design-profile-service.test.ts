import { buildImportDesignProfile } from '../design-profile-service'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { ImportDetectionResult } from '../../detection/types'
import type { DesignSystemProcessingResult } from '../design-system-service'

describe('buildImportDesignProfile', () => {
  it('projects DOM probe and component evidence into a source-backed profile', () => {
    const designSystemResult = {
      metrics: { confidence: 0.68 },
      probe: {
        capture: {
          palette: {
            colors: [
              { hex: '#111111', role: 'text', occurrences: 12, sampleSelectors: ['body'] },
            ],
            primary: { hex: '#0055aa', occurrences: 20, sampleSelectors: ['.button-primary'] },
            secondary: { hex: '#f2b705', occurrences: 5, sampleSelectors: ['.accent'] },
            surface: [{ hex: '#ffffff', occurrences: 30, sampleSelectors: ['body'] }],
          },
          typography: [
            {
              fontFamily: 'Inter',
              fontStack: 'Inter, sans-serif',
              fontWeight: '700',
              fontSizePx: 48,
              lineHeightPx: 56,
              letterSpacingPx: 0,
              role: 'heading',
              usageCount: 8,
              selector: 'h1',
            },
            {
              fontFamily: 'Inter',
              fontStack: 'Inter, sans-serif',
              fontWeight: '400',
              fontSizePx: 16,
              lineHeightPx: 24,
              letterSpacingPx: 0,
              role: 'body',
              usageCount: 14,
              selector: 'body',
            },
          ],
          spacing: { baseUnitPx: 8 },
        },
      },
    } as unknown as DesignSystemProcessingResult

    const detections = [{
      pageUrl: 'https://example.com/',
      processingTime: 1,
      modelUsed: 'test',
      components: [{
        component: ComponentType.NavBar,
        type: ComponentType.NavBar,
        confidence: 0.95,
        content: {
          logo: {
            src: { mediaId: 'logo', mediaType: 'image', url: 'https://example.com/logo.svg' },
          },
        },
      }],
    }] as ImportDetectionResult[]

    const profile = buildImportDesignProfile({
      sourceUrl: 'https://example.com/',
      designSystemResult,
      detections,
    })

    expect(profile.palette.primary?.value).toBe('#0055aa')
    expect(profile.typography.heading?.value).toBe('Inter, sans-serif')
    expect(profile.spacing.density).toBe('comfortable')
    expect(profile.brandAssets.logo?.value).toBe('https://example.com/logo.svg')
    expect(profile.diagnostics).toEqual([])
  })

  it('records diagnostics instead of silently substituting missing evidence', () => {
    const profile = buildImportDesignProfile({
      sourceUrl: 'https://example.com/',
      designSystemResult: null,
      detections: [],
    })

    expect(profile.confidence).toBe(0)
    expect(profile.palette.primary).toBeUndefined()
    expect(profile.diagnostics.map(diagnostic => diagnostic.code)).toEqual(
      expect.arrayContaining([
        'DESIGN_PROFILE_MISSING_PROBE',
        'DESIGN_PROFILE_MISSING_PRIMARY',
        'DESIGN_PROFILE_MISSING_LOGO',
        'DESIGN_PROFILE_MISSING_IMAGERY',
      ])
    )
  })
})
