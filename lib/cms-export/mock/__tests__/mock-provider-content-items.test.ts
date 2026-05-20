import { MockProvider } from '../mock-provider';
import { 
  UniversalContentItem, 
  ContentFilter, 
  PaginationOptions,
  ContentValidationResult 
} from '../../types';

describe('MockProvider Content Item Operations', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
  });

  afterEach(() => {
    provider.reset();
  });

  describe('createContentItem', () => {
    it('should create a new content item', async () => {
      const newItem: UniversalContentItem = {
        id: 'new-item',
        contentTypeId: 'blog-post',
        title: 'New Post',
        slug: 'new-post',
        content: { 
          title: 'New Post',
          content: 'Content here' 
        },
        status: 'draft'
      };

      const created = await provider.createContentItem(newItem);
      
      expect(created.id).toBe('new-item');
      expect(created.title).toBe('New Post');
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();
      expect(created.version).toBe('1.0');
    });

    it('should generate ID if not provided', async () => {
      const newItem: UniversalContentItem = {
        id: '',
        contentTypeId: 'blog-post',
        title: 'Auto ID Post',
        slug: 'auto-id-post',
        content: {},
        status: 'draft'
      };

      const created = await provider.createContentItem(newItem);
      
      expect(created.id).toMatch(/^mock-item-\d+$/);
    });

    it('should reject duplicate IDs', async () => {
      const item: UniversalContentItem = {
        id: 'item-1', // Already exists in test data
        contentTypeId: 'blog-post',
        title: 'Duplicate',
        slug: 'duplicate',
        content: {},
        status: 'draft'
      };

      await expect(provider.createContentItem(item)).rejects.toThrow(
        'Content item item-1 already exists'
      );
    });

    it('should reject duplicate slugs for same content type', async () => {
      const item: UniversalContentItem = {
        id: 'new-id',
        contentTypeId: 'blog-post',
        title: 'Different Title',
        slug: 'first-blog-post', // Already exists in test data
        content: {},
        status: 'draft'
      };

      await expect(provider.createContentItem(item)).rejects.toThrow(
        'Content item with slug first-blog-post already exists for type blog-post'
      );
    });

    it('should handle relationships', async () => {
      const item: UniversalContentItem = {
        id: 'related-item',
        contentTypeId: 'blog-post',
        title: 'Related Post',
        slug: 'related-post',
        content: {},
        status: 'draft',
        relationships: [
          {
            type: 'parent',
            targetId: 'item-1',
            targetType: 'blog-post'
          }
        ]
      };

      const created = await provider.createContentItem(item);
      
      expect(created.relationships).toBeDefined();
      expect(created.relationships![0].targetId).toBe('item-1');
    });
  });

  describe('updateContentItem', () => {
    it('should update an existing content item', async () => {
      const updated = await provider.updateContentItem('item-1', {
        id: 'item-1',
        contentTypeId: 'blog-post',
        title: 'Updated Title',
        slug: 'first-blog-post',
        content: { updated: true },
        status: 'draft'
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.content.updated).toBe(true);
      expect(updated.status).toBe('draft');
      expect(updated.updatedAt).toBeDefined();
    });

    it('should reject non-existent item', async () => {
      await expect(provider.updateContentItem('non-existent', {
        id: 'non-existent',
        contentTypeId: 'blog-post',
        title: 'Test',
        slug: 'test',
        content: {},
        status: 'draft'
      })).rejects.toThrow('Content item non-existent not found');
    });

    it('should prevent duplicate slugs when updating', async () => {
      await expect(provider.updateContentItem('item-2', {
        id: 'item-2',
        contentTypeId: 'blog-post',
        title: 'Test',
        slug: 'first-blog-post', // Item-1's slug
        content: {},
        status: 'draft'
      })).rejects.toThrow(
        'Content item with slug first-blog-post already exists for type blog-post'
      );
    });

    it('should preserve ID when updating', async () => {
      const updated = await provider.updateContentItem('item-1', {
        id: 'different-id', // Should be ignored
        contentTypeId: 'blog-post',
        title: 'Test',
        slug: 'test-slug',
        content: {},
        status: 'draft'
      });

      expect(updated.id).toBe('item-1');
    });
  });

  describe('deleteContentItem', () => {
    it('should delete an existing content item', async () => {
      const result = await provider.deleteContentItem('item-1');
      
      expect(result).toBe(true);
      
      const item = await provider.getContentItem('item-1');
      expect(item).toBeNull();
    });

    it('should reject deletion of non-existent item', async () => {
      await expect(provider.deleteContentItem('non-existent'))
        .rejects.toThrow('Content item non-existent not found');
    });

    it('should handle cascade deletion for relationships', async () => {
      // Create items with relationships
      await provider.createContentItem({
        id: 'parent',
        contentTypeId: 'blog-post',
        title: 'Parent',
        slug: 'parent',
        content: {},
        status: 'published'
      });

      await provider.createContentItem({
        id: 'child',
        contentTypeId: 'blog-post',
        title: 'Child',
        slug: 'child',
        content: {},
        status: 'published',
        relationships: [
          { type: 'parent', targetId: 'parent' }
        ]
      });

      // Delete parent
      await provider.deleteContentItem('parent');

      // Check child's relationships are cleaned up
      const child = await provider.getContentItem('child');
      expect(child?.relationships).toBeDefined();
      // The relationship metadata should show target doesn't exist
      expect(child?.relationships![0].metadata?.targetExists).toBe(false);
    });
  });

  describe('getContentItem', () => {
    it('should retrieve an existing content item', async () => {
      const item = await provider.getContentItem('item-1');
      
      expect(item).toBeDefined();
      expect(item?.id).toBe('item-1');
      expect(item?.title).toBe('First Blog Post');
    });

    it('should return null for non-existent item', async () => {
      const item = await provider.getContentItem('non-existent');
      
      expect(item).toBeNull();
    });

    it('should resolve relationships', async () => {
      await provider.createContentItem({
        id: 'item-with-rel',
        contentTypeId: 'blog-post',
        title: 'With Relationship',
        slug: 'with-rel',
        content: {},
        status: 'published',
        relationships: [
          { type: 'reference', targetId: 'item-1' }
        ]
      });

      const item = await provider.getContentItem('item-with-rel');
      
      expect(item?.relationships).toBeDefined();
      expect(item?.relationships![0].metadata?.targetExists).toBe(true);
      expect(item?.relationships![0].metadata?.targetTitle).toBe('First Blog Post');
    });
  });

  describe('getContentItems', () => {
    beforeEach(async () => {
      // Add more test items for filtering
      await provider.createContentItem({
        id: 'published-1',
        contentTypeId: 'blog-post',
        title: 'Published Post 1',
        slug: 'published-1',
        content: { category: 'tech' },
        metadata: { category: 'tech' },
        status: 'published',
        publishedAt: new Date('2024-01-01')
      });

      await provider.createContentItem({
        id: 'published-2',
        contentTypeId: 'blog-post',
        title: 'Published Post 2',
        slug: 'published-2',
        content: { category: 'science' },
        metadata: { category: 'science' },
        status: 'published',
        publishedAt: new Date('2024-02-01')
      });

      await provider.createContentItem({
        id: 'archived-1',
        contentTypeId: 'blog-post',
        title: 'Archived Post',
        slug: 'archived-1',
        content: {},
        status: 'archived'
      });
    });

    it('should return all content items without filter', async () => {
      const result = await provider.getContentItems();
      
      expect(result.total).toBeGreaterThanOrEqual(5); // Initial 2 + 3 added
      expect(result.items.length).toBeGreaterThanOrEqual(5);
    });

    it('should filter by content type', async () => {
      const result = await provider.getContentItems({
        contentTypeId: 'blog-post'
      });
      
      expect(result.items.every(item => item.contentTypeId === 'blog-post')).toBe(true);
    });

    it('should filter by status', async () => {
      const result = await provider.getContentItems({
        status: 'published'
      });
      
      expect(result.items.every(item => item.status === 'published')).toBe(true);
    });

    it('should filter by multiple statuses', async () => {
      const result = await provider.getContentItems({
        status: ['published', 'draft']
      });
      
      expect(result.items.every(item => 
        item.status === 'published' || item.status === 'draft'
      )).toBe(true);
    });

    it('should filter by IDs', async () => {
      const result = await provider.getContentItems({
        ids: ['item-1', 'item-2']
      });
      
      expect(result.items.length).toBe(2);
      expect(result.items.map(i => i.id)).toContain('item-1');
      expect(result.items.map(i => i.id)).toContain('item-2');
    });

    it('should filter by slug', async () => {
      const result = await provider.getContentItems({
        slug: 'first-blog-post'
      });
      
      expect(result.items.length).toBe(1);
      expect(result.items[0].slug).toBe('first-blog-post');
    });

    it('should filter by search text', async () => {
      const result = await provider.getContentItems({
        search: 'First'
      });
      
      expect(result.items.some(item => 
        item.title.includes('First')
      )).toBe(true);
    });

    it('should filter by metadata', async () => {
      const result = await provider.getContentItems({
        metadata: { category: 'tech' }
      });
      
      expect(result.items.every(item => 
        item.metadata?.category === 'tech'
      )).toBe(true);
    });

    it('should filter by date ranges', async () => {
      const result = await provider.getContentItems({
        publishedAfter: new Date('2024-01-15'),
        publishedBefore: new Date('2024-02-15')
      });
      
      expect(result.items.every(item => {
        if (!item.publishedAt) return false;
        return item.publishedAt >= new Date('2024-01-15') && 
               item.publishedAt <= new Date('2024-02-15');
      })).toBe(true);
    });

    it('should filter by relationships', async () => {
      await provider.createContentItem({
        id: 'with-parent',
        contentTypeId: 'blog-post',
        title: 'Child Post',
        slug: 'child-post',
        content: {},
        status: 'published',
        relationships: [
          { type: 'parent', targetId: 'item-1' }
        ]
      });

      const result = await provider.getContentItems({
        hasRelationship: {
          type: 'parent',
          targetId: 'item-1'
        }
      });
      
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items[0].relationships?.[0].targetId).toBe('item-1');
    });

    it('should handle pagination', async () => {
      const page1 = await provider.getContentItems(undefined, {
        limit: 2,
        offset: 0
      });
      
      const page2 = await provider.getContentItems(undefined, {
        limit: 2,
        offset: 2
      });
      
      expect(page1.items.length).toBeLessThanOrEqual(2);
      expect(page2.items.length).toBeLessThanOrEqual(2);
      expect(page1.items[0].id).not.toBe(page2.items[0]?.id);
    });

    it('should handle sorting', async () => {
      const ascending = await provider.getContentItems(undefined, {
        limit: 10,
        orderBy: {
          field: 'title',
          direction: 'asc'
        }
      });
      
      const descending = await provider.getContentItems(undefined, {
        limit: 10,
        orderBy: {
          field: 'title',
          direction: 'desc'
        }
      });
      
      expect(ascending.items[0].title).not.toBe(descending.items[0].title);
    });
  });

  describe('validateContentItem', () => {
    it('should validate valid content item', async () => {
      const item: UniversalContentItem = {
        id: 'valid',
        contentTypeId: 'blog-post',
        title: 'Valid Post',
        slug: 'valid-post',
        content: {
          title: 'Valid Post',
          content: 'Valid content'
        },
        status: 'published'
      };

      const result = await provider.validateContentItem(item);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect missing required fields', async () => {
      const item: UniversalContentItem = {
        id: '',
        contentTypeId: '',
        title: '',
        slug: '',
        content: {},
        status: 'published'
      };

      const result = await provider.validateContentItem(item);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some(e => e.field === 'id')).toBe(true);
      expect(result.errors?.some(e => e.field === 'title')).toBe(true);
      expect(result.errors?.some(e => e.field === 'slug')).toBe(true);
    });

    it('should validate slug format', async () => {
      const item: UniversalContentItem = {
        id: 'test',
        contentTypeId: 'blog-post',
        title: 'Test',
        slug: 'Invalid Slug!',
        content: {},
        status: 'published'
      };

      const result = await provider.validateContentItem(item);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => 
        e.field === 'slug' && e.code === 'INVALID_FORMAT'
      )).toBe(true);
    });

    it('should validate status values', async () => {
      const item: UniversalContentItem = {
        id: 'test',
        contentTypeId: 'blog-post',
        title: 'Test',
        slug: 'test',
        content: {},
        status: 'invalid' as any
      };

      const result = await provider.validateContentItem(item);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => 
        e.field === 'status' && e.code === 'INVALID_STATUS'
      )).toBe(true);
    });

    it('should detect circular references', async () => {
      const item: UniversalContentItem = {
        id: 'self-ref',
        contentTypeId: 'blog-post',
        title: 'Self Reference',
        slug: 'self-ref',
        content: {},
        status: 'published',
        relationships: [
          { type: 'parent', targetId: 'self-ref' }
        ]
      };

      const result = await provider.validateContentItem(item);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => 
        e.code === 'CIRCULAR_REFERENCE'
      )).toBe(true);
    });

    it('should detect duplicate relationships', async () => {
      const item: UniversalContentItem = {
        id: 'test',
        contentTypeId: 'blog-post',
        title: 'Test',
        slug: 'test',
        content: {},
        status: 'published',
        relationships: [
          { type: 'parent', targetId: 'item-1' },
          { type: 'reference', targetId: 'item-1' }
        ]
      };

      const result = await provider.validateContentItem(item);
      
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => 
        w.code === 'DUPLICATE_RELATIONSHIP'
      )).toBe(true);
    });

    it('should validate content against content type schema', async () => {
      const item: UniversalContentItem = {
        id: 'test',
        contentTypeId: 'blog-post',
        title: 'Test',
        slug: 'test',
        content: {
          // Missing required 'title' and 'content' fields
        },
        status: 'published'
      };

      const result = await provider.validateContentItem(item);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => 
        e.field === 'content.title' && e.code === 'REQUIRED_FIELD'
      )).toBe(true);
      expect(result.errors?.some(e => 
        e.field === 'content.content' && e.code === 'REQUIRED_FIELD'
      )).toBe(true);
    });

    it('should add SEO warnings', async () => {
      const item: UniversalContentItem = {
        id: 'test',
        contentTypeId: 'blog-post',
        title: 'Test',
        slug: 'test',
        content: {
          title: 'Test',
          content: 'Test content'
        },
        status: 'published'
        // No metadata.description
      };

      const result = await provider.validateContentItem(item);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => 
        w.field === 'metadata.description' && w.code === 'MISSING_SEO'
      )).toBe(true);
    });
  });

  describe('Test Helper Methods', () => {
    it('should track method calls', async () => {
      await provider.getContentItem('item-1');
      await provider.getContentItems();
      
      const calls = provider.getMethodCalls();
      
      expect(calls).toHaveLength(2);
      expect(calls[0].method).toBe('getContentItem');
      expect(calls[1].method).toBe('getContentItems');
    });

    it('should simulate failures when configured', async () => {
      provider.configure({
        shouldFail: true,
        failureMessage: 'Test failure'
      });

      await expect(provider.getContentItem('item-1'))
        .rejects.toThrow('Test failure');
    });

    it('should simulate latency', async () => {
      provider.configure({
        simulateDelay: 100
      });

      const start = Date.now();
      await provider.getContentItem('item-1');
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });
});