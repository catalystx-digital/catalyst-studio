import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { ImportDetectionResult } from '../../web-detection'
import { MediaIngestService } from '../media-ingest-service'
import type { MediaRepository } from '@/lib/studio/media/media-repository'
import type { MediaStorageProvider } from '@/lib/studio/media/storage/media-storage-provider'

describe('MediaIngestService', () => {
  const url = 'https://example.com/image.png'
  const MINIMAL_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    'base64'
  )
  const PDF_STUB = Buffer.from('%PDF-1.4')

  const createService = (options?: { maxFileSizeBytes?: number }) => {
    const repository = {
      resolveByOriginalUrl: jest.fn(),
      findByChecksum: jest.fn(),
      createMediaAsset: jest.fn(),
      upsertSourceLink: jest.fn()
    } as unknown as MediaRepository

    const storageProvider: MediaStorageProvider = {
      put: jest.fn().mockResolvedValue({}),
      get: jest.fn(),
      delete: jest.fn(),
      getPublicUrl: jest.fn(),
      getSignedUrl: jest.fn().mockResolvedValue('')
    }

    const service = new MediaIngestService({
      repository,
      storageProvider,
      backend: 'FILE',
      maxFileSizeBytes: options?.maxFileSizeBytes
    })

    return { service, repository, storageProvider }
  }

  const writeTempFile = async (prefix: string, contents: Buffer) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
    const filePath = path.join(dir, 'download.bin')
    await fs.writeFile(filePath, contents)
    return { dir, filePath }
  }

  let extractSpy: jest.SpyInstance
  let renditionsSpy: jest.SpyInstance

  beforeEach(() => {
    extractSpy = jest
      .spyOn(MediaIngestService.prototype as any, 'extractImageDimensions')
      .mockResolvedValue({ width: 1200, height: 800 })
    renditionsSpy = jest.spyOn(MediaIngestService.prototype as any, 'generateRenditions').mockResolvedValue([])
  })

  const buildDetection = (override?: Partial<ImportDetectionResult>): ImportDetectionResult => ({
    components: [
      {
        component: 'image-block',
        type: 'HeroImage',
        confidence: 0.9,
        content: { imageUrl: url }
      }
    ],
    pageTemplate: { templateKey: 'hero' },
    processingTime: 100,
    modelUsed: 'test-model',
    pageUrl: 'https://example.com',
    ...override
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('reuses existing media asset and rewrites detection payloads', async () => {
    const { service, repository, storageProvider } = createService()
    const detection = buildDetection()
    ;(repository.resolveByOriginalUrl as jest.Mock).mockResolvedValue({
      media: {
        id: 'media-123',
        storageKey: 'site/media-123.png',
        contentType: 'image/png',
        checksum: 'abc123'
      }
    })

    const result = await service.ingest({
      websiteId: 'site-1',
      detectionResults: [detection],
      designTokens: { images: [url] }
    })

    const rewrittenComponent = result.detections[0].components?.[0]
    expect(rewrittenComponent?.content).toEqual({ imageUrl: { src: url, mediaId: 'media-123', originalUrl: url } })
    expect(result.designTokens?.imageRefs).toEqual([{ mediaId: 'media-123', originalUrl: url }])
    expect(result.mediaAssets).toEqual([
      expect.objectContaining({ mediaId: 'media-123', originalUrl: url })
    ])
    expect(result.warnings).toHaveLength(0)
    expect(storageProvider.put).not.toHaveBeenCalled()
  })

  it('rewrites canonical media reference url without nesting the media object under url', async () => {
    const { service, repository } = createService()
    const detection = buildDetection({
      components: [
        {
          component: 'card-grid',
          type: 'card-grid',
          confidence: 0.9,
          content: {
            cards: [
              {
                title: 'Card',
                image: {
                  src: {
                    mediaId: 'detected:card',
                    mediaType: 'image',
                    url,
                  },
                  alt: 'Card image',
                },
              },
            ],
          },
        },
      ],
    })
    ;(repository.resolveByOriginalUrl as jest.Mock).mockResolvedValue({
      media: {
        id: 'media-123',
        storageKey: 'site/media-123.png',
        contentType: 'image/png',
        checksum: 'abc123',
      },
    })

    const result = await service.ingest({
      websiteId: 'site-1',
      detectionResults: [detection],
      designTokens: null,
    })

    expect(result.detections[0].components?.[0].content).toEqual({
      cards: [
        {
          title: 'Card',
          image: {
            src: {
              mediaId: 'media-123',
              mediaType: 'image',
              url,
              originalUrl: url,
            },
            alt: 'Card image',
          },
        },
      ],
    })
    expect(JSON.stringify(result.detections[0].components?.[0].content)).not.toContain('"url":{"src"')
  })

  it('preserves renderable canonical media references when only originalUrl is present', async () => {
    const { service, repository } = createService()
    const detection = buildDetection({
      components: [
        {
          component: 'hero-with-image',
          type: 'hero-with-image',
          confidence: 0.9,
          content: {
            image: {
              src: {
                mediaId: 'media-123',
                mediaType: 'image',
                originalUrl: url,
              },
              alt: 'Original only',
            },
          },
        },
      ],
    })
    ;(repository.resolveByOriginalUrl as jest.Mock).mockResolvedValue(null)

    const result = await service.ingest({
      websiteId: 'site-1',
      detectionResults: [detection],
      designTokens: null,
    })

    expect(result.detections[0].components?.[0].content).toEqual({
      image: {
        src: {
          mediaId: 'media-123',
          mediaType: 'image',
          url,
          originalUrl: url,
        },
        alt: 'Original only',
      },
    })
  })

  it('downloads and persists new media asset when no match exists', async () => {
    const { service, repository, storageProvider } = createService()
    const detection = buildDetection()
    ;(repository.resolveByOriginalUrl as jest.Mock).mockResolvedValue(null)
    ;(repository.findByChecksum as jest.Mock).mockResolvedValue(null)
    ;(repository.createMediaAsset as jest.Mock).mockResolvedValue({
      id: 'media-new',
      storageKey: 'site-1/abcdef.png',
      contentType: 'image/png',
      checksum: 'abcdef'
    })

    const { dir: tempDir, filePath: tempFile } = await writeTempFile('media-ingest-test-', MINIMAL_PNG)

    const downloadSpy = jest
      .spyOn(MediaIngestService.prototype as unknown as { downloadToTemp: (url: string, dir: string) => Promise<any> }, 'downloadToTemp')
      .mockResolvedValue({
        filePath: tempFile,
        checksum: 'abcdef',
        contentType: 'image/png',
        contentLength: 10
      })

    const result = await service.ingest({
      websiteId: 'site-1',
      detectionResults: [detection],
      designTokens: null
    })

    expect(storageProvider.put).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'site-1/abcdef.png',
        contentType: 'image/png'
      })
    )
    expect(repository.createMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({ checksum: 'abcdef', storageKey: 'site-1/abcdef.png' })
    )
    expect(repository.upsertSourceLink).toHaveBeenCalledWith(
      expect.objectContaining({ mediaId: 'media-new', originalUrl: url })
    )

    expect(result.mediaAssets).toEqual([
      expect.objectContaining({ mediaId: 'media-new', originalUrl: url })
    ])
    expect(result.warnings).toHaveLength(0)

    expect(await fs.stat(tempFile).catch(() => null)).toBeNull()
    await fs.rm(tempDir, { recursive: true, force: true })
    downloadSpy.mockRestore()
  })

  it('normalizes relative media URLs using the page origin', async () => {
    const { service, repository, storageProvider } = createService()
    const detection = buildDetection({
      components: [
        {
          component: 'feature-item',
          type: 'FeatureGrid',
          confidence: 0.9,
          content: { icon: '/images/logo.png' }
        }
      ],
      pageUrl: 'https://example.com/about'
    })
    ;(repository.resolveByOriginalUrl as jest.Mock).mockResolvedValue(null)
    ;(repository.findByChecksum as jest.Mock).mockResolvedValue(null)
    ;(repository.createMediaAsset as jest.Mock).mockResolvedValue({
      id: 'media-relative',
      storageKey: 'site-1/abcdef.png',
      contentType: 'image/png',
      checksum: 'abcdef'
    })

    const { dir: tempDir, filePath: tempFile } = await writeTempFile('media-ingest-test-relative-', MINIMAL_PNG)

    const downloadSpy = jest
      .spyOn(MediaIngestService.prototype as unknown as { downloadToTemp: (url: string, dir: string) => Promise<any> }, 'downloadToTemp')
      .mockResolvedValue({
        filePath: tempFile,
        checksum: 'abcdef',
        contentType: 'image/png',
        contentLength: 10
      })

    await service.ingest({
      websiteId: 'site-1',
      detectionResults: [detection],
      designTokens: null
    })

    expect(downloadSpy).toHaveBeenCalledWith('https://example.com/images/logo.png', expect.any(String))
    expect(repository.upsertSourceLink).toHaveBeenCalledWith(
      expect.objectContaining({
        originalUrl: 'https://example.com/images/logo.png'
      })
    )

    downloadSpy.mockRestore()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('skips ingestion for navigation href links', async () => {
    const { service, repository, storageProvider } = createService()
    const detection = buildDetection({
      components: [
        {
          component: 'footer',
          type: 'Footer',
          confidence: 0.9,
          content: {
            links: [
              { href: 'https://example.com/contact', label: 'Contact' }
            ]
          }
        }
      ]
    })

    const result = await service.ingest({
      websiteId: 'site-1',
      detectionResults: [detection],
      designTokens: null
    })

    expect(repository.resolveByOriginalUrl).not.toHaveBeenCalled()
    expect(storageProvider.put).not.toHaveBeenCalled()
    expect(result.mediaAssets).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('detects hero backgroundImage fields as media candidates', async () => {
    const { service, repository, storageProvider } = createService()
    const detection = buildDetection({
      components: [
        {
          component: 'hero-banner',
          type: 'HeroBanner',
          confidence: 0.9,
          content: { backgroundImage: '/media/hero.jpg' }
        }
      ],
      pageUrl: 'https://example.com/'
    })
    ;(repository.resolveByOriginalUrl as jest.Mock).mockResolvedValue(null)
    ;(repository.findByChecksum as jest.Mock).mockResolvedValue(null)
    ;(repository.createMediaAsset as jest.Mock).mockResolvedValue({
      id: 'media-hero',
      storageKey: 'site-1/abcdef.png',
      contentType: 'image/png',
      checksum: 'abcdef'
    })

    const { dir: tempDir, filePath: tempFile } = await writeTempFile('media-ingest-test-hero-', MINIMAL_PNG)

    const downloadSpy = jest
      .spyOn(MediaIngestService.prototype as unknown as { downloadToTemp: (url: string, dir: string) => Promise<any> }, 'downloadToTemp')
      .mockResolvedValue({
        filePath: tempFile,
        checksum: 'abcdef',
        contentType: 'image/png',
        contentLength: 10
      })

    const result = await service.ingest({
      websiteId: 'site-1',
      detectionResults: [detection],
      designTokens: null
    })

    const component = result.detections[0].components?.[0]
    expect(component?.content).toEqual({
      backgroundImage: {
        src: 'https://example.com/media/hero.jpg',
        mediaId: 'media-hero',
        originalUrl: 'https://example.com/media/hero.jpg'
      }
    })
    expect(result.mediaAssets).toEqual([
      expect.objectContaining({
        mediaId: 'media-hero',
        originalUrl: 'https://example.com/media/hero.jpg'
      })
    ])

    expect(downloadSpy).toHaveBeenCalledWith('https://example.com/media/hero.jpg', expect.any(String))

    downloadSpy.mockRestore()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('rejects downloads with disallowed MIME types', async () => {
    const { service, repository } = createService()
    const detection = buildDetection()
    ;(repository.resolveByOriginalUrl as jest.Mock).mockResolvedValue(null)
    const { dir: tempDir, filePath: tempFile } = await writeTempFile('media-ingest-pdf-', PDF_STUB)

    const downloadSpy = jest
      .spyOn(MediaIngestService.prototype as unknown as { downloadToTemp: (url: string, dir: string) => Promise<any> }, 'downloadToTemp')
      .mockResolvedValue({
        filePath: tempFile,
        checksum: 'pdfsum',
        contentType: 'application/pdf',
        contentLength: PDF_STUB.length
      })

    const result = await service.ingest({
      websiteId: 'site-1',
      detectionResults: [detection],
      designTokens: null
    })

    expect(result.mediaAssets).toHaveLength(0)
    expect(result.warnings).toEqual([
      expect.objectContaining({ reason: 'disallowed_mime' })
    ])
    expect(repository.createMediaAsset).not.toHaveBeenCalled()

    downloadSpy.mockRestore()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('rejects downloads when MIME header and content mismatch', async () => {
    const { service, repository } = createService()
    const detection = buildDetection()
    ;(repository.resolveByOriginalUrl as jest.Mock).mockResolvedValue(null)
    const { dir: tempDir, filePath: tempFile } = await writeTempFile('media-ingest-mismatch-', PDF_STUB)

    const downloadSpy = jest
      .spyOn(MediaIngestService.prototype as unknown as { downloadToTemp: (url: string, dir: string) => Promise<any> }, 'downloadToTemp')
      .mockResolvedValue({
        filePath: tempFile,
        checksum: 'pdfsum',
        contentType: 'image/png',
        contentLength: PDF_STUB.length
      })

    const result = await service.ingest({
      websiteId: 'site-1',
      detectionResults: [detection],
      designTokens: null
    })

    expect(result.mediaAssets).toHaveLength(0)
    expect(result.warnings).toEqual([
      expect.objectContaining({ reason: 'mime_mismatch' })
    ])
    expect(repository.createMediaAsset).not.toHaveBeenCalled()

    downloadSpy.mockRestore()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('rejects downloads that exceed the configured max size', async () => {
    const { service, repository } = createService({ maxFileSizeBytes: 4 })
    const detection = buildDetection()
    ;(repository.resolveByOriginalUrl as jest.Mock).mockResolvedValue(null)
    const largeBuffer = Buffer.concat([MINIMAL_PNG, Buffer.alloc(10, 1)])
    const { dir: tempDir, filePath: tempFile } = await writeTempFile('media-ingest-oversize-', largeBuffer)

    const downloadSpy = jest
      .spyOn(MediaIngestService.prototype as unknown as { downloadToTemp: (url: string, dir: string) => Promise<any> }, 'downloadToTemp')
      .mockResolvedValue({
        filePath: tempFile,
        checksum: 'bigsum',
        contentType: 'image/png',
        contentLength: largeBuffer.length
      })

    const result = await service.ingest({
      websiteId: 'site-1',
      detectionResults: [detection],
      designTokens: null
    })

    expect(result.mediaAssets).toHaveLength(0)
    expect(result.warnings).toEqual([
      expect.objectContaining({ reason: 'oversize' })
    ])
    expect(repository.createMediaAsset).not.toHaveBeenCalled()

    downloadSpy.mockRestore()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('persists rendition metadata when renditions are generated', async () => {
    const { service, repository } = createService()
    const detection = buildDetection()
    ;(repository.resolveByOriginalUrl as jest.Mock).mockResolvedValue(null)
    ;(repository.findByChecksum as jest.Mock).mockResolvedValue(null)
    ;(repository.createMediaAsset as jest.Mock).mockImplementation(async (input: any) => ({
      id: 'media-renditions',
      websiteId: input.websiteId,
      provider: input.provider,
      storageKey: input.storageKey,
      checksum: input.checksum,
      contentType: input.contentType,
      width: input.width,
      height: input.height,
      duration: null,
      metadata: input.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    }))
    extractSpy.mockResolvedValue({ width: 1920, height: 1080 })
    renditionsSpy.mockResolvedValue([{ storageKey: 'site-1/abcdef-768w.png', width: 768, height: 512 }])

    const { dir: tempDir, filePath: tempFile } = await writeTempFile('media-ingest-renditions-', MINIMAL_PNG)

    const downloadSpy = jest
      .spyOn(MediaIngestService.prototype as unknown as { downloadToTemp: (url: string, dir: string) => Promise<any> }, 'downloadToTemp')
      .mockResolvedValue({
        filePath: tempFile,
        checksum: 'abcdef',
        contentType: 'image/png',
        contentLength: MINIMAL_PNG.length
      })

    const result = await service.ingest({
      websiteId: 'site-1',
      detectionResults: [detection],
      designTokens: null
    })

    expect(repository.createMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          renditions: [
            expect.objectContaining({
              storageKey: 'site-1/abcdef-768w.png',
              width: 768
            })
          ]
        }),
        width: 1920,
        height: 1080
      })
    )
    expect(result.mediaAssets[0]).toEqual(
      expect.objectContaining({
        width: 1920,
        height: 1080
      })
    )

    downloadSpy.mockRestore()
    await fs.rm(tempDir, { recursive: true, force: true })
  })
})
