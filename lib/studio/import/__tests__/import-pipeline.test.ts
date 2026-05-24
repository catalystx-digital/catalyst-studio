/**
 * Tests for Web-Based Import Pipeline
*/

process.env.IMPORT_MODEL_CHAIN = process.env.IMPORT_MODEL_CHAIN || 'test-model'

import { ImportPipeline, importPipeline } from '../import-pipeline'
import { getDetectionService } from '../web-detection'
import type { ImportDetectionResult } from '../web-detection'
import { importDesignSystemFromUrl } from '@/lib/studio/design-system/import-design-system'
import type { DesignSystem, CapturedDesignSystem } from '../types/design-system.types'
import type { CaptureDesignSystemResult } from '@/lib/studio/design-system/dom-probe/service'

function createMockDesignSystem(): DesignSystem {
  const color = (value: string) => ({
    value,
    name: value,
    confidence: 0.9,
    source: 'css-var' as const,
    usageCount: 1
  })

  return {
    palette: {
      primary: [color('#3366ff')],
      secondary: [color('#ff9900')],
      accent: [color('#00cc66')],
      neutral: [color('#111111')],
      surface: [color('#fafafa')]
    },
    typography: {
      heading: [{ fontFamily: 'Inter', confidence: 0.9, source: 'css', usageCount: 1 }],
      body: [{ fontFamily: 'Inter', confidence: 0.9, source: 'css', usageCount: 1 }],
      ui: [{ fontFamily: 'Inter', confidence: 0.9, source: 'css', usageCount: 1 }]
    },
    spacing: {
      name: 'spacing-scale',
      values: [{ step: 1, value: 8, name: 'sm' }],
      unit: 'px',
      base: 8,
      confidence: 0.9,
      source: 'css'
    },
    radii: {
      name: 'radii-scale',
      values: [{ step: 1, value: 8, name: 'md' }],
      unit: 'px',
      base: 8,
      confidence: 0.8,
      source: 'css'
    },
    shadows: [],
    effects: [],
    metadata: {
      sourceUrls: [],
      capturedAt: new Date().toISOString(),
      confidence: 0.9,
      extractionMethod: 'deterministic',
      version: '1.0.0'
    },
    diagnostics: [],
    version: '1.0.0'
  }
}

function createMockDomProbeCapture(): CaptureDesignSystemResult {
  const timestamp = new Date().toISOString()
  const metadata = {
    baseline: 'test',
    url: 'https://example.com',
    timestamp,
    runId: 'run-1',
    runnerVersion: 'test',
    viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
    browser: { name: 'chromium', version: '120.0', userAgent: 'DomProbe/Test' },
    timings: [],
    captureDurationMs: 1200,
    cached: false,
    artifacts: {
      runLog: 'run.log',
      captureJson: 'capture.json',
      domSnapshot: 'snapshot.html',
      screenshots: [],
      diffs: [],
      manifest: 'manifest.json'
    },
    checkpoint: 'CP4' as const,
    configuration: {
      refreshRequested: true,
      evaluationRequested: true,
      flags: {},
      playwright: {}
    }
  }

  return {
    capture: {
      metadata,
      typography: [],
      palette: { colors: [], primary: null, secondary: null, neutrals: [] },
      spacing: { baseUnitPx: 8, scale: [] },
      components: [],
      diagnostics: {
        errors: [],
        warnings: [],
        infos: [],
        missingFonts: [],
        consoleErrors: []
      },
      rawDomSnapshotPath: 'snapshot.html'
    },
    manifest: {
      baseline: metadata.baseline,
      runId: metadata.runId,
      timestamp: metadata.timestamp,
      url: metadata.url,
      artifacts: metadata.artifacts,
      status: 'success',
      errors: [],
      checkpoints: {}
    },
    metadata,
    runDir: '/tmp/dom-probe',
    evaluation: {
      summary: {
        overall: true,
        typography: { passed: true, matched: 2, missing: 0, unexpected: 0 },
        palette: { passed: true, matched: 3, missing: 0, unexpected: 0, agreementRatio: 1, agreementThreshold: 0.9 },
        spacing: { passed: true, delta: 0 }
      },
      typography: { matches: [], missing: [], unexpected: [], passed: true },
      palette: { matches: [], missing: [], unexpected: [], passed: true },
      spacing: {
        result: {
          expectation: { baseUnitPx: 8, tolerancePx: 2, scale: [1, 2, 4] },
          baseUnitDelta: 0,
          matchedScaleValues: [8, 16, 32],
          missingScaleValues: []
        },
        passed: true
      },
      notes: [],
      baseline: {
        typography: [],
        palette: [],
        spacing: { baseUnitPx: 8, tolerancePx: 2, scale: [1, 2, 4] }
      },
      capture: {} as any
    }
  }
}

