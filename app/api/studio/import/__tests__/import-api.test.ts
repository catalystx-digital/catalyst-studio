import { NextRequest } from 'next/server'
import { POST as startImport } from '../start/route'
import { POST as cancelImport } from '../cancel/[jobId]/route'
import { prisma } from '@/lib/prisma'
import { checkAndRecordUsage } from '@/lib/usage/limits'
import { ImportService } from '@/lib/studio/import/services/import-service'

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn().mockResolvedValue({
    accountId: 'test-account-id',
    userId: 'test-user-id',
  }),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    importJob: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    websiteComponentType: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/usage/limits', () => ({
  checkAndRecordUsage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/studio/import/services/import-service')

// Mock workflow/api to prevent import errors
jest.mock('workflow/api', () => ({
  start: jest.fn().mockResolvedValue({ id: 'workflow-run-1' }),
}))

jest.mock('@/lib/studio/workflows/import-website.workflow', () => ({
  importWebsiteWorkflow: jest.fn(),
}))

const startImportMock = jest.fn()

const prismaMock = prisma as unknown as {
  website: {
    create: jest.Mock
    findUnique: jest.Mock
    update: jest.Mock
  }
  importJob: {
    findUnique: jest.Mock
    findMany: jest.Mock
    update: jest.Mock
  }
  websiteComponentType: {
    findMany: jest.Mock
    deleteMany: jest.Mock
  }
}

const usageMock = checkAndRecordUsage as jest.MockedFunction<typeof checkAndRecordUsage>
const ImportServiceMock = jest.mocked(ImportService)

