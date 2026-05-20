import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { prisma } from '@/lib/generated/prisma'
import TemplateGenerator from '../template-generator'
import TemplateStorageService from '../services/template-storage-service'
import { ImportService } from '../services/import-service'
import { ImportPipelineResult } from '../import-pipeline'

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
    importJob: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    website: {
      findUnique: vi.fn()
    },
    $transaction: vi.fn((callback) => callback(prisma))
  }
}))

describe('Template Integration with Site Builder', () => {
  let templateGenerator: TemplateGenerator
  let storageService: TemplateStorageService
  
  const mockWebsiteId = 'test-website-123'
  const mockImportJobId = 'test-job-456'
  
  const mockPipelineResult: ImportPipelineResult = {
    success: true,
    data: {
      detectedComponents: [
        {
          pageUrl: 'https://example.com',
          components: [
            {
              type: 'hero',
              confidence: 0.85,
              content: {
                title: 'Welcome to Our Site',
                subtitle: 'Your success starts here'
              },
              location: 'hero'
            },
            {
              type: 'navigation',
              confidence: 0.92,
              content: {
                items: ['Home', 'About', 'Services', 'Contact']
              },
              location: 'header'
            }
          ]
        }
      ],
      navigation: {
        pages: ['/', '/about', '/services', '/contact']
      },
      templates: [],
      designTokens: {
        colors: {
          primary: '#007bff',
          secondary: '#6c757d'
        },
        fonts: {
          body: 'Arial, sans-serif',
          heading: 'Georgia, serif'
        }
      }
    },
    performanceMetrics: {
      totalTime: 5000,
      detectionTime: 3000,
      templateTime: 2000
    }
  }

  beforeEach(() => {
    templateGenerator = new TemplateGenerator({
      generatePlaceholders: true,
      minConfidence: 0.7
    })
    
    storageService = new TemplateStorageService({
      batchSize: 10,
      validateBeforeSave: true,
      autoApproveThreshold: 0.7
    })
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Template Generation', () => {
    it('should generate templates from pipeline results', () => {
      const templates = templateGenerator.generateFromPatterns(mockPipelineResult)
      
      expect(templates).toBeDefined()
      expect(templates.length).toBeGreaterThan(0)
      
      // Check for component templates
      const componentTemplates = templates.filter(t => t.category === 'component')
      expect(componentTemplates.length).toBeGreaterThanOrEqual(2) // hero and navigation
      
      // Verify template structure
      const heroTemplate = componentTemplates.find(t => t.name.toLowerCase().includes('hero'))
      expect(heroTemplate).toBeDefined()
      expect(heroTemplate?.metadata.confidence).toBeGreaterThanOrEqual(0.7)
    })

    it('should filter components by confidence threshold', () => {
      const lowConfidenceResult = {
        ...mockPipelineResult,
        data: {
          ...mockPipelineResult.data,
          detectedComponents: [
            {
              pageUrl: 'https://example.com',
              components: [
                {
                  type: 'hero',
                  confidence: 0.5, // Below threshold
                  content: { title: 'Test' },
                  location: 'hero'
                },
                {
                  type: 'navigation',
                  confidence: 0.8, // Above threshold
                  content: { items: ['Home'] },
                  location: 'header'
                }
              ]
            }
          ]
        }
      }
      
      const templates = templateGenerator.generateFromPatterns(lowConfidenceResult)
      const componentTemplates = templates.filter(t => t.category === 'component')
      
      // Should only include high-confidence navigation component
      expect(componentTemplates.some(t => t.name.toLowerCase().includes('navigation'))).toBe(true)
      expect(componentTemplates.some(t => t.name.toLowerCase().includes('hero'))).toBe(false)
    })
  })

  describe('CMS Storage', () => {
    it('should save templates to CMSComponent table', async () => {
      const templates = templateGenerator.generateFromPatterns(mockPipelineResult)
      
      // Mock database responses
      ;(prisma.cMSComponent.findFirst as any).mockResolvedValue(null)
      ;(prisma.cMSComponent.create as any).mockImplementation((data: any) => ({
        id: `component-${Date.now()}`,
        ...data.data
      }))
      
      const result = await storageService.saveImportedTemplates(
        templates,
        mockWebsiteId,
        mockImportJobId
      )
      
      expect(result.success).toBe(true)
      expect(result.totalSaved).toBeGreaterThan(0)
      expect(result.savedTemplateIds).toHaveLength(result.totalSaved)
      
      // Verify database calls
      expect(prisma.cMSComponent.create).toHaveBeenCalled()
    })

    it('should include import metadata in aiMetadata', async () => {
      const templates = templateGenerator.generateFromPatterns(mockPipelineResult)
      
      ;(prisma.cMSComponent.findFirst as any).mockResolvedValue(null)
      ;(prisma.cMSComponent.create as any).mockImplementation((data: any) => {
        // Verify import metadata is set
        expect(data.data.aiMetadata.importJobId).toBe(mockImportJobId)
        expect(data.data.aiMetadata.importedAt).toBeDefined()
        expect(data.data.aiMetadata.source).toBe('import')
        return {
          id: `component-${Date.now()}`,
          ...data.data
        }
      })
      
      await storageService.saveImportedTemplates(
        templates,
        mockWebsiteId,
        mockImportJobId
      )
    })

    it('should handle duplicate templates gracefully', async () => {
      const templates = templateGenerator.generateFromPatterns(mockPipelineResult)
      
      // Mock existing component
      ;(prisma.cMSComponent.findFirst as any).mockResolvedValue({
        id: 'existing-component',
        type: 'hero',
        category: 'content',
        version: '1.0.0'
      })
      
      const result = await storageService.saveImportedTemplates(
        templates,
        mockWebsiteId,
        mockImportJobId
      )
      
      // Should skip existing components when overwriteExisting is false
      expect(result.failedTemplates).toBeDefined()
      expect(result.failedTemplates?.some(f => f.error === 'Component already exists')).toBe(true)
    })
  })

  describe('Site Builder Compatibility', () => {
    it('should create templates accessible via CMS APIs', async () => {
      const templates = templateGenerator.generateFromPatterns(mockPipelineResult)
      
      // Save templates
      ;(prisma.cMSComponent.findFirst as any).mockResolvedValue(null)
      ;(prisma.cMSComponent.create as any).mockImplementation((data: any) => ({
        id: `component-${Date.now()}`,
        ...data.data,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
      
      const saveResult = await storageService.saveImportedTemplates(
        templates,
        mockWebsiteId,
        mockImportJobId
      )
      
      // Mock fetching saved templates
      ;(prisma.cMSComponent.findMany as any).mockResolvedValue(
        saveResult.savedTemplateIds.map(id => ({
          id,
          type: 'imported-component',
          category: 'content',
          websiteId: mockWebsiteId,
          props: {},
          content: {},
          aiMetadata: { source: 'import', importJobId: mockImportJobId }
        }))
      )
      
      // Verify templates can be retrieved
      const savedTemplates = await prisma.cMSComponent.findMany({
        where: {
          websiteId: mockWebsiteId
        }
      })
      
      expect(savedTemplates).toHaveLength(saveResult.savedTemplateIds.length)
      expect(savedTemplates[0].aiMetadata.source).toBe('import')
    })

    it('should map template fields to CMS component structure', () => {
      const templates = templateGenerator.generateFromPatterns(mockPipelineResult)
      const template = templates[0]
      
      const componentData = templateGenerator.convertToCMSComponent(template, mockWebsiteId)
      
      // Verify mapping
      expect(componentData.type).toBeDefined()
      expect(componentData.category).toBeDefined()
      expect(componentData.props).toBeDefined()
      expect(componentData.props.fields).toBe(template.fields)
      expect(componentData.props.key).toBe(template.key)
      expect(componentData.content).toBeDefined()
      expect(componentData.aiMetadata.source).toBe('import')
      expect(componentData.confidence).toBeGreaterThanOrEqual(0.7)
    })
  })

  describe('Error Handling', () => {
    it('should validate template structure before saving', async () => {
      const invalidTemplate = {
        id: 'invalid',
        name: '', // Invalid: empty name
        key: 'test',
        category: 'component' as const,
        fields: [],
        metadata: {}
      }
      
      const result = await storageService.saveImportedTemplates(
        [invalidTemplate],
        mockWebsiteId,
        mockImportJobId
      )
      
      expect(result.success).toBe(false)
      expect(result.failedTemplates).toHaveLength(1)
      expect(result.failedTemplates?.[0].error).toContain('validation failed')
    })

    it('should implement rollback on batch save failure', async () => {
      const templates = templateGenerator.generateFromPatterns(mockPipelineResult)
      
      // Mock transaction failure
      ;(prisma.$transaction as any).mockRejectedValue(new Error('Transaction failed'))
      
      const result = await storageService.saveImportedTemplates(
        templates,
        mockWebsiteId,
        mockImportJobId
      )
      
      expect(result.success).toBe(false)
      expect(result.totalSaved).toBe(0)
    })

    it('should provide detailed error messages', async () => {
      const templates = templateGenerator.generateFromPatterns(mockPipelineResult)
      
      // Mock specific database error
      ;(prisma.cMSComponent.findFirst as any).mockResolvedValue(null)
      ;(prisma.cMSComponent.create as any).mockRejectedValue(
        new Error('P2002: Unique constraint violation')
      )
      
      const result = await storageService.saveImportedTemplates(
        templates,
        mockWebsiteId,
        mockImportJobId
      )
      
      expect(result.success).toBe(false)
      expect(result.failedTemplates).toBeDefined()
      result.failedTemplates?.forEach(failure => {
        expect(failure.error).toBeDefined()
        expect(failure.error.length).toBeGreaterThan(0)
      })
    })
  })
})
