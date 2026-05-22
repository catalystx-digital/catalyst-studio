import { BatchImportAPI } from './batch-import-api'
import { ComponentType } from '../_core/types'
import { CMSComponentFactory } from '../_factory/factory'

jest.mock('../_factory/factory')

describe('BatchImportAPI', () => {
  let api: BatchImportAPI
  let mockFactory: any

  beforeEach(() => {
    mockFactory = {
      hasComponent: jest.fn(),
      getRegistry: jest.fn(() => new Map()),
      loadComponent: jest.fn().mockResolvedValue({})
    }
    
    jest.spyOn(CMSComponentFactory, 'getInstance').mockReturnValue(mockFactory)
    
    api = new BatchImportAPI()
  })

  describe('batchCreateComponents', () => {
    it('should successfully import valid components', async () => {
      const items = [
        {
          type: ComponentType.HeroMinimal,
          content: { headline: 'Test Hero' },
          props: { settings: {} }
        },
        {
          type: ComponentType.PricingTable,
          content: { plans: [{ name: 'Basic', price: '$10' }] },
          props: { settings: {} }
        }
      ]

      mockFactory.hasComponent.mockReturnValue(true)

      const result = await api.batchCreateComponents(items)

      expect(result.success).toBe(true)
      expect(result.totalItems).toBe(2)
      expect(result.successCount).toBe(2)
      expect(result.failureCount).toBe(0)
      expect(result.importedComponents).toHaveLength(2)
    })

    it('should validate components before import', async () => {
      const items = [
        {
          type: ComponentType.HeroMinimal,
          content: {}, // Missing required headline
          props: { settings: {} }
        }
      ]

      mockFactory.hasComponent.mockReturnValue(true)

      const result = await api.batchCreateComponents(items, { validateBeforeImport: true })

      expect(result.failureCount).toBeGreaterThan(0)
      expect(result.errors[0].error).toContain('Hero components require a headline')
    })

    it('should stop on error when configured', async () => {
      const items = [
        {
          type: 'INVALID_TYPE' as ComponentType,
          content: {},
          props: { settings: {} }
        },
        {
          type: ComponentType.HeroMinimal,
          content: { headline: 'Valid Hero' },
          props: { settings: {} }
        }
      ]

      mockFactory.hasComponent.mockImplementation((type) => type === ComponentType.HeroMinimal)

      const result = await api.batchCreateComponents(items, { 
        stopOnError: true,
        validateBeforeImport: true 
      })

      expect(result.successCount).toBe(0)
      expect(result.failureCount).toBeGreaterThan(0)
    })

    it('should process components in chunks', async () => {
      const items = Array.from({ length: 25 }, (_, i) => ({
        type: ComponentType.HeroMinimal,
        content: { headline: `Hero ${i}` },
        props: { settings: {} }
      }))

      mockFactory.hasComponent.mockReturnValue(true)

      const result = await api.batchCreateComponents(items, { chunkSize: 10 })

      expect(result.totalItems).toBe(25)
      expect(result.successCount).toBe(25)
    })

    it('should track progress during import', async () => {
      const items = [
        {
          type: ComponentType.HeroMinimal,
          content: { headline: 'Test' },
          props: { settings: {} }
        }
      ]

      mockFactory.hasComponent.mockReturnValue(true)
      
      const progressUpdates: any[] = []
      const onProgress = jest.fn((progress) => {
        progressUpdates.push(progress)
      })

      await api.batchCreateComponents(items, { onProgress })

      expect(onProgress).toHaveBeenCalled()
      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[progressUpdates.length - 1].percentage).toBe(100)
    })

    it('should rollback on error when transactional', async () => {
      const items = [
        {
          type: ComponentType.HeroMinimal,
          content: {}, // Invalid - missing headline
          props: { settings: {} }
        }
      ]

      mockFactory.hasComponent.mockReturnValue(true)

      const result = await api.batchCreateComponents(items, { 
        transactional: true,
        validateBeforeImport: true 
      })

      expect(result.success).toBe(false)
      expect(result.importedComponents).toHaveLength(0) // Should be rolled back
    })
  })

  describe('Validation', () => {
    it('rejects legacy props.content payloads', async () => {
      const items = [
        {
          type: ComponentType.HeroMinimal,
          props: {
            content: { headline: 'Legacy Hero' },
          },
        } as any,
      ]

      mockFactory.hasComponent.mockReturnValue(true)

      const result = await api.batchCreateComponents(items, { validateBeforeImport: true })

      expect(result.errors[0].error).toBe('Batch import item props must not include content; use top-level content')
    })

    it('rejects legacy props.type payloads', async () => {
      const items = [
        {
          content: { headline: 'Hero' },
          props: {
            type: ComponentType.HeroMinimal,
          },
        } as any,
      ]

      mockFactory.hasComponent.mockReturnValue(true)

      const result = await api.batchCreateComponents(items, { validateBeforeImport: true })

      expect(result.errors[0].error).toBe('Batch import item props must not include type; use top-level type')
    })

    it('should validate pricing components require plans', async () => {
      const items = [
        {
          type: ComponentType.PricingTable,
          content: { plans: [] }, // Empty plans array
          props: { settings: {} }
        }
      ]

      mockFactory.hasComponent.mockReturnValue(true)

      const result = await api.batchCreateComponents(items, { validateBeforeImport: true })

      expect(result.errors[0].error).toContain('Pricing components require at least one plan')
    })

    it('should validate form components require fields', async () => {
      const items = [
        {
          type: ComponentType.ContactForm,
          content: { fields: [] }, // Empty fields array
          props: { settings: {} }
        }
      ]

      mockFactory.hasComponent.mockReturnValue(true)

      const result = await api.batchCreateComponents(items, { validateBeforeImport: true })

      expect(result.errors[0].error).toContain('Form components require at least one field')
    })

    it('should validate data table requires headers and rows', async () => {
      const items = [
        {
          type: ComponentType.DataTable,
          content: { headers: [] }, // Missing rows
          props: { settings: {} }
        }
      ]

      mockFactory.hasComponent.mockReturnValue(true)

      const result = await api.batchCreateComponents(items, { validateBeforeImport: true })

      expect(result.errors[0].error).toContain('Data table requires headers and rows')
    })

    it('should validate blog post components require body content', async () => {
      const items = [
        {
          type: ComponentType.BlogPost,
          content: {}, // Missing body
          props: { settings: {} }
        }
      ]

      mockFactory.hasComponent.mockReturnValue(true)

      const result = await api.batchCreateComponents(items, { validateBeforeImport: true })

      expect(result.errors[0].error).toContain('Blog posts require rich body content')
    })
  })

  describe('Performance', () => {
    it('should complete batch import within reasonable time', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        type: ComponentType.HeroMinimal,
        content: { headline: `Hero ${i}` },
        props: { settings: {} }
      }))

      mockFactory.hasComponent.mockReturnValue(true)

      const startTime = Date.now()
      const result = await api.batchCreateComponents(items)
      const endTime = Date.now()

      expect(result.duration).toBeLessThan(1000) // Should complete within 1 second
      expect(endTime - startTime).toBeLessThan(1000)
    })
  })
})
