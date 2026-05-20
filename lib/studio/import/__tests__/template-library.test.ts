import { TemplateLibrary } from '../template-library'
import { CMSTemplate } from '../template-generator'
import { PrismaClient } from '@prisma/client'

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockContentType = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn()
  }

  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      contentType: mockContentType
    })),
    ContentTypeCategory: {
      page: 'page',
      component: 'component',
      folder: 'folder'
    }
  }
})

// Mock performance monitor
jest.mock('@/lib/studio/components/cms/_import/performance', () => ({
  performanceMonitor: {
    measure: jest.fn((name, fn) => fn())
  }
}))

describe('TemplateLibrary', () => {
  let library: TemplateLibrary
  let prisma: PrismaClient
  let mockTemplate: CMSTemplate

  beforeEach(() => {
    prisma = new PrismaClient()
    library = new TemplateLibrary(prisma, {
      cacheEnabled: true,
      cacheTTL: 5000,
      batchSize: 2
    })

    mockTemplate = {
      id: 'template-1',
      name: 'Test Template',
      key: 'test_template',
      category: 'page',
      fields: [
        {
          name: 'title',
          type: 'string',
          required: true
        },
        {
          name: 'content',
          type: 'text',
          required: false
        }
      ],
      metadata: {
        confidence: 0.85,
        version: 1
      }
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('storeTemplate', () => {
    it('should store a template in the database', async () => {
      const websiteId = 'website-1'
      const mockCreated = {
        id: mockTemplate.id,
        key: mockTemplate.key,
        name: mockTemplate.name,
        category: mockTemplate.category,
        fields: mockTemplate.fields
      }

      ;(prisma.contentType.create as jest.Mock).mockResolvedValue(mockCreated)

      const result = await library.storeTemplate(mockTemplate, websiteId)

      expect(result).toBe(mockTemplate.id)
      expect(prisma.contentType.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: mockTemplate.id,
          key: mockTemplate.key,
          name: mockTemplate.name,
          category: mockTemplate.category,
          fields: {
            __fields: mockTemplate.fields,
            __metadata: mockTemplate.metadata || {}
          },
          websiteId
        })
      })
    })

    it('should generate unique key if not provided', async () => {
      const templateWithoutKey = { ...mockTemplate, key: '' }
      const websiteId = 'website-1'

      ;(prisma.contentType.create as jest.Mock).mockResolvedValue({
        id: templateWithoutKey.id
      })

      await library.storeTemplate(templateWithoutKey, websiteId)

      expect(prisma.contentType.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: expect.stringMatching(/^test_template_\d+$/)
        })
      })
    })

    it('should throw error for invalid template', async () => {
      const invalidTemplate = { ...mockTemplate, id: '' }
      const websiteId = 'website-1'

      await expect(library.storeTemplate(invalidTemplate, websiteId))
        .rejects.toThrow('Template must have an ID')
    })
  })

  describe('storeTemplatesBatch', () => {
    it('should store multiple templates in batch', async () => {
      const templates = [
        mockTemplate,
        { ...mockTemplate, id: 'template-2', name: 'Template 2' },
        { ...mockTemplate, id: 'template-3', name: 'Template 3' }
      ]
      const websiteId = 'website-1'

      ;(prisma.contentType.create as jest.Mock).mockResolvedValue({ id: 'created' })

      const result = await library.storeTemplatesBatch(templates, websiteId)

      expect(result.successful).toHaveLength(3)
      expect(result.failed).toHaveLength(0)
      expect(prisma.contentType.create).toHaveBeenCalledTimes(3)
    })

    it('should handle failures in batch processing', async () => {
      const templates = [
        mockTemplate,
        { ...mockTemplate, id: '', name: 'Invalid Template' }
      ]
      const websiteId = 'website-1'

      ;(prisma.contentType.create as jest.Mock).mockResolvedValueOnce({ id: 'template-1' })

      const result = await library.storeTemplatesBatch(templates, websiteId)

      expect(result.successful).toHaveLength(1)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].error).toContain('Template must have an ID')
    })
  })

  describe('getTemplate', () => {
    it('should retrieve template from database', async () => {
      const mockContentType = {
        id: mockTemplate.id,
        key: mockTemplate.key,
        name: mockTemplate.name,
        category: mockTemplate.category,
        fields: mockTemplate.fields
      }

      ;(prisma.contentType.findUnique as jest.Mock).mockResolvedValue(mockContentType)

      const result = await library.getTemplate(mockTemplate.id)

      expect(result).toEqual(expect.objectContaining({
        id: mockTemplate.id,
        name: mockTemplate.name,
        category: mockTemplate.category,
        fields: mockTemplate.fields
      }))
    })

    it('should return null for non-existent template', async () => {
      ;(prisma.contentType.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await library.getTemplate('non-existent')

      expect(result).toBeNull()
    })

    it('should use cache for subsequent requests', async () => {
      const mockContentType = {
        id: mockTemplate.id,
        key: mockTemplate.key,
        name: mockTemplate.name,
        category: mockTemplate.category,
        fields: mockTemplate.fields
      }

      ;(prisma.contentType.findUnique as jest.Mock).mockResolvedValue(mockContentType)

      // First call - should hit database
      await library.getTemplate(mockTemplate.id)
      
      // Second call - should use cache
      await library.getTemplate(mockTemplate.id)

      expect(prisma.contentType.findUnique).toHaveBeenCalledTimes(1)
    })
  })

  describe('searchTemplates', () => {
    it('should search templates by category', async () => {
      const mockResults = [
        {
          id: 'template-1',
          key: 'template_1',
          name: 'Template 1',
          category: 'page',
          fields: []
        },
        {
          id: 'template-2',
          key: 'template_2',
          name: 'Template 2',
          category: 'page',
          fields: []
        }
      ]

      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockResults)

      const results = await library.searchTemplates({ category: 'page' })

      expect(results).toHaveLength(2)
      expect(prisma.contentType.findMany).toHaveBeenCalledWith({
        where: { category: 'page' },
        take: 100
      })
    })

    it('should search templates by name', async () => {
      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue([])

      await library.searchTemplates({ name: 'Hero' })

      expect(prisma.contentType.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            contains: 'Hero',
            mode: 'insensitive'
          }
        },
        take: 100
      })
    })

    it('should apply additional filters for confidence', async () => {
      const mockResults = [
        {
          id: 'template-1',
          key: 'template_1',
          name: 'Template 1',
          category: 'page',
          fields: {
            __fields: [],
            __metadata: { confidence: 0.9 }
          }
        },
        {
          id: 'template-2',
          key: 'template_2',
          name: 'Template 2',
          category: 'page',
          fields: {
            __fields: [],
            __metadata: { confidence: 0.5 }
          }
        }
      ]

      ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockResults)

      const results = await library.searchTemplates({ minConfidence: 0.7 })

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('template-1')
    })
  })

  describe('duplicateTemplate', () => {
    it('should duplicate a template with new name', async () => {
      const websiteId = 'website-1'
      const newName = 'Duplicated Template'

      ;(prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: mockTemplate.id,
        key: mockTemplate.key,
        name: mockTemplate.name,
        category: mockTemplate.category,
        fields: mockTemplate.fields
      })

      ;(prisma.contentType.create as jest.Mock).mockResolvedValue({ id: 'new-id' })

      const result = await library.duplicateTemplate(mockTemplate.id, newName, websiteId)

      expect(result.name).toBe(newName)
      expect(result.metadata?.duplicatedFrom).toBe(mockTemplate.id)
      expect(result.id).not.toBe(mockTemplate.id)
    })

    it('should throw error if template not found', async () => {
      ;(prisma.contentType.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(library.duplicateTemplate('non-existent', 'New Name', 'website-1'))
        .rejects.toThrow('Template non-existent not found')
    })
  })

  describe('modifyTemplate', () => {
    it('should modify an existing template', async () => {
      const updates = {
        name: 'Updated Template',
        fields: [
          ...mockTemplate.fields,
          {
            name: 'author',
            type: 'string',
            required: false
          }
        ]
      }

      ;(prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: mockTemplate.id,
        key: mockTemplate.key,
        name: mockTemplate.name,
        category: mockTemplate.category,
        fields: mockTemplate.fields
      })

      ;(prisma.contentType.update as jest.Mock).mockResolvedValue({ id: mockTemplate.id })

      const result = await library.modifyTemplate(mockTemplate.id, updates)

      expect(result.name).toBe(updates.name)
      expect(result.fields).toHaveLength(3)
      expect(result.metadata?.version).toBe(2)
    })
  })

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      ;(prisma.contentType.delete as jest.Mock).mockResolvedValue({ id: mockTemplate.id })

      const result = await library.deleteTemplate(mockTemplate.id)

      expect(result).toBe(true)
      expect(prisma.contentType.delete).toHaveBeenCalledWith({
        where: { id: mockTemplate.id }
      })
    })

    it('should return false on delete failure', async () => {
      ;(prisma.contentType.delete as jest.Mock).mockRejectedValue(new Error('Delete failed'))

      const result = await library.deleteTemplate('non-existent')

      expect(result).toBe(false)
    })
  })

  describe('export/import', () => {
    it('should export templates to JSON format', () => {
      const templates = [mockTemplate]
      const exportData = library.exportTemplates(templates)

      expect(exportData.version).toBe('1.0.0')
      expect(exportData.templates).toHaveLength(1)
      expect(exportData.templates[0].id).toBe(mockTemplate.id)
      expect(exportData.exportDate).toBeDefined()
    })

    it('should import templates from JSON', async () => {
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        templates: [mockTemplate]
      }
      const websiteId = 'website-1'

      ;(prisma.contentType.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.contentType.create as jest.Mock).mockResolvedValue({ id: mockTemplate.id })

      const result = await library.importTemplates(exportData, websiteId, false)

      expect(result.imported).toBe(1)
      expect(result.updated).toBe(0)
      expect(result.skipped).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should update existing templates when overwrite is true', async () => {
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        templates: [mockTemplate]
      }
      const websiteId = 'website-1'

      ;(prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: mockTemplate.id,
        key: mockTemplate.key,
        name: 'Old Name',
        category: mockTemplate.category,
        fields: []
      })
      ;(prisma.contentType.update as jest.Mock).mockResolvedValue({ id: mockTemplate.id })

      const result = await library.importTemplates(exportData, websiteId, true)

      expect(result.imported).toBe(0)
      expect(result.updated).toBe(1)
      expect(result.skipped).toBe(0)
    })
  })

  describe('getTemplateStatistics', () => {
    it('should return template statistics', async () => {
      const websiteId = 'website-1'

      ;(prisma.contentType.groupBy as jest.Mock).mockResolvedValue([
        { category: 'page', _count: { category: 5 } },
        { category: 'component', _count: { category: 10 } },
        { category: 'folder', _count: { category: 2 } }
      ])

      ;(prisma.contentType.count as jest.Mock).mockResolvedValue(17)

      const stats = await library.getTemplateStatistics(websiteId)

      expect(stats.total).toBe(17)
      expect(stats.byCategory.page).toBe(5)
      expect(stats.byCategory.component).toBe(10)
      expect(stats.byCategory.folder).toBe(2)
    })
  })

  describe('cache management', () => {
    it('should clear cache', async () => {
      // Add template to cache
      ;(prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: mockTemplate.id,
        key: mockTemplate.key,
        name: mockTemplate.name,
        category: mockTemplate.category,
        fields: mockTemplate.fields
      })

      await library.getTemplate(mockTemplate.id)
      
      // Clear cache
      library.clearCache()
      
      // Next call should hit database again
      await library.getTemplate(mockTemplate.id)

      expect(prisma.contentType.findUnique).toHaveBeenCalledTimes(2)
    })
  })
})