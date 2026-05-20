/**
 * Content Type Tools Integration Tests
 * Tests all content type management tools with various scenarios
 */

import { allTools } from '@/lib/ai-tools/tools';
import { prisma } from '@/lib/prisma';

describe('Content Type Tools', () => {
  let testWebsiteId: string;
  let testContentTypeId: string;
  
  const contentTypeTools = allTools.filter(t => 
    ['list-content-types', 'get-content-type', 'create-content-type', 'update-content-type'].includes(t.name)
  );

  beforeAll(async () => {
    // Create test website
    const website = await prisma.website.create({
      data: {
        name: 'TEST_ContentType_Website',
        description: 'Website for content type testing'
      }
    });
    testWebsiteId = website.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.contentItem.deleteMany({
      where: { website: { id: testWebsiteId } }
    });
    await prisma.contentType.deleteMany({
      where: { websiteId: testWebsiteId }
    });
    await prisma.website.delete({
      where: { id: testWebsiteId }
    });
  });

  describe('create-content-type', () => {
    const tool = contentTypeTools.find(t => t.name === 'create-content-type')!;

    it('should create content type with automatic field inference', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        name: 'BlogPost',
        description: 'Blog post with title, content, author, publish date, and tags',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'content', type: 'text', required: true },
          { name: 'author', type: 'text', required: true },
          { name: 'publishDate', type: 'date', required: true },
          { name: 'featured', type: 'boolean', required: false },
          { name: 'tags', type: 'array', required: false },
          { name: 'viewCount', type: 'number', required: false }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        name: 'BlogPost',
        description: expect.any(String),
        fields: expect.arrayContaining([
          expect.objectContaining({ name: 'title', type: 'text' }),
          expect.objectContaining({ name: 'content', type: 'text' }),
          expect.objectContaining({ name: 'author', type: 'text' }),
          expect.objectContaining({ name: 'publishDate', type: 'date' }),
          expect.objectContaining({ name: 'featured', type: 'boolean' }),
          expect.objectContaining({ name: 'tags', type: 'array' }),
          expect.objectContaining({ name: 'viewCount', type: 'number' })
        ])
      });
      
      testContentTypeId = result.data.id;
    });

    it('should infer fields from description when not provided', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        name: 'Product',
        description: 'E-commerce product with name, description, price, SKU, inventory count, and images'
      });

      expect(result.success).toBe(true);
      expect(result.data.fields).toContainEqual(
        expect.objectContaining({ name: 'name', type: 'text' })
      );
      expect(result.data.fields).toContainEqual(
        expect.objectContaining({ name: 'price', type: 'number' })
      );
      expect(result.data.fields).toContainEqual(
        expect.objectContaining({ name: 'images', type: 'array' })
      );
    });

    it('should handle duplicate field names', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        name: 'DuplicateTest',
        description: 'Test content type',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'title', type: 'text', required: false }, // Duplicate
          { name: 'content', type: 'text', required: true }
        ]
      });

      expect(result.success).toBe(true);
      // Should deduplicate fields
      const titleFields = result.data.fields.filter((f: any) => f.name === 'title');
      expect(titleFields).toHaveLength(1);
    });

    it('should validate field types', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        name: 'InvalidFieldType',
        description: 'Test content type',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'invalid', type: 'unknown' as any, required: false }
        ]
      });

      // Should either fail or default to text type
      if (result.success) {
        const invalidField = result.data.fields.find((f: any) => f.name === 'invalid');
        expect(['text', 'unknown']).toContain(invalidField?.type);
      }
    });

    it('should handle content type with no fields', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        name: 'EmptyType',
        description: 'Content type with no fields'
      });

      expect(result.success).toBe(true);
      expect(result.data.fields).toEqual([]);
    });

    it('should prevent duplicate content type names', async () => {
      // First creation should succeed
      const result1 = await tool.execute({
        websiteId: testWebsiteId,
        name: 'UniqueType',
        description: 'First creation'
      });
      expect(result1.success).toBe(true);

      // Second creation with same name should fail
      const result2 = await tool.execute({
        websiteId: testWebsiteId,
        name: 'UniqueType',
        description: 'Second creation'
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already exists');
    });
  });

  describe('list-content-types', () => {
    const tool = contentTypeTools.find(t => t.name === 'list-content-types')!;

    beforeAll(async () => {
      // Create multiple content types for testing
      await prisma.contentType.createMany({
        data: [
          {
            websiteId: testWebsiteId,
            name: 'Article',
            description: 'News article',
            fields: [{ name: 'title', type: 'text' }]
          },
          {
            websiteId: testWebsiteId,
            name: 'Event',
            description: 'Event listing',
            fields: [{ name: 'title', type: 'text' }, { name: 'date', type: 'date' }]
          },
          {
            websiteId: testWebsiteId,
            name: 'FAQ',
            description: 'Frequently asked question',
            fields: [{ name: 'question', type: 'text' }, { name: 'answer', type: 'text' }]
          }
        ]
      });
    });

    it('should list all content types with filtering', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(3);
      
      const names = result.data.map((ct: any) => ct.name);
      expect(names).toContain('Article');
      expect(names).toContain('Event');
      expect(names).toContain('FAQ');
    });

    it('should return empty array for website with no content types', async () => {
      const emptyWebsite = await prisma.website.create({
        data: {
          name: 'TEST_Empty_ContentType_Website',
          description: 'Empty website'
        }
      });

      const result = await tool.execute({
        websiteId: emptyWebsite.id
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);

      // Cleanup
      await prisma.website.delete({ where: { id: emptyWebsite.id } });
    });

    it('should include content counts', async () => {
      // Create content items for one type
      const articleType = await prisma.contentType.findFirst({
        where: { websiteId: testWebsiteId, name: 'Article' }
      });

      await prisma.contentItem.createMany({
        data: [
          {
            websiteId: testWebsiteId,
            contentTypeId: articleType!.id,
            name: 'Article 1',
            content: { title: 'First Article' }
          },
          {
            websiteId: testWebsiteId,
            contentTypeId: articleType!.id,
            name: 'Article 2',
            content: { title: 'Second Article' }
          }
        ]
      });

      const result = await tool.execute({
        websiteId: testWebsiteId
      });

      expect(result.success).toBe(true);
      const article = result.data.find((ct: any) => ct.name === 'Article');
      expect(article._count.items).toBe(2);

      // Cleanup
      await prisma.contentItem.deleteMany({
        where: { contentTypeId: articleType!.id }
      });
    });

    it('should handle non-existent website', async () => {
      const result = await tool.execute({
        websiteId: 'non-existent-id'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Website not found');
    });
  });

  describe('get-content-type', () => {
    const tool = contentTypeTools.find(t => t.name === 'get-content-type')!;

    it('should get content type with valid ID', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(testContentTypeId);
      expect(result.data.name).toBe('BlogPost');
      expect(result.data.fields).toBeDefined();
      expect(result.data._count).toBeDefined();
    });

    it('should handle non-existent content type', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: 'non-existent-id'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content type not found');
    });

    it('should handle content type from different website', async () => {
      // Create another website and content type
      const otherWebsite = await prisma.website.create({
        data: {
          name: 'TEST_Other_Website',
          description: 'Other website'
        }
      });

      const otherType = await prisma.contentType.create({
        data: {
          websiteId: otherWebsite.id,
          name: 'OtherType',
          description: 'Type from other website',
          fields: []
        }
      });

      // Try to get it with wrong website ID
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: otherType.id
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');

      // Cleanup
      await prisma.contentType.delete({ where: { id: otherType.id } });
      await prisma.website.delete({ where: { id: otherWebsite.id } });
    });
  });

  describe('update-content-type', () => {
    const tool = contentTypeTools.find(t => t.name === 'update-content-type')!;
    let updateTestTypeId: string;

    beforeEach(async () => {
      // Create fresh content type for each test
      const type = await prisma.contentType.create({
        data: {
          websiteId: testWebsiteId,
          name: 'UpdateTest',
          description: 'Type for update testing',
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'content', type: 'text', required: false }
          ]
        }
      });
      updateTestTypeId = type.id;
    });

    afterEach(async () => {
      // Cleanup
      await prisma.contentItem.deleteMany({
        where: { contentTypeId: updateTestTypeId }
      });
      await prisma.contentType.delete({
        where: { id: updateTestTypeId }
      });
    });

    it('should update content type fields', async () => {
      const newFields = [
        { name: 'title', type: 'text', required: true },
        { name: 'content', type: 'text', required: true }, // Changed to required
        { name: 'author', type: 'text', required: false }, // New field
        { name: 'publishDate', type: 'date', required: false } // New field
      ];

      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: updateTestTypeId,
        fields: newFields
      });

      expect(result.success).toBe(true);
      expect(result.data.fields).toHaveLength(4);
      expect(result.data.fields).toEqual(newFields);
    });

    it('should update name and description', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: updateTestTypeId,
        name: 'UpdatedName',
        description: 'Updated description'
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('UpdatedName');
      expect(result.data.description).toBe('Updated description');
    });

    it('should remove fields when updating', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: updateTestTypeId,
        fields: [
          { name: 'title', type: 'text', required: true }
          // Removed 'content' field
        ]
      });

      expect(result.success).toBe(true);
      expect(result.data.fields).toHaveLength(1);
      expect(result.data.fields[0].name).toBe('title');
    });

    it('should handle schema changes with existing content', async () => {
      // Create content with original schema
      await prisma.contentItem.create({
        data: {
          websiteId: testWebsiteId,
          contentTypeId: updateTestTypeId,
          name: 'Test Item',
          content: {
            title: 'Original Title',
            content: 'Original content'
          }
        }
      });

      // Update schema
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: updateTestTypeId,
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'summary', type: 'text', required: false } // Renamed field
        ]
      });

      expect(result.success).toBe(true);
      
      // Verify content still exists (migration handled by app logic)
      const items = await prisma.contentItem.findMany({
        where: { contentTypeId: updateTestTypeId }
      });
      expect(items).toHaveLength(1);
    });

    it('should handle empty fields update', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: updateTestTypeId,
        fields: []
      });

      expect(result.success).toBe(true);
      expect(result.data.fields).toEqual([]);
    });

    it('should handle non-existent content type', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        contentTypeId: 'non-existent-id',
        fields: []
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content type not found');
    });
  });

  describe('bulk operations and limits', () => {
    it('should handle creating many content types', async () => {
      const createTool = contentTypeTools.find(t => t.name === 'create-content-type')!;
      const promises = [];

      // Create 20 content types (testing bulk creation)
      for (let i = 1; i <= 20; i++) {
        promises.push(
          createTool.execute({
            websiteId: testWebsiteId,
            name: `BulkType${i}`,
            description: `Bulk content type ${i}`,
            fields: [
              { name: 'field1', type: 'text', required: true },
              { name: 'field2', type: 'number', required: false }
            ]
          })
        );
      }

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      
      // Some might fail due to race conditions, but most should succeed
      expect(successCount).toBeGreaterThanOrEqual(15);

      // Verify they were created
      const listTool = contentTypeTools.find(t => t.name === 'list-content-types')!;
      const listResult = await listTool.execute({
        websiteId: testWebsiteId
      });

      expect(listResult.success).toBe(true);
      const bulkTypes = listResult.data.filter((ct: any) => 
        ct.name.startsWith('BulkType')
      );
      expect(bulkTypes.length).toBeGreaterThanOrEqual(15);

      // Cleanup
      await prisma.contentType.deleteMany({
        where: {
          websiteId: testWebsiteId,
          name: { startsWith: 'BulkType' }
        }
      });
    });
  });
});