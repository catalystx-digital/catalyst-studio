import { describe, it, expect, beforeEach, vi } from 'vitest'
import TemplateStorageService from '../template-storage-service'
import { CMSTemplate } from '../../template-generator'
import { prisma } from '@/lib/generated/prisma'

// Mock Prisma
vi.mock('@/lib/generated/prisma', () => ({
  prisma: {
    cMSComponent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

// Mock performance monitor
vi.mock('@/lib/studio/components/cms/_import/performance', () => ({
  performanceMonitor: {
    measure: vi.fn((name, fn) => fn()),
    measureSync: vi.fn((name, fn) => fn())
  }
}))

describe('TemplateStorageService', () => {
  let service: TemplateStorageService
  const mockWebsiteId = 'website-123'
  const mockImportJobId = 'import-456'

  const mockTemplate: CMSTemplate = {
    id: 'template-1',
    name: 'Hero Section',
    key: 'hero_section',
    category: 'component',
    fields: [
      {
        name: 'title',
        type: 'string',
        required: true,
        placeholder: 'Enter title'
      },
      {
        name: 'subtitle',
        type: 'text',
        required: false,
        placeholder: 'Enter subtitle'
      }
    ],
    metadata: {
      source: 'https://example.com',
      sourcePages: ['https://example.com/home'],
      confidence: 0.85,
      patterns: ['hero'],
      version: 1
    }
  }

  beforeEach(() => {
    service = new TemplateStorageService({
      batchSize: 5,
      validateBeforeSave: true,
      overwriteExisting: false,
      autoApproveThreshold: 0.7
    })
    vi.clearAllMocks()
  })

  describe('saveImportedTemplates', () => {
    it('should save templates successfully', async () => {
      const templates = [mockTemplate]
      
      // Mock transaction to execute callback immediately
      ;(prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(prisma)
      })
      
      // Mock no existing component
      ;(prisma.cMSComponent.findFirst as any).mockResolvedValue(null)
      
      // Mock successful creation
      ;(prisma.cMSComponent.create as any).mockResolvedValue({
        id: 'created-component-1',
        type: 'hero-section',
        category: 'content',
        websiteId: mockWebsiteId
      })

      const result = await service.saveImportedTemplates(templates, mockWebsiteId, mockImportJobId)

      expect(result.success).toBe(true)
      expect(result.totalSaved).toBe(1)
      expect(result.totalFailed).toBe(0)
      expect(result.savedTemplateIds).toContain('created-component-1')
    })

    it('should filter templates by auto-approve threshold', async () => {
      const templates = [
        mockTemplate,
        {
          ...mockTemplate,
          id: 'template-2',
          metadata: {
            ...mockTemplate.metadata,
            confidence: 0.5 // Below threshold
          }
        }
      ]

      ;(prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(prisma)
      })
      ;(prisma.cMSComponent.findFirst as any).mockResolvedValue(null)
      ;(prisma.cMSComponent.create as any).mockResolvedValue({
        id: 'created-component-1',
        type: 'hero-section'
      })

      const result = await service.saveImportedTemplates(templates, mockWebsiteId, mockImportJobId)

      // Only the high-confidence template should be saved
      expect(result.totalSaved).toBe(1)
      expect(prisma.cMSComponent.create).toHaveBeenCalledTimes(1)
    })

    it('should handle batch processing', async () => {
      const templates = Array(12).fill(null).map((_, i) => ({
        ...mockTemplate,
        id: `template-${i}`,
        key: `key-${i}`
      }))

      ;(prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(prisma)
      })
      ;(prisma.cMSComponent.findFirst as any).mockResolvedValue(null)
      ;(prisma.cMSComponent.create as any).mockImplementation((data: any) => ({
        id: `created-${data.data.type}`,
        ...data.data
      }))

      const result = await service.saveImportedTemplates(templates, mockWebsiteId, mockImportJobId)

      // Should process in 3 batches (batch size = 5)
      expect(result.totalSaved).toBe(12)
      expect(prisma.$transaction).toHaveBeenCalledTimes(3)
    })

    it('should handle validation failures', async () => {
      const invalidTemplate = {
        ...mockTemplate,
        name: '', // Invalid: empty name
        fields: [] // Invalid: no fields
      }

      ;(prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(prisma)
      })

      const result = await service.saveImportedTemplates([invalidTemplate], mockWebsiteId, mockImportJobId)

      expect(result.success).toBe(false)
      expect(result.totalFailed).toBe(1)
      expect(result.failedTemplates).toHaveLength(1)
      expect(result.failedTemplates?.[0].error).toContain('validation failed')
    })

    it('should handle existing components when overwriteExisting is false', async () => {
      ;(prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(prisma)
      })
      
      // Mock existing component
      ;(prisma.cMSComponent.findFirst as any).mockResolvedValue({
        id: 'existing-component',
        type: 'hero-section'
      })

      const result = await service.saveImportedTemplates([mockTemplate], mockWebsiteId, mockImportJobId)

      expect(result.success).toBe(false)
      expect(result.totalSaved).toBe(0)
      expect(result.failedTemplates?.[0].error).toContain('already exists')
      expect(prisma.cMSComponent.create).not.toHaveBeenCalled()
    })

    it('should overwrite existing components when overwriteExisting is true', async () => {
      const serviceWithOverwrite = new TemplateStorageService({
        overwriteExisting: true
      })

      ;(prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(prisma)
      })
      
      // Mock existing component
      ;(prisma.cMSComponent.findFirst as any).mockResolvedValue({
        id: 'existing-component',
        type: 'hero-section',
        version: '1.0.0'
      })
      
      // Mock successful update
      ;(prisma.cMSComponent.update as any).mockResolvedValue({
        id: 'existing-component',
        type: 'hero-section',
        version: '1.0.1'
      })

      const result = await serviceWithOverwrite.saveImportedTemplates(
        [mockTemplate], 
        mockWebsiteId, 
        mockImportJobId
      )

      expect(result.success).toBe(true)
      expect(result.totalSaved).toBe(1)
      expect(prisma.cMSComponent.update).toHaveBeenCalled()
      expect(prisma.cMSComponent.create).not.toHaveBeenCalled()
    })

    it('should handle transaction failures', async () => {
      ;(prisma.$transaction as any).mockRejectedValue(new Error('Transaction failed'))

      const result = await service.saveImportedTemplates([mockTemplate], mockWebsiteId, mockImportJobId)

      expect(result.success).toBe(false)
      expect(result.totalFailed).toBe(1)
      expect(result.failedTemplates?.[0].error).toContain('Batch save failed')
    })
  })

  describe('handleDuplicates', () => {
    it('should separate unique and duplicate templates', async () => {
      const templates = [mockTemplate]
      
      // First template doesn't exist
      ;(prisma.cMSComponent.findFirst as any)
        .mockResolvedValueOnce(null)

      const result = await service.handleDuplicates(templates, mockWebsiteId)

      expect(result.unique).toHaveLength(1)
      expect(result.duplicates).toHaveLength(0)
    })

    it('should identify duplicates correctly', async () => {
      const templates = [
        mockTemplate,
        { ...mockTemplate, id: 'template-2' }
      ]
      
      // Mock finding existing component for both
      ;(prisma.cMSComponent.findFirst as any).mockResolvedValue({
        id: 'existing',
        type: 'hero-section'
      })

      const result = await service.handleDuplicates(templates, mockWebsiteId)

      expect(result.unique).toHaveLength(0)
      expect(result.duplicates).toHaveLength(2)
    })
  })

  describe('rollbackBatchSave', () => {
    it('should delete saved components on rollback', async () => {
      const savedIds = ['id1', 'id2', 'id3']
      
      ;(prisma.cMSComponent.deleteMany as any).mockResolvedValue({
        count: 3
      })

      await service.rollbackBatchSave(savedIds)

      expect(prisma.cMSComponent.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: savedIds }
        }
      })
    })

    it('should handle empty rollback gracefully', async () => {
      await service.rollbackBatchSave([])
      
      expect(prisma.cMSComponent.deleteMany).not.toHaveBeenCalled()
    })

    it('should throw error if rollback fails', async () => {
      const savedIds = ['id1']
      
      ;(prisma.cMSComponent.deleteMany as any).mockRejectedValue(
        new Error('Delete failed')
      )

      await expect(service.rollbackBatchSave(savedIds)).rejects.toThrow('Delete failed')
    })
  })

  describe('associateTemplatesWithWebsite', () => {
    it('should update website association for templates', async () => {
      const templateIds = ['template1', 'template2']
      
      ;(prisma.cMSComponent.updateMany as any).mockResolvedValue({
        count: 2
      })

      await service.associateTemplatesWithWebsite(templateIds, mockWebsiteId)

      expect(prisma.cMSComponent.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: templateIds }
        },
        data: {
          websiteId: mockWebsiteId
        }
      })
    })
  })

  describe('mapTemplateToCMSComponent', () => {
    it('should correctly map template to CMS component structure', () => {
      // Access private method through type assertion
      const mappedComponent = (service as any).mapTemplateToCMSComponent(
        mockTemplate,
        mockWebsiteId,
        mockImportJobId
      )

      expect(mappedComponent.type).toBe('hero-section')
      expect(mappedComponent.category).toBe('content')
      expect(mappedComponent.version).toBe('1')
      expect(mappedComponent.confidence).toBe(0.85)
      expect(mappedComponent.props.fields).toEqual(mockTemplate.fields)
      expect(mappedComponent.aiMetadata.importJobId).toBe(mockImportJobId)
      expect(mappedComponent.aiMetadata.source).toBe('import')
      expect(mappedComponent.aiMetadata.autoApproved).toBe(true)
    })

    it('should sanitize component type name', () => {
      const templateWithSpecialChars = {
        ...mockTemplate,
        name: 'Hero Section Template!'
      }

      const mappedComponent = (service as any).mapTemplateToCMSComponent(
        templateWithSpecialChars,
        mockWebsiteId
      )

      // Should remove special characters and "template" suffix
      expect(mappedComponent.type).toBe('hero-section')
    })

    it('should include design tokens in styles if present', () => {
      const templateWithTokens = {
        ...mockTemplate,
        metadata: {
          ...mockTemplate.metadata,
          designTokens: {
            colors: { primary: '#000' },
            fonts: { body: 'Arial' }
          }
        }
      }

      const mappedComponent = (service as any).mapTemplateToCMSComponent(
        templateWithTokens,
        mockWebsiteId
      )

      expect(mappedComponent.styles).toBeDefined()
      expect(mappedComponent.styles.tokens).toEqual(templateWithTokens.metadata.designTokens)
      expect(mappedComponent.styles.theme).toBe('imported')
    })
  })
})