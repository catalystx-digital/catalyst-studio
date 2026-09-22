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


jest.mock('@/lib/studio/media/storage/media-storage-factory', () => ({ getMediaStorageProvider: () => ({ backend: 'local', provider: {} }) }))
jest.mock('@/lib/studio/media/media-repository', () => ({ MediaRepository: jest.fn() }))
jest.mock('../media-ingest-service', () => ({ MediaIngestService: jest.fn() }))
jest.mock('../design-system-service', () => ({ DesignSystemService: jest.fn() }))
jest.mock('../import-run-service', () => ({ ImportRunService: jest.fn() }))
jest.mock('../design-profile-service', () => ({ buildImportDesignProfile: jest.fn(() => ({ confidence: 1, diagnostics: [] })) }))
jest.mock('../page-builder/presentation-skeleton', () => ({ selectPresentationSkeleton: jest.fn() }))
jest.mock('@/lib/studio/components/cms/_factory/initialize', () => ({ initializeCMSComponents: jest.fn() }))

import { selectPresentationSkeleton } from '../page-builder/presentation-skeleton'
import { PageBuilderService } from '../page-builder-service'

describe('ImportResultHandler provenance', () => {
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

})
