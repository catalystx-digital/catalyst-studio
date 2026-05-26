import { ImportRunService } from '@/lib/studio/import/services/import-run-service'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    importRun: {
      findUnique: jest.fn(),
    },
    importPageStage: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    websitePage: {
      findMany: jest.fn(),
    },
  },
}))

describe('ImportRunService final status', () => {
  beforeEach(() => {
    const prismaMock = prisma as unknown as {
      importRun: { findUnique: jest.Mock }
      importPageStage: { count: jest.Mock; findMany: jest.Mock }
      websitePage: { findMany: jest.Mock }
    }
    prismaMock.importRun.findUnique.mockReset().mockResolvedValue({
      id: 'run-1',
      importJobId: 'job-1',
      status: 'importing',
    })
    prismaMock.importPageStage.count.mockReset()
    prismaMock.importPageStage.findMany.mockReset().mockResolvedValue([])
    prismaMock.websitePage.findMany.mockReset().mockResolvedValue([])
  })

  it('returns completed_with_warnings when some pages commit and some fail', async () => {
    const prismaMock = prisma as unknown as {
      importPageStage: { count: jest.Mock; findMany: jest.Mock }
      websitePage: { findMany: jest.Mock }
    }
    prismaMock.importPageStage.findMany.mockResolvedValueOnce([
      { committedPageId: 'page-1', pageContent: { components: [{ type: 'navbar' }] } },
      { committedPageId: 'page-2', pageContent: { components: [{ type: 'text-block' }] } },
    ])
    prismaMock.websitePage.findMany.mockResolvedValueOnce([
      { id: 'page-1', content: { components: [{ type: 'navbar' }] } },
      { id: 'page-2', content: { components: [{ type: 'text-block' }] } },
    ])
    prismaMock.importPageStage.count
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

  it('treats committed stages with empty committed page content as failed warnings', async () => {
    const prismaMock = prisma as unknown as {
      importPageStage: { count: jest.Mock; findMany: jest.Mock }
      websitePage: { findMany: jest.Mock }
    }
    prismaMock.importPageStage.findMany.mockResolvedValueOnce([
      { committedPageId: 'page-1', pageContent: { components: [{ type: 'navbar' }] } },
      { committedPageId: 'page-empty', pageContent: { components: [{ type: 'text-block' }] } },
    ])
    prismaMock.websitePage.findMany.mockResolvedValueOnce([
      { id: 'page-1', content: { components: [{ type: 'navbar' }] } },
      { id: 'page-empty', content: { components: [] } },
    ])
    prismaMock.importPageStage.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2)

    const result = await new ImportRunService().deriveFinalStatusForJob('job-1')

    expect(result).toMatchObject({
      status: 'completed_with_warnings',
      committedPages: 1,
      failedPages: 1,
      totalPages: 2,
    })
  })
})
