import { NextRequest } from 'next/server'
import { POST, GET } from '../reimport/route'
import { prisma } from '@/lib/prisma'
import { ReImportService } from '@/lib/studio/import/services/reimport-service'
import { ImportPipeline } from '@/lib/studio/import/import-pipeline'

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn().mockResolvedValue({
    accountId: 'test-account-id',
    userId: 'test-user-id',
  }),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findUnique: jest.fn(),
    },
    websitePage: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/studio/import/services/reimport-service')
jest.mock('@/lib/studio/import/import-pipeline')

const mockReimport = jest.fn()
const prismaMock = prisma as unknown as {
  website: {
    findUnique: jest.Mock
  }
  websitePage: {
    findUnique: jest.Mock
    findMany: jest.Mock
  }
}

const ReImportServiceMock = jest.mocked(ReImportService)

describe('Re-Import API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReimport.mockReset()
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key'

    prismaMock.website.findUnique.mockResolvedValue({
      id: 'test-website-id',
      accountId: 'test-account-id',
      name: 'Test Website',
    })

    ReImportServiceMock.mockImplementation(
      () => ({
        reimport: mockReimport,
      }) as unknown as InstanceType<typeof ReImportService>
    )
  })

  describe('POST /api/studio/import/reimport', () => {
    it('successfully re-imports pages and returns results', async () => {
      mockReimport.mockResolvedValueOnce({
        success: true,
        results: [
          {
            url: 'https://example.com/about',
            status: 'updated',
            pageId: 'page-1',
            changes: {
              componentsAdded: 2,
              componentsRemoved: 1,
              componentsUpdated: 3,
            },
          },
        ],
        summary: {
          updated: 1,
          created: 0,
          unchanged: 0,
          sourceNotFound: 0,
          failed: 0,
          skipped: 0,
          sharedComponentsUpdated: 0,
          mediaDownloaded: 0,
          totalComponentsAdded: 2,
          totalComponentsRemoved: 1,
        },
        warnings: [],
        processingTimeMs: 5000,
      })

      const request = new NextRequest('http://localhost:3000/api/studio/import/reimport', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'test-website-id',
          urls: ['https://example.com/about'],
        }),
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.status).toBe('completed')
      expect(payload.results).toHaveLength(1)
      expect(payload.results[0].status).toBe('updated')
      expect(payload.summary.updated).toBe(1)
      expect(mockReimport).toHaveBeenCalledWith(
        expect.objectContaining({
          websiteId: 'test-website-id',
          urls: ['https://example.com/about'],
        })
      )
    })

    it('returns 400 when websiteId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/import/reimport', {
        method: 'POST',
        body: JSON.stringify({
          urls: ['https://example.com/about'],
        }),
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toContain('websiteId is required')
      expect(mockReimport).not.toHaveBeenCalled()
    })

    it('returns 400 when urls is missing or empty', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/import/reimport', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'test-website-id',
          urls: [],
        }),
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toContain('urls is required')
      expect(mockReimport).not.toHaveBeenCalled()
    })

    it('returns 400 for invalid URL format', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/import/reimport', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'test-website-id',
          urls: ['not-a-valid-url'],
        }),
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toContain('Invalid URL')
      expect(mockReimport).not.toHaveBeenCalled()
    })

    it('returns 400 for localhost URLs', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/import/reimport', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'test-website-id',
          urls: ['http://localhost:3000/page'],
        }),
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toContain('localhost')
      expect(mockReimport).not.toHaveBeenCalled()
    })

    it('returns 404 when website not found', async () => {
      prismaMock.website.findUnique.mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost:3000/api/studio/import/reimport', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'non-existent',
          urls: ['https://example.com/about'],
        }),
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error).toContain('Website not found')
    })

    it('returns 403 when website belongs to different account', async () => {
      prismaMock.website.findUnique.mockResolvedValueOnce({
        id: 'test-website-id',
        accountId: 'different-account-id',
        name: 'Other Website',
      })

      const request = new NextRequest('http://localhost:3000/api/studio/import/reimport', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'test-website-id',
          urls: ['https://example.com/about'],
        }),
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(403)
      expect(payload.error).toContain('permission')
    })

    it('returns 500 when OpenRouter API key is missing', async () => {
      delete process.env.OPENROUTER_API_KEY

      const request = new NextRequest('http://localhost:3000/api/studio/import/reimport', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'test-website-id',
          urls: ['https://example.com/about'],
        }),
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(500)
      expect(payload.error).toContain('Import service not configured')
    })

    it('passes options to reimport service', async () => {
      mockReimport.mockResolvedValueOnce({
        success: true,
        results: [],
        summary: {
          updated: 0, created: 0, unchanged: 0, sourceNotFound: 0,
          failed: 0, skipped: 0, sharedComponentsUpdated: 0,
          mediaDownloaded: 0, totalComponentsAdded: 0, totalComponentsRemoved: 0,
        },
        warnings: [],
        processingTimeMs: 100,
      })

      const request = new NextRequest('http://localhost:3000/api/studio/import/reimport', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'test-website-id',
          urls: ['https://example.com/about'],
          options: {
            preserveCustomizations: true,
            skipSharedComponents: true,
          },
        }),
      })

      await POST(request)

      expect(mockReimport).toHaveBeenCalledWith(
        expect.objectContaining({
          preserveCustomizations: true,
          skipSharedComponents: true,
        })
      )
    })

    it('returns failed status when reimport fails', async () => {
      mockReimport.mockResolvedValueOnce({
        success: false,
        results: [{
          url: 'https://example.com/about',
          status: 'failed',
          error: 'Detection failed',
        }],
        summary: {
          updated: 0, created: 0, unchanged: 0, sourceNotFound: 0,
          failed: 1, skipped: 0, sharedComponentsUpdated: 0,
          mediaDownloaded: 0, totalComponentsAdded: 0, totalComponentsRemoved: 0,
        },
        warnings: [],
        processingTimeMs: 1000,
      })

      const request = new NextRequest('http://localhost:3000/api/studio/import/reimport', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'test-website-id',
          urls: ['https://example.com/about'],
        }),
      })

      const response = await POST(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.status).toBe('failed')
      expect(payload.summary.failed).toBe(1)
    })
  })

  describe('GET /api/studio/import/reimport', () => {
    it('returns list of reimportable pages for a website', async () => {
      prismaMock.websitePage.findMany.mockResolvedValueOnce([
        {
          id: 'page-1',
          title: 'About Us',
          status: 'draft',
          metadata: {
            importSource: 'https://example.com/about',
            lastReimportedAt: '2024-01-15T10:00:00Z',
          },
          updatedAt: new Date('2024-01-15'),
        },
        {
          id: 'page-2',
          title: 'Contact',
          status: 'draft',
          metadata: {
            importSource: 'https://example.com/contact',
            sourceNotFoundAt: '2024-01-10T10:00:00Z',
          },
          updatedAt: new Date('2024-01-14'),
        },
      ])

      const request = new NextRequest(
        'http://localhost:3000/api/studio/import/reimport?websiteId=test-website-id'
      )

      const response = await GET(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.websiteId).toBe('test-website-id')
      expect(payload.pages).toHaveLength(2)
      expect(payload.pages[0].importSource).toBe('https://example.com/about')
      expect(payload.pages[1].sourceNotFoundAt).toBe('2024-01-10T10:00:00Z')
    })

    it('returns 400 when websiteId is missing', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/studio/import/reimport'
      )

      const response = await GET(request)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toContain('websiteId is required')
    })

    it('returns 404 when website not found', async () => {
      prismaMock.website.findUnique.mockResolvedValueOnce(null)

      const request = new NextRequest(
        'http://localhost:3000/api/studio/import/reimport?websiteId=non-existent'
      )

      const response = await GET(request)
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error).toContain('Website not found')
    })

    it('returns specific page info when pageId is provided', async () => {
      prismaMock.websitePage.findUnique.mockResolvedValueOnce({
        id: 'page-1',
        title: 'About Us',
        status: 'draft',
        metadata: {
          importSource: 'https://example.com/about',
          lastReimportedAt: '2024-01-15T10:00:00Z',
          reimportHistory: [
            {
              timestamp: '2024-01-15T10:00:00Z',
              changes: { componentsAdded: 2, componentsRemoved: 0, componentsUpdated: 1 },
              sourceStatus: 200,
              preservedCustomizations: false,
            },
          ],
        },
        updatedAt: new Date('2024-01-15'),
      })

      const request = new NextRequest(
        'http://localhost:3000/api/studio/import/reimport?websiteId=test-website-id&pageId=page-1'
      )

      const response = await GET(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.pageId).toBe('page-1')
      expect(payload.importSource).toBe('https://example.com/about')
      expect(payload.reimportHistory).toHaveLength(1)
    })

    it('returns 404 when specific page not found', async () => {
      prismaMock.websitePage.findUnique.mockResolvedValueOnce(null)

      const request = new NextRequest(
        'http://localhost:3000/api/studio/import/reimport?websiteId=test-website-id&pageId=non-existent'
      )

      const response = await GET(request)
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error).toContain('Page not found')
    })
  })
})
