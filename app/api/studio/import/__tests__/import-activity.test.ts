import { NextRequest } from 'next/server'
import { GET as getImportActivity } from '../activity/route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn().mockResolvedValue({
    accountId: 'test-account-id',
    userId: 'user-1',
  }),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    importJob: {
      findMany: jest.fn(),
    },
  },
}))

describe('GET /api/studio/import/activity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns hydrated import jobs for the current account', async () => {
    const now = new Date('2025-09-17T10:15:00.000Z')
    const prismaMock = prisma as unknown as {
      importJob: {
        findMany: jest.Mock
      }
    }

    prismaMock.importJob.findMany.mockResolvedValue([
      {
        id: 'job-123',
        websiteId: 'site-123',
        url: 'https://example.com',
        status: 'processing',
        detectionResults: { progress: 42, lastProgressMessage: 'Analyzing DOM' },
        errorMessage: null,
        startedAt: new Date('2025-09-17T10:00:00.000Z'),
        completedAt: null,
        createdAt: new Date('2025-09-17T09:59:00.000Z'),
        updatedAt: now,
        website: {
          id: 'site-123',
          name: 'Example',
          icon: null,
        },
      },
    ])

    const request = new NextRequest('http://localhost:3000/api/studio/import/activity')
    const response = await getImportActivity(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.importJob.findMany).toHaveBeenCalledWith({
      where: {
        website: { accountId: 'test-account-id' },
        status: { in: ['pending', 'processing', 'queued'] },
      },
      include: {
        website: {
          select: { id: true, name: true, icon: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    })

    expect(Array.isArray(payload.data)).toBe(true)
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0]).toMatchObject({
      id: 'job-123',
      websiteId: 'site-123',
      status: 'processing',
      progress: 42,
      stage: 'analyzing',
      message: 'Analyzing DOM',
      mode: 'new',
      state: 'active',
      queuePosition: null,
      estimatedStartSeconds: null,
    })
  })

  it('surfaces media diagnostics when present', async () => {
    const prismaMock = prisma as unknown as {
      importJob: {
        findMany: jest.Mock
      }
    }

    prismaMock.importJob.findMany.mockResolvedValue([
      {
        id: 'job-media',
        websiteId: 'site-media',
        url: 'https://media.example.com',
        status: 'completed',
        detectionResults: {
          progress: 100,
          mediaDiagnostics: {
            assetsDetected: 5,
            ingestWarningCount: 1,
            missingSrcCount: 2,
            missingSrcByPage: [
              { pageUrl: 'https://media.example.com/about', count: 1 },
              { pageUrl: 'https://media.example.com/home', count: 1 }
            ],
            missingSrcEntries: [
              {
                pageUrl: 'https://media.example.com/about',
                parentType: 'hero-with-image',
                field: 'image',
                mediaId: 'media-123',
                message: 'Hero image mediaId detected without a usable src.'
              }
            ]
          }
        },
        errorMessage: null,
        startedAt: new Date('2025-09-17T08:00:00.000Z'),
        completedAt: new Date('2025-09-17T08:30:00.000Z'),
        createdAt: new Date('2025-09-17T07:45:00.000Z'),
        updatedAt: new Date('2025-09-17T08:30:00.000Z'),
        website: {
          id: 'site-media',
          name: 'Media Site',
          icon: null
        }
      }
    ])

    const request = new NextRequest('http://localhost:3000/api/studio/import/activity')
    const response = await getImportActivity(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data[0].metadata?.media).toEqual({
      assetsDetected: 5,
      ingestWarningCount: 1,
      missingSrcCount: 2,
      missingSrcByPage: [
        { pageUrl: 'https://media.example.com/about', count: 1 },
        { pageUrl: 'https://media.example.com/home', count: 1 }
      ],
      missingSrcEntries: [
        {
          pageUrl: 'https://media.example.com/about',
          parentType: 'hero-with-image',
          field: 'image',
          mediaId: 'media-123',
          message: 'Hero image mediaId detected without a usable src.'
        }
      ]
    })
  })

  it('includes queued jobs with queue metadata', async () => {
    const prismaMock = prisma as unknown as {
      importJob: {
        findMany: jest.Mock
      }
    }

    prismaMock.importJob.findMany.mockResolvedValue([
      {
        id: 'job-queued',
        websiteId: 'site-789',
        url: 'https://queued.example.com',
        status: 'queued',
        detectionResults: {
          progress: 0,
          lastProgressMessage: 'Queued - waiting for an available import slot',
          queuePosition: 2,
          estimatedStartSeconds: 240,
        },
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date('2025-09-17T09:00:00.000Z'),
        updatedAt: new Date('2025-09-17T09:05:00.000Z'),
        website: {
          id: 'site-789',
          name: 'Queued Site',
          icon: null,
        },
      },
    ])

    const request = new NextRequest('http://localhost:3000/api/studio/import/activity')
    const response = await getImportActivity(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data[0]).toMatchObject({
      id: 'job-queued',
      status: 'queued',
      state: 'queued',
      queuePosition: 2,
      estimatedStartSeconds: 240,
      progress: 0,
      stage: 'queued',
    })
  })

  it('handles errors gracefully', async () => {
    const prismaMock = prisma as unknown as { importJob: { findMany: jest.Mock } }
    prismaMock.importJob.findMany.mockRejectedValue(new Error('database offline'))

    const request = new NextRequest('http://localhost:3000/api/studio/import/activity')
    const response = await getImportActivity(request)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error).toBeDefined()
  })
})
