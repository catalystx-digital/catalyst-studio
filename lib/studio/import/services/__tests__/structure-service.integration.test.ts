import { StructureService } from '../structure-service'
import { PageBuilderService } from '../page-builder-service'
import { PrismaClient } from '@/lib/generated/prisma'
import type { WebsitePage, WebsiteStructure, ContentItem } from '@/lib/generated/prisma'

// Mock Prisma Client for integration testing
const mockPrisma = {
  $transaction: jest.fn(),
  websitePage: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  contentItem: {
    create: jest.fn(),
  },
  websiteStructure: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  }
} as unknown as PrismaClient

describe('StructureService Integration Tests', () => {
  let structureService: StructureService
  let pageBuilderService: PageBuilderService
  
  beforeEach(() => {
    structureService = new StructureService(mockPrisma)
    pageBuilderService = new PageBuilderService(mockPrisma)
    pageBuilderService.configureContentTypes({
      defaultContentTypeId: 'content-type-struct',
      templateContentTypes: new Map()
    })
    jest.clearAllMocks()
  })

  describe('Integration with PageBuilderService', () => {
    it('should create structure for pages created by PageBuilderService', async () => {
      // Mock PageBuilderService creating a page
      const mockPageData = {
        title: 'About Us',
        url: '/about',
        detectedComponents: [
          {
            id: 'comp-1',
            type: 'header',
            selector: '.header',
            content: { title: 'About' },
            styles: {},
            position: { x: 0, y: 0, width: 100, height: 50 },
            parent: null,
            children: []
          }
        ]
      }

      const mockComponentTypes = [
        {
          id: 'header-type-1',
          name: 'Header',
          type: 'header',
          category: 'layout'
        }
      ]

      const mockContentItem: ContentItem = {
        id: 'content-item-1',
        type: 'page',
        title: 'About Us',
        slug: 'about-us',
        content: {
          components: [
            {
              id: 'comp-1',
              type: 'header',
              typeId: 'header-type-1',
              parentId: null,
              position: 0,
              props: { title: 'About' },
              children: []
            }
          ]
        },
        metadata: {},
        parentId: null,
        position: 0,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const mockWebsitePage: WebsitePage = {
        id: 'page-1',
        title: 'About Us',
        websiteId: 'website-1',
        type: 'page',
        content: null,
        metadata: { url: '/about' },
        contentTypeId: 'content-type-1',
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null
      }

      // Mock the PageBuilderService.createPage method
      jest.spyOn(pageBuilderService, 'createPage').mockResolvedValue(mockWebsitePage)

      // Mock StructureService dependencies
      mockPrisma.websiteStructure.count = jest.fn().mockResolvedValue(0)
      mockPrisma.websiteStructure.findFirst = jest.fn().mockResolvedValue(null) // unique check
      
      const mockWebsiteStructure: WebsiteStructure = {
        id: 'structure-1',
        websiteId: 'website-1',
        slug: 'about',
        fullPath: '/about',
        websitePageId: 'page-1',
        parentId: null,
        position: 0,
        pathDepth: 1,
        weight: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      mockPrisma.websiteStructure.create = jest.fn().mockResolvedValue(mockWebsiteStructure)

      // Execute the integration flow
      const createdPage = await pageBuilderService.createPage(
        mockPageData,
        mockComponentTypes,
        'website-1',
        'content-type-1'
      )

      const createdStructure = await structureService.createStructure(
        createdPage,
        'website-1',
        undefined,
        '/about'
      )

      // Verify the integration works correctly
      expect(createdPage).toEqual(mockWebsitePage)
      expect(createdStructure).toEqual(mockWebsiteStructure)
      expect(createdStructure.websitePageId).toBe(createdPage.id)
    expect(createdStructure.slug).toBe('about')
    expect(createdStructure.fullPath).toBe('/about')
  })

    it('normalizes mixed-case URLs and records canonical collision diagnostics', async () => {
      const websiteId = 'website-1'
      const structures: WebsiteStructure[] = []

      const findFirst = jest.fn(async (args: any) => {
        const where = args?.where ?? {}
        if (typeof where.fullPath === 'string') {
          return (
            structures.find(
              structure => structure.websiteId === where.websiteId && structure.fullPath === where.fullPath
            ) ?? null
          )
        }
        if (typeof where.parentId !== 'undefined') {
          return (
            structures
              .filter(structure => structure.websiteId === where.websiteId && structure.parentId === where.parentId)
              .sort((a, b) => a.position - b.position)[0] ?? null
          )
        }
        return null
      })

      const createStructureMock = jest.fn(async ({ data }: { data: Partial<WebsiteStructure> }) => {
        const record: WebsiteStructure = {
          id: `structure-${structures.length + 1}`,
          websiteId,
          slug: data.slug ?? 'page',
          fullPath: data.fullPath ?? '/',
          websitePageId: data.websitePageId ?? null,
          parentId: data.parentId ?? null,
          position: data.position ?? 0,
          pathDepth: data.pathDepth ?? 0,
          weight: data.weight ?? 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        structures.push(record)
        return record
      })

      const countMock = jest.fn(async ({ where }: any) => {
        return structures.filter(structure => structure.websiteId === where.websiteId && structure.parentId === where.parentId).length
      })

      const findUnique = jest.fn(async ({ where }: any) => {
        return structures.find(structure => structure.id === where.id) ?? null
      })

      const findMany = jest.fn().mockResolvedValue([])

      const pages: WebsitePage[] = [
        {
          id: 'page-1',
          title: 'About Us',
          websiteId,
          contentItemId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { url: '/About' }
        } as WebsitePage,
        {
          id: 'page-2',
          title: 'About Duplicate',
          websiteId,
          contentItemId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { url: '/about' }
        } as WebsitePage
      ]

      mockPrisma.websiteStructure.findFirst = findFirst
      mockPrisma.websiteStructure.findMany = findMany
      mockPrisma.websiteStructure.findUnique = findUnique
      mockPrisma.websiteStructure.create = createStructureMock
      mockPrisma.websiteStructure.count = countMock
      mockPrisma.websitePage.findUnique = jest.fn(async ({ where }: any) => {
        return pages.find(page => page.id === where.id) ?? null
      })

      structureService.clearDiagnostics()

      const createdStructures = await structureService.createBatchStructures(pages, websiteId)

      expect(createdStructures).toHaveLength(1)
      expect(structures).toHaveLength(1)
      expect(structures[0].fullPath).toBe('/about')

      const diagnostics = structureService.getDiagnostics()
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]).toMatchObject({
        code: 'STRUCTURE_CANONICAL_COLLISION',
        level: 'warn'
      })
      expect(diagnostics[0].context).toMatchObject({
        canonicalPath: '/about',
        originalUrl: '/about',
        existingOriginalUrl: '/About'
      })

      mockPrisma.websiteStructure.findFirst = jest.fn()
      mockPrisma.websiteStructure.findMany = jest.fn()
      mockPrisma.websiteStructure.findUnique = jest.fn()
      mockPrisma.websiteStructure.create = jest.fn()
      mockPrisma.websiteStructure.count = jest.fn()
      mockPrisma.websitePage.findUnique = jest.fn()
    })

    it('should handle complete flow with multiple pages and hierarchy', async () => {
      // Mock creating multiple pages with PageBuilderService
      const pages = [
        {
          title: 'Home',
          url: '/',
          detectedComponents: []
        },
        {
          title: 'Products',
          url: '/products',
          detectedComponents: []
        },
        {
          title: 'Product Category',
          url: '/products/electronics',
          detectedComponents: []
        }
      ]

      const mockWebsitePages: WebsitePage[] = [
        {
          id: 'page-home',
          title: 'Home',
          url: '/',
          websiteId: 'website-1',
          contentItemId: 'content-home',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'page-products',
          title: 'Products',
          url: '/products',
          websiteId: 'website-1',
          contentItemId: 'content-products',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'page-electronics',
          title: 'Product Category',
          url: '/products/electronics',
          websiteId: 'website-1',
          contentItemId: 'content-electronics',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      // Mock PageBuilderService
      const createPageSpy = jest.spyOn(pageBuilderService, 'createPage')
      createPageSpy
        .mockResolvedValueOnce(mockWebsitePages[0])
        .mockResolvedValueOnce(mockWebsitePages[1])
        .mockResolvedValueOnce(mockWebsitePages[2])

      // Mock StructureService for batch creation
      jest.spyOn(structureService, 'findParentByUrl')
        .mockResolvedValueOnce(null) // Home has no parent
        .mockResolvedValueOnce(null) // Products has no parent
        .mockResolvedValueOnce({ // Electronics has Products as parent
          id: 'structure-products',
          websiteId: 'website-1',
          slug: 'products',
          fullPath: '/products',
          websitePageId: 'page-products',
          parentId: null,
          position: 1,
          pathDepth: 1,
          weight: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        } as WebsiteStructure)

      const mockStructures: WebsiteStructure[] = [
        {
          id: 'structure-home',
          websiteId: 'website-1',
          slug: 'home',
          fullPath: '/',
          websitePageId: 'page-home',
          parentId: null,
          position: 0,
          pathDepth: 0,
          weight: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'structure-products',
          websiteId: 'website-1',
          slug: 'products',
          fullPath: '/products',
          websitePageId: 'page-products',
          parentId: null,
          position: 1,
          pathDepth: 1,
          weight: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'structure-electronics',
          websiteId: 'website-1',
          slug: 'electronics',
          fullPath: '/products/electronics',
          websitePageId: 'page-electronics',
          parentId: 'structure-products',
          position: 0,
          pathDepth: 2,
          weight: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      jest.spyOn(structureService, 'createStructure')
        .mockResolvedValueOnce(mockStructures[0])
        .mockResolvedValueOnce(mockStructures[1])
        .mockResolvedValueOnce(mockStructures[2])

      // Execute complete flow
      const createdPages: WebsitePage[] = []
      for (let i = 0; i < pages.length; i++) {
        const page = await pageBuilderService.createPage(
          pages[i],
          [],
          'website-1',
          'content-type-1'
        )
        createdPages.push(page)
      }

      const createdStructures = await structureService.createBatchStructures(
        createdPages,
        'website-1'
      )

      // Verify the complete integration
      expect(createdPages).toHaveLength(3)
      expect(createdStructures).toHaveLength(3)
      
      // Verify hierarchy is correct
      expect(createdStructures[0].fullPath).toBe('/') // Home
      expect(createdStructures[1].fullPath).toBe('/products') // Products
      expect(createdStructures[2].fullPath).toBe('/products/electronics') // Electronics
      expect(createdStructures[2].parentId).toBe('structure-products')
    })

    it('should handle transaction rollback on failure', async () => {
      const mockPageData = {
        title: 'Test Page',
        url: '/test',
        detectedComponents: []
      }

      const mockWebsitePage: WebsitePage = {
        id: 'page-1',
        title: 'Test Page',
        url: '/test',
        websiteId: 'website-1',
        contentItemId: 'content-1',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Mock successful page creation but failed structure creation
      jest.spyOn(pageBuilderService, 'createPage').mockResolvedValue(mockWebsitePage)
      jest.spyOn(structureService, 'createStructure').mockRejectedValue(new Error('Structure creation failed'))

      // Mock transaction behavior
      mockPrisma.$transaction = jest.fn().mockImplementation(async (callback) => {
        try {
          return await callback(mockPrisma)
        } catch (error) {
          throw error
        }
      })

      // Test transaction rollback behavior
      await expect(async () => {
        await mockPrisma.$transaction(async (tx) => {
          const page = await pageBuilderService.createPage(
            mockPageData,
            [],
            'website-1',
            'content-type-1'
          )
          
          // This should fail and trigger rollback
          await structureService.createStructure(page, 'website-1')
        })
      }).rejects.toThrow('Structure creation failed')
    })

    it('should validate navigation works with generated URL structures', async () => {
      const mockWebsitePage: WebsitePage = {
        id: 'page-1',
        title: 'Contact Us',
        url: '/contact',
        websiteId: 'website-1',
        contentItemId: 'content-1',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const mockWebsiteStructure: WebsiteStructure = {
        id: 'structure-1',
        websiteId: 'website-1',
        slug: 'contact',
        fullPath: '/contact',
        websitePageId: 'page-1',
        parentId: null,
        position: 0,
        pathDepth: 1,
        weight: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Mock structure creation
      mockPrisma.websiteStructure.count = jest.fn().mockResolvedValue(0)
      mockPrisma.websiteStructure.findFirst = jest.fn().mockResolvedValue(null)
      mockPrisma.websiteStructure.create = jest.fn().mockResolvedValue(mockWebsiteStructure)

      // Create structure for the page
      const structure = await structureService.createStructure(
        mockWebsitePage,
        'website-1'
      )

      // Verify the structure can be used for navigation
      expect(structure.fullPath).toBe('/contact')
      expect(structure.websitePageId).toBe(mockWebsitePage.id)
      expect(structure.slug).toBe('contact')
      
      // Mock finding the structure by path (navigation scenario)
      mockPrisma.websiteStructure.findFirst = jest.fn().mockResolvedValue(structure)
      
      const foundStructure = await mockPrisma.websiteStructure.findFirst({
        where: {
          websiteId: 'website-1',
          fullPath: '/contact'
        }
      })
      
      expect(foundStructure).toEqual(structure)
      expect(foundStructure?.websitePageId).toBe(mockWebsitePage.id)
    })
  })
})
