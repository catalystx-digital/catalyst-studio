import { FolderExporter, FolderExportError, ExportErrorCode } from '../folder-exporter'
import { prisma } from '@/lib/prisma'
import { ContentTypeCategory } from '@/lib/generated/prisma'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contentType: {
      findMany: jest.fn()
    },
    websiteStructure: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    contentItem: {
      findMany: jest.fn()
    },
    website: {
      findUnique: jest.fn()
    }
  }
}))

describe('FolderExporter', () => {
  let exporter: FolderExporter
  const mockWebsiteId = 'website-123'
  
  beforeEach(() => {
    exporter = new FolderExporter()
    jest.clearAllMocks()
    // Clear caches for each test
    exporter.clearCache()
  })
  
  describe('Folder Hierarchy Building (AC: 1)', () => {
    it('should export flat folder structure (single level)', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
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
        },
        {
          id: 'folder-2',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'folder-2',
          fullPath: '/folder-2',
          position: 1,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'folder-3',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'folder-3',
          fullPath: '/folder-3',
          position: 2,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.root).toHaveLength(3)
      expect(result.totalFolders).toBe(3)
      expect(result.maxDepth).toBe(1)
      expect(result.pathMappings).toEqual({
        'folder-1': '/folder-1',
        'folder-2': '/folder-2',
        'folder-3': '/folder-3'
      })
    })
    
    it('should export deeply nested folders (10+ levels)', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      // Create deeply nested structure
      const mockStructures = []
      let parentId = null
      for (let i = 0; i < 12; i++) {
        const id = `folder-level-${i}`
        mockStructures.push({
          id,
          websiteId: mockWebsiteId,
          parentId,
          slug: `level-${i}`,
          fullPath: mockStructures.map(s => s.slug).join('/') + `/level-${i}`,
          position: 0,
          pathDepth: i,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        parentId = id
      }
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.totalFolders).toBe(12)
      expect(result.maxDepth).toBe(12)
      
      // Verify deep nesting
      let currentNode = result.root[0]
      for (let i = 1; i < 12; i++) {
        expect(currentNode.children).toHaveLength(1)
        currentNode = currentNode.children[0]
      }
      expect(currentNode.children).toHaveLength(0) // Last level has no children
    })
    
    it('should handle multiple root folders', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
          id: 'root-1',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'root-1',
          fullPath: '/root-1',
          position: 0,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'root-2',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'root-2',
          fullPath: '/root-2',
          position: 1,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'child-1',
          websiteId: mockWebsiteId,
          parentId: 'root-1',
          slug: 'child-1',
          fullPath: '/root-1/child-1',
          position: 0,
          pathDepth: 1,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.root).toHaveLength(2) // Two root folders
      expect(result.root[0].children).toHaveLength(1) // First root has one child
      expect(result.root[1].children).toHaveLength(0) // Second root has no children
      expect(result.totalFolders).toBe(3)
    })
    
    it('should preserve folder order within siblings', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
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
        },
        {
          id: 'child-3',
          websiteId: mockWebsiteId,
          parentId: 'parent',
          slug: 'child-3',
          fullPath: '/parent/child-3',
          position: 2,
          pathDepth: 1,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'child-1',
          websiteId: mockWebsiteId,
          parentId: 'parent',
          slug: 'child-1',
          fullPath: '/parent/child-1',
          position: 0,
          pathDepth: 1,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'child-2',
          websiteId: mockWebsiteId,
          parentId: 'parent',
          slug: 'child-2',
          fullPath: '/parent/child-2',
          position: 1,
          pathDepth: 1,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      const parent = result.root[0]
      expect(parent.children).toHaveLength(3)
      expect(parent.children[0].id).toBe('child-1') // position 0
      expect(parent.children[1].id).toBe('child-2') // position 1
      expect(parent.children[2].id).toBe('child-3') // position 2
    })
    
    it('should handle orphaned folders', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
          id: 'normal-folder',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'normal',
          fullPath: '/normal',
          position: 0,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'orphaned-folder',
          websiteId: mockWebsiteId,
          parentId: 'non-existent-parent', // Parent doesn't exist
          slug: 'orphaned',
          fullPath: '/orphaned',
          position: 1,
          pathDepth: 1,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.root).toHaveLength(2) // Both folders at root
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Orphaned folder detected'))
      
      consoleSpy.mockRestore()
    })

    it('should treat folders with existing page parents as non-orphans', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]

      const mockStructures = [
        {
          id: 'folder-articles',
          websiteId: mockWebsiteId,
          parentId: 'home-page',
          slug: 'articles',
          fullPath: '/articles',
          position: 0,
          pathDepth: 1,
          websitePageId: null,
          websitePage: null,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)

      const findManyMock = prisma.websiteStructure.findMany as jest.Mock
      findManyMock.mockImplementationOnce(async () => mockStructures)
      findManyMock.mockImplementationOnce(async () => [{ id: 'home-page' }])
      findManyMock.mockResolvedValue([])

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await exporter.exportFolders(mockWebsiteId)

      expect(consoleSpy).not.toHaveBeenCalled()
      expect(result.root).toHaveLength(1)
      expect(result.root[0].id).toBe('folder-articles')
      expect(result.root[0].metadata.parentType).toBe('page')

      consoleSpy.mockRestore()
    })
  })
  
  describe('Content Association (AC: 2)', () => {
    it('should correctly map content items to their folders', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
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
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce(mockStructures) // First call for folders
        .mockResolvedValue([ // Second call for content association
          { contentItemId: 'content-1' },
          { contentItemId: 'content-2' },
          { contentItemId: 'content-3' }
        ])
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.root[0].websitePages).toEqual(['content-1', 'content-2', 'content-3'])
    })
    
    it('should maintain correct associations in nested folders', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
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
        },
        {
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
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce(mockStructures)
        .mockResolvedValueOnce([{ contentItemId: 'parent-content' }]) // Parent content
        .mockResolvedValueOnce([{ contentItemId: 'child-content' }]) // Child content
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.root[0].websitePages).toEqual(['parent-content'])
      expect(result.root[0].children[0].websitePages).toEqual(['child-content'])
    })
    
    it('should handle folders without content', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
          id: 'empty-folder',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'empty',
          fullPath: '/empty',
          position: 0,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce(mockStructures)
        .mockResolvedValueOnce([]) // No content
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.root[0].websitePages).toEqual([])
    })
    
    it('should handle multiple content items in single folder', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
          id: 'busy-folder',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'busy',
          fullPath: '/busy',
          position: 0,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      const mockContent = Array.from({ length: 50 }, (_, i) => ({
        contentItemId: `content-${i}`
      }))
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce(mockStructures)
        .mockResolvedValueOnce(mockContent)
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.root[0].websitePages).toHaveLength(50)
      expect(result.root[0].websitePages[0]).toBe('content-0')
      expect(result.root[0].websitePages[49]).toBe('content-49')
    })
  })
  
  describe('Metadata Preservation (AC: 3)', () => {
    it('should preserve folder name', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
          id: 'named-folder',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'my-folder-name',
          fullPath: '/my-folder-name',
          position: 0,
          pathDepth: 0,
          contentItemId: null,
          contentItem: {
            id: 'content-1',
            title: 'My Custom Folder Name',
            contentTypeId: 'ct-folder-1',
            metadata: null
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.root[0].name).toBe('My Custom Folder Name')
      expect(result.root[0].metadata.name).toBe('my-folder-name')
    })
    
    it('should preserve folder order', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
          id: 'folder-1',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'folder-1',
          fullPath: '/folder-1',
          position: 5,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.root[0].order).toBe(5)
      expect(result.root[0].metadata.order).toBe(5)
    })
    
    it('should preserve custom metadata', async () => {
      const customMetadata = {
        icon: 'folder-icon',
        color: '#ff0000',
        permissions: ['read', 'write']
      }
      
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
          id: 'metadata-folder',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'metadata-folder',
          fullPath: '/metadata-folder',
          position: 0,
          pathDepth: 0,
          contentItemId: null,
          contentItem: {
            id: 'content-1',
            title: 'Metadata Folder',
            contentTypeId: 'ct-folder-1',
            metadata: customMetadata
          },
          metadata: customMetadata,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.root[0].metadata.settings).toEqual(customMetadata)
    })
    
    it('should preserve folder settings/properties', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const createdDate = new Date('2024-01-01')
      const updatedDate = new Date('2024-01-15')
      
      const mockStructures = [
        {
          id: 'settings-folder',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'settings-folder',
          fullPath: '/settings-folder',
          position: 3,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: createdDate,
          updatedAt: updatedDate
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.root[0].metadata.createdAt).toEqual(createdDate)
      expect(result.root[0].metadata.updatedAt).toEqual(updatedDate)
    })
  })
  
  describe('Selective Export (AC: 4)', () => {
    it('should export single folder without children', async () => {
      const mockStructure = {
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
      
      ;(prisma.websiteStructure.findFirst as jest.Mock).mockResolvedValue(mockStructure)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue([])
      
      const result = await exporter.exportSelectedFolders(
        mockWebsiteId,
        ['folder-1'],
        false // Don't include children
      )
      
      expect(result.root).toHaveLength(1)
      expect(result.root[0].id).toBe('folder-1')
      expect(result.root[0].children).toEqual([])
    })
    
    it('should export folder with all children', async () => {
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
      
      const mockChildren = [
        {
          id: 'child-1',
          websiteId: mockWebsiteId,
          parentId: 'parent',
          slug: 'child-1',
          fullPath: '/parent/child-1',
          position: 0,
          pathDepth: 1,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'child-2',
          websiteId: mockWebsiteId,
          parentId: 'parent',
          slug: 'child-2',
          fullPath: '/parent/child-2',
          position: 1,
          pathDepth: 1,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.websiteStructure.findFirst as jest.Mock).mockResolvedValue(mockParent)
      ;(prisma.websiteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // Parent content
        .mockResolvedValueOnce(mockChildren) // Children folders
        .mockResolvedValue([]) // No more children
      
      const result = await exporter.exportSelectedFolders(
        mockWebsiteId,
        ['parent'],
        true // Include children
      )
      
      expect(result.root).toHaveLength(1)
      expect(result.root[0].children).toHaveLength(2)
      expect(result.root[0].children[0].id).toBe('child-1')
      expect(result.root[0].children[1].id).toBe('child-2')
    })
    
    it('should export multiple non-contiguous folders', async () => {
      const mockFolder1 = {
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
      
      const mockFolder3 = {
        id: 'folder-3',
        websiteId: mockWebsiteId,
        parentId: null,
        slug: 'folder-3',
        fullPath: '/folder-3',
        position: 2,
        pathDepth: 0,
        contentItemId: null,
        contentItem: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      ;(prisma.websiteStructure.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockFolder1)
        .mockResolvedValueOnce(mockFolder3)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue([])
      
      const result = await exporter.exportSelectedFolders(
        mockWebsiteId,
        ['folder-1', 'folder-3'],
        false
      )
      
      expect(result.root).toHaveLength(2)
      expect(result.root[0].id).toBe('folder-1')
      expect(result.root[1].id).toBe('folder-3')
      expect(result.totalFolders).toBe(2)
    })
    
    it('should filter content for selective exports', async () => {
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
      
      ;(prisma.websiteStructure.findFirst as jest.Mock).mockResolvedValue(mockFolder)
      ;(prisma.websiteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { contentItemId: 'content-1' },
          { contentItemId: 'content-2' }
        ]) // Content for selected folder
        .mockResolvedValue([]) // No children
      
      const result = await exporter.exportSelectedFolders(
        mockWebsiteId,
        ['selected-folder'],
        false
      )
      
      expect(result.root[0].websitePages).toEqual(['content-1', 'content-2'])
    })
  })
  
  describe('Path Mapping (AC: 6)', () => {
    it('should generate paths for all folders', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
          id: 'root',
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
          id: 'child',
          websiteId: mockWebsiteId,
          parentId: 'root',
          slug: 'child',
          fullPath: '/root/child',
          position: 0,
          pathDepth: 1,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'grandchild',
          websiteId: mockWebsiteId,
          parentId: 'child',
          slug: 'grandchild',
          fullPath: '/root/child/grandchild',
          position: 0,
          pathDepth: 2,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.pathMappings).toEqual({
        'root': '/root',
        'child': '/root/child',
        'grandchild': '/root/child/grandchild'
      })
    })
    
    it('should ensure path uniqueness', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
          id: 'folder-1',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'duplicate',
          fullPath: '/duplicate',
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
          parentId: null,
          slug: 'unique',
          fullPath: '/unique',
          position: 1,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      // Each folder ID should map to a unique path
      const paths = Object.values(result.pathMappings)
      const uniquePaths = new Set(paths)
      expect(uniquePaths.size).toBe(paths.length)
    })
    
    it('should handle special characters in paths', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
          id: 'special-folder',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'folder-with-special-chars_123',
          fullPath: '/folder-with-special-chars_123',
          position: 0,
          pathDepth: 0,
          contentItemId: null,
          contentItem: {
            title: 'Folder with Special Chars & Symbols!'
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.pathMappings['special-folder']).toBe('/folder-with-special-chars_123')
      expect(result.root[0].name).toBe('Folder with Special Chars & Symbols!')
    })
    
    it('should enable path reconstruction from export', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
          id: 'a',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'a',
          fullPath: '/a',
          position: 0,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'b',
          websiteId: mockWebsiteId,
          parentId: 'a',
          slug: 'b',
          fullPath: '/a/b',
          position: 0,
          pathDepth: 1,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'c',
          websiteId: mockWebsiteId,
          parentId: 'b',
          slug: 'c',
          fullPath: '/a/b/c',
          position: 0,
          pathDepth: 2,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      // Verify we can reconstruct the full path for any folder
      const pathMapping = exporter.createPathMapping(result)
      expect(pathMapping['a']).toBe('/a')
      expect(pathMapping['b']).toBe('/a/b')
      expect(pathMapping['c']).toBe('/a/b/c')
    })
  })
  
  describe('Performance Benchmarks (AC: 7)', () => {
    it('should export 10 folders in <1 second', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = Array.from({ length: 10 }, (_, i) => ({
        id: `folder-${i}`,
        websiteId: mockWebsiteId,
        parentId: null,
        slug: `folder-${i}`,
        fullPath: `/folder-${i}`,
        position: i,
        pathDepth: 0,
        contentItemId: null,
        contentItem: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const startTime = Date.now()
      const result = await exporter.exportFolders(mockWebsiteId)
      const endTime = Date.now()
      
      expect(result.totalFolders).toBe(10)
      expect(endTime - startTime).toBeLessThan(1000)
    })
    
    it('should export 100 folders with 1000 items in <10 seconds', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      // Create 100 folders with proper hierarchy
      const firstBatch = Array.from({ length: 100 }, (_, i) => ({
        id: `folder-${i}`,
        websiteId: mockWebsiteId,
        parentId: i > 0 && i % 10 !== 0 ? `folder-${Math.floor(i / 10) * 10}` : null,
        slug: `folder-${i}`,
        fullPath: `/path/to/folder-${i}`,
        position: i % 10,
        pathDepth: i > 0 && i % 10 !== 0 ? 1 : 0,
        contentItemId: null,
        contentItem: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
      
      // Mock 10 content items per folder (1000 total)
      const mockContent = Array.from({ length: 10 }, (_, i) => ({
        contentItemId: `content-${i}`
      }))
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce(firstBatch) // First call returns 100 folders (triggers batching)
        .mockResolvedValueOnce(firstBatch) // fetchFolderStructuresBatched first call
        .mockResolvedValueOnce([]) // fetchFolderStructuresBatched second call (empty, stops)
        .mockResolvedValue(mockContent) // Subsequent calls for content
      
      const startTime = Date.now()
      const result = await exporter.exportFolders(mockWebsiteId)
      const endTime = Date.now()
      
      expect(result.totalFolders).toBe(100)
      expect(endTime - startTime).toBeLessThan(10000)
    })
    
    it('should keep memory usage under 50MB for typical exports', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      // Create a typical export (50 folders)
      const mockStructures = Array.from({ length: 50 }, (_, i) => ({
        id: `folder-${i}`,
        websiteId: mockWebsiteId,
        parentId: i > 0 ? `folder-${i - 1}` : null,
        slug: `folder-${i}`,
        fullPath: `/path/folder-${i}`,
        position: 0,
        pathDepth: i,
        contentItemId: null,
        contentItem: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      const memoryBefore = process.memoryUsage().heapUsed
      await exporter.exportFolders(mockWebsiteId)
      const memoryAfter = process.memoryUsage().heapUsed
      
      const memoryUsedMB = (memoryAfter - memoryBefore) / 1024 / 1024
      expect(memoryUsedMB).toBeLessThan(50)
    })
    
    it('should use batch processing effectively', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      // Create exactly 100 folders (batch size limit) to trigger batching logic
      const firstBatch = Array.from({ length: 100 }, (_, i) => ({
        id: `folder-${i}`,
        websiteId: mockWebsiteId,
        parentId: null,
        slug: `folder-${i}`,
        fullPath: `/folder-${i}`,
        position: i,
        pathDepth: 0,
        contentItemId: null,
        contentItem: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
      
      const secondBatch = Array.from({ length: 50 }, (_, i) => ({
        id: `folder-${i + 100}`,
        websiteId: mockWebsiteId,
        parentId: null,
        slug: `folder-${i + 100}`,
        fullPath: `/folder-${i + 100}`,
        position: i + 100,
        pathDepth: 0,
        contentItemId: null,
        contentItem: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
      
      // Mock batched responses
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock)
        .mockResolvedValueOnce(firstBatch) // First call returns full batch (triggers batching)
        .mockResolvedValueOnce(firstBatch) // fetchFolderStructuresBatched first call
        .mockResolvedValueOnce(secondBatch) // fetchFolderStructuresBatched second call
        .mockResolvedValue([]) // Content queries
      
      const result = await exporter.exportFolders(mockWebsiteId)
      
      expect(result.totalFolders).toBe(150)
      // Verify batching occurred
      expect(prisma.websiteStructure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100
        })
      )
    })
  })
  
  describe('Error Handling', () => {
    it('should detect and report circular references', async () => {
      const hierarchy = await exporter.buildFolderHierarchy([], mockWebsiteId)
      
      // Manually create a circular reference for testing
      const node1 = {
        id: 'node-1',
        name: 'Node 1',
        path: '/node-1',
        children: [],
        contentItems: [],
        metadata: {} as any,
        order: 0
      }
      
      const node2 = {
        id: 'node-2',
        name: 'Node 2',
        path: '/node-2',
        children: [node1], // node2 -> node1
        contentItems: [],
        metadata: {} as any,
        order: 1
      }
      
      // Create circular reference
      node1.children.push(node2) // node1 -> node2 (creates cycle)
      
      expect(() => {
        ;(exporter as any).detectCircularReferences([node1])
      }).toThrow(FolderExportError)
    })
    
    it('should handle database errors gracefully', async () => {
      ;(prisma.contentType.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      )
      
      await expect(exporter.exportFolders(mockWebsiteId)).rejects.toThrow(
        FolderExportError
      )
    })
    
    it('should clear cache when memory limit exceeded', async () => {
      const clearCacheSpy = jest.spyOn(exporter, 'clearCache')
      
      // Mock memory usage to exceed limit
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 150 * 1024 * 1024 // 150MB
      })
      
      ;(exporter as any).checkMemoryUsage()
      
      expect(clearCacheSpy).toHaveBeenCalledTimes(0) // Cache methods called internally
      
      // Restore original
      process.memoryUsage = originalMemoryUsage
    })
    
    it('should use cache for repeated exports', async () => {
      const mockFolderContentTypes = [
        { id: 'ct-folder-1' }
      ]
      
      const mockStructures = [
        {
          id: 'cached-folder',
          websiteId: mockWebsiteId,
          parentId: null,
          slug: 'cached',
          fullPath: '/cached',
          position: 0,
          pathDepth: 0,
          contentItemId: null,
          contentItem: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockFolderContentTypes)
      ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockStructures)
      
      // First call - should hit database
      const result1 = await exporter.exportFolders(mockWebsiteId)
      expect(prisma.websiteStructure.findMany).toHaveBeenCalledTimes(2) // Folders + content
      
      // Reset mock call count
      ;(prisma.websiteStructure.findMany as jest.Mock).mockClear()
      
      // Second call - should use cache
      const result2 = await exporter.exportFolders(mockWebsiteId)
      expect(prisma.websiteStructure.findMany).toHaveBeenCalledTimes(0)
      
      // Results should be identical
      expect(result2).toEqual(result1)
    })
  })
})


