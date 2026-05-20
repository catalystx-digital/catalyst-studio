import { UnifiedContentTransformer, TransformationError } from '../../transformers/unified-content-transformer';
import { UnifiedContent } from '@/lib/services/export/content-orchestrator';
import { RelationshipManager } from '../../managers/relationship-manager';
import { DependencyResolver } from '../../utils/dependency-resolver';

describe('UnifiedContentTransformer', () => {
  let transformer: UnifiedContentTransformer;
  let mockRelationshipManager: jest.Mocked<RelationshipManager>;
  let mockDependencyResolver: jest.Mocked<DependencyResolver>;

  beforeEach(() => {
    mockRelationshipManager = {
      buildRelationshipsFromUnified: jest.fn(),
      validateRelationships: jest.fn(),
      getDependencyOrder: jest.fn(),
      updateContentIdMapping: jest.fn(),
      clearCaches: jest.fn(),
    } as any;

    mockDependencyResolver = {
      createDependencyGraph: jest.fn(),
      getCreationOrder: jest.fn(),
      getBatchedCreationOrder: jest.fn(),
    } as any;

    transformer = new UnifiedContentTransformer(mockRelationshipManager, mockDependencyResolver);
  });

  afterEach(() => {
    transformer.clear();
    jest.clearAllMocks();
  });

  describe('Block Classification (AC: 1, 2)', () => {
    describe('Explicit Scope Classification', () => {
      it('should classify content with global scope metadata as global', () => {
        const content: UnifiedContent = createTestContent({
          metadata: { scope: 'global' }
        });

        const result = transformer.applyBlockClassification(content);

        expect(result).toBe('global');
      });

      it('should classify content with local scope metadata as local', () => {
        const content: UnifiedContent = createTestContent({
          metadata: { scope: 'local' }
        });

        const result = transformer.applyBlockClassification(content);

        expect(result).toBe('local');
      });

      it('should classify content with inline scope metadata as inline', () => {
        const content: UnifiedContent = createTestContent({
          metadata: { scope: 'inline' }
        });

        const result = transformer.applyBlockClassification(content);

        expect(result).toBe('inline');
      });
    });

    describe('Folder Path Classification', () => {
      it('should classify content in /ForAllSites/ as global', () => {
        const content: UnifiedContent = createTestContent({
          metadata: { folderPath: '/ForAllSites/Blocks' }
        });

        const result = transformer.applyBlockClassification(content);

        expect(result).toBe('global');
      });

      it('should not classify content in other folder paths as global', () => {
        const content: UnifiedContent = createTestContent({
          metadata: { folderPath: '/Sites/MySite/Blocks' }
        });

        const result = transformer.applyBlockClassification(content);

        expect(result).not.toBe('global');
      });
    });

    describe('Usage Pattern Classification', () => {
      it('should classify multi-site content as global', () => {
        const content: UnifiedContent = createTestContent({
          metadata: {
            usageCount: 3,
            usageSites: ['site1', 'site2', 'site3']
          }
        });

        const result = transformer.applyBlockClassification(content);

        expect(result).toBe('global');
      });

      it('should classify single site content as local', () => {
        const content: UnifiedContent = createTestContent({
          metadata: {
            siteId: 'site1',
            usageCount: 1
          }
        });

        const result = transformer.applyBlockClassification(content);

        expect(result).toBe('local');
      });
    });

    describe('Content Type Classification', () => {
      it('should classify hero content as local', () => {
        const content: UnifiedContent = createTestContent({
          contentTypeId: 'hero-banner'
        });

        const result = transformer.applyBlockClassification(content);

        expect(result).toBe('local');
      });

      it('should classify navigation content as global', () => {
        const content: UnifiedContent = createTestContent({
          contentTypeId: 'navigation-menu'
        });

        const result = transformer.applyBlockClassification(content);

        expect(result).toBe('global');
      });

      it('should classify footer content as global', () => {
        const content: UnifiedContent = createTestContent({
          contentTypeId: 'footer-content'
        });

        const result = transformer.applyBlockClassification(content);

        expect(result).toBe('global');
      });
    });

    describe('Default Classification', () => {
      it('should default to local for ambiguous content', () => {
        const content: UnifiedContent = createTestContent({
          contentTypeId: 'unknown-type'
        });

        const result = transformer.applyBlockClassification(content);

        expect(result).toBe('local');
      });
    });
  });

  describe('Source Type Mapping (AC: 3)', () => {
    describe('WebsitePage Source', () => {
      it('should correctly map WebsitePage source type', () => {
        const content: UnifiedContent = createTestContent({
          source: 'WebsitePage'
        });

        const result = transformer.mapSourceType(content.source);

        expect(result).toEqual({
          sourceType: 'page',
          isPageContent: true,
          hasUrl: true
        });
      });
    });

    describe('WebsiteCustomContentData Source', () => {
      it('should correctly map WebsiteCustomContentData source type', () => {
        const content: UnifiedContent = createTestContent({
          source: 'WebsiteCustomContentData'
        });

        const result = transformer.mapSourceType(content.source);

        expect(result).toEqual({
          sourceType: 'data',
          isPageContent: false,
          hasUrl: false
        });
      });
    });
  });

  describe('Content Transformation (AC: 1)', () => {
    it('should transform UnifiedContent to Optimizely format with correct structure', async () => {
      const content: UnifiedContent = createTestContent({
        id: 'test-content-1',
        title: 'Test Content',
        contentTypeId: 'test-type',
        content: { text: 'Sample content' },
        metadata: { scope: 'local' },
        status: 'published'
      });

      const result = await transformer.transformToOptimizely(content);

      expect(result).toMatchObject({
        contentGuid: 'guid-test-content-1',
        contentTypeGuid: 'contenttype-test-type',
        name: 'Test Content',
        urlSegment: 'test-content',
        language: 'en',
        properties: {
          text: 'Sample content'
        },
        status: 'Published',
        blockType: 'local',
        sourceType: 'page',
        isPageContent: true,
        hasUrl: true
      });
      expect(typeof result.properties.metadata).toBe('string');
      expect(JSON.parse(result.properties.metadata as string)).toMatchObject({ scope: 'local' });
    });

    it('should preserve metadata during transformation', async () => {
      const content: UnifiedContent = createTestContent({
        metadata: {
          customField: 'customValue',
          originalSource: 'migration'
        }
      });

      const result = await transformer.transformToOptimizely(content);

      expect(typeof result.properties.metadata).toBe('string');
      expect(JSON.parse(result.properties.metadata as string)).toMatchObject({
        customField: 'customValue',
        originalSource: 'migration'
      });
    });

    it('should handle content without metadata gracefully', async () => {
      const content: UnifiedContent = createTestContent({
        metadata: undefined
      });

      const result = await transformer.transformToOptimizely(content);

      expect(result).toBeDefined();
      expect(result.blockType).toBe('local'); // Default classification
    });
  });

  describe('API Sequencing (AC: 4, 5, 6)', () => {
    beforeEach(() => {
      const mockGraph = {
        nodes: new Map(),
        levels: [[]],
        hasCycles: false,
        cycleBreakers: []
      };
      
      mockDependencyResolver.createDependencyGraph.mockReturnValue(mockGraph);
    });

    it('should order content with folders first', () => {
      const contents: UnifiedContent[] = [
        createTestContent({ id: 'page-1', type: 'page' }),
        createTestContent({ id: 'folder-1', type: 'folder' }),
        createTestContent({ id: 'data-1', type: 'data' })
      ];

      const ordered = transformer.applyAPISequencing(contents);

      expect(ordered[0].type).toBe('folder');
    });

    it('should maintain parent-before-child ordering', () => {
      const parent = createTestContent({ id: 'parent', type: 'page' });
      const child = createTestContent({ id: 'child', type: 'page', parentId: 'parent' });
      
      mockDependencyResolver.getCreationOrder.mockReturnValue([parent, child]);

      const ordered = transformer.applyAPISequencing([child, parent]);

      const parentIndex = ordered.findIndex(c => c.id === 'parent');
      const childIndex = ordered.findIndex(c => c.id === 'child');
      
      expect(parentIndex).toBeLessThan(childIndex);
    });

    it('should use fallback sorting when dependency resolution fails', () => {
      mockDependencyResolver.createDependencyGraph.mockImplementation(() => {
        throw new Error('Dependency resolution failed');
      });

      const contents: UnifiedContent[] = [
        createTestContent({ id: 'page-1', type: 'page' }),
        createTestContent({ id: 'folder-1', type: 'folder' }),
        createTestContent({ id: 'data-1', type: 'data' })
      ];

      const ordered = transformer.applyAPISequencing(contents);

      // Should still work with basic sorting
      expect(ordered).toHaveLength(3);
      expect(ordered[0].type).toBe('folder');
    });
  });

  describe('Batch Processing (AC: 4)', () => {
    it('should process batch with proper sequencing', async () => {
      const contents: UnifiedContent[] = [
        createTestContent({ id: 'content-1' }),
        createTestContent({ id: 'content-2' }),
        createTestContent({ id: 'content-3' })
      ];

      mockDependencyResolver.getCreationOrder.mockReturnValue(contents);
      
      const mockGraph = {
        nodes: new Map(),
        levels: [contents.map(c => ({ id: c.id, content: c, dependencies: [], dependents: [], level: 0 }))],
        hasCycles: false,
        cycleBreakers: []
      };
      mockDependencyResolver.createDependencyGraph.mockReturnValue(mockGraph);

      const result = await transformer.transformBatch(contents);

      expect(result.metadata.totalProcessed).toBe(3);
      expect(result.metadata.successful).toBe(3);
      expect(result.metadata.failed).toBe(0);
      expect(result.transformed).toHaveLength(3);
    });

    it('should handle individual transformation errors gracefully', async () => {
      const contents: UnifiedContent[] = [
        createTestContent({ id: 'valid-content' }),
        createTestContent({ id: 'invalid-content', contentTypeId: '' }) // Invalid content
      ];

      mockDependencyResolver.getCreationOrder.mockReturnValue(contents);
      
      const mockGraph = {
        nodes: new Map(),
        levels: [contents.map(c => ({ id: c.id, content: c, dependencies: [], dependents: [], level: 0 }))],
        hasCycles: false,
        cycleBreakers: []
      };
      mockDependencyResolver.createDependencyGraph.mockReturnValue(mockGraph);

      const result = await transformer.transformBatch(contents);

      expect(result.metadata.totalProcessed).toBe(2);
      expect(result.metadata.successful).toBe(1);
      expect(result.metadata.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should track content ID mappings during batch processing', async () => {
      const contents: UnifiedContent[] = [
        createTestContent({ id: 'content-1' })
      ];

      mockDependencyResolver.getCreationOrder.mockReturnValue(contents);
      
      const mockGraph = {
        nodes: new Map(),
        levels: [contents.map(c => ({ id: c.id, content: c, dependencies: [], dependents: [], level: 0 }))],
        hasCycles: false,
        cycleBreakers: []
      };
      mockDependencyResolver.createDependencyGraph.mockReturnValue(mockGraph);

      await transformer.transformBatch(contents);

      expect(mockRelationshipManager.updateContentIdMapping).toHaveBeenCalledWith(
        'content-1',
        'guid-content-1'
      );
    });
  });

  describe('Error Handling', () => {
    it('should create TransformationError with correct properties', () => {
      const originalError = new Error('Original error');
      const transformError = new TransformationError('Transform failed', 'content-1', originalError);

      expect(transformError.name).toBe('TransformationError');
      expect(transformError.message).toBe('Transform failed');
      expect(transformError.contentId).toBe('content-1');
      expect(transformError.cause).toBe(originalError);
    });

    it('should handle transformation errors in batch processing', async () => {
      const contents: UnifiedContent[] = [
        createTestContent({ id: 'content-1' })
      ];

      mockDependencyResolver.getCreationOrder.mockReturnValue(contents);
      
      const mockGraph = {
        nodes: new Map(),
        levels: [[]],
        hasCycles: false,
        cycleBreakers: []
      };
      mockDependencyResolver.createDependencyGraph.mockReturnValue(mockGraph);

      // Mock a transformation error
      jest.spyOn(transformer, 'transformToOptimizely').mockRejectedValue(
        new Error('Transformation failed')
      );

      const result = await transformer.transformBatch(contents);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(TransformationError);
      expect(result.metadata.failed).toBe(1);
    });
  });

  describe('Folder Path Determination', () => {
    it('should use explicit folder path when provided', async () => {
      const content: UnifiedContent = createTestContent({
        metadata: { folderPath: '/Custom/Path' }
      });

      const result = await transformer.transformToOptimizely(content);

      expect(result.folderPath).toBe('/Custom/Path');
    });

    it('should generate global folder path for global blocks', async () => {
      const content: UnifiedContent = createTestContent({
        metadata: { scope: 'global' },
        contentTypeId: 'hero'
      });

      const result = await transformer.transformToOptimizely(content);

      expect(result.folderPath).toBe('/ForAllSites/Heroes');
    });

    it('should generate local folder path for local blocks', async () => {
      const content: UnifiedContent = createTestContent({
        metadata: { siteId: 'testsite' },
        contentTypeId: 'hero'
      });

      const result = await transformer.transformToOptimizely(content);

      expect(result.folderPath).toBe('/Sites/testsite/Heroes');
    });

    it('should return null folder path for inline blocks', async () => {
      const content: UnifiedContent = createTestContent({
        metadata: { scope: 'inline' }
      });

      const result = await transformer.transformToOptimizely(content);

      expect(result.folderPath).toBeNull();
    });
  });

  describe('Statistics and State Management', () => {
    it('should provide transformation statistics', async () => {
      const content = createTestContent({ id: 'test-1' });
      await transformer.transformToOptimizely(content);

      const stats = transformer.getStatistics();

      expect(stats.totalMappings).toBe(1);
      expect(stats.mappings).toHaveProperty('test-1', 'guid-test-1');
    });

    it('should clear internal state', async () => {
      const content = createTestContent({ id: 'test-1' });
      await transformer.transformToOptimizely(content);

      transformer.clear();

      const stats = transformer.getStatistics();
      expect(stats.totalMappings).toBe(0);
      expect(mockRelationshipManager.clearCaches).toHaveBeenCalled();
    });
  });

  describe('Performance Requirements', () => {
    it('should process large batches within performance limits', async () => {
      const contents: UnifiedContent[] = Array.from({ length: 1000 }, (_, i) =>
        createTestContent({ id: `content-${i}` })
      );

      mockDependencyResolver.getCreationOrder.mockReturnValue(contents);
      
      const mockGraph = {
        nodes: new Map(),
        levels: [contents.map(c => ({ id: c.id, content: c, dependencies: [], dependents: [], level: 0 }))],
        hasCycles: false,
        cycleBreakers: []
      };
      mockDependencyResolver.createDependencyGraph.mockReturnValue(mockGraph);

      const startTime = Date.now();
      const result = await transformer.transformBatch(contents);
      const duration = Date.now() - startTime;

      // Should process 1000 items in under 10 seconds (per story requirements)
      expect(duration).toBeLessThan(10000);
      expect(result.metadata.successful).toBe(1000);
    });
  });
});

// Helper function to create test content
function createTestContent(overrides: Partial<UnifiedContent> = {}): UnifiedContent {
  return {
    id: 'test-id',
    source: 'WebsitePage',
    type: 'page',
    title: 'Test Content',
    contentTypeId: 'test-type',
    content: {},
    status: 'published',
    ...overrides
  };
}