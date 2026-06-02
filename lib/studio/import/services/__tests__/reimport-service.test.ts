import { ReImportService } from '../reimport-service'
import { PrismaClient } from '@/lib/generated/prisma'
import { ImportPipeline } from '../../import-pipeline'

// Mock dependencies
jest.mock('@/lib/generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}))

jest.mock('../../import-pipeline', () => ({
  ImportPipeline: jest.fn().mockImplementation(() => mockImportPipeline),
}))
jest.mock('../checkpoint-service', () => ({
  getCheckpointService: jest.fn().mockReturnValue({
    initializeSession: jest.fn().mockResolvedValue({
      jobId: 'test-job',
      websiteId: 'test-website',
      cacheDir: '/tmp/test',
      manifest: {}
    }),
    saveSitemap: jest.fn().mockResolvedValue(undefined),
    getCompletedUrls: jest.fn().mockResolvedValue(new Set()),
    finalize: jest.fn().mockResolvedValue(undefined),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    completeStage: jest.fn().mockResolvedValue(undefined),
    resumeSession: jest.fn().mockResolvedValue(null),
    loadSitemap: jest.fn().mockResolvedValue(null),
  }),
}))

const mockPrisma = {
  $transaction: jest.fn(async (callback) => callback(mockPrisma)),
  website: {
    findUnique: jest.fn(),
  },
  websitePage: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  websiteStructure: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  importJob: {
    create: jest.fn(),
    update: jest.fn(),
  },
  websiteSharedComponent: {
    findMany: jest.fn(),
  },
  contentType: {
    findFirst: jest.fn(),
  },
}

const mockImportPipeline = {
  execute: jest.fn(),
  getLastDomProbeCapture: jest.fn().mockReturnValue(null),
}

describe('ReImportService', () => {
  let service: ReImportService

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENROUTER_API_KEY = 'test-api-key'
    ;(ImportPipeline as jest.Mock).mockImplementation(() => mockImportPipeline)

    service = new ReImportService({
      prisma: mockPrisma as unknown as PrismaClient,
      importPipeline: mockImportPipeline as unknown as ImportPipeline,
    })

    // Default mocks
    mockPrisma.website.findUnique.mockResolvedValue({
      id: 'test-website-id',
      accountId: 'test-account-id',
      importJobs: [{ url: 'https://example.com' }],
    })

    mockPrisma.contentType.findFirst.mockResolvedValue({
      id: 'content-type-1',
    })

    mockPrisma.importJob.create.mockResolvedValue({
      id: 'import-job-1',
    })
    mockPrisma.importJob.update.mockResolvedValue({})
    mockPrisma.websiteSharedComponent.findMany.mockResolvedValue([])
  })

  describe('validateUrls', () => {
    it('validates valid HTTP URLs', async () => {
      const results = await service.validateUrls('website-1', [
        'https://example.com/about',
        'https://example.com/contact',
      ])

      expect(results).toHaveLength(2)
      expect(results[0].valid).toBe(true)
      expect(results[1].valid).toBe(true)
    })

    it('rejects invalid URL formats', async () => {
      const results = await service.validateUrls('website-1', [
        'not-a-url',
        'ftp://example.com',
      ])

      expect(results[0].valid).toBe(false)
      expect(results[0].reason).toContain('Invalid URL')
      expect(results[1].valid).toBe(false)
      expect(results[1].reason).toContain('HTTP or HTTPS')
    })

    it('rejects localhost and private IPs', async () => {
      const results = await service.validateUrls('website-1', [
        'http://localhost/page',
        'http://127.0.0.1/page',
        'http://192.168.1.1/page',
        'http://10.0.0.1/page',
      ])

      results.forEach(result => {
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('not allowed')
      })
    })

    it('normalizes URLs correctly', async () => {
      const results = await service.validateUrls('website-1', [
        'https://EXAMPLE.COM/About/',
      ])

      expect(results[0].valid).toBe(true)
      expect(results[0].normalizedUrl).toBe('https://example.com/About')
    })
  })

  describe('resolveExistingPage', () => {
    it('finds page by importSource metadata', async () => {
      const mockPage = {
        id: 'page-1',
        title: 'About',
        metadata: { importSource: 'https://example.com/about' },
        structures: [{ id: 'struct-1', fullPath: '/about' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(mockPage)

      const result = await service.resolveExistingPage(
        'website-1',
        'https://example.com/about'
      )

      expect(result.found).toBe(true)
      expect(result.page).toEqual(mockPage)
      expect(result.matchedBy).toBe('importSource')
    })

    it('finds page by URL path when importSource not found', async () => {
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(null)

      const mockStructure = {
        id: 'struct-1',
        fullPath: '/about',
        websitePage: { id: 'page-1', title: 'About' },
      }
      mockPrisma.websiteStructure.findFirst.mockResolvedValueOnce(mockStructure)

      const result = await service.resolveExistingPage(
        'website-1',
        'https://example.com/about'
      )

      expect(result.found).toBe(true)
      expect(result.page).toEqual(mockStructure.websitePage)
      expect(result.matchedBy).toBe('fullPath')
    })

    it('returns not found when page does not exist', async () => {
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(null)
      mockPrisma.websiteStructure.findFirst.mockResolvedValueOnce(null)

      const result = await service.resolveExistingPage(
        'website-1',
        'https://example.com/new-page'
      )

      expect(result.found).toBe(false)
      expect(result.matchedBy).toBe('none')
    })
  })

  describe('reimport', () => {
    beforeEach(() => {
      mockImportPipeline.execute.mockResolvedValue({
        success: true,
        data: {
          detectedComponents: [{
            url: 'https://example.com/about',
            components: [
              { type: 'hero', position: 0, content: { title: 'About Us' } },
              { type: 'content', position: 1, content: { text: 'Content here' } },
            ],
            metadata: { httpStatus: 200 },
          }],
        },
      })
    })

    it('returns error for non-existent website', async () => {
      mockPrisma.website.findUnique.mockResolvedValueOnce(null)

      const result = await service.reimport({
        websiteId: 'non-existent',
        urls: ['https://example.com/about'],
      })

      expect(result.success).toBe(false)
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Website not found')
      )
    })

    it('skips URLs with invalid format', async () => {
      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['not-a-url', 'https://example.com/about'],
      })

      expect(result.results).toHaveLength(2)
      expect(result.results[0].status).toBe('skipped')
      expect(result.results[0].error).toContain('Invalid URL')
    })

    it('skips URLs from different domains', async () => {
      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://different.com/page'],
      })

      expect(result.results[0].status).toBe('skipped')
      expect(result.results[0].error).toContain('Domain mismatch')
    })

    it('updates existing page successfully', async () => {
      const existingPage = {
        id: 'page-1',
        title: 'About',
        content: { components: [] },
        metadata: { importSource: 'https://example.com/about' },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)
      mockPrisma.websitePage.update.mockResolvedValueOnce({ ...existingPage })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
      })

      expect(result.success).toBe(true)
      expect(result.results[0].status).toBe('updated')
      expect(result.results[0].pageId).toBe('page-1')
      expect(mockPrisma.websitePage.update).toHaveBeenCalled()
    })

    it('passes skipDesignSystem through to the import pipeline', async () => {
      const existingPage = {
        id: 'page-1',
        title: 'About',
        content: { components: [] },
        metadata: { importSource: 'https://example.com/about' },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)
      mockPrisma.websitePage.update.mockResolvedValueOnce({ ...existingPage })

      await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
        skipDesignSystem: true,
      })

      expect(mockImportPipeline.execute).toHaveBeenCalledWith(
        expect.objectContaining({ skipDesignSystem: true })
      )
    })

    it('records source status from detection metadata in reimport history', async () => {
      const existingPage = {
        id: 'page-1',
        title: 'About',
        content: { components: [] },
        metadata: { importSource: 'https://example.com/about', reimportHistory: [] },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)
      mockPrisma.websitePage.update.mockResolvedValueOnce({ ...existingPage })
      mockImportPipeline.execute.mockResolvedValueOnce({
        success: true,
        data: {
          detectedComponents: [{
            url: 'https://example.com/about',
            pageUrl: 'https://example.com/about',
            components: [{ type: 'hero', content: { title: 'About Us' } }],
            metadata: { httpStatus: 206 },
          }],
        },
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
      })

      expect(result.results[0].status).toBe('updated')
      expect(mockPrisma.websitePage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              reimportHistory: [
                expect.objectContaining({ sourceStatus: 206 }),
              ],
            }),
          }),
        })
      )
    })

    it('fails explicitly when source status is unavailable', async () => {
      const existingPage = {
        id: 'page-1',
        title: 'About',
        content: { components: [] },
        metadata: { importSource: 'https://example.com/about' },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)
      mockImportPipeline.execute.mockResolvedValueOnce({
        success: true,
        data: {
          detectedComponents: [{
            url: 'https://example.com/about',
            pageUrl: 'https://example.com/about',
            components: [{ type: 'hero', content: { title: 'About Us' } }],
          }],
        },
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
      })

      expect(result.results[0].status).toBe('failed')
      expect(result.results[0].error).toContain('Source HTTP status is not available')
    })

    it('allows zero-component redirect detections through reimport detection', async () => {
      const existingPage = {
        id: 'page-1',
        title: 'Outbound',
        content: { components: [] },
        metadata: { importSource: 'https://example.com/outbound' },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)
      mockPrisma.websitePage.update.mockResolvedValueOnce({ ...existingPage })
      mockImportPipeline.execute.mockResolvedValueOnce({
        success: true,
        data: {
          detectedComponents: [{
            url: 'https://example.com/outbound',
            pageUrl: 'https://example.com/outbound',
            components: [],
            metadata: { httpStatus: 200, redirectedTo: 'https://external.example/' },
            sourceHttpStatus: 200,
            redirectInfo: {
              type: 'http',
              targetUrl: 'https://external.example/',
              isExternal: true,
              description: 'External redirect',
            },
            isRedirectPage: true,
          }],
        },
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/outbound'],
        dryRun: true,
      })

      expect(result.results[0].status).toBe('updated')
      expect(result.results[0].error).toBeUndefined()
    })

    it('creates new page when not found and createIfNotExists is true', async () => {
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(null)
      mockPrisma.websiteStructure.findFirst.mockResolvedValueOnce(null)
      mockPrisma.websitePage.create.mockResolvedValueOnce({
        id: 'new-page-1',
        title: 'About',
      })
      mockPrisma.websiteStructure.create.mockResolvedValueOnce({
        id: 'new-struct-1',
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
        createIfNotExists: true,
      })

      expect(result.success).toBe(true)
      expect(result.results[0].status).toBe('created')
      expect(mockPrisma.websitePage.create).toHaveBeenCalled()
      expect(mockPrisma.websiteStructure.create).toHaveBeenCalled()
    })

    it('skips creation when createIfNotExists is false', async () => {
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(null)
      mockPrisma.websiteStructure.findFirst.mockResolvedValueOnce(null)

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
        createIfNotExists: false,
      })

      expect(result.results[0].status).toBe('skipped')
      expect(result.results[0].error).toContain('createIfNotExists is false')
    })

    it('handles 404 source errors', async () => {
      mockImportPipeline.execute.mockResolvedValueOnce({
        success: false,
        errors: ['Source page not found (404)'],
        data: { detectedComponents: [] },
      })

      mockPrisma.websitePage.findFirst.mockResolvedValueOnce({
        id: 'page-1',
        structures: [],
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/deleted-page'],
      })

      expect(result.results[0].status).toBe('failed')
    })

    it('reports progress during reimport', async () => {
      const progressCallback = jest.fn()

      mockPrisma.websitePage.findFirst.mockResolvedValue(null)
      mockPrisma.websiteStructure.findFirst.mockResolvedValue(null)
      mockPrisma.websitePage.create.mockResolvedValue({ id: 'new-page' })
      mockPrisma.websiteStructure.create.mockResolvedValue({ id: 'new-struct' })

      await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/page1'],
        onProgress: progressCallback,
      })

      expect(progressCallback).toHaveBeenCalled()
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: expect.any(String),
          progress: expect.any(Number),
          message: expect.any(String),
        })
      )
    })

    it('respects dry run mode', async () => {
      const existingPage = {
        id: 'page-1',
        content: { components: [] },
        metadata: { importSource: 'https://example.com/about' },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
        dryRun: true,
      })

      expect(result.success).toBe(true)
      expect(result.results[0].status).toBe('updated')
      expect(mockPrisma.websitePage.update).not.toHaveBeenCalled()
    })

    it('rejects detection components that only provide legacy props content', async () => {
      const existingPage = {
        id: 'page-1',
        content: { components: [] },
        metadata: { importSource: 'https://example.com/about' },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)
      mockImportPipeline.execute.mockResolvedValueOnce({
        success: true,
        data: {
          detectedComponents: [{
            url: 'https://example.com/about',
            components: [{ type: 'hero', position: 0, props: { title: 'Legacy title' } }],
            metadata: { httpStatus: 200 },
          }],
        },
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
        dryRun: true,
      })

      expect(result.results[0].status).toBe('failed')
      expect(result.results[0].error).toContain('components[0] uses legacy props content; use content')
    })

    it('rejects detection components without a type', async () => {
      const existingPage = {
        id: 'page-1',
        content: { components: [] },
        metadata: { importSource: 'https://example.com/about' },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)
      mockImportPipeline.execute.mockResolvedValueOnce({
        success: true,
        data: {
          detectedComponents: [{
            url: 'https://example.com/about',
            components: [{ position: 0, content: { title: 'Missing type' } }],
            metadata: { httpStatus: 200 },
          }],
        },
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
        dryRun: true,
      })

      expect(result.results[0].status).toBe('failed')
      expect(result.results[0].error).toContain('components[0].type must be a non-empty string')
    })

    it('derives component positions from detection order', async () => {
      const existingPage = {
        id: 'page-1',
        content: { components: [] },
        metadata: { importSource: 'https://example.com/about' },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)
      mockImportPipeline.execute.mockResolvedValueOnce({
        success: true,
        data: {
          detectedComponents: [{
            url: 'https://example.com/about',
            components: [{ type: 'hero', content: { title: 'Ordered component' } }],
            metadata: { httpStatus: 200 },
          }],
        },
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
        dryRun: true,
      })

      expect(result.results[0].status).toBe('updated')
      expect(result.results[0].error).toBeUndefined()
    })

    it('persists reimported component body data as canonical content, not props', async () => {
      const existingPage = {
        id: 'page-1',
        content: { components: [] },
        metadata: { importSource: 'https://example.com/about' },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)
      mockPrisma.websitePage.update.mockResolvedValueOnce({ ...existingPage })
      mockImportPipeline.execute.mockResolvedValueOnce({
        success: true,
        data: {
          detectedComponents: [{
            url: 'https://example.com/about',
            components: [{
              type: 'statistics',
              content: {
                title: 'Some stats',
                stats: [{ id: 'years', label: 'Years', value: 26 }],
              },
            }],
            metadata: { httpStatus: 200 },
          }],
        },
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
      })

      expect(result.results[0].status).toBe('updated')
      const updateCall = mockPrisma.websitePage.update.mock.calls[0][0]
      const component = updateCall.data.content.components[0]
      expect(component.content).toEqual({
        title: 'Some stats',
        stats: [{ id: 'years', label: 'Years', value: 26 }],
      })
      expect(component.props).toEqual({})
      expect(component.props).not.toHaveProperty('stats')
    })

    it('refreshes shared component body data into canonical content during single-page reimport', async () => {
      const existingPage = {
        id: 'page-1',
        content: {
          components: [{
            id: 'nav-1',
            type: 'navbar',
            parentId: null,
            position: 0,
            props: { sharedComponentId: 'shared-nav' },
            content: { logo: { text: 'Old' }, menuItems: [] },
          }],
        },
        metadata: { importSource: 'https://example.com/about' },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)
      mockPrisma.websitePage.update.mockResolvedValueOnce({ ...existingPage })
      mockPrisma.websitePage.findUnique.mockResolvedValueOnce({
        ...existingPage,
        content: {
          components: [{
            id: 'nav-1',
            type: 'navbar',
            parentId: null,
            position: 0,
            props: { sharedComponentId: 'shared-nav' },
            content: { logo: { text: 'Imported' }, menuItems: [], staleBodyField: 'remove-me' },
          }],
        },
      })
      mockPrisma.websiteSharedComponent.findMany.mockResolvedValueOnce([{
        id: 'shared-nav',
        content: {
          logo: { text: 'Shared Canonical' },
          menuItems: [{ label: 'Home', href: '/' }],
        },
      }])
      mockPrisma.websitePage.update.mockResolvedValueOnce({ ...existingPage })
      mockImportPipeline.execute.mockResolvedValueOnce({
        success: true,
        data: {
          detectedComponents: [{
            url: 'https://example.com/about',
            components: [{ type: 'navbar', content: { logo: { text: 'Imported' }, menuItems: [] } }],
            metadata: { httpStatus: 200 },
          }],
        },
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
      })

      expect(result.results[0].status).toBe('updated')
      const sharedRefreshCall = mockPrisma.websitePage.update.mock.calls[1][0]
      const component = sharedRefreshCall.data.content.components[0]
      expect(component.content).toEqual({
        logo: { text: 'Shared Canonical' },
        menuItems: [{ label: 'Home', href: '/' }],
      })
      expect(component.props).toEqual({ sharedComponentId: 'shared-nav' })
      expect(component.props).not.toHaveProperty('menuItems')
      expect(component.props).not.toHaveProperty('logo')
      expect(component.content).not.toHaveProperty('staleBodyField')
    })

    it('matches preserved customizations by canonical content region', async () => {
      const existingPage = {
        id: 'page-1',
        content: {
          components: [
            {
              id: 'existing-header',
              type: 'cta-banner',
              parentId: null,
              position: 0,
              props: { customClass: 'keep-header' },
              content: { region: 'header', heading: 'Old header' },
            },
            {
              id: 'existing-main',
              type: 'cta-banner',
              parentId: null,
              position: 1,
              props: { customClass: 'keep-main' },
              content: { region: 'main', heading: 'Old main' },
            },
          ],
        },
        metadata: { importSource: 'https://example.com/about' },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)
      mockPrisma.websitePage.update.mockResolvedValueOnce({ ...existingPage })
      mockImportPipeline.execute.mockResolvedValueOnce({
        success: true,
        data: {
          detectedComponents: [{
            url: 'https://example.com/about',
            components: [
              { type: 'cta-banner', content: { region: 'header', heading: 'New header' } },
              { type: 'cta-banner', content: { region: 'main', heading: 'New main' } },
            ],
            metadata: { httpStatus: 200 },
          }],
        },
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
        preserveCustomizations: true,
      })

      expect(result.results[0].status).toBe('updated')
      const updateCall = mockPrisma.websitePage.update.mock.calls[0][0]
      expect(updateCall.data.content.components).toEqual([
        expect.objectContaining({
          id: 'existing-header',
          content: expect.objectContaining({ region: 'header', heading: 'New header' }),
          props: expect.objectContaining({ customClass: 'keep-header' }),
        }),
        expect.objectContaining({
          id: 'existing-main',
          content: expect.objectContaining({ region: 'main', heading: 'New main' }),
          props: expect.objectContaining({ customClass: 'keep-main' }),
        }),
      ])
      expect(result.results[0].changes).toEqual(
        expect.objectContaining({ componentsAdded: 0, componentsRemoved: 0, componentsUpdated: 2 })
      )
    })

    it('fails page creation when no content type is configured', async () => {
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(null)
      mockPrisma.websiteStructure.findFirst.mockResolvedValueOnce(null)
      mockPrisma.contentType.findFirst.mockResolvedValue(null)

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
        createIfNotExists: true,
      })

      expect(result.results[0].status).toBe('failed')
      expect(result.results[0].error).toContain('no ContentType is configured')
      expect(mockPrisma.websitePage.create).not.toHaveBeenCalled()
    })

    it('rejects detection children that only provide legacy props content', async () => {
      const existingPage = {
        id: 'page-1',
        content: { components: [] },
        metadata: { importSource: 'https://example.com/about' },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)
      mockImportPipeline.execute.mockResolvedValueOnce({
        success: true,
        data: {
          detectedComponents: [{
            url: 'https://example.com/about',
            components: [{
              type: 'section',
              position: 0,
              content: {},
              children: [{ type: 'text', position: 0, props: { text: 'Legacy child text' } }],
            }],
            metadata: { httpStatus: 200 },
          }],
        },
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
        dryRun: true,
      })

      expect(result.results[0].status).toBe('failed')
      expect(result.results[0].error).toContain('components[0].children[0] uses legacy props content; use content')
    })

    it('rejects deeply nested detection children that only provide legacy props content', async () => {
      const existingPage = {
        id: 'page-1',
        content: { components: [] },
        metadata: { importSource: 'https://example.com/about' },
        structures: [{ id: 'struct-1' }],
      }
      mockPrisma.websitePage.findFirst.mockResolvedValueOnce(existingPage)
      mockImportPipeline.execute.mockResolvedValueOnce({
        success: true,
        data: {
          detectedComponents: [{
            url: 'https://example.com/about',
            components: [{
              type: 'section',
              position: 0,
              content: {},
              children: [{
                type: 'column',
                position: 0,
                content: {},
                children: [{ type: 'text', position: 0, props: { text: 'Legacy grandchild text' } }],
              }],
            }],
            metadata: { httpStatus: 200 },
          }],
        },
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: ['https://example.com/about'],
        dryRun: true,
      })

      expect(result.results[0].status).toBe('failed')
      expect(result.results[0].error).toContain('components[0].children[0].children[0] uses legacy props content; use content')
    })

    it('rejects non-JSON values before Prisma serialization', () => {
      const circular: Record<string, unknown> = {}
      circular.self = circular
      const sparse: unknown[] = []
      sparse[1] = 'value'

      expect(() => (service as any).toPrismaInputJson({ value: undefined }, 'websitePage.metadata'))
        .toThrow('Re-import websitePage.metadata.value contains undefined')
      expect(() => (service as any).toPrismaInputJson({ value: BigInt(1) }, 'websitePage.metadata'))
        .toThrow('Re-import websitePage.metadata.value contains BigInt')
      expect(() => (service as any).toPrismaInputJson({ value: () => undefined }, 'websitePage.metadata'))
        .toThrow('Re-import websitePage.metadata.value contains function')
      expect(() => (service as any).toPrismaInputJson({ value: Symbol('x') }, 'websitePage.metadata'))
        .toThrow('Re-import websitePage.metadata.value contains symbol')
      expect(() => (service as any).toPrismaInputJson(sparse, 'websitePage.content'))
        .toThrow('Re-import websitePage.content[0] contains sparse array hole')
      expect(() => (service as any).toPrismaInputJson({ value: new Date() }, 'websitePage.metadata'))
        .toThrow('Re-import websitePage.metadata.value contains unsupported Date')
      expect(() => (service as any).toPrismaInputJson(circular, 'websitePage.metadata'))
        .toThrow('Re-import websitePage.metadata.self contains circular reference')
    })

    it('processes multiple URLs with correct summary', async () => {
      // First URL - existing page
      mockPrisma.websitePage.findFirst
        .mockResolvedValueOnce({
          id: 'page-1',
          content: { components: [] },
          metadata: { importSource: 'https://example.com/about' },
          structures: [],
        })
        // Second URL - new page
        .mockResolvedValueOnce(null)
        // Third URL - new page
        .mockResolvedValueOnce(null)

      mockPrisma.websiteStructure.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      mockPrisma.websitePage.update.mockResolvedValue({})
      mockPrisma.websitePage.create.mockResolvedValue({ id: 'new-page' })
      mockPrisma.websiteStructure.create.mockResolvedValue({ id: 'new-struct' })

      mockImportPipeline.execute.mockResolvedValue({
        success: true,
        data: {
          detectedComponents: [{
            url: 'test',
            components: [{ type: 'hero', position: 0, content: {} }],
            metadata: { httpStatus: 200 },
          }],
        },
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls: [
          'https://example.com/about',
          'https://example.com/contact',
          'https://example.com/services',
        ],
      })

      expect(result.results).toHaveLength(3)
      expect(result.summary.updated).toBe(1)
      expect(result.summary.created).toBe(2)
    })
  })

  describe('batch processing', () => {
    it('processes URLs with configured concurrency', async () => {
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
        'https://example.com/page4',
      ]

      mockPrisma.websitePage.findFirst.mockResolvedValue(null)
      mockPrisma.websiteStructure.findFirst.mockResolvedValue(null)
      mockPrisma.websitePage.create.mockResolvedValue({ id: 'new-page' })
      mockPrisma.websiteStructure.create.mockResolvedValue({ id: 'new-struct' })

      mockImportPipeline.execute.mockResolvedValue({
        success: true,
        data: {
          detectedComponents: [{
            url: 'test',
            components: [{ type: 'hero', position: 0, content: {} }],
            metadata: { httpStatus: 200 },
          }],
        },
      })

      const result = await service.reimport({
        websiteId: 'test-website-id',
        urls,
        concurrency: 2,
      })

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(4)
    })
  })
})