function createMockCapturedDesignSystem(overrides?: Partial<CapturedDesignSystem>): CapturedDesignSystem {
  return {
    designSystem: createMockDesignSystem(),
    rawData: {},
    processingStats: {
      totalStylesheets: 0,
      totalInlineStyles: 0,
      extractionTime: 42,
      llmCalls: 0,
      cacheHits: 0
    },
    ...overrides
  }
}

// Mock dependencies
jest.mock('../web-detection')
jest.mock('@/lib/studio/design-system/import-design-system')
jest.mock('@/lib/studio/components/cms/_import/performance', () => ({
  performanceMonitor: {
    measure: jest.fn(async (name, fn) => fn()),
    measureSync: jest.fn((name, fn) => fn()),
    measure: jest.fn(async (name, fn) => fn())
  }
}))

describe('ImportPipeline', () => {
  let pipeline: ImportPipeline
  let mockDetectionService: any
  let domProbeCapture: CaptureDesignSystemResult
  let domProbeCaptured: CapturedDesignSystem
  let domProbeServiceMock: {
    captureDesignSystem: jest.Mock<Promise<CaptureDesignSystemResult>, any>
    toCapturedDesignSystem: jest.Mock<CapturedDesignSystem, any>
  }

  const mockUrls = [
    'https://example.com',
    'https://example.com/about',
    'https://example.com/contact'
  ]

  const mockDetectionResult: ImportDetectionResult = {
    components: [
      {
        component: 'NavBar',
        type: 'navbar' as any,
        confidence: 0.95,
        location: 'header',
        content: {
          logo: 'Company Logo',
          menuItems: ['Home', 'About', 'Contact'],
          links: [
            { label: 'Home', url: '/' },
            { label: 'About', url: '/about' },
            { label: 'Contact', url: '/contact' }
          ]
        }
      },
      {
        component: 'HeroWithImage',
        type: 'hero-with-image' as any,
        confidence: 0.9,
        location: 'hero',
        content: {
          heading: 'Welcome',
          subheading: 'To our website',
          backgroundImage: '/images/hero.jpg'
        }
      },
      {
        component: 'CardGrid',
        type: 'card-grid' as any,
        confidence: 0.85,
        location: 'main',
        content: {
          cards: [
            { title: 'Feature 1', description: 'Description 1' },
            { title: 'Feature 2', description: 'Description 2' }
          ]
        }
      },
      {
        component: 'Footer',
        type: 'footer' as any,
        confidence: 0.9,
        location: 'footer',
        content: {
          copyright: '© 2025 Company',
          links: [
            { label: 'Privacy', url: '/privacy' },
            { label: 'Terms', url: '/terms' }
          ]
        }
      }
    ],
    pageTemplate: { templateKey: 'marketing/home-default', confidence: 0.9, reason: 'fixture' },
    processingTime: 2000,
    modelUsed: 'openai/gpt-4o-mini',
    tokenUsage: 1500,
    cost: 0.02,
    pageUrl: 'https://example.com',
    accuracy: 0.9
  }

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    domProbeCapture = createMockDomProbeCapture()
    domProbeCaptured = createMockCapturedDesignSystem()
    process.env.DOM_PROBE_IMPORT_ENABLED = '1'
    process.env.DOM_PROBE_IMPORT_WEBSITE_ALLOWLIST = ''

    // Setup detection service mock
    mockDetectionService = {
      detectComponentsFromUrl: jest.fn().mockResolvedValue(mockDetectionResult)
    }
    ;(getDetectionService as jest.Mock).mockReturnValue(mockDetectionService)

    // Create pipeline instance
    pipeline = new ImportPipeline()

    domProbeServiceMock = {
      captureDesignSystem: jest.fn().mockResolvedValue(domProbeCapture),
      toCapturedDesignSystem: jest.fn().mockReturnValue(domProbeCaptured)
    }

    ;(pipeline as any).domProbeService = domProbeServiceMock
    ;(importDesignSystemFromUrl as jest.Mock).mockResolvedValue({
      designSystem: domProbeCaptured,
      conceptId: 'concept-1',
      conceptName: 'Default Concept',
      diagnostics: [],
      success: true
    })
  })

  afterEach(() => {
    delete process.env.DOM_PROBE_IMPORT_ENABLED
    delete process.env.DOM_PROBE_IMPORT_WEBSITE_ALLOWLIST
  })

  describe('execute', () => {
    it('executes web-based import pipeline successfully', async () => {
      const result = await pipeline.execute({
        urls: mockUrls
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.detectedComponents).toHaveLength(3)
      expect(result.errors).toHaveLength(0)
    })

    it('detects components for all URLs', async () => {
      await pipeline.execute({ urls: mockUrls })

      expect(mockDetectionService.detectComponentsFromUrl).toHaveBeenCalledTimes(3)
      expect(mockDetectionService.detectComponentsFromUrl).toHaveBeenCalledWith(
        mockUrls[0],
        expect.objectContaining({ includeContent: true })
      )
    })

    it('should extract navigation hierarchy from detected components', async () => {
      const result = await pipeline.execute({ urls: mockUrls })

      expect(result.data?.navigation).toBeDefined()
      expect(result.data?.navigation.pages).toHaveLength(3) // Home, About, Contact
      expect(result.data?.navigation.pages[0].title).toBe('Home')
      expect(result.data?.navigation.pages[0].url).toBe('/')
    })

    it('should identify page templates from component patterns', async () => {
      // Mock different component patterns for template detection
      mockDetectionService.detectComponentsFromUrl
        .mockResolvedValueOnce(mockDetectionResult) // Page 1
        .mockResolvedValueOnce(mockDetectionResult) // Page 2 - same template
        .mockResolvedValueOnce({
          ...mockDetectionResult,
          components: [
            mockDetectionResult.components[0],
            mockDetectionResult.components[1],
            mockDetectionResult.components[3]
          ] // Page 3 - different template, still satisfies required navbar/footer
        })

      const result = await pipeline.execute({ urls: mockUrls })

      expect(result.data?.templates).toBeDefined()
      expect(result.data?.templates.length).toBeGreaterThan(0)
      expect(result.data?.templates[0].pages).toContain(mockUrls[0])
    })

    it('should extract design tokens from detected components', async () => {
      const result = await pipeline.execute({ urls: mockUrls })

      expect(result.data?.designTokens).toBeDefined()
      expect(result.data?.designTokens.images).toContain('/images/hero.jpg')
      expect(result.data?.designTokens.textPatterns).toContain('heading')
      expect(result.data?.designTokens.textPatterns).toContain('subheading')
      expect(result.data?.designTokens.componentUsage).toBeDefined()
    })

    it('tracks performance metrics', async () => {
      mockDetectionService.detectComponentsFromUrl.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return mockDetectionResult
      })

      const result = await pipeline.execute({
        urls: mockUrls,
        enablePerformanceMonitoring: true
      })

      expect(result.performance).toBeDefined()
      expect(result.performance?.totalTime).toBeGreaterThan(0)
      expect(result.performance?.detectionTime).toBeGreaterThanOrEqual(0)
      expect(result.performance?.processingTime).toBeGreaterThanOrEqual(0)
    })

    it('should report progress through callback', async () => {
      const progressCallback = jest.fn()

      await pipeline.execute({ urls: mockUrls, onProgress: progressCallback })

      expect(progressCallback).toHaveBeenCalled()
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Starting web-based import pipeline'),
          progress: 0
        })
      )
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('completed successfully'),
          progress: 100
        })
      )
    })

    it('attaches alias map to captured design system', async () => {
      const aliasMap = { '--background': '120 30% 60%' }
      const captured: CapturedDesignSystem = {
        designSystem: {
          ...createMockDesignSystem(),
          aliases: {
            cssVariables: aliasMap,
            computedAt: new Date().toISOString(),
            diagnostics: [],
            fallbackSummary: { '--background': 1 }
          }
        },
        rawData: {},
        processingStats: {
          totalStylesheets: 0,
          totalInlineStyles: 0,
          extractionTime: 10,
          llmCalls: 0,
          cacheHits: 0
        }
      }

      domProbeServiceMock.toCapturedDesignSystem.mockReturnValueOnce(captured)
      ;(importDesignSystemFromUrl as jest.Mock).mockResolvedValueOnce({
        designSystem: captured,
        conceptId: 'concept-1',
        conceptName: 'Default Concept',
        diagnostics: [],
        success: true
      })

      const result = await pipeline.execute({ urls: mockUrls })

      expect(result.data?.designSystem?.designSystem.aliases?.cssVariables).toEqual(aliasMap)
    })

    it('handles detection errors', async () => {
      mockDetectionService.detectComponentsFromUrl
        .mockResolvedValueOnce(mockDetectionResult)
        .mockRejectedValueOnce(new Error('Detection failed'))
        .mockResolvedValueOnce(mockDetectionResult)

      const result = await pipeline.execute({ urls: mockUrls })

      expect(result.success).toBe(true)
      expect(result.errors.length).toBeGreaterThanOrEqual(0)
      expect(result.data?.detectedComponents).toHaveLength(3)
      // Detect retries should succeed after a transient failure
      expect(mockDetectionService.detectComponentsFromUrl).toHaveBeenCalledTimes(4)
      expect(result.data?.detectedComponents[1].pageTemplate.templateKey).toBe('marketing/home-default')
    })

    it('fails instead of creating fallback content when detection cannot run', async () => {
      mockDetectionService.detectComponentsFromUrl.mockRejectedValue(new Error('hard failure'))

      const result = await pipeline.execute({ urls: ['https://example.com/generic'] })

      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.errors[0]).toContain('Detection failed for 1/1 page(s)')
      expect(result.errors[0]).toContain('https://example.com/generic')
    })

    it('does not treat redirect detections as failed content fallbacks', async () => {
      mockDetectionService.detectComponentsFromUrl.mockResolvedValueOnce({
        components: [],
        pageTemplate: {
          templateKey: 'redirect',
          confidence: 1,
          source: 'redirect-detection',
          reason: 'External redirect'
        },
        pageMetadata: { title: 'Redirect' },
        processingTime: 10,
        modelUsed: 'redirect-detection',
        tokenUsage: 0,
        cost: 0,
        pageUrl: 'https://example.com/out',
        accuracy: 1,
        redirectInfo: {
          type: 'http',
          targetUrl: 'https://external.example/path',
          isExternal: true,
          description: 'External redirect'
        },
        isRedirectPage: true
      })

      const result = await pipeline.execute({ urls: ['https://example.com/out'] })

      expect(result.success).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.data?.detectedComponents[0].isRedirectPage).toBe(true)
      expect(result.data?.detectedComponents[0].components).toHaveLength(0)
    })

    it('fails non-redirect detections that parse with zero components', async () => {
      mockDetectionService.detectComponentsFromUrl.mockResolvedValueOnce({
        components: [],
        pageTemplate: { templateKey: 'core/generic-default', confidence: 0.6, reason: 'No visible sections' },
        pageMetadata: { title: 'Empty' },
        processingTime: 10,
        modelUsed: 'test-model',
        tokenUsage: 0,
        cost: 0,
        pageUrl: 'https://example.com/empty',
        accuracy: 0
      })

      const result = await pipeline.execute({ urls: ['https://example.com/empty'] })

      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.errors[0]).toContain('Detection completed but found no components')
    })

    it('should use custom model when specified', async () => {
      await pipeline.execute({ urls: mockUrls, model: 'anthropic/claude-3.5-sonnet', apiKey: 'custom-api-key' })
      expect(mockDetectionService.detectComponentsFromUrl).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ model: 'anthropic/claude-3.5-sonnet', apiKey: 'custom-api-key' })
      )
    })
  })

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      expect(importPipeline).toBeDefined()
      expect(importPipeline).toBeInstanceOf(ImportPipeline)
    })
  })

  describe('design token extraction', () => {
    it('should extract unique images from components', async () => {
      // Mock multiple detection results with duplicate images
      mockDetectionService.detectComponentsFromUrl.mockResolvedValue({
        ...mockDetectionResult,
        components: [
          ...mockDetectionResult.components,
          {
            component: 'ImageGallery',
            type: 'image-gallery' as any,
            confidence: 0.8,
            location: 'main',
            content: {
              images: ['/images/hero.jpg', '/images/gallery1.jpg', '/images/gallery2.jpg']
            }
          }
        ]
      })

      const result = await pipeline.execute({ urls: [mockUrls[0]] })

      const images = result.data?.designTokens.images || []
      expect(images).toContain('/images/hero.jpg')
      expect(images).toContain('/images/gallery1.jpg')
      expect(images).toContain('/images/gallery2.jpg')
      // Should be unique
      expect(images.filter(img => img === '/images/hero.jpg')).toHaveLength(1)
    })

    it('should calculate component usage frequency', async () => {
      const result = await pipeline.execute({ urls: mockUrls })

      const usage = result.data?.designTokens.componentUsage || []
      const navBarUsage = usage.find(u => u.type === 'navbar')
      
      expect(navBarUsage).toBeDefined()
      expect(navBarUsage?.frequency).toBe(1) // Appears on all pages
      expect(navBarUsage?.instances).toBe(3) // 3 pages total
    })
  })

  describe('template identification', () => {
    it('should group pages with same component structure', async () => {
      const result = await pipeline.execute({ urls: mockUrls })

      const templates = result.data?.templates || []
      expect(templates.length).toBeGreaterThan(0)
      
      // Pages with same components should share template
      const template = templates[0]
      expect(template.pages.length).toBeGreaterThanOrEqual(1)
      expect(template.regions).toBeDefined()
      expect(template.regions.header).toContain('navbar')
      expect(template.regions.hero).toContain('hero-with-image')
      expect(template.regions.main).toContain('card-grid')
      expect(template.regions.footer).toContain('footer')
    })

    it('should create different templates for different structures', async () => {
      // Mock different component structures
      const differentResult = {
        ...mockDetectionResult,
        components: [
          {
            component: 'NavBar',
            type: 'navbar' as any,
            confidence: 0.95,
            location: 'header',
            content: {}
          },
          {
            component: 'ContactForm',
            type: 'contact-form' as any,
            confidence: 0.9,
            location: 'main',
            content: {}
          },
          {
            component: 'Footer',
            type: 'footer' as any,
            confidence: 0.9,
            location: 'footer',
            content: {}
          }
        ]
      }

      mockDetectionService.detectComponentsFromUrl
        .mockResolvedValueOnce(mockDetectionResult) // Standard template
        .mockResolvedValueOnce(mockDetectionResult) // Standard template
        .mockResolvedValueOnce(differentResult) // Different template

      const result = await pipeline.execute({ urls: mockUrls })

      const templates = result.data?.templates || []
      expect(templates.length).toBe(2) // Two different templates
    })
  })
})
