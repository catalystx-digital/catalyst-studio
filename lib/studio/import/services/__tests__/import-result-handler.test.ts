/** @jest-environment node */
import {
  ImportResultHandler,
  IMPORT_AUTO_APPROVE_CONFIDENCE_THRESHOLD,
  isImportComponentAutoApproved,
} from '../import-result-handler'

describe('ImportResultHandler approval threshold', () => {
  it('keeps source-backed components at the exact auto-approval confidence boundary', () => {
    expect(IMPORT_AUTO_APPROVE_CONFIDENCE_THRESHOLD).toBe(0.7)
    expect(isImportComponentAutoApproved({ confidence: 0.7 })).toBe(true)
  })

  it('drops components below the auto-approval confidence boundary', () => {
    expect(isImportComponentAutoApproved({ confidence: 0.699 })).toBe(false)
  })

  it('keeps components without explicit confidence for existing import compatibility', () => {
    expect(isImportComponentAutoApproved({})).toBe(true)
  })
})


jest.mock('../detection-post-processor', () => ({ adjustDetectedComponents: jest.fn(components => components) }))
jest.mock('@/lib/studio/media/storage/media-storage-factory', () => ({ getMediaStorageProvider: () => ({ backend: 'local', provider: {} }) }))
jest.mock('@/lib/studio/media/media-repository', () => ({ MediaRepository: jest.fn() }))
jest.mock('../media-ingest-service', () => ({ MediaIngestService: jest.fn() }))
jest.mock('../design-system-service', () => ({ DesignSystemService: jest.fn() }))
jest.mock('../import-run-service', () => ({ ImportRunService: jest.fn() }))
jest.mock('../design-profile-service', () => ({ buildImportDesignProfile: jest.fn(() => ({ confidence: 1, diagnostics: [] })) }))
jest.mock('../page-builder/presentation-skeleton', () => ({ selectPresentationSkeleton: jest.fn() }))
jest.mock('@/lib/studio/components/cms/_factory/initialize', () => ({ initializeCMSComponents: jest.fn() }))

import { adjustDetectedComponents } from '../detection-post-processor'
import { selectPresentationSkeleton } from '../page-builder/presentation-skeleton'
import { DetectionConfig } from '../../config'
import { PageBuilderService } from '../page-builder-service'

describe('ImportResultHandler repair selection', () => {
  test.each(['blocks', 'section'] as const)('preserves %s provenance through page-builder preflight', async detectionHarness => {
    const preflightReached = new Error('Reached page-builder preflight')
    const preflight = jest.spyOn(PageBuilderService.prototype, 'validatePagesInBatch').mockRejectedValue(preflightReached)
    jest.mocked(selectPresentationSkeleton).mockReturnValue({ key: 'unknown', diagnostics: [] } as any)
    const handler = new ImportResultHandler({
      repository: {
        findById: async () => ({ id: 'job', websiteId: 'website', url: 'https://example.com/' }),
        update: jest.fn(),
      },
      prisma: {}, progressManager: {}, orchestrator: {},
    } as any)
    try {
      await expect(handler.persist('job', { data: { detectedComponents: [{
        detectionHarness,
        pageUrl: 'https://example.com/',
        components: [{ component: 'text-block', type: 'text-block', location: 'main', confidence: 0.9, content: { text: 'Fixture' } }],
      }] } }, {
        sitemapMetaByUrl: new Map(), skipDesignSystemProcessing: true, skipMediaIngestion: true,
      })).rejects.toBe(preflightReached)
      const child = preflight.mock.calls[0][0][0].pageData.detectedComponents[0].children![0]
      expect(child.metadata?.region).toBe('main')
      expect(child.metadata?.detectionHarness).toBe(detectionHarness === 'blocks' ? 'blocks' : undefined)
    } finally {
      preflight.mockRestore()
    }
  })

  test.each(['blocks', 'section', undefined] as const)('uses the result harness field for %s', async detectionHarness => {
    jest.mocked(adjustDetectedComponents).mockClear()
    const auditReached = new Error('Reached design-fit audit after repair selection')
    jest.mocked(selectPresentationSkeleton).mockReturnValue({
      key: 'unknown',
      get diagnostics() { throw auditReached }
    } as any)
    const handler = new ImportResultHandler({
      repository: { findById: async () => ({ id: 'job', websiteId: 'website', url: 'https://example.com/' }) },
      prisma: {},
      progressManager: {},
      orchestrator: {}
    } as any)
    const previous = DetectionConfig.detectionHarness
    DetectionConfig.detectionHarness = detectionHarness === 'blocks' ? 'section' : 'blocks'
    const detection = {
      detectionHarness,
      pageUrl: 'https://example.com/',
      components: [{ component: 'text-block', type: 'text-block', confidence: 0.9, content: { text: 'Fixture' } }]
    }
    try {
      await expect(handler.persist('job', { data: { detectedComponents: [detection] } }, {
        sitemapMetaByUrl: new Map(), skipDesignSystemProcessing: true, skipMediaIngestion: true
      })).rejects.toBe(auditReached)
      expect(adjustDetectedComponents).toHaveBeenCalledTimes(detectionHarness === 'blocks' ? 0 : 1)
    } finally {
      DetectionConfig.detectionHarness = previous
    }
  })
})
