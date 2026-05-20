import { StructureService } from '../structure-service'
import { PrismaClient } from '@/lib/generated/prisma'
import type { WebsitePage, WebsiteStructure } from '@/lib/generated/prisma'

// Mock Prisma Client
const mockPrisma = {
  websiteStructure: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  },
  websitePage: {
    findUnique: jest.fn()
  }
} as unknown as PrismaClient

describe('StructureService', () => {
  let service: StructureService
  
  beforeEach(() => {
    service = new StructureService(mockPrisma)
    jest.clearAllMocks()
  })

  describe('generateSlug', () => {
    it('should generate slug from page title', () => {
      const slug = service.generateSlug('About Us Page', '', {
        generateSlugsFromTitle: true,
        preserveOriginalUrls: false
      })
      expect(slug).toBe('about-us-page')
    })

    it('should extract slug from URL when preserveOriginalUrls is true', () => {
      const slug = service.generateSlug('Some Title', '/about/company-info', {
        preserveOriginalUrls: true
      })
      expect(slug).toBe('company-info')
    })

    it('should normalize special characters', () => {
      const slug = service.generateSlug('Products & Services!', '')
      expect(slug).toBe('products-services')
    })

    it('should handle empty title with fallback', () => {
      const slug = service.generateSlug('', '')
      expect(slug).toBe('page')
    })

    it('should respect max slug length', () => {
      const longTitle = 'This is a very long page title that should be truncated to meet the maximum length requirement'
      const slug = service.generateSlug(longTitle, '', { maxSlugLength: 20 })
      expect(slug.length).toBeLessThanOrEqual(20)
      expect(slug).toBe('this-is-a-very-long-')
    })

    it('should handle consecutive separators', () => {
      const slug = service.generateSlug('Multiple   Spaces    Here', '')
      expect(slug).toBe('multiple-spaces-here')
    })
  })

  describe('calculatePathDepth', () => {
    it('should return 0 for root path', () => {
      expect(service.calculatePathDepth('/')).toBe(0)
    })

    it('should calculate correct depth for nested paths', () => {
      expect(service.calculatePathDepth('/about')).toBe(1)
      expect(service.calculatePathDepth('/products/category')).toBe(2)
      expect(service.calculatePathDepth('/products/category/item')).toBe(3)
    })

    it('should handle empty path', () => {
      expect(service.calculatePathDepth('')).toBe(0)
    })
  })

  describe('generateFullPath', () => {
    it('should generate root path for index/home pages', () => {
      expect(service.generateFullPath(null, 'index')).toBe('/')
      expect(service.generateFullPath(null, 'home')).toBe('/')
    })

    it('should generate correct full path from parent and slug', () => {
      expect(service.generateFullPath(null, 'about')).toBe('/about')
      expect(service.generateFullPath('/products', 'category')).toBe('/products/category')
    })

    it('should handle root parent path', () => {
      expect(service.generateFullPath('/', 'about')).toBe('/about')
    })
  })

  describe('validateStructureUniqueness', () => {
    it('should return true when structure is unique', async () => {
      mockPrisma.websiteStructure.findFirst = jest.fn().mockResolvedValue(null)
      
      const result = await service.validateStructureUniqueness('website-1', '/about')
      expect(result).toBe(true)
    })

    it('should return false when structure already exists', async () => {
      const existingStructure = { id: 'existing-1', fullPath: '/about' }
      mockPrisma.websiteStructure.findFirst = jest.fn().mockResolvedValue(existingStructure)
      
      const result = await service.validateStructureUniqueness('website-1', '/about')
      expect(result).toBe(false)
    })

    it('should exclude specific ID when checking uniqueness', async () => {
      mockPrisma.websiteStructure.findFirst = jest.fn().mockResolvedValue(null)
      
      const result = await service.validateStructureUniqueness('website-1', '/about', 'exclude-id')
      expect(result).toBe(true)
      expect(mockPrisma.websiteStructure.findFirst).toHaveBeenCalledWith({
        where: {
          websiteId: 'website-1',
          fullPath: '/about',
          id: { not: 'exclude-id' }
        }
      })
    })
  })

  describe('createStructure', () => {
    const mockPage: WebsitePage = {
      id: 'page-1',
      title: 'About Page',
      websiteId: 'website-1',
      type: 'page',
      content: null,
      metadata: { url: '/about' }, // Store URL in metadata
      contentTypeId: 'content-type-1',
      status: 'draft',
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null
    }

    it('should create structure for page without parent', async () => {
      mockPrisma.websiteStructure.count = jest.fn().mockResolvedValue(0)
      mockPrisma.websiteStructure.findFirst = jest.fn().mockResolvedValue(null) // unique check
      const expectedStructure = {
        id: 'structure-1',
        websiteId: 'website-1',
        slug: 'about',
        fullPath: '/about',
        websitePageId: 'page-1',
        parentId: null,
        position: 0,
        pathDepth: 1,
        weight: 0
      }
      mockPrisma.websiteStructure.create = jest.fn().mockResolvedValue(expectedStructure)

      const result = await service.createStructure(mockPage, 'website-1', undefined, '/about')
      
      expect(result).toEqual(expectedStructure)
      expect(mockPrisma.websiteStructure.create).toHaveBeenCalledWith({
        data: {
          websiteId: 'website-1',
          slug: 'about',
          fullPath: '/about',
          websitePageId: 'page-1',
          parentId: undefined,
          position: 0,
          pathDepth: 1,
          weight: 0
        }
      })
    })

    it('should create structure with parent', async () => {
      const parentStructure = {
        id: 'parent-1',
        fullPath: '/products',
        pathDepth: 1
      }
      mockPrisma.websiteStructure.findUnique = jest.fn().mockResolvedValue(parentStructure)
      mockPrisma.websiteStructure.count = jest.fn().mockResolvedValue(2)
      mockPrisma.websiteStructure.findFirst = jest.fn().mockResolvedValue(null) // unique check

      const childPage: WebsitePage = {
        ...mockPage,
        id: 'page-2',
        title: 'Product Category',
        metadata: { url: '/products/category' }
      }

      const expectedStructure = {
        id: 'structure-2',
        websiteId: 'website-1',
        slug: 'category',
        fullPath: '/products/category',
        websitePageId: 'page-2',
        parentId: 'parent-1',
        position: 2,
        pathDepth: 2,
        weight: 0
      }
      mockPrisma.websiteStructure.create = jest.fn().mockResolvedValue(expectedStructure)

      const result = await service.createStructure(childPage, 'website-1', 'parent-1', '/products/category')
      
      expect(result).toEqual(expectedStructure)
    })
  })

  describe('findParentByUrl', () => {
    it('should return null for root level URLs', async () => {
      const result = await service.findParentByUrl('/about', 'website-1')
      expect(result).toBeNull()
    })

    it('should find parent for nested URLs', async () => {
      const parentStructure = { id: 'parent-1', fullPath: '/products' }
      mockPrisma.websiteStructure.findFirst = jest.fn().mockResolvedValue(parentStructure)
      
      const result = await service.findParentByUrl('/products/category', 'website-1')
      expect(result).toEqual(parentStructure)
      expect(mockPrisma.websiteStructure.findFirst).toHaveBeenCalledWith({
        where: {
          websiteId: 'website-1',
          fullPath: '/products'
        }
      })
    })

    it('should return null for empty URL', async () => {
      const result = await service.findParentByUrl('', 'website-1')
      expect(result).toBeNull()
    })
  })

  describe('updateSiblingPositions', () => {
    it('should update positions for siblings', async () => {
      const siblings = [
        { id: 'child-2', position: 0, createdAt: new Date('2024-01-01') },
        { id: 'child-3', position: 1, createdAt: new Date('2024-01-02') },
        { id: 'child-1', position: 2, createdAt: new Date('2024-01-03') }
      ]
      mockPrisma.websiteStructure.findMany = jest.fn().mockResolvedValue(siblings)
      mockPrisma.websiteStructure.update = jest.fn().mockResolvedValue({})

      await service.updateSiblingPositions('parent-1', 'website-1')

      expect(mockPrisma.websiteStructure.update).toHaveBeenCalledTimes(3)
      // Verify that updates are called for each sibling in array order
      expect(mockPrisma.websiteStructure.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'child-2' },
        data: { position: 0 }
      })
      expect(mockPrisma.websiteStructure.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'child-3' },
        data: { position: 1 }
      })
      expect(mockPrisma.websiteStructure.update).toHaveBeenNthCalledWith(3, {
        where: { id: 'child-1' },
        data: { position: 2 }
      })
    })
  })

  describe('createBatchStructures', () => {
    it('should create structures for multiple pages in correct order', async () => {
      const pages: WebsitePage[] = [
        {
          id: 'page-1',
          title: 'Home',
          websiteId: 'website-1',
          type: 'page',
          content: null,
          metadata: { url: '/' },
          contentTypeId: 'content-type-1',
          status: 'draft',
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null
        },
        {
          id: 'page-2',
          title: 'Products',
          websiteId: 'website-1',
          type: 'page',
          content: null,
          metadata: { url: '/products' },
          contentTypeId: 'content-type-1',
          status: 'draft',
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null
        },
        {
          id: 'page-3',
          title: 'Category',
          websiteId: 'website-1',
          type: 'page',
          content: null,
          metadata: { url: '/products/category' },
          contentTypeId: 'content-type-1',
          status: 'draft',
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null
        }
      ]

      // Mock the service methods
      const createStructureSpy = jest.spyOn(service, 'createStructure')
      const findParentSpy = jest.spyOn(service, 'findParentByUrl')
      
      findParentSpy
        .mockResolvedValueOnce(null) // Home page has no parent
        .mockResolvedValueOnce(null) // Products page has no parent
        .mockResolvedValueOnce({ id: 'products-structure' } as WebsiteStructure) // Category has Products as parent

      createStructureSpy
        .mockResolvedValueOnce({ id: 'home-structure' } as WebsiteStructure)
        .mockResolvedValueOnce({ id: 'products-structure' } as WebsiteStructure)
        .mockResolvedValueOnce({ id: 'category-structure' } as WebsiteStructure)

      // Create URL map from metadata
      const pageUrls = new Map<string, string>([
        ['page-1', '/'],
        ['page-2', '/products'],
        ['page-3', '/products/category']
      ])
      
      const result = await service.createBatchStructures(pages, 'website-1', pageUrls)

      expect(result).toHaveLength(3)
      expect(createStructureSpy).toHaveBeenCalledTimes(3)
      
      // Verify pages were processed in order of URL depth (shallow to deep)
      expect(createStructureSpy).toHaveBeenNthCalledWith(1, pages[0], 'website-1', undefined, '/')
      expect(createStructureSpy).toHaveBeenNthCalledWith(2, pages[1], 'website-1', undefined, '/products')
      expect(createStructureSpy).toHaveBeenNthCalledWith(3, pages[2], 'website-1', 'products-structure', '/products/category')
    })
  })

  describe('buildHierarchy', () => {
    it('should build correct hierarchy tree from pages', async () => {
      const pages: WebsitePage[] = [
        {
          id: 'page-1',
          title: 'Home',
          websiteId: 'website-1',
          type: 'page',
          content: null,
          metadata: { url: '/' },
          contentTypeId: 'content-type-1',
          status: 'draft',
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null
        },
        {
          id: 'page-2',
          title: 'About',
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
      ]

      const findParentSpy = jest.spyOn(service, 'findParentByUrl')
      findParentSpy
        .mockResolvedValueOnce(null) // Home has no parent
        .mockResolvedValueOnce(null) // About has no parent

      const pageUrls = new Map<string, string>([
        ['page-1', '/'],
        ['page-2', '/about']
      ])
      
      const result = await service.buildHierarchy(pages, 'website-1', pageUrls)

      expect(result.children).toHaveLength(2)
      expect(result.id).toBe('virtual-root')
      expect(result.children[0].slug).toBe('home')
      expect(result.children[1].slug).toBe('about')
    })
  })

  describe('repairStructureIntegrity', () => {
    it('should fix circular references and update positions', async () => {
      const structures = [
        { id: 'struct-1', parentId: 'struct-2' },
        { id: 'struct-2', parentId: 'struct-1' }, // Circular reference
        { id: 'struct-3', parentId: null }
      ]
      mockPrisma.websiteStructure.findMany = jest.fn().mockResolvedValue(structures)
      mockPrisma.websiteStructure.findUnique = jest.fn()
        .mockResolvedValueOnce({ id: 'struct-2', parentId: 'struct-1' }) // For hasCircularReference check
        .mockResolvedValueOnce({ id: 'struct-1', parentId: 'struct-2' }) // For hasCircularReference check  
        .mockResolvedValueOnce(null) // For subsequent checks
      mockPrisma.websiteStructure.update = jest.fn().mockResolvedValue({})

      const updateSiblingPositionsSpy = jest.spyOn(service, 'updateSiblingPositions')
      updateSiblingPositionsSpy.mockResolvedValue()

      await service.repairStructureIntegrity('website-1')

      // Should attempt to fix circular reference
      expect(mockPrisma.websiteStructure.update).toHaveBeenCalled()
      // Should update sibling positions for each parent group
      expect(updateSiblingPositionsSpy).toHaveBeenCalled()
    })
  })

  describe('slug uniqueness handling', () => {
    it('should return existing canonical structure and record diagnostic when duplicate detected', async () => {
      const mockPage: WebsitePage = {
        id: 'page-1',
        title: 'About',
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

      const existingStructure: WebsiteStructure = {
        id: 'structure-existing',
        websiteId: 'website-1',
        slug: 'about',
        fullPath: '/about',
        websitePageId: 'page-2',
        parentId: null,
        position: 0,
        pathDepth: 1,
        weight: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const existingPage: WebsitePage = {
        id: 'page-2',
        title: 'Existing About',
        websiteId: 'website-1',
        type: 'page',
        content: null,
        metadata: { url: '/About' },
        contentTypeId: 'content-type-1',
        status: 'published',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null
      }

      mockPrisma.websiteStructure.count = jest.fn().mockResolvedValue(1)
      mockPrisma.websiteStructure.findFirst = jest.fn().mockResolvedValue(existingStructure)
      mockPrisma.websitePage.findUnique = jest.fn().mockResolvedValue(existingPage)

      const result = await service.createStructure(mockPage, 'website-1')

      expect(result).toBe(existingStructure)
      const diagnostics = service.getDiagnostics()
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]).toMatchObject({
        code: 'STRUCTURE_CANONICAL_COLLISION',
        level: 'warn'
      })
      expect(diagnostics[0].context).toMatchObject({
        canonicalPath: '/about',
        pageId: 'page-1',
        existingPageId: 'page-2',
        originalUrl: '/about',
        existingOriginalUrl: '/About'
      })
    })
  })
})
