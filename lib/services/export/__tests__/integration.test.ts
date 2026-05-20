/**
 * Integration tests for Enhanced Export Service
 */

import { BundleExporter } from '../bundle-exporter'
import { ICMSProvider } from '@/lib/cms-export/types'

// Mock provider for testing
class MockProvider implements ICMSProvider {
  id = 'test-provider'
  name = 'Test Provider'
  version = '1.0.0'
  
  // Track calls for verification
  calls = {
    createContentType: 0,
    updateContentType: 0,
    createContentItem: 0,
    updateContentItem: 0,
    errors: [] as any[]
  }
  
  // Control behavior
  shouldFail = false
  failureType: 'network' | 'validation' | 'provider' = 'network'
  
  getContentTypes = jest.fn().mockResolvedValue([])
  getContentType = jest.fn().mockResolvedValue(null)
  
  createContentType = jest.fn().mockImplementation(async (type) => {
    if (this.shouldFail) {
      this.calls.errors.push({ method: 'createContentType', type: this.failureType })
      throw new Error(`${this.failureType} error in createContentType`)
    }
    this.calls.createContentType++
    return type
  })
  
  updateContentType = jest.fn().mockImplementation(async (id, type) => {
    if (this.shouldFail) {
      this.calls.errors.push({ method: 'updateContentType', type: this.failureType })
      throw new Error(`${this.failureType} error in updateContentType`)
    }
    this.calls.updateContentType++
    return type
  })
  
  deleteContentType = jest.fn().mockResolvedValue(true)
  
  getContentItems = jest.fn().mockResolvedValue([])
  getContentItem = jest.fn().mockResolvedValue(null)
  
  syncUnifiedBundle = jest.fn().mockImplementation(async () => {
    if (this.shouldFail) {
      this.calls.errors.push({ method: 'syncUnifiedBundle', type: this.failureType })
      throw new Error(`${this.failureType} error in syncUnifiedBundle`)
    }
    return {
      successCount: 0,
      failureCount: 0,
      details: []
    }
  })
  
  mapFromUniversal = jest.fn().mockImplementation((data) => data)
  mapToUniversal = jest.fn().mockImplementation((data) => data)
  
  setDryRun = jest.fn()
  isDryRun = jest.fn().mockReturnValue(false)
  
  reset() {
    this.calls = {
      createContentType: 0,
      updateContentType: 0,
      createContentItem: 0,
      updateContentItem: 0,
      errors: []
    }
    this.shouldFail = false
    this.failureType = 'network'
    jest.clearAllMocks()
  }
}

// Mock data generators
const createMockWebsite = (id = 'test-website') => ({
  id,
  name: 'Test Website',
  domain: 'test.com',
  createdAt: new Date(),
  updatedAt: new Date()
})

const createMockContentType = (id = 'test-type', websiteId = 'test-website') => ({
  id,
  websiteId,
  name: 'Test Type',
  key: 'test_type',
  category: 'content',
  fields: []
})

const createMockContentItem = (id = 'test-item', typeId = 'test-type') => ({
  id,
  contentTypeId: typeId,
  title: 'Test Item',
  slug: 'test-item',
  content: { text: 'Test content' },
  metadata: {}
})

describe('BundleExporter Integration', () => {
  let mockProvider: MockProvider
  let exportService: BundleExporter

  beforeEach(() => {
    mockProvider = new MockProvider()
    exportService = new BundleExporter(mockProvider)
  })
  
  afterEach(() => {
    mockProvider.reset()
  })
  
  describe('Export and Sync Workflow', () => {
    it('should use BundleExporter directly without feature flags', async () => {
      // This test verifies feature flags are no longer needed
      const websiteId = 'test-website'
      
      // Mock database data
      const mockWebsite = createMockWebsite(websiteId)
      const mockContentType = createMockContentType('type-1', websiteId)
      const mockContentItem = createMockContentItem('item-1', 'type-1')
      
      // Execute export without any feature flag checks
      const result = await exportService.export(websiteId, {
        includeComponents: true,
        includeFolders: true,
        includeContentItems: true
      })
      
      // Verify the export happened
      expect(result).toBeDefined()
      expect(result.exportData).toBeDefined()
    })
    
    it('should handle provider sync operations', async () => {
      const websiteId = 'test-website'
      
      // Execute with mock provider
      const result = await exportService.export(websiteId, {
        includeContentItems: true
      })
      
      // Verify provider bundle sync was invoked
      expect(mockProvider.syncUnifiedBundle).toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      mockProvider.shouldFail = true
      mockProvider.failureType = 'network'
      
      const websiteId = 'test-website'
      
      await expect(
        exportService.export(websiteId, {
          includeContentItems: true
        })
      ).rejects.toThrow('syncUnifiedBundle')
    })
  })
  
  describe('Export Options', () => {
    it('should respect includeContentItems option', async () => {
      const websiteId = 'test-website'
      
      // Export without content items
      const result = await exportService.export(websiteId, {
        includeContentItems: false
      })

      expect(result.exportData.contentItems).toHaveLength(0)
    })

    it('should include content items when option is true', async () => {
      const websiteId = 'test-website'
      
      // Export with content items
      const result = await exportService.export(websiteId, {
        includeContentItems: true
      })
      
      // Content items should be included
      expect(result.exportData).toBeDefined()
      expect(Array.isArray(result.exportData.contentItems)).toBe(true)
    })
  })
})
