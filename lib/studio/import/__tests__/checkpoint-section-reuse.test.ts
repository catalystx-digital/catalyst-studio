import { GlobalSectionArtifactCache } from '../detection/global-section-cache'
import { isCheckpointSectionCacheUsable, loadReusableSectionFromCheckpoint } from '../web-detection'
import type { CheckpointSession, IImportCheckpointService } from '../types/checkpoint.types'

const session = {
  jobId: 'job-1',
  websiteId: 'site-1',
  cacheDir: '.import-cache/site-1/job-1',
  manifest: {} as CheckpointSession['manifest']
} satisfies CheckpointSession

function createService(sectionsByUrl: Record<string, any[]>): IImportCheckpointService {
  return {
    loadSitemap: jest.fn(async () => ({
      discoveredAt: new Date().toISOString(),
      skipped: [],
      urls: Object.keys(sectionsByUrl).map((url, order) => ({
        url,
        urlHash: `hash-${order}`,
        status: 'pending' as const,
        order
      }))
    })),
    streamSectionResults: jest.fn(async function* (_session: CheckpointSession, url: string) {
      for (const section of sectionsByUrl[url] ?? []) {
        yield section
      }
    })
  } as unknown as IImportCheckpointService
}

describe('loadReusableSectionFromCheckpoint', () => {
  it('reuses a validated same-key checkpoint header from another URL', async () => {
    const cache = new GlobalSectionArtifactCache()
    const reuseKey = cache.createKey({
      role: 'header',
      origin: 'https://example.com',
      sectionSlice: [{ tag: 'nav', text: 'Home' }],
      candidateTypes: ['navbar'],
      model: 'test-model'
    })
    const service = createService({
      'https://example.com/': [],
      'https://example.com/news': [
        {
          url: 'https://example.com/news',
          urlHash: 'news',
          sectionKey: 'header',
          sectionOrder: 0,
          processedAt: new Date().toISOString(),
          durationMs: 10,
          components: [{ type: 'navbar', confidence: 0.95, content: { menuItems: [] } }],
          llmDebug: { reuseKey: reuseKey?.key }
        }
      ]
    })

    const result = await loadReusableSectionFromCheckpoint({
      checkpointSession: session,
      checkpointService: service,
      reuseKey,
      role: 'header',
      currentUrl: 'https://example.com/'
    })

    expect(result?.provenance).toMatchObject({
      extractionMode: 'reused',
      cacheHit: true,
      reusedFromUrl: 'https://example.com/news',
      reuseKey: reuseKey?.key
    })
    expect(result?.artifact.components).toEqual([
      expect.objectContaining({ type: 'navbar' })
    ])
  })

  it('does not reuse empty or wrong-type checkpoint sections', async () => {
    const cache = new GlobalSectionArtifactCache()
    const reuseKey = cache.createKey({
      role: 'header',
      origin: 'https://example.com',
      sectionSlice: [{ tag: 'nav', text: 'Home' }],
      candidateTypes: ['navbar'],
      model: 'test-model'
    })
    const service = createService({
      'https://example.com/': [],
      'https://example.com/news': [
        {
          url: 'https://example.com/news',
          sectionKey: 'header',
          sectionOrder: 0,
          durationMs: 10,
          components: [],
          llmDebug: { reuseKey: reuseKey?.key }
        },
        {
          url: 'https://example.com/about',
          sectionKey: 'header',
          sectionOrder: 0,
          durationMs: 10,
          components: [{ type: 'footer', confidence: 0.9, content: {} }],
          llmDebug: { reuseKey: reuseKey?.key }
        }
      ]
    })

    await expect(loadReusableSectionFromCheckpoint({
      checkpointSession: session,
      checkpointService: service,
      reuseKey,
      role: 'header',
      currentUrl: 'https://example.com/'
    })).resolves.toBeNull()
  })
})

describe('isCheckpointSectionCacheUsable', () => {
  it('rejects bare empty global section cache entries', () => {
    expect(isCheckpointSectionCacheUsable('header', [], {
      requiredSectionEmpty: true
    })).toBe(false)
  })

  it('keeps previously satisfied empty required global sections usable', () => {
    expect(isCheckpointSectionCacheUsable('header', [], {
      requiredSectionEmpty: true,
      satisfiedBySectionKey: 'main:0-100'
    })).toBe(true)
  })
})
