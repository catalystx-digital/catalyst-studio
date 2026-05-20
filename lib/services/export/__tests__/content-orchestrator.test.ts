import { ContentOrchestrator, UnifiedContent } from '../content-orchestrator'
import { PrismaClient } from '@/lib/generated/prisma'
import type { UniversalMediaAsset } from '@/lib/cms-export/universal/types'
import type { UniversalMediaService } from '@/lib/cms-export/universal/types'

// Mock PrismaClient
const prismaMock = {
  websitePage: {
    findMany: jest.fn()
  },
  websiteCustomContentData: {
    findMany: jest.fn()
  },
  websiteStructure: {
    findMany: jest.fn()
  },
  contentType: {
    findFirst: jest.fn()
  }
}

const mockPrisma = prismaMock as unknown as PrismaClient

describe('ContentOrchestrator', () => {
  let orchestrator: ContentOrchestrator
  const websiteId = 'test-website-id'

  beforeEach(() => {
    jest.clearAllMocks()
    ;(prismaMock.contentType.findFirst as jest.Mock).mockResolvedValue(null)
    orchestrator = new ContentOrchestrator(mockPrisma)
    process.env.EXPORT_ENABLE_MEDIA_RESOLUTION = 'true'
  })

  afterEach(() => {
    delete process.env.EXPORT_ENABLE_MEDIA_RESOLUTION
  })

  describe('gatherAllContent', () => {
    it('should fetch and unify content from all three tables', async () => {
      // Mock data
      const mockPages = [
        {
          id: 'page-1',
          websiteId,
          type: 'page',
          title: 'Home Page',
          content: { components: [] },
          metadata: { seo: { title: 'Home' } },
          contentTypeId: 'ct-page',
          status: 'published',
          publishedAt: new Date(),
          contentType: { key: 'page', name: 'Page' }
        },
        {
          id: 'folder-1',
          websiteId,
          type: 'folder',
          title: 'Blog',
          content: null,
          metadata: {},
          contentTypeId: 'ct-folder',
          status: 'published',
          publishedAt: new Date(),
          contentType: { key: 'folder', name: 'Folder' }
        }
      ]

      const mockCustomData = [
        {
          id: 'data-1',
          websiteId,
          title: 'Product Info',
          data: { name: 'Widget', price: 99.99 },
          contentTypeId: 'ct-product',
          status: 'draft',
          publishedAt: null,
          contentType: { key: 'product', name: 'Product' }
        }
      ]

      const mockStructures = [
        {
          id: 'struct-1',
          websiteId,
          websitePageId: 'page-1',
          fullPath: '/',
          parentId: null,
          pathDepth: 0,
          position: 0
        },
        {
          id: 'struct-2',
          websiteId,
          websitePageId: 'folder-1',
          fullPath: '/blog',
          parentId: null,
          pathDepth: 1,
          position: 1
        }
      ]

      // Setup mocks
      ;(mockPrisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages)
      ;(mockPrisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue(mockCustomData)
      ;(mockPrisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)

      // Execute
      const result = await orchestrator.gatherAllContent(websiteId)

      // Assertions
      expect(result).toHaveLength(3)
      
      // Check page content
      const homePage = result.find(item => item.id === 'page-1')
      expect(homePage).toBeDefined()
      expect(homePage?.source).toBe('WebsitePage')
      expect(homePage?.type).toBe('page')
      expect(homePage?.url).toBe('/')
      expect(homePage?.title).toBe('Home Page')

      // Check folder content
      const blogFolder = result.find(item => item.id === 'folder-1')
      expect(blogFolder).toBeDefined()
      expect(blogFolder?.source).toBe('WebsitePage')
      expect(blogFolder?.type).toBe('folder')
      expect(blogFolder?.url).toBe('/blog')

      // Check custom data
      const productData = result.find(item => item.id === 'data-1')
      expect(productData).toBeDefined()
      expect(productData?.source).toBe('WebsiteCustomContentData')
      expect(productData?.type).toBe('data')
      expect(productData?.url).toBeUndefined()
      expect(productData?.content).toEqual({ name: 'Widget', price: 99.99 })

      // Verify all prisma methods were called with correct parameters
      expect(mockPrisma.websitePage.findMany).toHaveBeenCalledWith({
        where: {
          websiteId,
          type: { in: ['page', 'folder'] }
        }
      })
      expect(mockPrisma.websiteCustomContentData.findMany).toHaveBeenCalledWith({
        where: { websiteId },
        include: { contentType: true }
      })
      expect(mockPrisma.websiteStructure.findMany).toHaveBeenCalledWith({
        where: { websiteId },
        orderBy: [
          { pathDepth: 'asc' },
          { position: 'asc' }
        ]
      })
    })

    it('should synthesize folder content from structures without pages', async () => {

      const mockPages = [

        {

          id: 'page-root',

          websiteId,

          type: 'page',

          title: 'Home',

          content: {},

          metadata: {},

          contentTypeId: 'ct-page',

          status: 'published',

          publishedAt: new Date()

        },

        {

          id: 'page-child',

          websiteId,

          type: 'page',

          title: 'Celebrating Easter at Home',

          content: {},

          metadata: {},

          contentTypeId: 'ct-page',

          status: 'draft',

          publishedAt: null

        }

      ]



      const mockStructures = [

        {

          id: 'struct-root',

          websiteId,

          slug: 'home',

          fullPath: '/',

          websitePageId: 'page-root',

          parentId: null,

          pathDepth: 0,

          position: 0,

          createdAt: new Date(),

          updatedAt: new Date()

        },

        {

          id: 'struct-folder',

          websiteId,

          slug: 'articles',

          fullPath: '/articles',

          websitePageId: null,

          parentId: 'struct-root',

          pathDepth: 1,

          position: 2,

          createdAt: new Date(),

          updatedAt: new Date()

        },

        {

          id: 'struct-child',

          websiteId,

          slug: 'celebrating-easter-at-home',

          fullPath: '/articles/celebrating-easter-at-home',

          websitePageId: 'page-child',

          parentId: 'struct-folder',

          pathDepth: 2,

          position: 0,

          createdAt: new Date(),

          updatedAt: new Date()

        }

      ]



      ;(mockPrisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages)

      ;(mockPrisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([])

      ;(mockPrisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      ;(prismaMock.contentType.findFirst as jest.Mock).mockResolvedValue({ id: 'ct-folder-db' })


      const result = await orchestrator.gatherAllContent(websiteId)



      expect(result).toHaveLength(3)



      const folder = result.find(item => item.source === 'WebsiteStructure') as UnifiedContent | undefined

      expect(folder).toBeDefined()

      expect(folder?.type).toBe('folder')

      expect(folder?.id).toBe('struct-folder')

      expect(folder?.parentId).toBe('page-root')

      expect(folder?.metadata?.slug).toBe('articles')

      expect(folder?.contentTypeId).toBe('ct-folder-db')
      expect(folder?.metadata?.originalContentTypeId).toBe('ct-folder-db')

      expect(folder?.title).toBe('Articles')


      const childPage = result.find(item => item.id === 'page-child')

      expect(childPage?.parentId).toBe('struct-folder')

    })





    it('should handle parallel fetching with Promise.all', async () => {
      // Mock all calls to resolve quickly
      ;(mockPrisma.websitePage.findMany as jest.Mock).mockResolvedValue([])
      ;(mockPrisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([])
      ;(mockPrisma.websiteStructure.findMany as jest.Mock).mockResolvedValue([])

      const startTime = Date.now()
      await orchestrator.gatherAllContent(websiteId)
      const endTime = Date.now()

      // Should complete quickly due to parallel execution
      expect(endTime - startTime).toBeLessThan(100)

      // All three methods should have been called
      expect(mockPrisma.websitePage.findMany).toHaveBeenCalled()
      expect(mockPrisma.websiteCustomContentData.findMany).toHaveBeenCalled()
      expect(mockPrisma.websiteStructure.findMany).toHaveBeenCalled()
    })

    it('should handle empty results gracefully', async () => {
      ;(mockPrisma.websitePage.findMany as jest.Mock).mockResolvedValue([])
      ;(mockPrisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([])
      ;(mockPrisma.websiteStructure.findMany as jest.Mock).mockResolvedValue([])

      const result = await orchestrator.gatherAllContent(websiteId)

      expect(result).toHaveLength(0)
      expect(Array.isArray(result)).toBe(true)
    })

    it('should handle pages without matching structures', async () => {
      const mockPages = [
        {
          id: 'page-without-structure',
          websiteId,
          type: 'page',
          title: 'Orphaned Page',
          content: {},
          metadata: {},
          contentTypeId: 'ct-page',
          status: 'draft',
          publishedAt: null
        }
      ]

      ;(mockPrisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages)
      ;(mockPrisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([])
      ;(mockPrisma.websiteStructure.findMany as jest.Mock).mockResolvedValue([])

      const result = await orchestrator.gatherAllContent(websiteId)

      expect(result).toHaveLength(1)
      const orphanedPage = result[0]
      expect(orphanedPage.url).toBeNull()
      expect(orphanedPage.parentId).toBeNull()
    })

    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed')
      ;(mockPrisma.websitePage.findMany as jest.Mock).mockRejectedValue(dbError)

      await expect(orchestrator.gatherAllContent(websiteId)).rejects.toThrow('Database connection failed')
    })

    it('should attach media assets when media references are detected', async () => {
      const mockMediaAsset: UniversalMediaAsset = {
        id: 'media-1',
        mimeType: 'image/png',
        width: 800,
        height: 600,
        altText: null,
        signedUrl: 'https://example.com/signed.png',
        publicUrl: 'https://example.com/public.png'
      }

      const mediaService: UniversalMediaService = {
        getAssetsForWebsiteByIds: jest.fn().mockResolvedValue(new Map([[mockMediaAsset.id, mockMediaAsset]]))
      } as unknown as UniversalMediaService

      orchestrator = new ContentOrchestrator(mockPrisma, undefined, { mediaService })

      const pageContent = {
        id: 'page-1',
        websiteId,
        type: 'page',
        title: 'Media Page',
        content: {
          hero: {
            mediaId: 'media-1',
            altText: 'Hero Alt'
          }
        },
        metadata: {
          thumbnail: {
            mediaId: 'media-1'
          }
        },
        components: [],
        contentTypeId: 'ct-page',
        status: 'published',
        publishedAt: new Date()
      }

      ;(mockPrisma.websitePage.findMany as jest.Mock).mockResolvedValue([pageContent])
      ;(mockPrisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([])
      ;(mockPrisma.websiteStructure.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'struct-1',
          websiteId,
          websitePageId: 'page-1',
          fullPath: '/',
          parentId: null,
          pathDepth: 0,
          position: 0
        }
      ])

      const result = await orchestrator.gatherAllContent(websiteId)

      expect(result).toHaveLength(1)
      const [item] = result
      expect(item.mediaAssets).toBeDefined()
      expect(item.mediaAssets).toHaveLength(1)
      expect(item.mediaAssets?.[0]?.id).toBe('media-1')
      expect(item.mediaAssets?.[0]?.altText).toBe('Hero Alt')

      const calls = (mediaService.getAssetsForWebsiteByIds as jest.Mock).mock.calls
      expect(calls).toHaveLength(1)
      expect(calls[0][0]).toBe(websiteId)
      expect(calls[0][1]).toBeInstanceOf(Set)
      expect(Array.from(calls[0][1] as Set<string>)).toEqual(['media-1'])
    })

    it('should skip media attachment when feature flag is disabled', async () => {
      process.env.EXPORT_ENABLE_MEDIA_RESOLUTION = 'false'
      orchestrator = new ContentOrchestrator(mockPrisma)

      ;(mockPrisma.websitePage.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'page-flag',
          websiteId,
          type: 'page',
          title: 'Flag Page',
          content: { hero: { mediaId: 'media-flag' } },
          metadata: {},
          contentTypeId: 'ct-page',
          status: 'published',
          publishedAt: new Date()
        }
      ])
      ;(mockPrisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([])
      ;(mockPrisma.websiteStructure.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'struct-flag',
          websiteId,
          websitePageId: 'page-flag',
          fullPath: '/',
          parentId: null,
          pathDepth: 0,
          position: 0
        }
      ])

      const result = await orchestrator.gatherAllContent(websiteId)

      expect(result[0].mediaAssets).toBeUndefined()
    })
  })

  describe('cache functionality', () => {
    it('should use cached structures on subsequent calls', async () => {
      const mockStructures = [
        {
          id: 'struct-1',
          websiteId,
          websitePageId: 'page-1',
          fullPath: '/',
          parentId: null,
          pathDepth: 0,
          position: 0
        }
      ]

      ;(mockPrisma.websitePage.findMany as jest.Mock).mockResolvedValue([])
      ;(mockPrisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([])
      ;(mockPrisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)

      // First call - should hit database
      await orchestrator.gatherAllContent(websiteId)
      expect(mockPrisma.websiteStructure.findMany).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      await orchestrator.gatherAllContent(websiteId)
      expect(mockPrisma.websiteStructure.findMany).toHaveBeenCalledTimes(1) // Still only called once
    })

    it('should clear cache when clearCache is called', async () => {
      ;(mockPrisma.websitePage.findMany as jest.Mock).mockResolvedValue([])
      ;(mockPrisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([])
      ;(mockPrisma.websiteStructure.findMany as jest.Mock).mockResolvedValue([])

      // First call
      await orchestrator.gatherAllContent(websiteId)
      expect(mockPrisma.websiteStructure.findMany).toHaveBeenCalledTimes(1)

      // Clear cache
      orchestrator.clearCache()

      // Second call should hit database again
      await orchestrator.gatherAllContent(websiteId)
      expect(mockPrisma.websiteStructure.findMany).toHaveBeenCalledTimes(2)
    })
  })

  describe('performance requirements', () => {
    it('should complete within 5 seconds for large datasets', async () => {
      // Create mock data for 1000 items
      const largePagesArray = Array.from({ length: 500 }, (_, i) => ({
        id: `page-${i}`,
        websiteId,
        type: 'page',
        title: `Page ${i}`,
        content: {},
        metadata: {},
        contentTypeId: 'ct-page',
        status: 'published',
        publishedAt: new Date()
      }))

      const largeCustomDataArray = Array.from({ length: 500 }, (_, i) => ({
        id: `data-${i}`,
        websiteId,
        title: `Data ${i}`,
        data: { value: i },
        contentTypeId: 'ct-data',
        status: 'published',
        publishedAt: new Date()
      }))

      ;(mockPrisma.websitePage.findMany as jest.Mock).mockResolvedValue(largePagesArray)
      ;(mockPrisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue(largeCustomDataArray)
      ;(mockPrisma.websiteStructure.findMany as jest.Mock).mockResolvedValue([])

      const startTime = Date.now()
      const result = await orchestrator.gatherAllContent(websiteId)
      const endTime = Date.now()

      expect(result).toHaveLength(1000)
      expect(endTime - startTime).toBeLessThan(5000) // Must complete within 5 seconds
    })
  })
})
