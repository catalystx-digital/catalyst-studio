import { NextRequest } from 'next/server'
import { POST as retryImport } from '../retry/[jobId]/route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn().mockResolvedValue({
    accountId: 'account-1',
    userId: 'user-1',
  }),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    importRun: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    importPageStage: {
      updateMany: jest.fn(),
    },
    importJob: {
      update: jest.fn(),
    },
  },
}))

jest.mock('workflow/api', () => ({
  start: jest.fn().mockResolvedValue({ id: 'workflow-1' }),
}))

jest.mock('@/lib/studio/workflows/import-website.workflow', () => ({
  importWebsiteWorkflow: jest.fn(),
}))

describe('POST /api/studio/import/retry/[jobId]', () => {
  beforeEach(() => {
    const prismaMock = prisma as unknown as {
      importRun: { findUnique: jest.Mock; update: jest.Mock }
      importPageStage: { updateMany: jest.Mock }
      importJob: { update: jest.Mock }
    }

    jest.clearAllMocks()
    prismaMock.importRun.findUnique.mockResolvedValue({
      id: 'run-1',
      importJobId: 'job-1',
      websiteId: 'website-1',
      sourceUrl: 'https://example.com',
      progress: 80,
      importJob: { id: 'job-1' },
      website: { accountId: 'account-1' },
    })
    prismaMock.importRun.update.mockResolvedValue({})
    prismaMock.importPageStage.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.importJob.update.mockResolvedValue({})
  })

  it('rotates retryable page tokens and increments the page attempt count', async () => {
    const prismaMock = prisma as unknown as {
      importPageStage: { updateMany: jest.Mock }
    }

    const response = await retryImport(
      new NextRequest('http://localhost:3000/api/studio/import/retry/job-1', { method: 'POST' }),
      { params: Promise.resolve({ jobId: 'job-1' }) },
    )

    expect(response.status).toBe(200)
    expect(prismaMock.importPageStage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attemptToken: expect.any(String),
          attempts: { increment: 1 },
        }),
      }),
    )
  })
})
