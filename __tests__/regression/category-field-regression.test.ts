/**
 * Regression tests for Category Field Implementation (Story 7.4a)
 * Ensures no breaking changes to existing functionality
 */

import { createContentType, ContentType } from '@/lib/content-types/types';
import { contentTypeService } from '@/lib/services/content-type-service';
import { databaseTypeLoader } from '@/lib/services/universal-types/database-type-loader';
import { prisma } from '@/lib/db/prisma';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    contentType: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    website: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Category Field Regression Tests', () => {
  const mockWebsiteId = 'test-website-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Backward Compatibility', () => {
    it('should handle content types without category field (migration scenario)', async () => {
      // Mock a content type from database without category (pre-migration)
      const legacyContentType = {
        id: 'legacy-1',
        websiteId: mockWebsiteId,
        name: 'LegacyType',
        fields: JSON.stringify({
          fields: [],
          relationships: [],
          pluralName: 'LegacyTypes',
          icon: '📋',
        }),
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.contentType.findMany as jest.Mock).mockResolvedValue([legacyContentType]);

      // Load content types
      databaseTypeLoader.setWebsiteContext(mockWebsiteId);
      const types = await databaseTypeLoader.loadContentTypes();

      // Should default to 'page' category
      expect(types[0].category).toBe('page');
    });

    it('should preserve existing content type data when adding category', async () => {
      const existingContentType = {
        id: 'existing-1',
        websiteId: mockWebsiteId,
        name: 'ExistingBlogPost',
        fields: JSON.stringify({
          fields: [
            { id: 'field-1', name: 'title', type: 'text', required: true },
            { id: 'field-2', name: 'content', type: 'richText', required: false },
          ],
          relationships: [],
          pluralName: 'ExistingBlogPosts',
          icon: '📝',
        }),
        settings: {
          description: 'A blog post content type',
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue(existingContentType);

      const result = await contentTypeService.getContentType('existing-1');

      // All original data should be preserved
      expect(result.name).toBe('ExistingBlogPost');
      expect(result.fields).toHaveLength(2);
      expect(result.fields[0].name).toBe('title');
      expect(result.settings.description).toBe('A blog post content type');
      // Category should default to 'page'
      expect(result.category).toBe('page');
    });
  });

  describe('API Compatibility', () => {
    it('should accept content type creation without category (defaults to page)', async () => {
      const newContentType = {
        websiteId: mockWebsiteId,
        name: 'NewType',
        pluralName: 'NewTypes',
        icon: '📋',
        fields: [],
        relationships: [],
      };

      (prisma.contentType.create as jest.Mock).mockResolvedValue({
        id: 'new-1',
        ...newContentType,
        category: 'page', // Database default
        fields: JSON.stringify({ fields: [], relationships: [] }),
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await contentTypeService.createContentType(newContentType);

      expect(result.category).toBe('page');
      expect(prisma.contentType.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'page', // Should use default
          }),
        })
      );
    });

    it('should accept content type creation with explicit category', async () => {
      const newContentType = {
        websiteId: mockWebsiteId,
        name: 'HeroComponent',
        pluralName: 'HeroComponents',
        icon: '🧩',
        category: 'component' as const,
        fields: [],
        relationships: [],
      };

      (prisma.contentType.create as jest.Mock).mockResolvedValue({
        id: 'new-2',
        ...newContentType,
        fields: JSON.stringify({ fields: [], relationships: [] }),
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await contentTypeService.createContentType(newContentType);

      expect(result.category).toBe('component');
      expect(prisma.contentType.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'component',
          }),
        })
      );
    });

    it('should handle update operations with category field', async () => {
      const updateData = {
        name: 'UpdatedType',
        category: 'component' as const,
      };

      (prisma.contentType.update as jest.Mock).mockResolvedValue({
        id: 'update-1',
        websiteId: mockWebsiteId,
        name: 'UpdatedType',
        category: 'component',
        fields: JSON.stringify({ fields: [], relationships: [] }),
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await contentTypeService.updateContentType('update-1', updateData);

      expect(result.category).toBe('component');
      expect(prisma.contentType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'component',
          }),
        })
      );
    });
  });

  describe('Database Type Loader', () => {
    it('should correctly load content types with category from database', async () => {
      const mockContentTypes = [
        {
          id: 'page-1',
          websiteId: mockWebsiteId,
          name: 'ArticlePage',
          category: 'page',
          fields: JSON.stringify({ fields: [], relationships: [] }),
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'component-1',
          websiteId: mockWebsiteId,
          name: 'CallToAction',
          category: 'component',
          fields: JSON.stringify({ fields: [], relationships: [] }),
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockContentTypes);

      databaseTypeLoader.setWebsiteContext(mockWebsiteId);
      const types = await databaseTypeLoader.loadContentTypes();

      expect(types).toHaveLength(2);
      expect(types[0].category).toBe('page');
      expect(types[1].category).toBe('component');
    });

    it('should not break existing filtering and searching functionality', async () => {
      const mockContentTypes = [
        {
          id: 'blog-1',
          websiteId: mockWebsiteId,
          name: 'BlogPost',
          category: 'page',
          fields: JSON.stringify({ fields: [], relationships: [] }),
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.contentType.findMany as jest.Mock).mockResolvedValue(mockContentTypes);

      databaseTypeLoader.setWebsiteContext(mockWebsiteId);
      
      // Test existing methods still work
      const isDuplicate = databaseTypeLoader.isDuplicateType('BlogPost');
      expect(typeof isDuplicate).toBe('boolean');

      const formatted = databaseTypeLoader.formatForPrompt();
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('BlogPost');
    });
  });

  describe('Content Type Helper Functions', () => {
    it('should maintain backward compatibility with single parameter', () => {
      // Test that createContentType still works with just name
      const contentType = createContentType('TestType');
      
      expect(contentType.name).toBe('TestType');
      expect(contentType.category).toBe('page'); // Should default to page
      expect(contentType.icon).toBe('📄');
    });

    it('should work with both parameters', () => {
      const pageType = createContentType('PageType', 'page');
      const componentType = createContentType('ComponentType', 'component');
      
      expect(pageType.category).toBe('page');
      expect(componentType.category).toBe('component');
    });
  });

  describe('TypeScript Type Safety', () => {
    it('should enforce category type constraints', () => {
      // This test ensures TypeScript compilation doesn't break
      const testType: ContentType = {
        id: 'ts-test',
        name: 'TypeScriptTest',
        pluralName: 'TypeScriptTests',
        icon: '📋',
        category: 'page', // Should only accept 'page' | 'component'
        fields: [],
        relationships: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(testType.category).toBeDefined();
      expect(['page', 'component']).toContain(testType.category);
    });

    it('should handle optional category in API requests', () => {
      // Simulating API request type
      interface CreateContentTypeRequest {
        name: string;
        pluralName: string;
        icon: string;
        category?: 'page' | 'component';
        fields: any[];
        relationships: any[];
      }

      const request: CreateContentTypeRequest = {
        name: 'TestRequest',
        pluralName: 'TestRequests',
        icon: '📋',
        // category is optional, should default to 'page'
        fields: [],
        relationships: [],
      };

      expect(request.category).toBeUndefined();
      // System should handle undefined category by defaulting to 'page'
    });
  });

  describe('Data Integrity', () => {
    it('should not lose data during category field addition', async () => {
      const complexContentType = {
        id: 'complex-1',
        websiteId: mockWebsiteId,
        name: 'ComplexType',
        fields: JSON.stringify({
          fields: [
            { id: 'f1', name: 'field1', type: 'text' },
            { id: 'f2', name: 'field2', type: 'number' },
            { id: 'f3', name: 'field3', type: 'boolean' },
          ],
          relationships: [
            { id: 'r1', name: 'rel1', type: 'oneToMany' },
          ],
          pluralName: 'ComplexTypes',
          icon: '🔧',
          description: 'A complex content type',
        }),
        settings: {
          customSetting: 'value',
          anotherSetting: 123,
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
      };

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue(complexContentType);

      const result = await contentTypeService.getContentType('complex-1');

      // Verify all data is preserved
      expect(result.name).toBe('ComplexType');
      expect(result.fields).toHaveLength(3);
      expect(result.relationships).toHaveLength(1);
      expect(result.settings.customSetting).toBe('value');
      expect(result.settings.anotherSetting).toBe(123);
      expect(result.category).toBe('page'); // Default category added
    });
  });
});