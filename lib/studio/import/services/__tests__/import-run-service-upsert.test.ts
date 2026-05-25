import { ImportRunService } from '@/lib/studio/import/services/import-run-service'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    importRun: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    importPageStage: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
  },
}))

jest.mock('@/lib/studio/activity/studio-event-bus', () => ({
  studioEventBus: {
    publish: jest.fn(),
  },
}))

jest.mock('@/lib/studio/import/services/import-activity-read-service', () => ({
  ImportActivityReadService: jest.fn().mockImplementation(() => ({
    getForJobByWebsite: jest.fn().mockResolvedValue(null),
  })),
}))

jest.mock('@/lib/studio/import/services/import-draft-materializer', () => ({
  ImportDraftMaterializer: jest.fn().mockImplementation(() => ({
    updateDraftForStage: jest.fn().mockResolvedValue(undefined),
  })),
}))

describe('ImportRunService upsertPageStageForJob', () => {
  const run = {
    id: 'run-1',
    importJobId: 'job-1',
    websiteId: 'website-1',
    sourceUrl: 'https://example.com',
    totalPages: 1,
  }

  const committedStage = {
    id: 'stage-1',
    runId: 'run-1',
    websiteId: 'website-1',
    sourceUrl: 'https://example.com/about',
    canonicalUrl: null,
    normalizedPageUrl: 'https://example.com/about',
    normalizedPath: '/about',
    title: 'Committed title',
    status: 'committed',
    phase: 'commit_page',
    attemptToken: 'current-token',
    committedPageId: 'page-1',
  }

  beforeEach(() => {
    const prismaMock = prisma as unknown as {
      importRun: { findUnique: jest.Mock; update: jest.Mock }
      importPageStage: {
        findUnique: jest.Mock
        updateMany: jest.Mock
        create: jest.Mock
        count: jest.Mock
      }
    }

    jest.clearAllMocks()
    prismaMock.importRun.findUnique.mockResolvedValue(run)
    prismaMock.importRun.update.mockResolvedValue(run)
    prismaMock.importPageStage.create.mockResolvedValue(committedStage)
    prismaMock.importPageStage.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.importPageStage.count.mockResolvedValue(1)
  })

  it('does not mutate a protected committed stage when a stale writer reports the same page', async () => {
    const prismaMock = prisma as unknown as {
      importPageStage: {
        findUnique: jest.Mock
        updateMany: jest.Mock
        create: jest.Mock
        count: jest.Mock
      }
    }

    prismaMock.importPageStage.findUnique
      .mockResolvedValueOnce({
        id: committedStage.id,
        status: committedStage.status,
        attemptToken: committedStage.attemptToken,
      })
      .mockResolvedValueOnce(committedStage)

    const result = await new ImportRunService().upsertPageStageForJob('job-1', {
      pageUrl: 'https://example.com/about',
      title: 'Late stale title',
      status: 'committed',
      phase: 'commit_page',
      committedPageId: 'stale-page',
      attemptToken: 'stale-token',
    })

    expect(result).toEqual(committedStage)
    expect(prismaMock.importPageStage.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.importPageStage.create).not.toHaveBeenCalled()
    expect(prismaMock.importPageStage.count).not.toHaveBeenCalled()
  })

  it('marks empty committed page content as failed instead of committing a visible page', async () => {
    const prismaMock = prisma as unknown as {
      importPageStage: {
        findUnique: jest.Mock
        create: jest.Mock
      }
    }

    const failedStage = {
      ...committedStage,
      status: 'failed_terminal',
      committedPageId: null,
      error: {
        code: 'EMPTY_IMPORT_PAGE_CONTENT',
        message: 'Import page content has no components and cannot be committed',
        pageUrl: 'https://example.com/about',
      },
    }
    prismaMock.importPageStage.findUnique.mockResolvedValueOnce(null)
    prismaMock.importPageStage.create.mockResolvedValueOnce(failedStage)

    const result = await new ImportRunService().upsertPageStageForJob('job-1', {
      pageUrl: 'https://example.com/about',
      title: 'Empty page',
      status: 'committed',
      phase: 'commit_page',
      pageContent: {
        version: 1,
        components: [],
      },
      committedPageId: 'page-1',
    })

    expect(result).toEqual(failedStage)
    expect(prismaMock.importPageStage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'failed_terminal',
        committedPageId: null,
        committedAt: undefined,
        error: {
          code: 'EMPTY_IMPORT_PAGE_CONTENT',
          message: 'Import page content has no components and cannot be committed',
          pageUrl: 'https://example.com/about',
        },
      }),
    })
  })

  it('marks existing stages with empty committed page content as failed', async () => {
    const prismaMock = prisma as unknown as {
      importPageStage: {
        findUnique: jest.Mock
        updateMany: jest.Mock
      }
    }

    const failedStage = {
      ...committedStage,
      status: 'failed_terminal',
      committedPageId: null,
      error: {
        code: 'EMPTY_IMPORT_PAGE_CONTENT',
        message: 'Import page content has no components and cannot be committed',
        pageUrl: 'https://example.com/about',
      },
    }
    prismaMock.importPageStage.findUnique
      .mockResolvedValueOnce({
        id: 'stage-1',
        status: 'detected',
        attemptToken: 'current-token',
      })
      .mockResolvedValueOnce(failedStage)

    const result = await new ImportRunService().upsertPageStageForJob('job-1', {
      pageUrl: 'https://example.com/about',
      title: 'Empty page',
      status: 'committed',
      phase: 'commit_page',
      pageContent: {
        version: 1,
        components: [],
      },
      committedPageId: 'page-1',
    })

    expect(result).toEqual(failedStage)
    expect(prismaMock.importPageStage.updateMany).toHaveBeenCalledWith({
      where: { id: 'stage-1' },
      data: expect.objectContaining({
        status: 'failed_terminal',
        committedPageId: null,
        committedAt: undefined,
        error: {
          code: 'EMPTY_IMPORT_PAGE_CONTENT',
          message: 'Import page content has no components and cannot be committed',
          pageUrl: 'https://example.com/about',
        },
      }),
    })
  })

  it('commits page content when it contains components', async () => {
    const prismaMock = prisma as unknown as {
      importPageStage: {
        findUnique: jest.Mock
        create: jest.Mock
      }
    }

    prismaMock.importPageStage.findUnique.mockResolvedValueOnce(null)
    prismaMock.importPageStage.create.mockResolvedValueOnce(committedStage)

    await new ImportRunService().upsertPageStageForJob('job-1', {
      pageUrl: 'https://example.com/about',
      title: 'Imported page',
      status: 'committed',
      phase: 'commit_page',
      pageContent: {
        version: 1,
        components: [{ id: 'component-1', type: 'text-block', content: { text: 'Hello' } }],
      },
      committedPageId: 'page-1',
    })

    expect(prismaMock.importPageStage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'committed',
        committedPageId: 'page-1',
        committedAt: expect.any(Date),
        error: null,
      }),
    })
  })
})
