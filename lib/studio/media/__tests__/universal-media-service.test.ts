import { MediaStorageProvider as MediaProviderEnum } from '@/lib/generated/prisma'
import { monitoring } from '@/lib/monitoring'
import type { UniversalMediaAsset } from '@/lib/cms-export/universal/types'
import { UniversalMediaService } from '../universal-media-service'
import type { MediaRepository } from '../media-repository'
import type { MediaStorageProvider } from '../storage/media-storage-provider'

describe('UniversalMediaService', () => {
  const createService = (overrides?: {
    repository?: Partial<MediaRepository>
    storageProvider?: Partial<MediaStorageProvider>
  }) => {
    const repository = {
      listMediaByIds: jest.fn()
    } as unknown as MediaRepository

    const storageProvider: MediaStorageProvider = {
      put: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      getPublicUrl: jest.fn().mockResolvedValue('https://public.example.com/key'),
      getSignedUrl: jest.fn().mockResolvedValue('https://signed.example.com/key')
    }

    Object.assign(repository, overrides?.repository)
    Object.assign(storageProvider, overrides?.storageProvider)

    const service = new UniversalMediaService({ repository, storageProvider })
    return { service, repository, storageProvider }
  }

  beforeEach(() => {
    jest.spyOn(monitoring, 'logError').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns empty map when no media ids provided', async () => {
    const { service, repository } = createService()
    const result = await service.getAssetsForWebsiteByIds('site-1', new Set())
    expect(result.size).toBe(0)
    expect((repository.listMediaByIds as jest.Mock)).not.toHaveBeenCalled()
  })

  it('maps media rows to universal assets and prefers contextual alt text', async () => {
    const rows = [
      {
        id: 'media-1',
        websiteId: 'site-1',
        contentId: 'content-123',
        provider: MediaProviderEnum.FILE,
        storageKey: 'site-1/assets/logo.png',
        checksum: 'abc123',
        contentType: 'image/png',
        width: 200,
        height: 300,
        duration: null,
        metadata: { altText: 'Stored alt' },
        sources: [
          {
            id: 'source-1',
            websiteId: 'site-1',
            mediaId: 'media-1',
            originalUrl: 'https://example.com/logo.png',
            contentId: null,
            metadata: { altText: 'Source alt' }
          }
        ]
      }
    ]

    const { service, repository, storageProvider } = createService({
      repository: {
        listMediaByIds: jest.fn().mockResolvedValue(rows)
      }
    })

    const altMap = new Map<string, string | null>([['media-1', 'Context alt']])
    const result = await service.getAssetsForWebsiteByIds('site-1', new Set(['media-1']), {
      altTextByMediaId: altMap
    })

    expect(repository.listMediaByIds as jest.Mock).toHaveBeenCalledWith('site-1', ['media-1'])
    expect((storageProvider.getSignedUrl as jest.Mock)).toHaveBeenCalledWith({ key: 'site-1/assets/logo.png' })
    expect((storageProvider.getPublicUrl as jest.Mock)).toHaveBeenCalledWith({ key: 'site-1/assets/logo.png' })

    const asset = result.get('media-1') as UniversalMediaAsset
    expect(asset).toMatchObject({
      id: 'media-1',
      contentId: 'content-123',
      mimeType: 'image/png',
      width: 200,
      height: 300,
      altText: 'Context alt',
      originalUrl: 'https://example.com/logo.png',
      signedUrl: 'https://signed.example.com/key',
      publicUrl: 'https://public.example.com/key'
    })
    expect(asset.providerHints).toMatchObject({
      provider: MediaProviderEnum.FILE,
      storageKey: 'site-1/assets/logo.png',
      checksum: 'abc123'
    })
    expect(Array.isArray((asset.providerHints as any).sources)).toBe(true)
  })

  it('logs failures when storage provider throws', async () => {
    const rows = [
      {
        id: 'media-2',
        websiteId: 'site-1',
        contentId: null,
        provider: MediaProviderEnum.S3,
        storageKey: 'key',
        checksum: 'zzz',
        contentType: null,
        width: null,
        height: null,
        duration: null,
        metadata: null,
        sources: []
      }
    ]

    const getSignedUrl = jest.fn().mockRejectedValue(new Error('boom'))
    const getPublicUrl = jest.fn().mockRejectedValue(new Error('boom-public'))

    const { service } = createService({
      repository: {
        listMediaByIds: jest.fn().mockResolvedValue(rows)
      },
      storageProvider: {
        getSignedUrl,
        getPublicUrl
      }
    })

    const result = await service.getAssetsForWebsiteByIds('site-1', new Set(['media-2']))
    expect(result.get('media-2')?.signedUrl).toBeNull()
    expect(result.get('media-2')?.publicUrl).toBeNull()
    expect(monitoring.logError).toHaveBeenCalledTimes(2)
  })
})