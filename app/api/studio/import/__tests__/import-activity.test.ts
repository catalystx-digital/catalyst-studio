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
    importRun: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    importJob: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}))

describe('GET /api/studio/import/activity', () => {
  beforeEach(() => {
    const prismaMock = prisma as unknown as {
      importRun: { findMany: jest.Mock; findUnique: jest.Mock }
      importJob: { findMany: jest.Mock; findFirst: jest.Mock }
    }
    prismaMock.importRun.findMany.mockReset().mockResolvedValue([])
    prismaMock.importRun.findUnique.mockReset().mockResolvedValue(null)
    prismaMock.importJob.findMany.mockReset().mockResolvedValue([])
    prismaMock.importJob.findFirst.mockReset().mockResolvedValue(null)
  })

  it('returns hydrated import jobs for the current account', async () => {
    const now = new Date('2025-09-17T10:15:00.000Z')
    const prismaMock = prisma as unknown as {
      importRun: {
        findMany: jest.Mock
      }
      importJob: {
        findMany: jest.Mock
      }
    }

    prismaMock.importRun.findMany.mockResolvedValue([])
    prismaMock.importJob.findMany
      .mockResolvedValueOnce([
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
      .mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost:3000/api/studio/import/activity')
    const response = await getImportActivity(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.importJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        website: { accountId: 'test-account-id' },
        importRuns: { none: {} },
      }),
      include: {
        website: {
          select: { id: true, name: true, icon: true },
        },
      },
    }))

    expect(Array.isArray(payload.data)).toBe(true)
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0]).toMatchObject({
      id: 'job-123',
      websiteId: 'site-123',
      status: 'running',
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
      importRun: {
        findMany: jest.Mock
      }
      importJob: {
        findMany: jest.Mock
      }
    }

    prismaMock.importRun.findMany.mockResolvedValue([])
    prismaMock.importJob.findMany
      .mockResolvedValueOnce([
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
      importRun: {
        findMany: jest.Mock
      }
      importJob: {
        findMany: jest.Mock
      }
    }

    prismaMock.importRun.findMany.mockResolvedValue([])
    prismaMock.importJob.findMany
      .mockResolvedValueOnce([
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
      .mockResolvedValueOnce([])

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

  it('normalizes import run page-stage statuses for canvas metadata', async () => {
    const prismaMock = prisma as unknown as {
      importRun: {
        findMany: jest.Mock
      }
      importJob: {
        findMany: jest.Mock
      }
    }

    prismaMock.importRun.findMany.mockResolvedValueOnce([
      {
        id: 'run-1',
        importJobId: 'job-run',
        websiteId: 'site-run',
        sourceUrl: 'https://example.com',
        status: 'detecting',
        phase: 'detect_page',
        progress: 60,
        message: 'Extracting shared components...',
        totalPages: 5,
        stagedPages: 2,
        committedPages: 1,
        failedPages: 1,
        recoverableActions: [],
        lastError: null,
        startedAt: new Date('2025-09-17T09:00:00.000Z'),
        completedAt: null,
        createdAt: new Date('2025-09-17T09:00:00.000Z'),
        updatedAt: new Date('2025-09-17T09:10:00.000Z'),
        importJob: {
          id: 'job-run',
          websiteId: 'site-run',
          url: 'https://example.com',
          status: 'processing',
          errorMessage: null,
          startedAt: new Date('2025-09-17T09:00:00.000Z'),
          completedAt: null,
          createdAt: new Date('2025-09-17T09:00:00.000Z'),
          updatedAt: new Date('2025-09-17T09:10:00.000Z'),
        },
        website: {
          id: 'site-run',
          name: 'Run Site',
          icon: null,
        },
        pageStages: [
          {
            sourceUrl: 'https://example.com/a',
            canonicalUrl: null,
            normalizedPageUrl: 'https://example.com/a',
            title: 'A',
            status: 'detected',
            phase: 'detect_page',
            error: null,
            committedPageId: null,
          },
          {
            sourceUrl: 'https://example.com/b',
            canonicalUrl: null,
            normalizedPageUrl: 'https://example.com/b',
            title: 'B',
            status: 'committed',
            phase: 'commit_page',
            error: null,
            committedPageId: 'page-b',
          },
          {
            sourceUrl: 'https://example.com/c',
            canonicalUrl: null,
            normalizedPageUrl: 'https://example.com/c',
            title: 'C',
            status: 'failed_retryable',
            phase: 'detect_page',
            error: { message: 'Timeout' },
            committedPageId: null,
          },
          {
            sourceUrl: 'https://example.com/d',
            canonicalUrl: null,
            normalizedPageUrl: 'https://example.com/d',
            title: 'D',
            status: 'skipped',
            phase: 'detect_page',
            error: null,
            committedPageId: null,
          },
          {
            sourceUrl: 'https://example.com/e',
            canonicalUrl: null,
            normalizedPageUrl: 'https://example.com/e',
            title: 'E',
            status: 'recoverable_stuck',
            phase: 'detect_page',
            error: { message: 'Manual retry available' },
            committedPageId: null,
          },
        ],
      },
    ])
    prismaMock.importJob.findMany.mockResolvedValueOnce([])

    const request = new NextRequest('http://localhost:3000/api/studio/import/activity')
    const response = await getImportActivity(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data[0]).toMatchObject({
      id: 'job-run',
      status: 'running',
      progress: 60,
      productStatus: 'active',
      metadata: {
        progressSummary: {
          processedCount: 4,
          totalCount: 5,
          currentUrl: 'https://example.com/a',
        },
      },
    })
    expect(payload.data[0].metadata.pages).toEqual([
      expect.objectContaining({ url: 'https://example.com/a', normalizedPageUrl: 'https://example.com/a', status: 'processing', rawStatus: 'detected' }),
      expect.objectContaining({ url: 'https://example.com/b', normalizedPageUrl: 'https://example.com/b', status: 'ready', rawStatus: 'committed', committedPageId: 'page-b' }),
      expect.objectContaining({ url: 'https://example.com/c', normalizedPageUrl: 'https://example.com/c', status: 'failed', rawStatus: 'failed_retryable' }),
      expect.objectContaining({ url: 'https://example.com/d', normalizedPageUrl: 'https://example.com/d', status: 'skipped', rawStatus: 'skipped' }),
      expect.objectContaining({ url: 'https://example.com/e', normalizedPageUrl: 'https://example.com/e', status: 'invalid', rawStatus: 'recoverable_stuck' }),
    ])
  })

  it('handles errors gracefully', async () => {
    const prismaMock = prisma as unknown as {
      importRun: { findMany: jest.Mock }
      importJob: { findMany: jest.Mock }
    }
    prismaMock.importRun.findMany.mockRejectedValue(new Error('database offline'))

    const request = new NextRequest('http://localhost:3000/api/studio/import/activity')
    const response = await getImportActivity(request)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error).toBeDefined()
  })
})
