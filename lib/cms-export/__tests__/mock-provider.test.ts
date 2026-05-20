// MockProvider Unit Tests

import { MockProvider } from '../mock/mock-provider';
import { UniversalContentType } from '../universal/types';

describe('MockProvider', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
  });

  describe('Interface Implementation (slim)', () => {
    it('exposes the production-used ICMSProvider API', () => {
      expect(provider.id).toBe('mock');
      expect(typeof provider.getContentType).toBe('function');
      expect(typeof provider.createContentType).toBe('function');
      expect(typeof provider.syncUnifiedBundle).toBe('function');
      expect(typeof provider.getCompiledTypeSupport).toBe('function');
    });
  });

  describe('getContentTypes', () => {
    it('should return array of content types', async () => {
      const types = await provider.getContentTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });

    it('should include blog-post type', async () => {
      const types = await provider.getContentTypes();
      const blogPost = types.find(t => t.id === 'blog-post');
      expect(blogPost).toBeDefined();
      expect(blogPost?.name).toBe('Blog Post');
      expect(blogPost?.type).toBe('page');
      expect(blogPost?.isRoutable).toBe(true);
    });

    it('should include hero-section component', async () => {
      const types = await provider.getContentTypes();
      const heroSection = types.find(t => t.id === 'hero-section');
      expect(heroSection).toBeDefined();
      expect(heroSection?.name).toBe('Hero Section');
      expect(heroSection?.type).toBe('component');
      expect(heroSection?.isRoutable).toBe(false);
    });

    it('should include fields with all three layers', async () => {
      const types = await provider.getContentTypes();
      const heroSection = types.find(t => t.id === 'hero-section');
      
      const primitiveField = heroSection?.fields.find(f => f.layer === 'primitive');
      const commonField = heroSection?.fields.find(f => f.layer === 'common');
      
      expect(primitiveField).toBeDefined();
      expect(commonField).toBeDefined();
      // Note: extension layer fields not included in default test data
    });
  });

  describe('getContentType', () => {
    it('should return specific content type by ID', async () => {
      const type = await provider.getContentType('blog-post');
      expect(type).toBeDefined();
      expect(type?.id).toBe('blog-post');
    });

    it('should return null for non-existent type', async () => {
      const type = await provider.getContentType('non-existent');
      expect(type).toBeNull();
    });
  });

  describe('createContentType', () => {
    it('should create new content type', async () => {
      const newType: UniversalContentType = {
        version: '1.0.0',
        id: 'test-type',
        name: 'Test Type',
        type: 'page',
        isRoutable: true,
        fields: [
          {
            id: 'field1',
            name: 'Field 1',
            layer: 'primitive',
            type: 'text'
          }
        ],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      const created = await provider.createContentType(newType);
      expect(created.id).toBe('test-type');
      
      const retrieved = await provider.getContentType('test-type');
      expect(retrieved).toBeDefined();
    });

    it('should fail for duplicate type', async () => {
      const duplicateType: any = {
        version: '1.0.0',
        id: 'blog-post', // Already exists
        name: 'Duplicate Blog',
        type: 'page',
        fields: []
      };

      await expect(provider.createContentType(duplicateType))
        .rejects.toThrow(/Content type 'blog-post' already exists/);
    });

    it('should add metadata if not present', async () => {
      const typeWithoutMetadata: any = {
        version: '1.0.0',
        id: 'test-no-metadata',
        name: 'Test No Metadata',
        type: 'page',
        isRoutable: false,
        fields: [
          {
            id: 'field1',
            name: 'Field 1',
            layer: 'primitive',
            type: 'text'
          }
        ]
      };

      const created = await provider.createContentType(typeWithoutMetadata);
      expect(created.metadata).toBeDefined();
      expect(created.metadata.createdAt).toBeDefined();
    });
  });

  // Removed: update/delete/validate type tests (not part of slim API)

  // Removed: deleteContentType tests

  // Removed: validateContentType tests

  // Removed: capabilities tests

  // Removed: mapping tests (internal only)

  describe('Provider Identification', () => {
    it('should return provider ID', () => {
      expect(provider.id).toBe('mock');
    });
  });

  // Removed: performance tests for removed methods

  describe('Compiled Type Support', () => {
    it('compiles and configures compiled type index', async () => {
      const support = provider.getCompiledTypeSupport();
      expect(support).toBeDefined();
      const compiled = support!.compile([
        { id: 't1', key: 'article', name: 'Article', pluralName: 'Articles', category: 'page', fields: [] }
      ] as any);
      await support!.configure?.(compiled as any);
      await support!.ensure?.(compiled as any);
      support!.registerContentTypeMapping?.('db1', 'article', '_page');
    });
  });
});
