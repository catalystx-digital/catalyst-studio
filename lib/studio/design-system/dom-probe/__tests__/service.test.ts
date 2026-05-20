import { DomProbeService } from '../service'
import type { DomDesignSystemCapture } from '../types'

function createSampleCapture(): DomDesignSystemCapture {
  return {
    metadata: {
      baseline: 'sample',
      url: 'https://example.com',
      timestamp: new Date().toISOString(),
      runId: 'run-1',
      runnerVersion: 'test',
      viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
      browser: { name: 'chromium', version: '1.0.0', userAgent: 'test-agent' },
      timings: [],
      captureDurationMs: 1234,
      cached: false,
      artifacts: {
        runLog: '/tmp/run.log',
        captureJson: '/tmp/capture.json',
        domSnapshot: '/tmp/dom.html',
        screenshots: ['/tmp/screenshot.png'],
        diffs: [],
        manifest: '/tmp/manifest.json'
      },
      configuration: {
        refreshRequested: true,
        evaluationRequested: true,
        flags: {},
        playwright: {}
      }
    },
    typography: [
      {
        id: 'h1',
        selector: 'h1',
        fontFamily: 'Example Display',
        fontStack: 'Example Display, Arial, sans-serif',
        fontWeight: '700',
        fontStyle: 'normal',
        fontSizePx: 40,
        lineHeightPx: 48,
        letterSpacingPx: null,
        textTransform: 'none',
        textDecoration: 'none',
        textAlign: 'left',
        textSample: 'Heading',
        usageCount: 5,
        role: 'heading'
      },
      {
        id: 'body',
        selector: 'p',
        fontFamily: 'Example Text',
        fontStack: 'Example Text, Georgia, serif',
        fontWeight: '400',
        fontStyle: 'normal',
        fontSizePx: 16,
        lineHeightPx: 24,
        letterSpacingPx: null,
        textTransform: 'none',
        textDecoration: 'none',
        textAlign: 'left',
        textSample: 'Body copy',
        usageCount: 12,
        role: 'body'
      },
      {
        id: 'button',
        selector: '.button',
        fontFamily: 'Example Display',
        fontStack: 'Example Display, Arial, sans-serif',
        fontWeight: '600',
        fontStyle: 'normal',
        fontSizePx: 14,
        lineHeightPx: 20,
        letterSpacingPx: null,
        textTransform: 'uppercase',
        textDecoration: 'none',
        textAlign: 'center',
        textSample: 'CTA',
        usageCount: 3,
        role: 'cta'
      }
    ],
    palette: {
      colors: [
        {
          hex: '#112233',
          rgb: 'rgb(17, 34, 51)',
          occurrences: 15,
          cssProperties: ['color'],
          sampleSelectors: ['body'],
          role: 'primary'
        },
        {
          hex: '#445566',
          rgb: 'rgb(68, 85, 102)',
          occurrences: 10,
          cssProperties: ['color'],
          sampleSelectors: ['h1'],
          role: 'secondary'
        },
        {
          hex: '#ededed',
          rgb: 'rgb(237, 237, 237)',
          occurrences: 20,
          cssProperties: ['background-color'],
          sampleSelectors: ['body'],
          role: 'background'
        },
        {
          hex: '#ff6600',
          rgb: 'rgb(255, 102, 0)',
          occurrences: 6,
          cssProperties: ['color'],
          sampleSelectors: ['.cta'],
          role: 'accent'
        }
      ],
      primary: null,
      secondary: null,
      neutrals: []
    },
    spacing: {
      baseUnitPx: 8,
      scale: [
        { valuePx: 8, occurrences: 10, sources: ['margin'] },
        { valuePx: 16, occurrences: 6, sources: ['padding'] },
        { valuePx: 24, occurrences: 4, sources: ['gap'] }
      ],
      gapTokens: []
    },
    components: [],
    diagnostics: {
      errors: [],
      warnings: ['Spacing token gaps detected'],
      infos: ['Sample info'],
      missingFonts: ['Example Display'],
      consoleErrors: [{ type: 'error', text: 'Refused to load image', location: { url: 'https://example.com' } }],
      notes: ['Sample note']
    },
    rawDomSnapshotPath: '/tmp/dom.html'
  }
}

