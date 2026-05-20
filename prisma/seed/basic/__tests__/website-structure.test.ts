import { createWebsiteStructures } from '../website-structure'
import { PrismaClient, WebsitePage } from '../../../../lib/generated/prisma'

// Mock Prisma
jest.mock('../../../../lib/generated/prisma', () => ({
  PrismaClient: jest.fn()
}))

describe('Website Structure Seed', () => {
  let prisma: any
  let mockCreate: jest.Mock
  let mockPages: WebsitePage[]

  beforeEach(() => {
    mockCreate = jest.fn()
    
    prisma = {
      websiteStructure: {
        create: mockCreate
      }
    }

    // Mock pages array
    mockPages = [
      {
        id: 'home-page-id',
        websiteId: 'test-website',
        type: 'page',
        title: 'Home',
        content: {},
        metadata: {},
        contentTypeId: 'page-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null
      },
      {
        id: 'products-page-id',
        websiteId: 'test-website',
        type: 'page',
        title: 'Products',
        content: {},
        metadata: {},
        contentTypeId: 'page-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null
      },
      {
        id: 'featured-page-id',
        websiteId: 'test-website',
        type: 'page',
        title: 'Featured Products',
        content: {},
        metadata: {},
        contentTypeId: 'page-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null
      },
      {
        id: 'about-page-id',
        websiteId: 'test-website',
        type: 'page',
        title: 'About Us',
        content: {},
        metadata: {},
        contentTypeId: 'page-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null
      },
      {
        id: 'blog-folder-id',
        websiteId: 'test-website',
        type: 'folder',
        title: 'Blog',
        content: null,
        metadata: {},
        contentTypeId: 'folder-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null
      },
      {
        id: 'resources-folder-id',
        websiteId: 'test-website',
        type: 'folder',
        title: 'Resources & Documentation <>"\'',
        content: null,
        metadata: {},
        contentTypeId: 'folder-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null
      },
      {
        id: 'intl-page-id',
        websiteId: 'test-website',
        type: 'page',
        title: 'International 你好 مرحبا 🌍',
        content: {},
        metadata: {},
        contentTypeId: 'page-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null
      }
    ] as WebsitePage[]

    // Reset all mocks
    jest.clearAllMocks()
    
    // Setup default behavior - return structure with ID
    mockCreate.mockImplementation((args) => 
      Promise.resolve({
        id: `structure-${Date.now()}`,
        ...args.data
      })
    )
  })

  it('should create root structure for home page', async () => {
    const websiteId = 'test-website'
    
    await createWebsiteStructures(prisma as PrismaClient, websiteId, mockPages)
    
    // Check root structure was created
    const rootCall = mockCreate.mock.calls.find(
      call => call[0].data.slug === 'home' && call[0].data.parentId === null
    )
    
    expect(rootCall).toBeDefined()
    expect(rootCall[0].data.fullPath).toBe('/home')
    expect(rootCall[0].data.pathDepth).toBe(0)
    expect(rootCall[0].data.position).toBe(0)
  })

  it('should create hierarchical structures with correct parent relationships', async () => {
    const websiteId = 'test-website'
    
    await createWebsiteStructures(prisma as PrismaClient, websiteId, mockPages)
    
    // Check that products is under home
    const productsCall = mockCreate.mock.calls.find(
      call => call[0].data.slug === 'products'
    )
    
    expect(productsCall).toBeDefined()
    expect(productsCall[0].data.fullPath).toBe('/home/products')
    expect(productsCall[0].data.pathDepth).toBe(1)
    expect(productsCall[0].data.parentId).toBeDefined()
  })

  it('should create level 2 structures correctly', async () => {
    const websiteId = 'test-website'
    
    await createWebsiteStructures(prisma as PrismaClient, websiteId, mockPages)
    
    // Check featured products is under products
    const featuredCall = mockCreate.mock.calls.find(
      call => call[0].data.slug === 'featured'
    )
    
    expect(featuredCall).toBeDefined()
    expect(featuredCall[0].data.fullPath).toBe('/home/products/featured')
    expect(featuredCall[0].data.pathDepth).toBe(2)
    expect(featuredCall[0].data.parentId).toBeDefined()
  })

  it('should create folder structures under home', async () => {
    const websiteId = 'test-website'
    
    await createWebsiteStructures(prisma as PrismaClient, websiteId, mockPages)
    
    // Check blog folder is under home
    const blogCall = mockCreate.mock.calls.find(
      call => call[0].data.slug === 'blog'
    )
    
    expect(blogCall).toBeDefined()
    expect(blogCall[0].data.fullPath).toBe('/home/blog')
    expect(blogCall[0].data.pathDepth).toBe(1)
    expect(blogCall[0].data.parentId).toBeDefined() // Should have home as parent
    
    // Check resources folder is under home
    const resourcesCall = mockCreate.mock.calls.find(
      call => call[0].data.slug === 'resources'
    )
    
    expect(resourcesCall).toBeDefined()
    expect(resourcesCall[0].data.fullPath).toBe('/home/resources')
    expect(resourcesCall[0].data.pathDepth).toBe(1)
    expect(resourcesCall[0].data.parentId).toBeDefined() // Should have home as parent
  })

  it('should set correct position values for siblings', async () => {
    const websiteId = 'test-website'
    
    await createWebsiteStructures(prisma as PrismaClient, websiteId, mockPages)
    
    // Check root level - should only have home at position 0
    const rootStructures = mockCreate.mock.calls.filter(
      call => call[0].data.parentId === null
    )
    
    expect(rootStructures.length).toBe(1) // Only home should be root
    expect(rootStructures[0][0].data.position).toBe(0)
    
    // Check children of home have correct positions
    const homeChildren = mockCreate.mock.calls.filter(
      call => call[0].data.parentId && call[0].data.pathDepth === 1
    )
    
    const childPositions = homeChildren.map(call => call[0].data.position).sort()
    // Should have positions 0, 1, 2, 3, 4 for home's children (products, about, blog, resources, international)
    expect(childPositions).toEqual([0, 1, 2, 3, 4])
  })

  it('should link structures to correct page IDs', async () => {
    const websiteId = 'test-website'
    
    await createWebsiteStructures(prisma as PrismaClient, websiteId, mockPages)
    
    // Check that home structure links to home page
    const homeCall = mockCreate.mock.calls.find(
      call => call[0].data.slug === 'home'
    )
    
    expect(homeCall[0].data.websitePageId).toBe('home-page-id')
    
    // Check that blog structure links to blog folder
    const blogCall = mockCreate.mock.calls.find(
      call => call[0].data.slug === 'blog'
    )
    
    expect(blogCall[0].data.websitePageId).toBe('blog-folder-id')
  })

  it('should create exactly 7 structures', async () => {
    const websiteId = 'test-website'
    
    const count = await createWebsiteStructures(prisma as PrismaClient, websiteId, mockPages)
    
    expect(count).toBe(7)
    expect(mockCreate).toHaveBeenCalledTimes(7)
  })

  it('should handle special characters in page titles', async () => {
    const websiteId = 'test-website'
    
    await createWebsiteStructures(prisma as PrismaClient, websiteId, mockPages)
    
    // Check resources structure was created despite special chars in title
    const resourcesCall = mockCreate.mock.calls.find(
      call => call[0].data.slug === 'resources'
    )
    
    expect(resourcesCall).toBeDefined()
    expect(resourcesCall[0].data.websitePageId).toBe('resources-folder-id')
  })

  it('should handle unicode in page titles', async () => {
    const websiteId = 'test-website'
    
    await createWebsiteStructures(prisma as PrismaClient, websiteId, mockPages)
    
    // Check international structure was created
    const intlCall = mockCreate.mock.calls.find(
      call => call[0].data.slug === 'international'
    )
    
    expect(intlCall).toBeDefined()
    expect(intlCall[0].data.websitePageId).toBe('intl-page-id')
  })

  it('should throw error if creation fails', async () => {
    const websiteId = 'test-website'
    const error = new Error('Database error')
    
    mockCreate.mockRejectedValueOnce(error)
    
    await expect(
      createWebsiteStructures(prisma as PrismaClient, websiteId, mockPages)
    ).rejects.toThrow(error)
  })

  it('should set weight values correctly', async () => {
    const websiteId = 'test-website'
    
    await createWebsiteStructures(prisma as PrismaClient, websiteId, mockPages)
    
    // Check weight values match position values
    mockCreate.mock.calls.forEach(call => {
      expect(call[0].data.weight).toBe(call[0].data.position)
    })
  })

  it('should handle empty pages array gracefully', async () => {
    const websiteId = 'test-website'
    const emptyPages: WebsitePage[] = []
    
    // Should still create structures even if no matching pages
    const count = await createWebsiteStructures(prisma as PrismaClient, websiteId, emptyPages)
    
    expect(count).toBe(7)
    
    // All websitePageId should be null when no pages match
    mockCreate.mock.calls.forEach(call => {
      expect(call[0].data.websitePageId).toBeNull()
    })
  })
})