import { OptimizelyProvider } from '../provider';
import { OptimizelyClient } from '../client';
import { UniversalContentType, UniversalContentItem } from '../../types';
import { UnifiedContent } from '@/lib/services/export/content-orchestrator';
import { OptimizelyContentType } from '../types';

// Mock the client
jest.mock('../client');

describe('OptimizelyProvider', () => {
  let provider: OptimizelyProvider;
  let mockClient: jest.Mocked<OptimizelyClient>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create provider instance
    provider = new OptimizelyProvider();
    
    // Get the mocked client
    mockClient = (provider as any).client as jest.Mocked<OptimizelyClient>;
  });

// Removed: getContentTypes tests (not part of slim API)

  describe('getContentType', () => {
    it('should fetch and transform a single content type', async () => {
      const mockOptimizelyType: OptimizelyContentType = {
        key: 'TestType',
        displayName: 'Test Type',
        description: 'Test description',
        baseType: '_page',
        source: 'test',
        sortOrder: 100,
        mayContainTypes: [],
        properties: {}
      };

      mockClient.getContentType.mockResolvedValue(mockOptimizelyType);

      const result = await provider.getContentType('TestType');

      expect(mockClient.getContentType).toHaveBeenCalledWith('TestType');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('TestType');
      expect(result?.type).toBe('page');
    });

    it('should return null for non-existent content type', async () => {
      mockClient.getContentType.mockResolvedValue(null);

      const result = await provider.getContentType('NonExistent');

      expect(result).toBeNull();
    });
  });

  describe('createContentType', () => {
    it('should transform and create content type', async () => {
      const universalType: UniversalContentType = {
        version: '1.0',
        id: 'NewType',
        name: 'NewType',
        type: 'component',
        description: 'New type description',
        isRoutable: false,
        fields: [
          {
            id: 'field_title',
            name: 'title',
            layer: 'primitive',
            type: 'text',
            required: true,
            validations: []
          }
        ],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      const mockCreatedType: OptimizelyContentType = {
        key: 'NewType',
        displayName: 'NewType',
        description: 'New type description',
        baseType: '_component',
        source: 'catalyst-studio-sync',
        sortOrder: 100,
        mayContainTypes: [],
        properties: {
          title: {
            type: 'String',
            displayName: 'title',
            required: true
          }
        }
      };

      mockClient.createContentType.mockResolvedValue(mockCreatedType);

      const result = await provider.createContentType(universalType);

      expect(mockClient.createContentType).toHaveBeenCalled();
      expect(result.id).toBe('NewType');
    });
  });

  // Removed: validateContentType tests (not part of slim API)

  // Removed: capabilities tests (not part of slim API)

  // Removed: mapToUniversal/mapFromUniversal tests (internal only)

  describe('Enhanced Content Creation', () => {
    describe('Block Type Classification', () => {
      it('should classify global blocks correctly', () => {
        const item: UniversalContentItem = {
          id: 'test-1',
          contentTypeId: 'Block',
          title: 'Global Header',
          slug: 'global-header',
          content: {},
          metadata: {
            usageCount: 5,
            siteAgnostic: true
          },
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const classification = (provider as any).classifyBlockType(item);
        
        expect(classification.blockType).toBe('global');
        expect(classification.scope).toBe('all-sites');
        expect(classification.folderPath).toBe('/ForAllSites/Blocks/');
      });

      it('should classify inline blocks correctly', () => {
        const item: UniversalContentItem = {
          id: 'test-2',
          contentTypeId: 'Block',
          title: 'Inline Content',
          slug: 'inline-content',
          content: {},
          metadata: {
            contentAreaParent: true
          },
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const classification = (provider as any).classifyBlockType(item);
        
        expect(classification.blockType).toBe('inline');
        expect(classification.scope).toBe('page-specific');
      });
    });

    describe('Content Transformation', () => {
      it('should transform properties correctly', () => {
        const item: UniversalContentItem = {
          id: 'test-3',
          contentTypeId: 'Block',
          title: 'Test Content',
          slug: 'test-content',
          content: {
            title: 'Welcome',
            count: 42,
            isActive: true
          },
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const properties = (provider as any).transformProperties(item);
        
        expect(properties.title).toBe('Welcome');
        expect(properties.slug).toBe('test-content');
        expect(properties.count).toBe(42);
        expect(properties.isActive).toBe(true);
      });

      it('passes template metadata through unified transformation', async () => {
        const transformer = (provider as any).unifiedContentTransformer;
        const unified: UnifiedContent = {
          id: 'page-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Landing Page',
          contentTypeId: 'page',
          content: {},
          metadata: {},
          url: '/landing',
          parentId: null,
          components: [],
          publishedAt: null,
          status: 'draft',
          templateKey: 'marketing/home-default',
          templateProps: { primaryCallToAction: 'Get started' }
        };

        const result = await transformer.transformBatch([unified]);
        expect(result.transformed[0].properties.templateKey).toBe('marketing/home-default');
        expect(result.transformed[0].properties.templateProps).toEqual({ primaryCallToAction: 'Get started' });
      });
    });

    describe('Batch Processing', () => {
      it('should sort content by dependencies', () => {
        const items: UnifiedContent[] = [
          {
            id: 'folder-1',
            source: 'WebsiteStructure',
            type: 'folder',
            title: 'Folder',
            contentTypeId: 'Folder',
            content: {},
            status: 'draft',
            websiteId: 'site-1'
          } as any,
          {
            id: 'page-1',
            source: 'WebsitePage',
            type: 'page',
            title: 'Page',
            contentTypeId: 'Page',
            content: {},
            status: 'draft',
            websiteId: 'site-1',
            parentId: 'folder-1'
          } as any,
          {
            id: 'data-1',
            source: 'WebsitePage',
            type: 'page',
            title: 'Block',
            contentTypeId: 'Block',
            content: {},
            status: 'draft',
            websiteId: 'site-1',
            parentId: 'page-1'
          } as any
        ];

        const sorted: UnifiedContent[] = (provider as any).sortByDependencies(items);

        expect(sorted.map(item => item.id)).toEqual(['folder-1', 'page-1', 'data-1']);
      });
    });

    describe('Error Classification', () => {
      it('should classify errors correctly', () => {
        const authError = new Error('Authentication token expired');
        const authClass = (provider as any).classifyError(authError);
        expect(authClass.recoverable).toBe(true);
        expect(authClass.category).toBe('auth');

        const validationError = new Error('Validation failed');
        const valClass = (provider as any).classifyError(validationError);
        expect(valClass.recoverable).toBe(false);
        expect(valClass.category).toBe('validation');
      });
    });

  });

  describe('createOptimizelyContent naming', () => {
    it('uses Pascal-case names and display names for content requests', async () => {
      mockClient.retryWithBackoff.mockImplementation(async (fn: any) => fn());
      const captured: any[] = [];
      mockClient.createContent.mockImplementation(async payload => {
        captured.push(payload);
        return { contentLink: { guidValue: 'component-guid' } };
      });

      await (provider as any).createOptimizelyContent({
        name: 'Card Grid - shared-123',
        displayName: 'Card Grid',
        originalContentTypeId: 'card-grid',
        language: 'en',
        status: 'Draft',
        properties: {},
        container: (provider as any).blockContainerId
      });

      expect(mockClient.createContent).toHaveBeenCalledTimes(1);
      expect(captured[0]).toEqual(expect.objectContaining({
        name: 'Card Grid - shared-123',
        displayName: 'Card Grid',
        contentType: 'card_grid'
      }));
    });
  });

  describe('processBatchUnifiedContent', () => {
    it('ensures folder content type before creating placeholders', async () => {
      const transformSpy = jest
        .spyOn((provider as any).unifiedContentTransformer, 'transformBatch')
        .mockResolvedValue({
          transformed: [{
            contentGuid: 'guid-folder-ensure',
            contentTypeKey: 'tree_folder',
            originalContentTypeId: 'tree-folder',
            name: 'Folder Ensure',
            language: 'en',
            status: 'Draft',
            properties: {}
          }],
          errors: [],
          warnings: [],
          metadata: { totalProcessed: 1, totalErrors: 0, totalWarnings: 0, duration: 0 }
        } as any);
      const createSpy = jest
        .spyOn(provider as any, 'createOptimizelyContent')
        .mockResolvedValue({ contentLink: { guidValue: 'folder-guid' } });

      mockClient.getContentType.mockResolvedValueOnce(null);
      mockClient.createContentType.mockResolvedValueOnce({
        key: 'tree_folder',
        name: 'Folder',
        guid: 'tree-folder-guid',
        displayName: 'Folder',
        description: 'Catalyst Studio folder placeholder',
        baseType: '_page',
        source: 'catalyst-studio-sync',
        sortOrder: 50,
        mayContainTypes: [],
        properties: {}
      } as any);

      const folder: UnifiedContent = {
        id: 'folder-ensure',
        source: 'WebsiteStructure',
        type: 'folder',
        title: 'Folder Ensure',
        contentTypeId: 'tree-folder',
        content: {},
        metadata: { originalContentTypeId: 'tree-folder' },
        status: 'draft'
      } as any;

      try {
        await provider.processBatchUnifiedContent([folder]);

        expect(mockClient.getContentType).toHaveBeenCalledWith('tree_folder');
        expect(mockClient.createContentType).toHaveBeenCalledWith(expect.objectContaining({ key: 'tree_folder', baseType: '_page' }));
        expect(createSpy).toHaveBeenCalledTimes(1);
      } finally {
        transformSpy.mockRestore();
        createSpy.mockRestore();
      }
    });

    it('uses transformed folder payload when creating placeholders', async () => {
      const transformSpy = jest
        .spyOn((provider as any).unifiedContentTransformer, 'transformBatch')
        .mockResolvedValue({
          transformed: [
            {
              contentGuid: 'guid-folder-1',
              contentTypeKey: 'tree_folder',
              originalContentTypeId: 'tree-folder',
              name: 'Folder 1',
              language: 'en',
              status: 'Draft',
              properties: { foo: 'bar' }
            }
          ],
          errors: [],
          warnings: [],
          metadata: { totalProcessed: 1, totalErrors: 0, totalWarnings: 0, duration: 0 }
        } as any);
      const createSpy = jest
        .spyOn(provider as any, 'createOptimizelyContent')
        .mockResolvedValue({ contentLink: { guidValue: 'folder-guid' } });

      const folder: UnifiedContent = {
        id: 'folder-1',
        source: 'WebsiteStructure',
        type: 'folder',
        title: 'Folder 1',
        contentTypeId: 'tree-folder',
        content: {},
        metadata: {},
        status: 'draft'
      } as any;

      try {
        const result = await provider.processBatchUnifiedContent([folder]);

        expect(transformSpy).toHaveBeenCalled();
        expect(createSpy).toHaveBeenCalledTimes(1);

        const request = createSpy.mock.calls[0][0];
        expect(request.originalContentTypeId).toBe('tree-folder');
        expect(request.contentTypeKey).toBe('tree_folder');
        expect(request.properties).toEqual({ foo: 'bar' });
        expect(result.successful).toHaveLength(0);
      } finally {
        transformSpy.mockRestore();
        createSpy.mockRestore();
      }
    });

    it('formats shared and local component names via helpers', async () => {
      const transformSpy = jest
        .spyOn((provider as any).unifiedContentTransformer, 'transformBatch')
        .mockResolvedValue({
          transformed: [{
            contentGuid: 'guid-page-1',
            contentTypeKey: 'landing_page',
            originalContentTypeId: 'landing-page',
            name: 'Landing Page',
            language: 'en',
            status: 'Draft',
            properties: {}
          }],
          errors: [],
          warnings: [],
          metadata: { totalProcessed: 1, totalErrors: 0, totalWarnings: 0, duration: 0 }
        } as any);
      const createSpy = jest
        .spyOn(provider as any, 'createOptimizelyContent')
        .mockImplementation(async (req: any) => ({ contentLink: { guidValue: `guid-${(req && req.name) || 'unknown'}` } }));
      mockClient.getAssetsContainerId.mockResolvedValue('assets-container-1');

      const page: UnifiedContent = {
        id: 'page-1',
        source: 'WebsitePage',
        type: 'page',
        title: 'Landing Page',
        contentTypeId: 'landing-page',
        slug: 'landing-page',
        content: {},
        components: [
          { id: 'comp-1', type: 'card-grid', isShared: true, sharedId: 'shared-1', position: 0, properties: {} },
          { id: 'comp-2', type: 'card-grid', isShared: false, position: 1, properties: {} }
        ],
        metadata: {},
        status: 'draft'
      } as any;

      try {
        await provider.processBatchUnifiedContent([page]);

        const calls = createSpy.mock.calls.map(([arg]: any[]) => arg);
        const sharedCall = calls.find(call => call.originalContentTypeId === 'card-grid' && !call.owner);
        const localCall = calls.find(call => call.originalContentTypeId === 'card-grid' && call.owner);

        expect(sharedCall).toBeDefined();
        expect(sharedCall?.name).toBe('Card Grid - shared-1');
        expect(sharedCall?.displayName).toBe('Card Grid');

        expect(localCall).toBeDefined();
        expect(localCall?.name).toBe('Card Grid - page-1 - comp-2');
        expect(localCall?.displayName).toBe('Card Grid');
      } finally {
        transformSpy.mockRestore();
        createSpy.mockRestore();
      }
    });

    it('uses numeric Optimizely IDs for page hierarchy containers', async () => {
      const transformSpy = jest
        .spyOn((provider as any).unifiedContentTransformer, 'transformBatch')
        .mockResolvedValue({
          transformed: [
            {
              contentGuid: 'guid-parent',
              contentTypeKey: 'landing_page',
              originalContentTypeId: 'landing-page',
              name: 'Parent Page',
              language: 'en',
              status: 'Draft',
              properties: {}
            },
            {
              contentGuid: 'guid-child',
              contentTypeKey: 'landing_page',
              originalContentTypeId: 'landing-page',
              name: 'Child Page',
              language: 'en',
              status: 'Draft',
              properties: {}
            }
          ],
          errors: [],
          warnings: [],
          metadata: { totalProcessed: 2, totalErrors: 0, totalWarnings: 0, duration: 0 }
        } as any);
      const createSpy = jest
        .spyOn(provider as any, 'createOptimizelyContent')
        .mockImplementation(async (req: any) => {
          if (req.name === 'Parent Page') {
            return { contentLink: { id: 101, guidValue: 'parent-guid' } };
          }
          if (req.name === 'Child Page') {
            return { contentLink: { id: 202, guidValue: 'child-guid' } };
          }
          return { contentLink: { id: 999 } };
        });

      const parentPage: UnifiedContent = {
        id: 'parent',
        source: 'WebsitePage',
        type: 'page',
        title: 'Parent Page',
        contentTypeId: 'landing-page',
        content: {},
        metadata: {},
        components: [],
        url: '/parent',
        parentId: null,
        status: 'draft'
      } as any;

      const childPage: UnifiedContent = {
        id: 'child',
        source: 'WebsitePage',
        type: 'page',
        title: 'Child Page',
        contentTypeId: 'landing-page',
        content: {},
        metadata: {},
        components: [],
        url: '/parent/child',
        parentId: 'parent',
        status: 'draft'
      } as any;

      try {
        await provider.processBatchUnifiedContent([parentPage, childPage]);

        expect(createSpy).toHaveBeenCalledTimes(2);

        const childCall = createSpy.mock.calls.find(([arg]: any[]) => arg.name === 'Child Page');
        expect(childCall).toBeDefined();
        expect(childCall?.[0]?.container).toBe('cms://content/101');
      } finally {
        transformSpy.mockRestore();
        createSpy.mockRestore();
      }
    });

    it('creates folders and parent pages before dependent child pages', async () => {
      const folder: UnifiedContent = {
        id: 'folder-root',
        source: 'WebsiteStructure',
        type: 'folder',
        title: 'Folder Root',
        contentTypeId: 'tree-folder',
        content: {},
        metadata: { originalContentTypeId: 'tree-folder' },
        status: 'draft',
        websiteId: 'site-1'
      } as any;

      const parentPage: UnifiedContent = {
        id: 'page-parent',
        source: 'WebsitePage',
        type: 'page',
        title: 'Parent Page',
        contentTypeId: 'landing-page',
        content: {},
        status: 'draft',
        parentId: 'folder-root',
        websiteId: 'site-1',
        components: []
      } as any;

      const childPage: UnifiedContent = {
        id: 'page-child',
        source: 'WebsitePage',
        type: 'page',
        title: 'Child Page',
        contentTypeId: 'landing-page',
        content: {},
        status: 'draft',
        parentId: 'page-parent',
        websiteId: 'site-1',
        components: []
      } as any;

      const transformSpy = jest
        .spyOn((provider as any).unifiedContentTransformer, 'transformBatch')
        .mockResolvedValue({
          transformed: [
            {
              contentGuid: 'guid-folder-root',
              contentTypeKey: 'tree_folder',
              originalContentTypeId: 'tree-folder',
              name: 'Folder Root',
              language: 'en',
              status: 'Draft',
              properties: {}
            },
            {
              contentGuid: 'guid-page-parent',
              contentTypeKey: 'landing_page',
              originalContentTypeId: 'landing-page',
              name: 'Parent Page',
              language: 'en',
              status: 'Draft',
              properties: {}
            },
            {
              contentGuid: 'guid-page-child',
              contentTypeKey: 'landing_page',
              originalContentTypeId: 'landing-page',
              name: 'Child Page',
              language: 'en',
              status: 'Draft',
              properties: {}
            }
          ],
          errors: [],
          warnings: [],
          metadata: { totalProcessed: 3, successful: 3, failed: 0, duration: 0 }
        } as any);

      const createOrder: string[] = [];
      const createSpy = jest
        .spyOn(provider as any, 'createOptimizelyContent')
        .mockImplementation(async (request: any) => {
          createOrder.push(`${request.originalContentTypeId}:${request.name}`);
          return {
            contentLink: {
              guidValue: `${request.originalContentTypeId}-guid`,
              id: `${request.originalContentTypeId}-id`
            }
          };
        });

      mockClient.getContentType.mockResolvedValue({ key: 'tree_folder' } as any);
      mockClient.retryWithBackoff.mockImplementation(async (fn: any) => fn());
      mockClient.updateContentItem.mockResolvedValue({} as any);

      try {
        const result = await provider.processBatchUnifiedContent([
          childPage,
          parentPage,
          folder
        ]);

        expect(createSpy).toHaveBeenCalledTimes(3);
        expect(createOrder).toEqual([
          'tree-folder:Folder Root',
          'landing-page:Parent Page',
          'landing-page:Child Page'
        ]);
        expect(result.successful).toHaveLength(2);
      } finally {
        transformSpy.mockRestore();
        createSpy.mockRestore();
      }
    });

    it('creates nested local components under their parent component owners', async () => {
      const transformSpy = jest
        .spyOn((provider as any).unifiedContentTransformer, 'transformBatch')
        .mockResolvedValue({
          transformed: [
            {
              contentGuid: 'guid-page-1',
              contentTypeKey: 'landing_page',
              originalContentTypeId: 'landing-page',
              name: 'Nested Page',
              language: 'en',
              status: 'Draft',
              properties: {}
            }
          ],
          errors: [],
          warnings: [],
          metadata: { totalProcessed: 1, successful: 1, failed: 0, duration: 0 }
        } as any);

      const createOrder: string[] = [];
      const childRequests: any[] = [];
      const createSpy = jest
        .spyOn(provider as any, 'createOptimizelyContent')
        .mockImplementation(async (request: any) => {
          createOrder.push(request.originalContentTypeId);
          if (request.originalContentTypeId === 'landing-page') {
            return { contentLink: { id: 'page-content-id', guidValue: 'page-content-guid' } };
          }
          if (request.originalContentTypeId === 'HeroSection') {
            return { contentLink: { id: 'comp-parent-created', guidValue: 'comp-parent-guid' } };
          }
          if (request.originalContentTypeId === 'Button') {
            childRequests.push(request);
            return { contentLink: { id: 'comp-child-created', guidValue: 'comp-child-guid' } };
          }
          return { contentLink: { id: 'fallback-id' } };
        });

      mockClient.retryWithBackoff.mockImplementation(async (fn: any) => fn());
      mockClient.updateContentItem.mockResolvedValue({} as any);

      const page: UnifiedContent = {
        id: 'page-1',
        source: 'WebsitePage',
        type: 'page',
        title: 'Nested Page',
        contentTypeId: 'landing-page',
        content: {
          components: [
            { id: 'comp-parent', type: 'HeroSection', position: 0, properties: { title: 'Parent' } },
            { id: 'comp-child', type: 'Button', position: 1, parentId: 'comp-parent', properties: { label: 'Child' } }
          ]
        },
        metadata: {},
        components: [
          {
            id: 'comp-parent',
            type: 'HeroSection',
            position: 0,
            parentId: null,
            properties: { title: 'Parent' },
            isShared: false
          },
          {
            id: 'comp-child',
            type: 'Button',
            position: 1,
            parentId: 'comp-parent',
            properties: { label: 'Child' },
            isShared: false
          }
        ],
        status: 'draft',
        websiteId: 'site-1'
      } as any;

      try {
        await provider.processBatchUnifiedContent([page]);

        expect(createOrder).toEqual(['landing-page', 'HeroSection', 'Button']);
        expect(childRequests).toHaveLength(1);
        expect(childRequests[0].owner).toBe('comp-parent-created');

        expect(mockClient.updateContentItem).toHaveBeenCalledTimes(1);
        const updatePayload = mockClient.updateContentItem.mock.calls[0][1];
        expect(updatePayload.properties.components).toEqual([
          { reference: 'cms://content/comp-parent-created', displayOption: 'full' }
        ]);
      } finally {
        transformSpy.mockRestore();
        createSpy.mockRestore();
      }
    });

  });
});