describe('DomProbeService', () => {
  it('maps captures to design system tokens', () => {
    const service = new DomProbeService()
    const capture = createSampleCapture()
    const designSystem = service.toDesignSystem(capture)

    expect(designSystem.palette.primary[0].hex).toBe('#112233')
    expect(designSystem.palette.accent.some(color => color.hex === '#ff6600')).toBe(true)
    expect(designSystem.typography.heading[0].fontFamily).toBe('Example Display')
    expect(designSystem.typography.body[0].fontFamily).toBe('Example Text')
    expect(designSystem.spacing.base).toBe(8)
    expect(designSystem.spacing.values).toHaveLength(3)
    expect(designSystem.diagnostics.some(diagnostic => diagnostic.code.startsWith('DOM_PROBE_MISSING_FONT'))).toBe(true)
    expect(designSystem.metadata.domProbe?.runId).toBe('run-1')
    expect(designSystem.metadata.domProbe?.baseline).toBe('sample')
  })

  it('respects palette roles provided by the capture', () => {
    const service = new DomProbeService()
    const capture = createSampleCapture()
    const whiteSwatch = {
      hex: '#ffffff',
      rgb: 'rgb(255, 255, 255)',
      occurrences: 40,
      cssProperties: ['background-color'],
      sampleSelectors: ['body'],
      role: 'background',
      oklch: { l: 1, c: 0, h: 0 }
    } as const
    const primarySwatch = {
      hex: '#ffa500',
      rgb: 'rgb(255, 165, 0)',
      occurrences: 18,
      cssProperties: ['color'],
      sampleSelectors: ['.brand'],
      role: 'primary',
      oklch: { l: 0.75, c: 0.09, h: 75 }
    } as const
    const secondarySwatch = {
      hex: '#3966a8',
      rgb: 'rgb(57, 102, 168)',
      occurrences: 12,
      cssProperties: ['color'],
      sampleSelectors: ['.link'],
      role: 'secondary',
      oklch: { l: 0.58, c: 0.08, h: 250 }
    } as const
    const textSwatch = {
      hex: '#000000',
      rgb: 'rgb(0, 0, 0)',
      occurrences: 60,
      cssProperties: ['color'],
      sampleSelectors: ['p'],
      role: 'text',
      oklch: { l: 0, c: 0, h: 0 }
    } as const

    capture.palette.colors = [whiteSwatch, primarySwatch, secondarySwatch, textSwatch] as unknown as typeof capture.palette.colors
    capture.palette.primary = capture.palette.colors[1]
    capture.palette.secondary = capture.palette.colors[2]
    capture.palette.neutrals = [textSwatch]
    capture.palette.surface = [whiteSwatch]

    const result = service.toDesignSystem(capture)

    expect(result.palette.primary[0].hex).toBe('#ffa500')
    expect(result.palette.secondary[0].hex).toBe('#3966a8')
    expect(result.palette.surface[0].hex).toBe('#ffffff')
    expect(result.palette.neutral.some(color => color.hex === '#000000')).toBe(true)
    expect(result.palette.accent.some(color => color.hex === '#ffa500')).toBe(false)
  })

  it('wraps design system in captured payload with raw data', () => {
    const service = new DomProbeService()
    const capture = createSampleCapture()
    const captured = service.toCapturedDesignSystem(capture)

    expect(captured.designSystem.metadata.sourceUrls).toEqual(['https://example.com'])
    expect(captured.designSystem.metadata.domProbe?.targetUrl).toBe('https://example.com')
    expect(captured.rawData?.literals?.colors?.length).toBeGreaterThan(0)
    expect(captured.rawData?.literals?.fonts?.some(font => font.value === 'Example Display')).toBe(true)
    expect(captured.processingStats.extractionTime).toBe(capture.metadata.captureDurationMs)
  })
})
