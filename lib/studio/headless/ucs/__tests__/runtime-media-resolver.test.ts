import type { PrismaClient } from '@/lib/generated/prisma'
import { resolveRuntimeMedia, resolveRuntimeMediaBatch } from '@/lib/studio/headless/ucs/runtime-media-resolver'

function createPrismaMock(overrides: Partial<PrismaClient>): PrismaClient {
  return overrides as unknown as PrismaClient
}

describe('resolveRuntimeMedia', () => {
  const previousPublicBaseUrl = process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL

  afterEach(() => {
    if (previousPublicBaseUrl === undefined) {
      delete process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL
    } else {
      process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL = previousPublicBaseUrl
    }
    jest.clearAllMocks()
  })

  it('preserves canonical mediaId resolution through the configured public URL', async () => {
    process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL = 'https://cdn.example.com/media'
    const data = {
      image: {
        mediaId: 'media-1',
        url: 'https://legacy.example.com/old.jpg',
        altText: 'Hero image'
      }
    }
    const prisma = createPrismaMock({
      websiteMedia: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'media-1',
            storageKey: '/uploads/hero.jpg',
            contentType: 'image/jpeg',
            width: 1200,
            height: 800,
            metadata: {},
            sources: [
              {
                originalUrl: 'https://source.example.com/hero.jpg',
                metadata: {}
              }
            ]
          }
        ])
      }
    })

    const result = await resolveRuntimeMedia(data, 'site', prisma)

    expect(result).toEqual({ resolved: 1, unresolved: 0, errors: [] })
    expect(data.image.src).toBe('https://cdn.example.com/media/uploads/hero.jpg')
    expect(data.image.originalUrl).toBe('https://source.example.com/hero.jpg')
    expect(data.image.alt).toBe('Hero image')
  })

  it('does not apply fallback URL values when media is missing', async () => {
    process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL = 'https://cdn.example.com'
    const data = {
      image: {
        mediaId: 'missing-media',
        url: 'https://legacy.example.com/fallback.jpg',
        originalUrl: 'https://source.example.com/fallback.jpg'
      }
    }
    const prisma = createPrismaMock({
      websiteMedia: {
        findMany: jest.fn().mockResolvedValue([])
      }
    })

    const result = await resolveRuntimeMedia(data, 'site', prisma)

    expect(result.resolved).toBe(0)
    expect(result.unresolved).toBe(1)
    expect(result.errors).toEqual([
      'Media missing-media at image not found in database'
    ])
    expect(data.image).not.toHaveProperty('src')
  })

  it('does not apply fallback URL values when the media query fails', async () => {
    const data = {
      image: {
        mediaId: 'media-1',
        href: 'https://legacy.example.com/fallback.jpg',
        originalUrl: 'https://source.example.com/fallback.jpg'
      }
    }
    const prisma = createPrismaMock({
      websiteMedia: {
        findMany: jest.fn().mockRejectedValue(new Error('connection refused'))
      }
    })

    const result = await resolveRuntimeMedia(data, 'site', prisma)

    expect(result.resolved).toBe(0)
    expect(result.unresolved).toBe(1)
    expect(result.errors).toEqual([
      'Database query failed: connection refused'
    ])
    expect(data.image).not.toHaveProperty('src')
  })

  it('does not apply fallback URL values when public URL configuration is missing', async () => {
    delete process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL
    const data = {
      image: {
        mediaId: 'media-1',
        url: 'https://legacy.example.com/fallback.jpg'
      }
    }
    const prisma = createPrismaMock({
      websiteMedia: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'media-1',
            storageKey: 'uploads/hero.jpg',
            contentType: 'image/jpeg',
            width: null,
            height: null,
            metadata: {},
            sources: [
              {
                originalUrl: 'https://source.example.com/hero.jpg',
                metadata: {}
              }
            ]
          }
        ])
      }
    })

    const result = await resolveRuntimeMedia(data, 'site', prisma)

    expect(result.resolved).toBe(0)
    expect(result.unresolved).toBe(1)
    expect(result.errors).toEqual([
      'Media media-1 at image has no public URL configured'
    ])
    expect(data.image).not.toHaveProperty('src')
  })
})

describe('resolveRuntimeMediaBatch', () => {
  const previousPublicBaseUrl = process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL

  afterEach(() => {
    if (previousPublicBaseUrl === undefined) {
      delete process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL
    } else {
      process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL = previousPublicBaseUrl
    }
    jest.dontMock('@/lib/generated/prisma')
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('does not apply fallback URL values when Prisma is unavailable', async () => {
    jest.doMock('@/lib/generated/prisma', () => {
      throw new Error('module missing')
    })

    const data = {
      image: {
        mediaId: 'media-1',
        src: undefined,
        url: 'https://legacy.example.com/fallback.jpg',
        originalUrl: 'https://source.example.com/fallback.jpg'
      }
    }

    const result = await resolveRuntimeMediaBatch(
      [{ data }],
      'site'
    )

    expect(result.totalResolved).toBe(0)
    expect(result.totalUnresolved).toBe(1)
    expect(result.errors).toEqual([
      'Prisma client unavailable: module missing'
    ])
    expect(data.image.src).toBeUndefined()
  })

  it('does not apply fallback URL values when batch media records are missing', async () => {
    process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL = 'https://cdn.example.com'
    const data = {
      image: {
        mediaId: 'missing-media',
        url: 'https://legacy.example.com/fallback.jpg'
      }
    }
    const prisma = createPrismaMock({
      websiteMedia: {
        findMany: jest.fn().mockResolvedValue([])
      },
      $disconnect: jest.fn()
    })

    const result = await resolveRuntimeMediaBatch([{ data }], 'site', prisma)

    expect(result.totalResolved).toBe(0)
    expect(result.totalUnresolved).toBe(1)
    expect(result.errors).toEqual([
      'Media missing-media at image not found in database'
    ])
    expect(data.image).not.toHaveProperty('src')
  })

  it('does not apply fallback URL values when batch public URL configuration is missing', async () => {
    delete process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL
    const data = {
      image: {
        mediaId: 'media-1',
        href: 'https://legacy.example.com/fallback.jpg'
      }
    }
    const prisma = createPrismaMock({
      websiteMedia: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'media-1',
            storageKey: 'uploads/hero.jpg',
            contentType: 'image/jpeg',
            width: null,
            height: null,
            metadata: {},
            sources: [
              {
                originalUrl: 'https://source.example.com/hero.jpg',
                metadata: {}
              }
            ]
          }
        ])
      },
      $disconnect: jest.fn()
    })

    const result = await resolveRuntimeMediaBatch([{ data }], 'site', prisma)

    expect(result.totalResolved).toBe(0)
    expect(result.totalUnresolved).toBe(1)
    expect(result.errors).toEqual([
      'Media media-1 at image has no public URL configured'
    ])
    expect(data.image).not.toHaveProperty('src')
  })

  it('does not apply fallback URL values when the batch media query fails', async () => {
    const data = {
      image: {
        mediaId: 'media-1',
        originalUrl: 'https://source.example.com/fallback.jpg'
      }
    }
    const prisma = createPrismaMock({
      websiteMedia: {
        findMany: jest.fn().mockRejectedValue(new Error('query failed'))
      },
      $disconnect: jest.fn()
    })

    const result = await resolveRuntimeMediaBatch([{ data }], 'site', prisma)

    expect(result.totalResolved).toBe(0)
    expect(result.totalUnresolved).toBe(1)
    expect(result.errors).toEqual([
      'Failed to load media assets: query failed'
    ])
    expect(data.image).not.toHaveProperty('src')
  })
})
