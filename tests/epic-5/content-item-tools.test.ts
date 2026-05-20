/**
 * Content Item Tools Integration Tests
 * Tests all content item management tools including bulk operations and validation
 */

import { allTools } from '@/lib/ai-tools/tools';
import { prisma } from '@/lib/prisma';

describe('Content Item Tools', () => {
  let testWebsiteId: string;
  let testContentTypeId: string;
  let testContentItemId: string;
  
  const contentItemTools = allTools.filter(t => 
    ['list-content-items', 'create-page', 'update-content-item'].includes(t.name)
  );

  beforeAll(async () => {
    // Create test website with business rules
    const website = await prisma.website.create({
      data: {
        name: 'TEST_ContentItem_Website',
        description: 'Website for content item testing',
        businessRequirements: [
          'All items must have a title',
          'Descriptions must be at least 20 characters'
        ]
      }
    });
    testWebsiteId = website.id;

    // Create test content type
    const contentType = await prisma.contentType.create({
      data: {
        websiteId: testWebsiteId,
        name: 'Article',
        description: 'Article content type',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'text', required: true },
          { name: 'content', type: 'text', required: false },
          { name: 'publishDate', type: 'date', required: false },
          { name: 'featured', type: 'boolean', required: false },
          { name: 'tags', type: 'array', required: false },
          { name: 'viewCount', type: 'number', required: false }
        ]
      }
    });
    testContentTypeId = contentType.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.contentItem.deleteMany({
      where: { websiteId: testWebsiteId }
    });
    await prisma.contentType.deleteMany({
      where: { websiteId: testWebsiteId }
    });
    await prisma.website.delete({
      where: { id: testWebsiteId }
    });
  });

  describe('create-page', () => {
    const tool = contentItemTools.find(t => t.name === 'create-page')!;

    it('should create content item with validation', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        name: 'First Article',
        content: {
          title: 'Getting Started with Testing',
          description: 'A comprehensive guide to testing your applications effectively',
          content: 'This article covers testing best practices...',
          publishDate: '2025-01-14',
          featured: true,
          tags: ['testing', 'best-practices', 'tutorial'],
          viewCount: 0
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        name: 'First Article',
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId
      });
      expect(result.data.content).toMatchObject({
        title: 'Getting Started with Testing',
        featured: true,
        tags: ['testing', 'best-practices', 'tutorial']
      });

      testContentItemId = result.data.id;
    });

    it('should validate required fields', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        name: 'Invalid Article',
        content: {
          // Missing required 'title' field
          description: 'This article is missing a title',
          content: 'Some content here'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should validate field types', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        name: 'Type Test Article',
        content: {
          title: 'Type Validation Test',
          description: 'Testing field type validation in content items',
          viewCount: 'not a number', // Should be number
          featured: 'yes' // Should be boolean
        }
      });

      // Type coercion might occur, check if it handles gracefully
      if (result.success) {
        expect(typeof result.data.content.viewCount).toBe('number');
        expect(typeof result.data.content.featured).toBe('boolean');
      }
    });

    it('should handle array fields', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        name: 'Array Test Article',
        content: {
          title: 'Testing Array Fields',
          description: 'This article tests array field handling',
          tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.content.tags).toEqual(['tag1', 'tag2', 'tag3', 'tag4', 'tag5']);
    });

    it('should validate against business rules', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        name: 'Business Rule Test',
        content: {
          title: 'Valid Title',
          description: 'Too short' // Less than 20 characters
        }
      });

      // Should either fail or return validation warnings
      if (result.success) {
        expect(result.validationWarnings).toBeDefined();
      } else {
        expect(result.error).toContain('characters');
      }
    });

    it('should handle non-existent content type', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: 'non-existent-id',
        name: 'Test Item',
        content: { title: 'Test' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content type not found');
    });

    it('should generate unique slugs if needed', async () => {
      // Create content type with slug field
      const slugType = await prisma.contentType.create({
        data: {
          websiteId: testWebsiteId,
          name: 'Page',
          description: 'Page with slug',
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'slug', type: 'text', required: true }
          ]
        }
      });

      // Create first item
      const result1 = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: slugType.id,
        name: 'Home Page',
        content: {
          title: 'Home',
          slug: 'home'
        }
      });

      expect(result1.success).toBe(true);

      // Try to create with same slug
      const result2 = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: slugType.id,
        name: 'Another Home Page',
        content: {
          title: 'Home 2',
          slug: 'home'
        }
      });

      // Should either fail or auto-generate unique slug
      if (result2.success) {
        expect(result2.data.content.slug).not.toBe('home');
      }

      // Cleanup
      await prisma.contentItem.deleteMany({
        where: { contentTypeId: slugType.id }
      });
      await prisma.contentType.delete({
        where: { id: slugType.id }
      });
    });
  });

  describe('list-content-items', () => {
    const tool = contentItemTools.find(t => t.name === 'list-content-items')!;

    beforeAll(async () => {
      // Create multiple content items for pagination testing
      const items = [];
      for (let i = 1; i <= 25; i++) {
        items.push({
          websiteId: testWebsiteId,
          contentTypeId: testContentTypeId,
          name: `Article ${i}`,
          content: {
            title: `Article Title ${i}`,
            description: `This is the description for article number ${i}`,
            viewCount: i * 10,
            featured: i % 3 === 0
          }
        });
      }
      await prisma.contentItem.createMany({ data: items });
    });

    it('should list content items with pagination', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        limit: 10,
        offset: 0
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(10);
      expect(result.total).toBeGreaterThanOrEqual(25);
      expect(result.hasMore).toBe(true);
    });

    it('should handle pagination offset', async () => {
      const page1 = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        limit: 10,
        offset: 0
      });

      const page2 = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        limit: 10,
        offset: 10
      });

      expect(page1.success).toBe(true);
      expect(page2.success).toBe(true);
      
      // Pages should have different items
      const page1Ids = page1.data.map((item: any) => item.id);
      const page2Ids = page2.data.map((item: any) => item.id);
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('should filter by website and content type', async () => {
      // Create another content type with items
      const otherType = await prisma.contentType.create({
        data: {
          websiteId: testWebsiteId,
          name: 'News',
          description: 'News content type',
          fields: [{ name: 'title', type: 'text' }]
        }
      });

      await prisma.contentItem.create({
        data: {
          websiteId: testWebsiteId,
          contentTypeId: otherType.id,
          name: 'News Item',
          content: { title: 'Breaking News' }
        }
      });

      // List should only show items from specified content type
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId
      });

      expect(result.success).toBe(true);
      const newsItems = result.data.filter((item: any) => 
        item.contentTypeId === otherType.id
      );
      expect(newsItems).toHaveLength(0);

      // Cleanup
      await prisma.contentItem.deleteMany({
        where: { contentTypeId: otherType.id }
      });
      await prisma.contentType.delete({
        where: { id: otherType.id }
      });
    });

    it('should handle empty results', async () => {
      // Create content type with no items
      const emptyType = await prisma.contentType.create({
        data: {
          websiteId: testWebsiteId,
          name: 'Empty',
          description: 'Empty content type',
          fields: []
        }
      });

      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: emptyType.id
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);

      // Cleanup
      await prisma.contentType.delete({
        where: { id: emptyType.id }
      });
    });

    it('should sort by creation date by default', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        limit: 5
      });

      expect(result.success).toBe(true);
      
      // Check if sorted by createdAt descending (newest first)
      for (let i = 0; i < result.data.length - 1; i++) {
        const date1 = new Date(result.data[i].createdAt);
        const date2 = new Date(result.data[i + 1].createdAt);
        expect(date1.getTime()).toBeGreaterThanOrEqual(date2.getTime());
      }
    });
  });

  describe('update-content-item', () => {
    const tool = contentItemTools.find(t => t.name === 'update-content-item')!;
    let updateTestItemId: string;

    beforeEach(async () => {
      // Create fresh content item for each test
      const item = await prisma.contentItem.create({
        data: {
          websiteId: testWebsiteId,
          contentTypeId: testContentTypeId,
          name: 'Update Test Article',
          content: {
            title: 'Original Title',
            description: 'Original description that is long enough',
            content: 'Original content',
            featured: false,
            viewCount: 100
          }
        }
      });
      updateTestItemId = item.id;
    });

    afterEach(async () => {
      // Cleanup
      await prisma.contentItem.delete({
        where: { id: updateTestItemId }
      });
    });

    it('should update content item with partial updates', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentItemId: updateTestItemId,
        content: {
          title: 'Updated Title',
          featured: true
          // Other fields should remain unchanged
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.content.title).toBe('Updated Title');
      expect(result.data.content.featured).toBe(true);
      expect(result.data.content.description).toBe('Original description that is long enough');
      expect(result.data.content.viewCount).toBe(100);
    });

    it('should update name separately from content', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentItemId: updateTestItemId,
        name: 'Renamed Article',
        content: {
          viewCount: 200
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Renamed Article');
      expect(result.data.content.viewCount).toBe(200);
      expect(result.data.content.title).toBe('Original Title');
    });

    it('should validate updates against content type schema', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentItemId: updateTestItemId,
        content: {
          title: '', // Empty required field
          description: 'Valid description that is long enough'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should validate updates against business rules', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentItemId: updateTestItemId,
        content: {
          description: 'Short' // Less than 20 characters
        }
      });

      // Should either fail or return validation warnings
      if (result.success) {
        expect(result.validationWarnings).toBeDefined();
      } else {
        expect(result.error).toContain('characters');
      }
    });

    it('should handle adding new fields', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentItemId: updateTestItemId,
        content: {
          tags: ['new', 'tags', 'added'],
          publishDate: '2025-01-15'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.content.tags).toEqual(['new', 'tags', 'added']);
      expect(result.data.content.publishDate).toBe('2025-01-15');
    });

    it('should handle removing optional fields', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentItemId: updateTestItemId,
        content: {
          content: null, // Remove optional field
          featured: null // Remove optional field
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.content.content).toBeUndefined();
      expect(result.data.content.featured).toBeUndefined();
    });

    it('should handle non-existent content item', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentItemId: 'non-existent-id',
        content: { title: 'New Title' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content item not found');
    });

    it('should handle concurrent updates', async () => {
      // Simulate concurrent updates
      const promises = [
        tool.execute({
          websiteId: testWebsiteId,
          contentItemId: updateTestItemId,
          content: { viewCount: 500 }
        }),
        tool.execute({
          websiteId: testWebsiteId,
          contentItemId: updateTestItemId,
          content: { viewCount: 600 }
        })
      ];

      const results = await Promise.all(promises);
      
      // Both should complete (last write wins)
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThanOrEqual(1);

      // Check final state
      const finalItem = await prisma.contentItem.findUnique({
        where: { id: updateTestItemId }
      });
      expect([500, 600]).toContain((finalItem!.content as any).viewCount);
    });
  });

  describe('bulk operations (20-item limit)', () => {
    it('should handle bulk creation up to limit', async () => {
      const createTool = contentItemTools.find(t => t.name === 'create-page')!;
      const promises = [];

      // Try to create 25 items (should handle up to 20)
      for (let i = 1; i <= 25; i++) {
        promises.push(
          createTool.execute({
            websiteId: testWebsiteId,
            contentTypeId: testContentTypeId,
            name: `Bulk Item ${i}`,
            content: {
              title: `Bulk Title ${i}`,
              description: `Bulk description for item ${i} with enough characters`,
              viewCount: i
            }
          })
        );
      }

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      
      // Should succeed for at least 20 items
      expect(successCount).toBeGreaterThanOrEqual(20);

      // Verify created items
      const items = await prisma.contentItem.findMany({
        where: {
          websiteId: testWebsiteId,
          name: { startsWith: 'Bulk Item' }
        }
      });
      
      expect(items.length).toBeGreaterThanOrEqual(20);

      // Cleanup
      await prisma.contentItem.deleteMany({
        where: {
          websiteId: testWebsiteId,
          name: { startsWith: 'Bulk Item' }
        }
      });
    });

    it('should handle bulk updates efficiently', async () => {
      const updateTool = contentItemTools.find(t => t.name === 'update-content-item')!;
      
      // Create items to update
      const items = [];
      for (let i = 1; i <= 20; i++) {
        items.push({
          websiteId: testWebsiteId,
          contentTypeId: testContentTypeId,
          name: `Update Bulk ${i}`,
          content: {
            title: `Original ${i}`,
            description: `Original bulk description for item ${i}`,
            viewCount: 0
          }
        });
      }
      
      const created = await prisma.contentItem.createMany({ 
        data: items,
        skipDuplicates: true 
      });

      // Get created item IDs
      const createdItems = await prisma.contentItem.findMany({
        where: {
          websiteId: testWebsiteId,
          name: { startsWith: 'Update Bulk' }
        }
      });

      // Bulk update
      const updatePromises = createdItems.map((item, index) =>
        updateTool.execute({
          websiteId: testWebsiteId,
          contentItemId: item.id,
          content: {
            title: `Updated ${index + 1}`,
            viewCount: (index + 1) * 100
          }
        })
      );

      const updateResults = await Promise.all(updatePromises);
      const updateSuccessCount = updateResults.filter(r => r.success).length;
      
      expect(updateSuccessCount).toBe(createdItems.length);

      // Cleanup
      await prisma.contentItem.deleteMany({
        where: {
          websiteId: testWebsiteId,
          name: { startsWith: 'Update Bulk' }
        }
      });
    });
  });

  describe('content type field validation', () => {
    it('should enforce field constraints strictly', async () => {
      const createTool = contentItemTools.find(t => t.name === 'create-page')!;

      // Create content type with strict validation
      const strictType = await prisma.contentType.create({
        data: {
          websiteId: testWebsiteId,
          name: 'StrictType',
          description: 'Type with strict validation',
          fields: [
            { name: 'email', type: 'text', required: true, validation: { pattern: '^[\\w-\\.]+@[\\w-]+\\.[a-z]{2,}$' } },
            { name: 'age', type: 'number', required: true, validation: { min: 18, max: 120 } },
            { name: 'website', type: 'text', required: false, validation: { pattern: '^https?://' } }
          ]
        }
      });

      // Test valid content
      const validResult = await createTool.execute({
        websiteId: testWebsiteId,
        contentTypeId: strictType.id,
        name: 'Valid Strict Item',
        content: {
          email: 'test@example.com',
          age: 25,
          website: 'https://example.com'
        }
      });

      expect(validResult.success).toBe(true);

      // Test invalid email
      const invalidEmailResult = await createTool.execute({
        websiteId: testWebsiteId,
        contentTypeId: strictType.id,
        name: 'Invalid Email Item',
        content: {
          email: 'not-an-email',
          age: 30
        }
      });

      // Should fail or warn about validation
      if (invalidEmailResult.success) {
        expect(invalidEmailResult.validationWarnings).toBeDefined();
      } else {
        expect(invalidEmailResult.error).toContain('validation');
      }

      // Test invalid age
      const invalidAgeResult = await createTool.execute({
        websiteId: testWebsiteId,
        contentTypeId: strictType.id,
        name: 'Invalid Age Item',
        content: {
          email: 'valid@example.com',
          age: 150 // Exceeds max
        }
      });

      // Should fail or warn about validation
      if (invalidAgeResult.success) {
        expect(invalidAgeResult.validationWarnings).toBeDefined();
      } else {
        expect(invalidAgeResult.error).toContain('validation');
      }

      // Cleanup
      await prisma.contentItem.deleteMany({
        where: { contentTypeId: strictType.id }
      });
      await prisma.contentType.delete({
        where: { id: strictType.id }
      });
    });
  });
});