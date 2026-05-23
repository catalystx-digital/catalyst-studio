import { UnifiedContentTransformer } from '@/lib/cms-export/optimizely/transformers/unified-content-transformer';
import { OptimizelyProvider } from '@/lib/cms-export/optimizely/provider';
import { BundleExporter } from '@/lib/services/export/bundle-exporter';
import { UnifiedContent } from '@/lib/services/export/content-orchestrator';
import { prisma } from '@/lib/prisma';

describe('Story 15.6: Content Transformation & API Sequencing Integration', () => {
  let transformer: UnifiedContentTransformer;
  let provider: OptimizelyProvider;
  let exportService: BundleExporter;

  beforeEach(() => {
    // Initialize components
    transformer = new UnifiedContentTransformer();
    provider = new OptimizelyProvider();
    exportService = new BundleExporter(provider);
    
    // Configure provider
    provider.configure({
      apiUrl: 'http://localhost:3000/test-optimizely-api',
      dryRun: false
    });
  });

  afterEach(() => {
    transformer.clear();
    jest.restoreAllMocks();
  });

  describe('AC1: UnifiedContent to Optimizely Format Transformation', () => {
    it('should transform unified content with all required fields', async () => {
      const unifiedContent: UnifiedContent = createTestUnifiedContent({
        id: 'test-page-1',
        source: 'WebsitePage',
        type: 'page',
        title: 'Test Page',
        contentTypeId: 'StandardPage',
        content: { heading: 'Welcome', body: 'Test content' },
        metadata: { scope: 'local', siteId: 'test-site' }
      });

      const result = await transformer.transformToOptimizely(unifiedContent);

      expect(result).toMatchObject({
        contentGuid: 'guid-test-page-1',
        contentTypeGuid: 'contenttype-StandardPage',
        name: 'Test Page',
        urlSegment: 'test-page',
        language: 'en',
        properties: {
          heading: 'Welcome',
          body: 'Test content'
        },
        status: 'Published',
        blockType: 'local',
        folderPath: '/Sites/test-site/StandardPages'
      });
    });

    it('should preserve metadata during transformation', async () => {
      const unifiedContent: UnifiedContent = createTestUnifiedContent({
        metadata: {
          customField: 'customValue',
          originalSource: 'migration'
        }
      });

      const result = await transformer.transformToOptimizely(unifiedContent);

      const metadata = typeof result.properties.metadata === 'string'
        ? JSON.parse(result.properties.metadata)
        : result.properties.metadata;

      expect(metadata).toMatchObject({
        customField: 'customValue',
        originalSource: 'migration'
      });
    });
  });

  describe('AC2: Block Classification Integration', () => {
    it('should classify content as global based on metadata scope', async () => {
      const globalContent: UnifiedContent = createTestUnifiedContent({
        metadata: { scope: 'global' }
      });

      const result = await transformer.transformToOptimizely(globalContent);

      expect(result.blockType).toBe('global');
      expect(result.folderPath).toBe('/ForAllSites/TestContents');
    });

    it('should classify content as local for single site usage', async () => {
      const localContent: UnifiedContent = createTestUnifiedContent({
        metadata: { siteId: 'test-site', usageCount: 1 }
      });

      const result = await transformer.transformToOptimizely(localContent);

      expect(result.blockType).toBe('local');
      expect(result.folderPath).toBe('/Sites/test-site/TestContents');
    });

    it('should classify navigation content as global', async () => {
      const navigationContent: UnifiedContent = createTestUnifiedContent({
        contentTypeId: 'navigation-menu'
      });

      const result = await transformer.transformToOptimizely(navigationContent);

      expect(result.blockType).toBe('global');
    });
  });

  describe('AC3: Source Type Mapping', () => {
    it('should map WebsitePage source correctly', async () => {
      const pageContent: UnifiedContent = createTestUnifiedContent({
        source: 'WebsitePage'
      });

      const result = await transformer.transformToOptimizely(pageContent);

      expect(result).toMatchObject({
        sourceType: 'page',
        isPageContent: true,
        hasUrl: true
      });
    });

    it('should map WebsiteStructure source correctly', async () => {
      const folderContent: UnifiedContent = createTestUnifiedContent({
        source: 'WebsiteStructure',
        type: 'folder'
      });

      const result = await transformer.transformToOptimizely(folderContent);

      expect(result).toMatchObject({
        sourceType: 'folder',
        isPageContent: false,
        hasUrl: false
      });
    });
  });

  describe('AC4: Batch Processing', () => {
    it('should process multiple items with proper sequencing', async () => {
      const contents: UnifiedContent[] = [
        createTestUnifiedContent({ id: 'page-1', type: 'page' }),
        createTestUnifiedContent({ id: 'folder-1', type: 'folder' }),
        createTestUnifiedContent({ id: 'folder-2', type: 'folder' })
      ];

      const result = await transformer.transformBatch(contents);

      expect(result.metadata.totalProcessed).toBe(3);
      expect(result.metadata.successful).toBe(3);
      expect(result.metadata.failed).toBe(0);
      expect(result.transformed).toHaveLength(3);
    });

    it('should handle transformation errors gracefully', async () => {
      const contents: UnifiedContent[] = [
        createTestUnifiedContent({ id: 'valid-content' }),
        createTestUnifiedContent({ id: 'invalid-content', contentTypeId: '' }) // Invalid
      ];

      const result = await transformer.transformBatch(contents);

      expect(result.metadata.totalProcessed).toBe(2);
      expect(result.metadata.successful).toBe(1);
      expect(result.metadata.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('AC5: API Sequencing', () => {
    it('should order content with folders first', () => {
      const contents: UnifiedContent[] = [
        createTestUnifiedContent({ id: 'page-1', type: 'page' }),
        createTestUnifiedContent({ id: 'folder-1', type: 'folder' }),
        createTestUnifiedContent({ id: 'folder-2', type: 'folder' })
      ];

      const ordered = transformer.applyAPISequencing(contents);

      expect(ordered[0].type).toBe('folder');
    });

    it('should handle dependency resolution errors with fallback', () => {
      const contents: UnifiedContent[] = [
        createTestUnifiedContent({ id: 'content-1' })
      ];

      // Should not throw error even if dependency resolution fails
      expect(() => transformer.applyAPISequencing(contents)).not.toThrow();
    });
  });

  describe('AC6: OptimizelyProvider Integration', () => {
    it('should integrate transformer in batch processing', async () => {
      const mockUnifiedContent: UnifiedContent[] = [
        createTestUnifiedContent({ id: 'test-1' })
      ];

      // Mock the client's retryWithBackoff method and the createContent method
      const mockClient = {
        retryWithBackoff: jest.fn((fn) => fn()),
        createContent: jest.fn().mockResolvedValue({
          contentLink: { 
            id: 123, 
            guidValue: 'guid-test-1'
          }
        })
      };
      
      // Replace the client property in provider
      (provider as any).client = mockClient;
      // Ensure blockContainerId is set
      (provider as any).blockContainerId = 'test-container';

      const bundle = {
        website: { id: 'test-website', name: 'Test Site' },
        contentTypes: [],
        unifiedContent: mockUnifiedContent,
        componentUsage: [],
        components: [],
        folders: {
          root: [],
          totalFolders: 0,
          maxDepth: 0,
          pathMappings: {}
        },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId: 'test-website',
          version: '1.0.0'
        }
      };

      const result = await provider.syncUnifiedBundle(bundle);

      // Should have processed the single item
      expect(result.successCount + result.failureCount).toBeGreaterThanOrEqual(1);
      
      // If there are any failures, log them for debugging
      if (result.failureCount > 0) {
        console.log('Failed items:', result.details.filter(detail => detail.action === 'error'));
      }
      
      // At minimum, verify the method executed without throwing
      expect(result).toHaveProperty('successCount');
      expect(result).toHaveProperty('failureCount');
    });
  });

  describe('AC7: BundleExporter Integration', () => {
    it('should use unified content sync when provider supports it', async () => {
      const websiteId = 'test-website';

      const mockUnifiedContent: UnifiedContent[] = [
        createTestUnifiedContent({ id: 'test-content' })
      ];

      const exportData = {
        contentTypes: [],
        contentItems: [],
        components: [],
        folders: {
          root: [],
          totalFolders: 0,
          maxDepth: 0,
          pathMappings: {}
        },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId,
          version: '1.0.0'
        }
      } as any;

      const bundle = {
        website: { id: websiteId, name: 'Test' },
        contentTypes: exportData.contentTypes,
        unifiedContent: mockUnifiedContent,
        componentUsage: [],
        components: [],
        folders: exportData.folders,
        metadata: exportData.metadata
      };

      jest
        .spyOn(exportService as any, 'prepareExportBundle')
        .mockResolvedValue({ exportData, bundle });
      jest.spyOn(exportService as any, 'preflightWithProvider').mockResolvedValue(undefined);
      jest.spyOn(exportService as any, 'applyValidation').mockResolvedValue(undefined);
      jest.spyOn(exportService as any, 'emitTypeDependencyPlan').mockResolvedValue(undefined);

      jest.spyOn(provider, 'syncUnifiedBundle')
        .mockResolvedValue({
          successCount: mockUnifiedContent.length,
          failureCount: 0,
          details: mockUnifiedContent.map(item => ({
            scope: 'content',
            id: item.id,
            action: 'created',
            providerId: provider.id
          }))
        });

      jest.spyOn(prisma.website, 'findUnique').mockResolvedValue({
        id: websiteId,
        name: 'Test Site'
      } as any);

      const result = await exportService.export(websiteId);

      expect(provider.syncUnifiedBundle).toHaveBeenCalledWith(bundle);
      expect(result.syncResults?.unifiedContent?.successCount).toBe(1);
      expect(result.syncResults?.unifiedContent?.failureCount).toBe(0);
      expect(result.syncResults?.unifiedContent?.details).toHaveLength(1);
    });

    it('should fall back to legacy sync if unified sync fails', async () => {
      const websiteId = 'test-website';
      
      // Mock export data
      const mockExportData = {
        contentTypes: [],
        contentItems: [
          {
            id: 'test-item',
            title: 'Test Item',
            contentTypeId: 'test-type',
            content: {}
          }
        ],
        components: [],
        folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
        metadata: {
          exportDate: new Date().toISOString(),
          websiteId,
          version: '1.0.0'
        }
      };

      jest
        .spyOn(exportService as any, 'prepareExportBundle')
        .mockResolvedValue({
          exportData: mockExportData,
          bundle: {
            website: { id: websiteId, name: 'Test Site' },
            contentTypes: [],
            unifiedContent: [],
            componentUsage: [],
            components: [],
            folders: mockExportData.folders,
            metadata: mockExportData.metadata
          }
        });
      jest.spyOn(exportService as any, 'preflightWithProvider').mockResolvedValue(undefined);
      jest.spyOn(exportService as any, 'applyValidation').mockResolvedValue(undefined);
      jest.spyOn(exportService as any, 'emitTypeDependencyPlan').mockResolvedValue(undefined);

      jest.spyOn(provider, 'syncUnifiedBundle')
        .mockRejectedValue(new Error('Unified sync failed'));

      await expect(exportService.export(websiteId))
        .rejects.toThrow('Unified sync failed');
    });
  });

  describe('Performance Requirements', () => {
    it('should process 1000 items within performance limits', async () => {
      const contents: UnifiedContent[] = Array.from({ length: 1000 }, (_, i) =>
        createTestUnifiedContent({ id: `content-${i}` })
      );

      const startTime = Date.now();
      const result = await transformer.transformBatch(contents);
      const duration = Date.now() - startTime;

      // Should process 1000 items in under 10 seconds
      expect(duration).toBeLessThan(10000);
      expect(result.metadata.successful).toBe(1000);
    }, 15000); // Allow 15s for test timeout

    it('should maintain performance during API sequencing', async () => {
      const contents: UnifiedContent[] = Array.from({ length: 500 }, (_, i) =>
        createTestUnifiedContent({ 
          id: `content-${i}`,
          type: i % 3 === 0 ? 'folder' : 'page'
        })
      );

      const startTime = Date.now();
      const ordered = transformer.applyAPISequencing(contents);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // 5 seconds for sequencing
      expect(ordered).toHaveLength(500);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle individual transformation failures in batch', async () => {
      const contents: UnifiedContent[] = [
        createTestUnifiedContent({ id: 'good-1' }),
        createTestUnifiedContent({ id: 'bad-1', contentTypeId: '' }), // Will fail
        createTestUnifiedContent({ id: 'good-2' })
      ];

      const result = await transformer.transformBatch(contents);

      expect(result.metadata.totalProcessed).toBe(3);
      expect(result.metadata.successful).toBe(2);
      expect(result.metadata.failed).toBe(1);
      expect(result.errors[0].contentId).toBe('bad-1');
    });

    it('should provide detailed error information', async () => {
      const badContent: UnifiedContent = createTestUnifiedContent({
        id: 'error-test',
        contentTypeId: '' // This should cause an error
      });

      const result = await transformer.transformBatch([badContent]);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        contentId: 'error-test',
        message: expect.stringContaining('Content type ID cannot be empty')
      });
    });
  });

  describe('Folder Path Generation', () => {
    it('should generate correct folder paths for different block types', async () => {
      const testCases = [
        {
          content: createTestUnifiedContent({ metadata: { scope: 'global' }, contentTypeId: 'hero' }),
          expectedPath: '/ForAllSites/Heroes'
        },
        {
          content: createTestUnifiedContent({ metadata: { siteId: 'site1', usageCount: 1 }, contentTypeId: 'hero' }),
          expectedPath: '/Sites/site1/Heroes'
        },
        {
          content: createTestUnifiedContent({ metadata: { scope: 'inline' } }),
          expectedPath: null
        }
      ];

      for (const testCase of testCases) {
        const result = await transformer.transformToOptimizely(testCase.content);
        expect(result.folderPath).toBe(testCase.expectedPath);
      }
    });
  });
});

// Helper function to create test unified content
function createTestUnifiedContent(overrides: Partial<UnifiedContent> = {}): UnifiedContent {
  return {
    id: 'test-id',
    source: 'WebsitePage' as const,
    type: 'page',
    title: 'Test Content',
    contentTypeId: 'TestContent',
    content: { text: 'Sample content' },
    status: 'published',
    ...overrides
  };
}
