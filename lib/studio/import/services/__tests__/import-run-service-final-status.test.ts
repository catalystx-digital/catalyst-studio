import { ImportRunService } from '@/lib/studio/import/services/import-run-service'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    importRun: {
      findUnique: jest.fn(),
    },
    importPageStage: {
      count: jest.fn(),
    },
  },
}))

describe('ImportRunService final status', () => {
  beforeEach(() => {
    const prismaMock = prisma as unknown as {
      importRun: { findUnique: jest.Mock }
      importPageStage: { count: jest.Mock }
    }
    prismaMock.importRun.findUnique.mockReset().mockResolvedValue({
      id: 'run-1',
      importJobId: 'job-1',
      status: 'importing',
    })
    prismaMock.importPageStage.count.mockReset()
  })

  it('returns completed_with_warnings when some pages commit and some fail', async () => {
    const prismaMock = prisma as unknown as {
      importPageStage: { count: jest.Mock }
    }
    prismaMock.importPageStage.count
      .mockResolvedValueOnce(2) // committed
      .mockResolvedValueOnce(1) // failed
      .mockResolvedValueOnce(0) // skipped
      .mockResolvedValueOnce(0) // redirects
      .mockResolvedValueOnce(3) // total

    const result = await new ImportRunService().deriveFinalStatusForJob('job-1')

    expect(result).toMatchObject({
      status: 'completed_with_warnings',
      committedPages: 2,
      failedPages: 1,
      totalPages: 3,
    })
  })

  it('fails the run when no pages commit and at least one page failed', async () => {
    const prismaMock = prisma as unknown as {
      importPageStage: { count: jest.Mock }
    }
    prismaMock.importPageStage.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)

    const result = await new ImportRunService().deriveFinalStatusForJob('job-1')

    expect(result).toMatchObject({
      status: 'failed_retryable',
      committedPages: 0,
      failedPages: 1,
    })
  })
})
