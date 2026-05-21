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
})
