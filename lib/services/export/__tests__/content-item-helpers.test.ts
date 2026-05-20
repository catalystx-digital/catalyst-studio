import type { ContentItemExport } from '../types'
import { attachMediaAssetsToContentItems } from '../helpers/content-item-helpers'
import type { UnifiedContent } from '../content-orchestrator'
import type { UniversalMediaAsset } from '@/lib/cms-export/universal/types'
import type { UniversalMediaService } from '@/lib/cms-export/universal/types'

describe('attachMediaAssetsToContentItems', () => {
  const websiteId = 'website-media'
  const baseUnified: UnifiedContent = {
    id: 'content-1',
    websiteId,
    source: 'WebsitePage',
    type: 'page',
    title: 'Test Page',
    contentTypeId: 'ct-page',
    content: {
      hero: {
        mediaId: 'media-1',
        altText: 'Context Alt'
      }
    },
    metadata: {},
    url: '/',
    status: 'published',
    templateKey: null,
    templateProps: null,
    components: []
  }

  const baseContentItem: ContentItemExport = {
    id: 'content-1',
    contentTypeId: 'ct-page',
    title: 'Test Page',
    slug: 'test-page',
    content: baseUnified.content,
    metadata: {}
  }

  afterEach(() => {
    delete process.env.EXPORT_ENABLE_MEDIA_RESOLUTION
  })

  it('returns input when media resolution flag disabled', async () => {
    process.env.EXPORT_ENABLE_MEDIA_RESOLUTION = 'false'

    const service: UniversalMediaService = {
      getAssetsForWebsiteByIds: jest.fn()
    } as unknown as UniversalMediaService

    const result = await attachMediaAssetsToContentItems([baseUnified], [baseContentItem], { mediaService: service })

    expect(result[0].mediaAssets).toBeUndefined()
    expect(service.getAssetsForWebsiteByIds).not.toHaveBeenCalled()
  })

  it('attaches media assets when flag enabled', async () => {
    process.env.EXPORT_ENABLE_MEDIA_RESOLUTION = 'true'

    const asset: UniversalMediaAsset = {
      id: 'media-1',
      mimeType: 'image/png',
      width: 1200,
      height: 800,
      altText: null,
      signedUrl: 'https://example.com/signed.png',
      publicUrl: 'https://example.com/public.png',
      originalUrl: 'https://origin/image.png'
    }

    const service: UniversalMediaService = {
      getAssetsForWebsiteByIds: jest.fn().mockResolvedValue(new Map([[asset.id, asset]]))
    } as unknown as UniversalMediaService

    const result = await attachMediaAssetsToContentItems([baseUnified], [baseContentItem], { mediaService: service })

    expect(service.getAssetsForWebsiteByIds).toHaveBeenCalledWith(
      websiteId,
      new Set(['media-1']),
      expect.objectContaining({ altTextByMediaId: expect.any(Map) })
    )
    expect(result[0].mediaAssets).toEqual([
      expect.objectContaining({ id: 'media-1', altText: 'Context Alt' })
    ])
  })
  it('continues when media service rejects', async () => {
    process.env.EXPORT_ENABLE_MEDIA_RESOLUTION = 'true'

    const service: UniversalMediaService = {
      getAssetsForWebsiteByIds: jest.fn().mockRejectedValue(new Error('boom'))
    } as unknown as UniversalMediaService

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await attachMediaAssetsToContentItems([baseUnified], [baseContentItem], { mediaService: service })

    expect(service.getAssetsForWebsiteByIds).toHaveBeenCalledWith(
      websiteId,
      new Set(['media-1']),
      expect.objectContaining({ altTextByMediaId: expect.any(Map) })
    )
    expect(result[0].mediaAssets).toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith(
      'attachMediaAssetsToContentItems: failed to resolve media assets',
      expect.objectContaining({ websiteId: websiteId, error: 'boom' })
    )

    warnSpy.mockRestore()
  })
})
