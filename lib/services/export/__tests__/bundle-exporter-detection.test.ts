import { transformUnifiedContentToExport } from '../helpers/content-item-helpers'
import { UnifiedContent } from '../content-orchestrator'

// Ensure DB setup does not run for unit tests focused on pure logic
process.env.SKIP_DB_SETUP = 'true'

// Mock prisma usage in the service where needed
jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: { findUnique: jest.fn().mockResolvedValue({ id: 'site1', name: 'Test' }) },
  }
}))

// Spyable mock for FieldShapeDetector
const detectMock = jest.fn()
const ctorMock = jest.fn()
jest.mock('@/lib/services/export/detection/field-shape-detector', () => {
  return {
    __esModule: true,
    default: class FieldShapeDetectorMock {
      private minConfidence: number
      private mode: 'off' | 'dry-run'
      constructor(opts?: { mode?: 'off' | 'dry-run'; minConfidence?: number; logger?: (e: any) => void }) {
        ctorMock(opts)
        this.minConfidence = opts?.minConfidence ?? 0.6
        this.mode = opts?.mode ?? 'dry-run'
      }
      detect(value: unknown, path?: string) {
        // Allow tests to control returned confidence via detectMock
        const ret = detectMock(value, path)
        const confidence = (ret && typeof ret.confidence === 'number') ? ret.confidence : 0.7
        const classification = (ret && ret.classification) || 'object'
        return {
          classification,
          confidence,
          path,
          sample: undefined,
          meetsThreshold: confidence >= this.minConfidence,
          reasons: [],
          mode: this.mode,
        }
      }
    }
  }
})

describe('BundleExporter detection (Story 40.2)', () => {
  const sampleContent: UnifiedContent[] = [
    {
      id: 'item-1',
      source: 'WebsitePage',
      type: 'page',
      title: 'Hello',
      contentTypeId: 'page',
      content: { blocks: [{ type: 'hero', props: { title: 'Hi' } }] },
      metadata: {},
      status: 'published',
      url: '/hello'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.EXPORT_DETECTION_MODE
    delete process.env.EXPORT_DETECTION_MIN_CONFIDENCE
  })

  it('skips detection entirely when mode=off', async () => {
    process.env.EXPORT_DETECTION_MODE = 'off'
    await transformUnifiedContentToExport(sampleContent)
    expect(ctorMock).not.toHaveBeenCalled()
    expect(detectMock).not.toHaveBeenCalled()
  })

  it('calls detector in dry-run mode and emits logs above threshold', async () => {
    process.env.EXPORT_DETECTION_MODE = 'dry-run'
    process.env.EXPORT_DETECTION_MIN_CONFIDENCE = '0.6'
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    // Return confidence above threshold for content root
    detectMock.mockReturnValueOnce({ classification: 'array_content_reference', confidence: 0.82 })
    // And again for a child path
    detectMock.mockReturnValueOnce({ classification: 'array_content_reference', confidence: 0.75 })

    await transformUnifiedContentToExport(sampleContent)

    expect(ctorMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'dry-run', minConfidence: 0.6 }))
    expect(detectMock).toHaveBeenCalled()
    // Verify a structured detection log with prefix and fields
    const calls = logSpy.mock.calls.filter(c => typeof c[0] === 'string' && c[0].includes('[DETECTION] FieldShape'))
    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0][1]).toEqual(expect.objectContaining({
      id: 'item-1',
      path: expect.stringMatching(/^content(\.|$)/),
      classification: expect.any(String),
      confidence: expect.any(Number),
      threshold: 0.6,
      action: 'log-only'
    }))

    logSpy.mockRestore()
  })

  it('treats conservative mode like dry-run', async () => {
    process.env.EXPORT_DETECTION_MODE = 'conservative'
    detectMock.mockReturnValue({ classification: 'content_reference', confidence: 0.7 })
    await transformUnifiedContentToExport(sampleContent)
    expect(ctorMock).toHaveBeenCalled()
    expect(detectMock).toHaveBeenCalled()
  })

  it('logs at threshold boundary (confidence === threshold)', async () => {
    process.env.EXPORT_DETECTION_MODE = 'dry-run'
    process.env.EXPORT_DETECTION_MIN_CONFIDENCE = '0.7'
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    detectMock.mockReturnValue({ classification: 'content_reference', confidence: 0.7 })
    await transformUnifiedContentToExport(sampleContent)
    const calls = logSpy.mock.calls.filter(c => typeof c[0] === 'string' && c[0].includes('[DETECTION] FieldShape'))
    expect(calls.length).toBeGreaterThan(0)
    logSpy.mockRestore()
  })
})