describe('Import API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    startImportMock.mockReset()
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key'

    prismaMock.website.create.mockResolvedValue({
      id: 'test-website-id',
      name: 'Example Site',
      category: 'imported',
    })
    prismaMock.website.findUnique.mockResolvedValue(null)
    prismaMock.website.update.mockResolvedValue({})
    prismaMock.importJob.findUnique.mockResolvedValue(null)
    prismaMock.importJob.findMany.mockResolvedValue([])
    prismaMock.importJob.update.mockResolvedValue({})
    prismaMock.websiteComponentType.findMany.mockResolvedValue([])
    prismaMock.websiteComponentType.deleteMany.mockResolvedValue({ count: 0 })

    ImportServiceMock.mockImplementation(
      () => ({
        startImport: startImportMock,
      }) as unknown as InstanceType<typeof ImportService>,
    )
  })

  describe('POST /api/studio/import/start', () => {
    it('starts a new import and returns job metadata', async () => {
      startImportMock.mockResolvedValueOnce({
        job: { id: 'job-1', websiteId: 'test-website-id' } as any,
        message: 'Preparing import...',
        initialSitemap: [],
      })

      const request = new NextRequest('http://localhost:3000/api/studio/import/start', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com',
          websiteName: 'Example Site',
        }),
      })

      const response = await startImport(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(usageMock).toHaveBeenCalledWith(expect.anything(), 'test-account-id', 'import_page', 1, {
        metadata: { mode: 'new' },
      })
      expect(startImportMock).toHaveBeenCalledWith({
        websiteId: 'test-website-id',
        url: 'https://example.com',
        accountId: 'test-account-id',
      })
      expect(payload).toEqual({
        jobId: 'job-1',
        websiteId: 'test-website-id',
        mode: 'new',
        message: 'Preparing import...',
        initialSitemap: [],
      })
    })

    it('merges into an existing website when mode is merge', async () => {
      prismaMock.website.findUnique.mockResolvedValueOnce({
        id: 'existing-site',
        accountId: 'test-account-id',
      })
      startImportMock.mockResolvedValueOnce({
        job: { id: 'job-merge', websiteId: 'existing-site' } as any,
        message: 'Preparing import...',
        initialSitemap: [],
      })

      const request = new NextRequest('http://localhost:3000/api/studio/import/start', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com',
          mode: 'merge',
          targetWebsiteId: 'existing-site',
        }),
      })

      const response = await startImport(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(prismaMock.website.create).not.toHaveBeenCalled()
      expect(startImportMock).toHaveBeenCalledWith({
        websiteId: 'existing-site',
        url: 'https://example.com',
        accountId: 'test-account-id',
      })
      expect(payload.websiteId).toBe('existing-site')
      expect(payload.mode).toBe('merge')
    })

    it('requires targetWebsiteId for merge mode', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/import/start', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com',
          mode: 'merge',
        }),
      })

      const response = await startImport(request)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toContain('targetWebsiteId')
      expect(startImportMock).not.toHaveBeenCalled()
    })

    it('rejects invalid URLs', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/import/start', {
        method: 'POST',
        body: JSON.stringify({
          url: 'not-a-valid-url',
          websiteName: 'Invalid',
        }),
      })

      const response = await startImport(request)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toContain('valid website URL')
      expect(startImportMock).not.toHaveBeenCalled()
    })

    it('rejects localhost URLs', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/import/start', {
        method: 'POST',
        body: JSON.stringify({
          url: 'http://localhost:3000',
        }),
      })

      const response = await startImport(request)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toContain('localhost')
      expect(startImportMock).not.toHaveBeenCalled()
    })

    it('returns configuration error when OpenRouter API key is missing', async () => {
      delete process.env.OPENROUTER_API_KEY

      const request = new NextRequest('http://localhost:3000/api/studio/import/start', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://example.com',
        }),
      })

      const response = await startImport(request)
      const payload = await response.json()

      expect(response.status).toBe(500)
      expect(payload.error).toContain('Import service not configured')
      expect(startImportMock).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/studio/import/cancel/[jobId]', () => {
    it('cancels an active import job', async () => {
      prismaMock.importJob.findUnique.mockResolvedValueOnce({
        id: 'job-1',
        websiteId: 'test-website-id',
        status: 'processing',
        detectionResults: { progress: 50 },
        startedAt: new Date(),
        completedAt: null,
        website: { id: 'test-website-id', accountId: 'test-account-id' },
      })
      prismaMock.website.findUnique.mockResolvedValueOnce({
        id: 'test-website-id',
        accountId: 'test-account-id',
      })
      prismaMock.websiteComponentType.findMany.mockResolvedValueOnce([
        {
          id: 'component-1',
          aiMetadata: { importJobId: 'job-1' },
        },
      ])
      prismaMock.websiteComponentType.deleteMany.mockResolvedValueOnce({ count: 1 })
      prismaMock.importJob.update.mockResolvedValueOnce({
        id: 'job-1',
        status: 'cancelled',
      })

      const request = new NextRequest('http://localhost:3000/api/studio/import/cancel/job-1', {
        method: 'POST',
      })

      const response = await cancelImport(request, { params: Promise.resolve({ jobId: 'job-1' }) })
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload).toMatchObject({
        success: true,
        jobId: 'job-1',
        status: 'cancelled',
      })
      expect(prismaMock.websiteComponentType.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['component-1'] } },
      })
      expect(prismaMock.importJob.findMany).toHaveBeenCalledWith({
        where: {
          websiteId: 'test-website-id',
          status: 'completed',
          id: { not: 'job-1' },
        },
      })
    })

    it('does not cancel completed jobs', async () => {
      prismaMock.importJob.findUnique.mockResolvedValueOnce({
        id: 'job-1',
        websiteId: 'test-website-id',
        status: 'completed',
        website: { id: 'test-website-id', accountId: 'test-account-id' },
      })
      prismaMock.website.findUnique.mockResolvedValueOnce({
        id: 'test-website-id',
        accountId: 'test-account-id',
      })

      const request = new NextRequest('http://localhost:3000/api/studio/import/cancel/job-1', {
        method: 'POST',
      })

      const response = await cancelImport(request, { params: Promise.resolve({ jobId: 'job-1' }) })
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toContain('Cannot cancel job')
      expect(prismaMock.importJob.update).not.toHaveBeenCalled()
    })

    it('returns 404 for unknown jobs', async () => {
      prismaMock.importJob.findUnique.mockResolvedValueOnce(null)

      const request = new NextRequest('http://localhost:3000/api/studio/import/cancel/job-unknown', {
        method: 'POST',
      })

      const response = await cancelImport(request, { params: Promise.resolve({ jobId: 'job-unknown' }) })
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error).toContain('Import job not found')
    })
  })
})
