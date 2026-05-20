import { BundleExporter } from '../bundle-exporter'
import { prisma } from '@/lib/prisma'
import { ContentTypeCategory } from '@/lib/generated/prisma'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findUnique: jest.fn()
    },
    contentType: {
      findMany: jest.fn()
    },
    contentItem: {
      findMany: jest.fn()
    },
    siteStructure: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    cMSComponent: {
      findMany: jest.fn(),
      count: jest.fn()
    }
  }
}))

describe('Export Integration Tests', () => {
  let exportService: BundleExporter
  const mockWebsiteId = 'website-test-123'
  
  beforeEach(() => {
    exportService = new BundleExporter()
    jest.clearAllMocks()
    // Reset mock implementations to avoid test interference
    ;(prisma.contentType.findMany as jest.Mock).mockReset()
  })
  
  describe('Folder Export with Component Detection Integration', () => {
    it('should export folders with component detection data', async () => {
      // Mock website
      const mockWebsite = {
        id: mockWebsiteId,
        name: 'Test Website',
        description: 'Test website for integration testing'
      }
      
      // Mock content types including folders
      const mockContentTypes = [
        {
          id: 'ct-page',
          key: 'page',
          name: 'Page',
          pluralName: 'Pages',
          category: ContentTypeCategory.page,
          fields: {}
        },
        {
          id: 'ct-folder',
          key: 'folder',
          name: 'Folder',
          pluralName: 'Folders',
          category: ContentTypeCategory.folder,
          fields: {}
        },
        {
          id: 'ct-component',
          key: 'hero',
          name: 'Hero',
          pluralName: 'Heroes',
          category: ContentTypeCategory.component,
          fields: {}
        }
      ]
      
      // Mock content items
      const mockContentItems = [
        {
          id: 'content-1',
          contentTypeId: 'ct-page',
          title: 'Home Page',
          slug: 'home',
          content: {
            hero: { type: 'hero', title: 'Welcome' }
          },
          metadata: null
        },
        {
          id: 'content-2',
          contentTypeId: 'ct-page',
          title: 'About Page',
          slug: 'about',
          content: {
            hero: { type: 'hero', title: 'About Us' }
          },
          metadata: null
        }
      ]
      
      // Mock folder structures
      const mockStructures = [
        {
          id: 'root-folder',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'root',
          fullPath: '/root',
          position: 0,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'pages-folder',
          websiteId: mockWebsiteId,
          parentId: 'root-folder',
          slug: 'pages',
          fullPath: '/root/pages',
          position: 0,
          pathDepth: 1,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      // Mock CMS components
      const mockComponents = [
        {
          id: 'comp-1',
          type: 'hero',
          category: 'heroes',
          props: {},
          content: { title: 'Welcome' }
        }
      ]
      
      // Setup mocks
      ;(prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite)
      ;(prisma.contentType.findMany as jest.Mock)
        .mockResolvedValueOnce(mockContentTypes) // First call: Regular content types query by export service
        .mockResolvedValueOnce([{ id: 'ct-folder' }]) // Second call: Query for folder content types by folder exporter
        .mockResolvedValue([]) // Any additional calls
      ;(prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockContentItems)
      ;(prisma.siteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce(mockStructures) // Folder structures
        .mockResolvedValue([]) // Content associations
      ;(prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue(mockComponents)
      ;(prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(mockComponents.length)
      
      // Execute export with folders and components
      const { exportData } = await exportService.export(mockWebsiteId, {
        includeComponents: true,
        includeFolders: true
      })

      // Verify export structure
      expect(exportData).toBeDefined()
      expect(exportData.metadata.websiteId).toBe(mockWebsiteId)
      expect(exportData.metadata.websiteName).toBe('Test Website')

      // Verify content types
      expect(exportData.contentTypes).toHaveLength(3)
      expect(exportData.contentTypes.find(ct => ct.key === 'folder')).toBeDefined()

      // Verify content items
      expect(exportData.contentItems).toHaveLength(2)

      // Verify folders were exported
      expect(exportData.folders).toBeDefined()
      expect(exportData.folders.root).toHaveLength(1)
      expect(exportData.folders.root[0].id).toBe('root-folder')
      expect(exportData.folders.root[0].children).toHaveLength(1)
      expect(exportData.folders.root[0].children[0].id).toBe('pages-folder')
      expect(exportData.folders.totalFolders).toBe(2)

      // Verify path mappings
      expect(exportData.folders.pathMappings).toEqual({
        'root-folder': '/root',
        'pages-folder': '/root/pages'
      })

      // Verify components (when component detection is enabled)
      expect(exportData.components).toBeDefined()

      // Verify metadata statistics
      expect(exportData.metadata.statistics.folders).toBe(2)
      expect(exportData.metadata.statistics.contentTypes).toBe(3)
      expect(exportData.metadata.statistics.contentItems).toBe(2)
    })
    
    it('should correctly associate content with folders during export', async () => {
      const mockWebsite = {
        id: mockWebsiteId,
        name: 'Test Website'
      }
      
      const mockContentTypes = [
        {
          id: 'ct-folder',
          key: 'folder',
          name: 'Folder',
          pluralName: 'Folders',
          category: ContentTypeCategory.folder,
          fields: {}
        },
        {
          id: 'ct-page',
          key: 'page',
          name: 'Page',
          pluralName: 'Pages',
          category: ContentTypeCategory.page,
          fields: {}
        }
      ]
      
      const mockContentItems = [
        {
          id: 'page-1',
          contentTypeId: 'ct-page',
          title: 'Page 1',
          slug: 'page-1',
          content: {},
          metadata: null
        }
      ]
      
      const mockStructures = [
        {
          id: 'folder-with-content',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'content-folder',
          fullPath: '/content-folder',
          position: 0,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite)
      ;(prisma.contentType.findMany as jest.Mock)
        .mockResolvedValueOnce(mockContentTypes) // First call: Regular content types query by export service
        .mockResolvedValueOnce([{ id: 'ct-folder' }]) // Second call: Query for folder content types by folder exporter
        .mockResolvedValue([]) // Any additional calls
      ;(prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockContentItems)
      ;(prisma.siteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce(mockStructures)
        .mockResolvedValueOnce([
          { contentItemId: 'page-1' } // Content in folder
        ])
      
      const result = await exportService.export(mockWebsiteId, {
        includeFolders: true
      })
      
      expect(result.folders.root[0].websitePages).toEqual(['page-1'])
    })
    
    it('should handle selective folder export', async () => {
      const mockWebsite = {
        id: mockWebsiteId,
        name: 'Test Website'
      }
      
      const mockContentTypes = []
      const mockContentItems = []
      
      const mockFolder = {
        id: 'selected-folder',
        websiteId: mockWebsiteId,
        parentId: null,
        slug: 'selected',
        fullPath: '/selected',
        position: 0,
        pathDepth: 0,
        contentItemId: null,
        contentItem: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      ;(prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite)
      ;(prisma.contentType.findMany as jest.Mock)
        .mockResolvedValueOnce(mockContentTypes) // First call: Regular content types query by export service
        .mockResolvedValueOnce([]) // Second call: Query for folder content types by folder exporter
        .mockResolvedValue([]) // Any additional calls
      ;(prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockContentItems)
      ;(prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(mockFolder)
      ;(prisma.siteStructure.findMany as jest.Mock).mockResolvedValue([])
      
      const result = await exportService.export(mockWebsiteId, {
        includeFolders: true,
        selectedFolders: ['selected-folder'],
        includeFolderChildren: false
      })
      
      expect(result.folders.root).toHaveLength(1)
      expect(result.folders.root[0].id).toBe('selected-folder')
      expect(result.folders.root[0].children).toEqual([])
    })
    
    it('should validate folder references in export', async () => {
      const mockWebsite = {
        id: mockWebsiteId,
        name: 'Test Website'
      }
      
      const mockStructures = [
        {
          id: 'orphan',
          websiteId: mockWebsiteId,
          parentId: 'non-existent', // Invalid parent
          slug: 'orphan',
          fullPath: '/orphan',
          position: 0,
          pathDepth: 1,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      ;(prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite)
      ;(prisma.contentType.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // First call: Regular content types query by export service (empty)
        .mockResolvedValueOnce([]) // Second call: Query for folder content types by folder exporter (empty)
        .mockResolvedValue([]) // Any additional calls
      ;(prisma.websitePage.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.siteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce(mockStructures)
        .mockResolvedValue([])
      
      const result = await exportService.export(mockWebsiteId, {
        includeFolders: true
      })
      
      // Orphaned folder should be added to root
      expect(result.folders.root).toHaveLength(1)
      expect(result.folders.root[0].id).toBe('orphan')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Orphaned folder'))
      
      consoleSpy.mockRestore()
    })
  })
  
  describe('Folder Export Endpoint', () => {
    it('should handle folders endpoint with statistics', async () => {
      const mockStructures = [
        {
          id: 'folder-1',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'folder-1',
          fullPath: '/folder-1',
          position: 0,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'folder-2',
          websiteId: mockWebsiteId,
          parentId: 'folder-1',
          slug: 'folder-2',
          fullPath: '/folder-1/folder-2',
          position: 0,
          pathDepth: 1,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // Query for folder content types by folder exporter
      ;(prisma.siteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce(mockStructures)
        .mockResolvedValue([
          { contentItemId: 'content-1' },
          { contentItemId: 'content-2' }
        ])
      
      const result = await exportService.exportFolders(
        mockWebsiteId,
        undefined,
        true,
        true
      )
      
      expect(result.folders).toBeDefined()
      expect(result.folders.totalFolders).toBe(2)
      expect(result.folders.maxDepth).toBe(2)
      expect(result.contentCount).toBe(4) // 2 per folder
      expect(result.statistics).toBeDefined()
      expect(result.statistics.totalFolders).toBe(2)
      expect(result.statistics.totalContent).toBe(4)
      expect(result.statistics.processingTime).toBeGreaterThanOrEqual(0)
    })
    
    it('should export selected folders with children', async () => {
      const mockParent = {
        id: 'parent',
        websiteId: mockWebsiteId,
        parentId: null,
        slug: 'parent',
        fullPath: '/parent',
        position: 0,
        pathDepth: 0,
        contentItemId: null,
        contentItem: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      const mockChild = {
        id: 'child',
        websiteId: mockWebsiteId,
        parentId: 'parent',
        slug: 'child',
        fullPath: '/parent/child',
        position: 0,
        pathDepth: 1,
        contentItemId: null,
        contentItem: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      ;(prisma.contentType.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // Query for folder content types by folder exporter
      ;(prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(mockParent)
      ;(prisma.siteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // Parent content
        .mockResolvedValueOnce([mockChild]) // Children
        .mockResolvedValue([]) // No more content
      
      const result = await exportService.exportFolders(
        mockWebsiteId,
        ['parent'],
        true,
        true
      )
      
      expect(result.folders.root).toHaveLength(1)
      expect(result.folders.root[0].children).toHaveLength(1)
      expect(result.folders.root[0].children[0].id).toBe('child')
    })
  })
  
  describe('Export Validation', () => {
    it('should validate export with component detector from Story 13.2', async () => {
      // Setup mock data with component dependencies
      const mockWebsite = {
        id: mockWebsiteId,
        name: 'Test Website',
        description: 'Test website for validation'
      }
      
      const mockContentTypes = [
        {
          id: 'ct-page',
          key: 'page',
          name: 'Page',
          pluralName: 'Pages',
          category: ContentTypeCategory.page,
          fields: {}
        },
        {
          id: 'ct-component',
          key: 'hero',
          name: 'Hero Component',
          pluralName: 'Hero Components',
          category: ContentTypeCategory.component,
          fields: {}
        }
      ]
      
      const mockContentItems = [
        {
          id: 'content-1',
          contentTypeId: 'ct-page',
          title: 'Home Page',
          slug: 'home',
          content: {
            globalComponents: [
              { componentKey: 'hero-1', type: 'hero' }
            ]
          }
        }
      ]
      
      const mockComponents = [
        {
          id: 'hero-1',
          key: 'hero-1',
          websiteId: mockWebsiteId,
          name: 'Hero Component',
          isActive: true,
          config: { type: 'hero' },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite)
      ;(prisma.contentType.findMany as jest.Mock).mockImplementation((args) => {
        // Return different results based on the where clause
        if (args?.where?.category === ContentTypeCategory.component) {
          // Component detector looking for component types (not used anymore)
          return Promise.resolve([])
        } else if (args?.where?.category === ContentTypeCategory.folder) {
          // Folder exporter looking for folder types
          return Promise.resolve([])
        }
        // Default: return all content types for export service
        return Promise.resolve(mockContentTypes)
      })
      ;(prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockContentItems)
      ;(prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue(mockComponents)
      ;(prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(mockComponents.length)
      ;(prisma.siteStructure.findMany as jest.Mock).mockResolvedValue([])
      
      const result = await exportService.export(mockWebsiteId, {
        includeComponents: true,
        includeFolders: true,
      })
      
      // Check that validation was performed
      expect(result.metadata.validation).toBeDefined()
      expect(result.metadata.validation?.performed).toBe(true)
      // Debug: Log validation errors if any
      if (!result.metadata.validation?.valid) {
        console.log('Validation errors:', JSON.stringify(result.metadata.validation?.errors, null, 2))
      }
      expect(result.metadata.validation?.valid).toBe(true)
      expect(result.metadata.validation?.errorCount).toBe(0)
    })
    
    it('should validate export with folder exporter from Story 13.3', async () => {
      // Setup mock data with folder hierarchy
      const mockWebsite = {
        id: mockWebsiteId,
        name: 'Test Website',
        description: 'Test website for folder validation'
      }
      
      const mockContentTypes = [
        {
          id: 'ct-folder',
          key: 'folder',
          name: 'Folder',
          pluralName: 'Folders',
          category: ContentTypeCategory.folder,
          fields: {}
        }
      ]
      
      const mockContentItems = [
        {
          id: 'content-1',
          contentTypeId: 'ct-folder',
          title: 'Products',
          slug: 'products',
          content: {}
        }
      ]
      
      const mockFolderStructure = [
        {
          id: 'root-folder',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'products',
          fullPath: '/products',
          position: 0,
          pathDepth: 0,
          contentItemId: 'content-1',
          contentItem: mockContentItems[0],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite)
      ;(prisma.contentType.findMany as jest.Mock).mockImplementation((args) => {
        // Return different results based on the where clause
        if (args?.where?.category === ContentTypeCategory.component) {
          // Component detector looking for component types (not used anymore)
          return Promise.resolve([])
        } else if (args?.where?.category === ContentTypeCategory.folder) {
          // Folder exporter looking for folder types
          return Promise.resolve([{ id: 'ct-folder' }])
        }
        // Default: return all content types for export service
        return Promise.resolve(mockContentTypes)
      })
      ;(prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockContentItems)
      ;(prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(0)
      ;(prisma.siteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce(mockFolderStructure) // Root folders
        .mockResolvedValue([]) // No children
      
      const result = await exportService.export(mockWebsiteId, {
        includeComponents: false,
        includeFolders: true,
      })
      
      // Check folder validation
      expect(result.folders.totalFolders).toBeGreaterThan(0)
      expect(result.metadata.validation?.performed).toBe(true)
      expect(result.metadata.validation?.valid).toBe(true)
    })
    
    it('should detect and report validation errors', async () => {
      // Setup mock data with missing dependencies
      const mockWebsite = {
        id: mockWebsiteId,
        name: 'Test Website',
        description: 'Test website with validation errors'
      }
      
      const mockContentTypes = []
      
      const mockContentItems = [
        {
          id: 'content-1',
          contentTypeId: 'missing-type', // This type doesn't exist
          title: 'Orphaned Content',
          slug: 'orphaned',
          content: {}
        }
      ]
      
      ;(prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite)
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockContentTypes)
      ;(prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockContentItems)
      ;(prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(0)
      ;(prisma.siteStructure.findMany as jest.Mock).mockResolvedValue([])
      
      const result = await exportService.export(mockWebsiteId, {
        includeComponents: false,
        includeFolders: false,
      })
      
      // Should have validation errors
      expect(result.metadata.validation?.performed).toBe(true)
      expect(result.metadata.validation?.valid).toBe(false)
      expect(result.metadata.validation?.errorCount).toBeGreaterThan(0)
      
      // Should include validation report in metadata
      expect((result.metadata as any).validationReport).toBeDefined()
      expect((result.metadata as any).validationReport.errors).toHaveLength(
        result.metadata.validation?.errorCount
      )
    })
    
    it('should stop export on critical errors when requested', async () => {
      const mockWebsite = {
        id: mockWebsiteId,
        name: 'Test Website',
        description: 'Test website with critical errors'
      }
      
      const mockContentItems = [
        {
          id: 'content-1',
          contentTypeId: 'invalid-type',
          title: 'Invalid Content',
          slug: 'invalid',
          content: {}
        }
      ]
      
      ;(prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite)
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockContentItems)
      ;(prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(0)
      ;(prisma.siteStructure.findMany as jest.Mock).mockResolvedValue([])
      
      // Should throw when stopOnCriticalErrors is true
      await expect(
        exportService.export(mockWebsiteId, {
          includeComponents: false,
          includeFolders: false,
          stopOnCriticalErrors: true
        })
      ).rejects.toThrow('Export validation failed')
    })
    
    it('should validate full export pipeline integration', async () => {
      // Setup comprehensive mock data
      const mockWebsite = {
        id: mockWebsiteId,
        name: 'Full Export Test',
        description: 'Complete export with all features'
      }
      
      const mockContentTypes = [
        {
          id: 'ct-page',
          key: 'page',
          name: 'Page',
          pluralName: 'Pages',
          category: ContentTypeCategory.page,
          fields: { title: { type: 'string' } }
        },
        {
          id: 'ct-component',
          key: 'button',
          name: 'Button',
          pluralName: 'Buttons',
          category: ContentTypeCategory.component,
          fields: { label: { type: 'string' } }
        },
        {
          id: 'ct-folder',
          key: 'folder',
          name: 'Folder',
          pluralName: 'Folders',
          category: ContentTypeCategory.folder,
          fields: {}
        }
      ]
      
      const mockContentItems = [
        {
          id: 'page-1',
          contentTypeId: 'ct-page',
          title: 'Home',
          slug: 'home',
          content: {
            title: 'Home Page',
            componentId: 'btn-1'
          }
        },
        {
          id: 'folder-1',
          contentTypeId: 'ct-folder',
          title: 'Products',
          slug: 'products',
          content: {}
        }
      ]
      
      const mockComponents = [
        {
          id: 'btn-1',
          key: 'btn-1',
          websiteId: mockWebsiteId,
          name: 'Primary Button',
          isActive: true,
          config: { label: 'Click Me' },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      const mockFolders = [
        {
          id: 'products-folder',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'products',
          fullPath: '/products',
          position: 0,
          pathDepth: 0,
          contentItemId: 'folder-1',
          contentItem: mockContentItems[1],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite)
      ;(prisma.contentType.findMany as jest.Mock).mockImplementation((args) => {
        // Return different results based on the where clause
        if (args?.where?.category === ContentTypeCategory.component) {
          // Component detector looking for component types
          return Promise.resolve([mockContentTypes.find(ct => ct.category === ContentTypeCategory.component)])
        } else if (args?.where?.category === ContentTypeCategory.folder) {
          // Folder exporter looking for folder types
          return Promise.resolve([{ id: 'ct-folder' }])
        }
        // Default: return all content types for export service
        return Promise.resolve(mockContentTypes)
      })
      ;(prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockContentItems)
      ;(prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue(mockComponents)
      ;(prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(mockComponents.length)
      ;(prisma.siteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce(mockFolders) // Root folders
        .mockResolvedValue([]) // No children
      
      const result = await exportService.export(mockWebsiteId, {
        includeComponents: true,
        includeFolders: true,
      })
      
      // Verify complete export
      expect(result.contentTypes).toHaveLength(3)
      expect(result.websitePages).toHaveLength(2)
      expect(result.components).toHaveLength(1)
      expect(result.folders.totalFolders).toBe(1)
      
      // Verify validation
      expect(result.metadata.validation?.performed).toBe(true)
      expect(result.metadata.validation?.valid).toBe(true)
      expect(result.metadata.statistics.contentTypes).toBe(3)
      expect(result.metadata.statistics.websitePages).toBe(2)
      expect(result.metadata.statistics.components).toBe(1)
      expect(result.metadata.statistics.folders).toBe(1)
    })
    
    it('should handle validation errors gracefully without stopping export', async () => {
      const mockWebsite = {
        id: mockWebsiteId,
        name: 'Test Website',
        description: 'Website with validation warnings'
      }
      
      const mockContentItems = [
        {
          id: 'content-1',
          contentTypeId: 'ct-page',
          title: 'Page with warnings',
          slug: 'page',
          content: {} // Empty content might trigger warning
        }
      ]
      
      const mockContentTypes = [
        {
          id: 'ct-page',
          key: 'page',
          name: 'Page',
          pluralName: 'Pages',
          category: ContentTypeCategory.page,
          fields: {}
        }
      ]
      
      ;(prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite)
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockContentTypes)
      ;(prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockContentItems)
      ;(prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(0)
      ;(prisma.siteStructure.findMany as jest.Mock).mockResolvedValue([])
      
      const result = await exportService.export(mockWebsiteId, {
        includeComponents: false,
        includeFolders: false,
        validateBeforeExport: true,
        stopOnCriticalErrors: false // Continue even with errors
      })
      
      // Export should complete despite warnings
      expect(result).toBeDefined()
      expect(result.websitePages).toHaveLength(1)
      expect(result.metadata.validation?.performed).toBe(true)
      
      // May have warnings but should still export
      if (result.metadata.validation?.warningCount && result.metadata.validation.warningCount > 0) {
        expect((result.metadata as any).validationReport.warnings).toBeDefined()
      }
    })
    
    it('should test error handling and recovery', async () => {
      const mockWebsite = {
        id: mockWebsiteId,
        name: 'Test Website',
        description: 'Website for error testing'
      }
      
      // Mock a validation error scenario
      ;(prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite)
      ;(prisma.contentType.findMany as jest.Mock).mockRejectedValueOnce(
        new Error('Database connection error')
      )
      
      // Should handle error gracefully
      await expect(
        exportService.export(mockWebsiteId, {
          includeComponents: false,
          includeFolders: false,
          })
      ).rejects.toThrow('Database connection error')
    })
    
    it('should validate export and report issues', async () => {
      const mockWebsite = {
        id: mockWebsiteId,
        name: 'Test Website'
      }
      
      const mockContentItems = [
        {
          id: 'content-1',
          contentTypeId: 'ct-1',
          title: 'Content 1',
          slug: 'content-1',
          content: {},
          metadata: null
        }
      ]
      
      const mockStructures = [
        {
          id: 'folder-1',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'folder-1',
          fullPath: '/folder-1',
          position: 0,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      ;(prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite)
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockContentItems)
      ;(prisma.siteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockStructures)
        .mockResolvedValueOnce([
          { contentItemId: 'non-existent-content' } // Invalid content reference
        ])
      
      await exportService.export(mockWebsiteId, {
        includeFolders: true
      })
      
      // Should log validation errors for invalid content references
      expect(consoleErrorSpy).toHaveBeenCalled()
      
      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })
  })
})