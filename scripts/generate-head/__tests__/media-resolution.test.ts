import type { SiteSnapshot } from '../core/types'
import { resolveSnapshotMedia } from '../core/media-resolution'

jest.mock('@/lib/services/export/helpers/media-service-loader', () => ({
  resolveUniversalMediaService: jest.fn()
}))

const { resolveUniversalMediaService } = jest.requireMock('@/lib/services/export/helpers/media-service-loader') as {
  resolveUniversalMediaService: jest.Mock
}

const createSnapshot = (): SiteSnapshot => ({
  site: { id: 'site-1', name: 'Test Site' },
  pages: [
    {
      id: 'page-1',
      title: 'Landing',
      fullPath: '/landing',
      templateKey: null,
      templateProps: {},
      regions: [],
      components: [
        {
          id: 'component-1',
          type: 'hero-with-image',
          componentType: undefined,
          componentTypeId: undefined,
          typeId: undefined,
          parentId: null,
          position: 0,
          props: {
            image: {
              mediaId: 'media-1',
              alt: 'Original hero'
            }
          },
          content: {},
          styles: {},
          metadata: {}
        }
      ],
      metadata: {},
      sharedComponentIds: []
    }
  ],
  structure: [],
  sharedComponents: [],
  capturedAt: new Date().toISOString()
})

describe('resolveSnapshotMedia', () => {
  beforeEach(() => {
    resolveUniversalMediaService.mockReset()
  })

  it('prefers public URLs when available', async () => {
    const snapshot = createSnapshot()
    resolveUniversalMediaService.mockResolvedValue({
      getAssetsForWebsiteByIds: jest.fn(async () => {
        const asset = new Map<string, any>()
        asset.set('media-1', {
          id: 'media-1',
          publicUrl: 'https://cdn.example.com/media-1-public.jpg',
          signedUrl: 'https://cdn.example.com/media-1-signed.jpg'
        })
        return asset
      })
    })

    const result = await resolveSnapshotMedia(snapshot, 'site-1')

    const imageRef = snapshot.pages[0].components[0].props.image as Record<string, unknown>
    expect(imageRef.src).toBe('https://cdn.example.com/media-1-public.jpg')
    expect(result.report.summary.references).toBe(1)
    expect(result.report.summary.resolved).toBe(1)
    expect(result.report.unresolved).toHaveLength(0)
    expect(result.diagnostics).toHaveLength(0)
    expect(result.unresolvedReferences).toHaveLength(0)
    expect(result.report.summary.resolvedWithStableUrl).toBe(1)
    expect(result.report.summary.resolvedWithSignedFallback).toBe(0)
  })

  it('falls back to original URL when public URL is unavailable', async () => {
    const snapshot = createSnapshot()
    resolveUniversalMediaService.mockResolvedValue({
      getAssetsForWebsiteByIds: jest.fn(async () => {
        const asset = new Map<string, any>()
        asset.set('media-1', {
          id: 'media-1',
          originalUrl: 'https://cdn.example.com/media-1-original.jpg',
          signedUrl: 'https://cdn.example.com/media-1-signed.jpg'
        })
        return asset
      })
    })

    const result = await resolveSnapshotMedia(snapshot, 'site-1')
    const imageRef = snapshot.pages[0].components[0].props.image as Record<string, unknown>
    expect(imageRef.src).toBe('https://cdn.example.com/media-1-original.jpg')
    expect(result.report.summary.resolvedWithStableUrl).toBe(1)
    expect(result.report.summary.resolvedWithSignedFallback).toBe(0)
    expect(result.diagnostics).toHaveLength(0)
  })

  it('records unresolved entries when assets are missing', async () => {
    const snapshot = createSnapshot()
    resolveUniversalMediaService.mockResolvedValue({
      getAssetsForWebsiteByIds: jest.fn(async () => new Map())
    })

    const result = await resolveSnapshotMedia(snapshot, 'site-1')

    expect(result.report.summary.references).toBe(1)
    expect(result.report.summary.resolved).toBe(0)
    expect(result.report.summary.unresolved).toBe(1)
    expect(result.report.summary.resolvedWithStableUrl).toBe(0)
    expect(result.report.summary.resolvedWithSignedFallback).toBe(0)
    expect(result.report.unresolved[0].mediaId).toBe('media-1')
    expect(result.diagnostics[0].code).toBe('MEDIA_ASSET_MISSING')
    expect(result.unresolvedReferences).toHaveLength(1)
  })

  it('falls back gracefully when media service is unavailable', async () => {
    const snapshot = createSnapshot()
    resolveUniversalMediaService.mockResolvedValue(null)

    const result = await resolveSnapshotMedia(snapshot, 'site-1')

    expect(result.report.summary.references).toBe(1)
    expect(result.report.summary.resolved).toBe(0)
    expect(result.report.summary.unresolved).toBe(1)
    expect(result.report.summary.resolvedWithStableUrl).toBe(0)
    expect(result.report.summary.resolvedWithSignedFallback).toBe(0)
    expect(result.report.unresolved[0].reason).toBe('service-unavailable')
    expect(result.diagnostics[0].code).toBe('MEDIA_SERVICE_UNAVAILABLE')
    expect(result.unresolvedReferences).toHaveLength(1)
  })

  it('emits diagnostics when falling back to signed URLs', async () => {
    const snapshot = createSnapshot()
    resolveUniversalMediaService.mockResolvedValue({
      getAssetsForWebsiteByIds: jest.fn(async () => {
        const asset = new Map<string, any>()
        asset.set('media-1', {
          id: 'media-1',
          signedUrl: 'https://cdn.example.com/media-1-signed.jpg'
        })
        return asset
      })
    })

    const result = await resolveSnapshotMedia(snapshot, 'site-1')
    const imageRef = snapshot.pages[0].components[0].props.image as Record<string, unknown>
    expect(imageRef.src).toBe('https://cdn.example.com/media-1-signed.jpg')
    expect(result.report.summary.resolvedWithStableUrl).toBe(0)
    expect(result.report.summary.resolvedWithSignedFallback).toBe(1)
    expect(result.diagnostics.some(diag => diag.code === 'MEDIA_SIGNED_URL_FALLBACK')).toBe(true)
    const fallbackDiagnostic = result.diagnostics.find(diag => diag.code === 'MEDIA_SIGNED_URL_FALLBACK')
    expect(fallbackDiagnostic?.context?.mediaId).toBe('media-1')
  })
})
