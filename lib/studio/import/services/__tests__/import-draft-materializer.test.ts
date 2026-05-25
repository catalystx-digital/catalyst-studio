import { prisma } from '@/lib/prisma'
import { ImportDraftMaterializer } from '@/lib/studio/import/services/import-draft-materializer'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    importRun: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/studio/activity/studio-event-bus', () => ({
  studioEventBus: {
    publishInTransaction: jest.fn().mockResolvedValue({ id: 'event-1' }),
    publishAfterCommit: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/lib/studio/import/services/import-activity-read-service', () => ({
  ImportActivityReadService: jest.fn().mockImplementation(() => ({
    getForJobByWebsite: jest.fn().mockResolvedValue(null),
  })),
}))

describe('ImportDraftMaterializer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('attaches top-level imported pages to the existing root structure', async () => {
    const structures = new Map<string, any>()
    const createdStructures: any[] = []
    let pageIndex = 0
    let structureIndex = 0

    const tx = {
      importRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'run-1',
          importJobId: 'job-1',
          websiteId: 'website-1',
          pageStages: [
            {
              id: 'stage-about',
              runId: 'run-1',
              websiteId: 'website-1',
              sourceUrl: 'https://example.com/about',
              normalizedPageUrl: 'https://example.com/about',
              normalizedPath: '/about',
              title: 'About',
              status: 'discovered',
              phase: 'queued',
              draftPageId: null,
              draftStructureId: null,
            },
            {
              id: 'stage-home',
              runId: 'run-1',
              websiteId: 'website-1',
              sourceUrl: 'https://example.com/',
              normalizedPageUrl: 'https://example.com/',
              normalizedPath: '/',
              title: 'Home',
              status: 'discovered',
              phase: 'queued',
              draftPageId: null,
              draftStructureId: null,
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      contentType: {
        findFirst: jest.fn().mockResolvedValue({ id: 'content-type-page' }),
      },
      websitePage: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: `page-${++pageIndex}`,
          ...data,
        })),
        update: jest.fn(),
      },
      websiteStructure: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const fullPath = where.websiteId_fullPath.fullPath
          return structures.get(fullPath) ?? null
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const structure = {
            id: `structure-${++structureIndex}`,
            ...data,
          }
          structures.set(data.fullPath, structure)
          createdStructures.push(structure)
          return structure
        }),
        update: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      importPageStage: {
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      website: {
        update: jest.fn().mockResolvedValue({ revision: 2 }),
      },
    }

    ;(prisma.$transaction as jest.Mock).mockImplementation((callback) => callback(tx))
    ;(prisma.importRun.findUnique as jest.Mock).mockResolvedValue({
      websiteId: 'website-1',
      importJobId: 'job-1',
    })

    await new ImportDraftMaterializer().materializeRun('run-1')

    const root = createdStructures.find((structure) => structure.fullPath === '/')
    const about = createdStructures.find((structure) => structure.fullPath === '/about')

    expect(root).toEqual(expect.objectContaining({ parentId: null }))
    expect(about).toEqual(expect.objectContaining({ parentId: root.id }))
  })

  it('uses a structure-only root as the parent for top-level imported pages', async () => {
    const structures = new Map<string, any>([
      ['/', { id: 'root-structure', websiteId: 'website-1', fullPath: '/', websitePageId: null }],
    ])
    const createdStructures: any[] = []

    const tx = {
      importRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'run-1',
          importJobId: 'job-1',
          websiteId: 'website-1',
          pageStages: [
            {
              id: 'stage-about',
              runId: 'run-1',
              websiteId: 'website-1',
              sourceUrl: 'https://example.com/about',
              normalizedPageUrl: 'https://example.com/about',
              normalizedPath: '/about',
              title: 'About',
              status: 'discovered',
              phase: 'queued',
              draftPageId: null,
              draftStructureId: null,
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      contentType: {
        findFirst: jest.fn().mockResolvedValue({ id: 'content-type-page' }),
      },
      websitePage: {
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'page-about', ...data })),
        update: jest.fn(),
      },
      websiteStructure: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const fullPath = where.websiteId_fullPath.fullPath
          return structures.get(fullPath) ?? null
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const structure = { id: 'about-structure', ...data }
          createdStructures.push(structure)
          return structure
        }),
        update: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      importPageStage: {
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      website: {
        update: jest.fn().mockResolvedValue({ revision: 2 }),
      },
    }

    ;(prisma.$transaction as jest.Mock).mockImplementation((callback) => callback(tx))
    ;(prisma.importRun.findUnique as jest.Mock).mockResolvedValue({
      websiteId: 'website-1',
      importJobId: 'job-1',
    })

    await new ImportDraftMaterializer().materializeRun('run-1')

    expect(createdStructures).toHaveLength(1)
    expect(createdStructures[0]).toEqual(expect.objectContaining({ fullPath: '/about', parentId: 'root-structure' }))
  })
})
