/**
 * AI Tools Test Suite
 * Tests all AI tools with actual database operations
 */

import { tools } from '@/lib/ai-tools/tools';
import { prisma } from '@/lib/prisma';

// Mock the AI SDK if needed for context generation
jest.mock('ai');
jest.mock('@ai-sdk/openai');

describe('AI Tools Test Suite', () => {
  let testWebsiteId: string;
  let testContentTypeId: string;
  let testContentItemId: string;

  beforeAll(async () => {
    // Create test website and content type for testing
    const website = await prisma.website.create({
      data: {
        name: 'TEST_E-commerce Store',
        description: 'A test online store for testing AI tools',
        category: 'e-commerce',
        metadata: JSON.stringify({
          businessRequirements: [
            'Product descriptions must be at least 100 characters',
            'All prices must include currency symbol',
            'Categories are required for all products'
          ]
        })
      }
    });
    testWebsiteId = website.id;

    const contentType = await prisma.contentType.create({
      data: {
        name: 'TEST_Product',
        key: 'test_product',
        pluralName: 'TEST_Products',
        websiteId: testWebsiteId,
        category: 'page',
        fields: JSON.stringify([
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'text', required: true },
          { name: 'price', type: 'number', required: true },
          { name: 'category', type: 'text', required: true },
          { name: 'inStock', type: 'boolean', required: false },
          { name: 'images', type: 'array', required: false }
        ])
      }
    });
    testContentTypeId = contentType.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testContentItemId) {
      await prisma.contentItem.deleteMany({
        where: { contentTypeId: testContentTypeId }
      });
    }
    if (testContentTypeId) {
      await prisma.contentType.deleteMany({
        where: { id: testContentTypeId }
      });
    }
    if (testWebsiteId) {
      await prisma.website.deleteMany({
        where: { id: testWebsiteId }
      });
    }
  });

  describe('Website Management Tools', () => {
    it('should get website context', async () => {
      const getWebsiteContext = tools.getWebsiteContext;
      expect(getWebsiteContext).toBeDefined();

      const result = await getWebsiteContext.execute({
        websiteId: testWebsiteId
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('website');
      expect(result.data.website.name).toBe('TEST_E-commerce Store');
      expect(result.data.businessRequirements).toHaveProperty('rules');
      expect(result.data.businessRequirements.rules).toHaveLength(3);
    });

    it('should update business requirements', async () => {
      const updateBusinessRequirements = tools.updateBusinessRequirements;
      expect(updateBusinessRequirements).toBeDefined();

      const result = await updateBusinessRequirements.execute({
        websiteId: testWebsiteId,
        requirements: [
          'New requirement: Product titles must be unique',
          'New requirement: SKU field is mandatory'
        ]
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('updatedRequirements');
    });

    it('should validate content against business rules', async () => {
      const validateContent = tools.validateContent;
      expect(validateContent).toBeDefined();

      const result = await validateContent.execute({
        websiteId: testWebsiteId,
        content: {
          title: 'Test Product',
          description: 'This is a test product description that is long enough to meet the minimum character requirement for product descriptions.',
          price: '$99.99',
          category: 'Electronics'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('isValid');
    });
  });

  describe('Content Type Management Tools', () => {
    it('should list content types', async () => {
      const listContentTypes = tools.listContentTypes;
      expect(listContentTypes).toBeDefined();

      const result = await listContentTypes.execute({
        websiteId: testWebsiteId
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('contentTypes');
      expect(Array.isArray(result.data.contentTypes)).toBe(true);
      expect(result.data.contentTypes.length).toBeGreaterThan(0);
    });

    it('should get content type details', async () => {
      const getContentType = tools.getContentType;
      expect(getContentType).toBeDefined();

      const result = await getContentType.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('contentType');
      expect(result.data.contentType.name).toBe('TEST_Product');
    });

    it('should create a new content type', async () => {
      const createContentType = tools.createContentType;
      expect(createContentType).toBeDefined();

      const result = await createContentType.execute({
        websiteId: testWebsiteId,
        name: 'TEST_Category',
        description: 'Product category',
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'slug', type: 'text', required: true },
          { name: 'parentId', type: 'text', required: false }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data.name).toBe('TEST_Category');
      
      // Clean up
      await prisma.contentType.delete({ where: { id: result.data.id } });
    });

    it('should update content type fields', async () => {
      const updateContentType = tools.updateContentType;
      expect(updateContentType).toBeDefined();

      const result = await updateContentType.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'text', required: true },
          { name: 'price', type: 'number', required: true },
          { name: 'category', type: 'text', required: true },
          { name: 'inStock', type: 'boolean', required: false },
          { name: 'images', type: 'array', required: false },
          { name: 'sku', type: 'text', required: true } // New field
        ]
      });

      expect(result.success).toBe(true);
      expect(result.data.fields).toHaveLength(7);
    });
  });

  describe('Page Management Tools', () => {
    it('should create a page', async () => {
      const createPage = tools.createPage;
      expect(createPage).toBeDefined();

      const result = await createPage.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId,
        title: 'Gaming Laptop',
        content: {
          title: 'Gaming Laptop',
          description: 'High-performance gaming laptop with RTX 4080 graphics card and Intel i9 processor. Perfect for gaming and content creation.',
          price: '$2499.99',
          category: 'Electronics',
          inStock: true,
          sku: 'LAP-001'
        }
      });

      expect(result.success).toBe(true);
      expect(result.page).toHaveProperty('id');
      testContentItemId = result.page.id;
    });

    it('should list content items', async () => {
      const listContentItems = tools.listContentItems;
      expect(listContentItems).toBeDefined();

      const result = await listContentItems.execute({
        websiteId: testWebsiteId,
        contentTypeId: testContentTypeId
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('contentItems');
      expect(Array.isArray(result.data.contentItems)).toBe(true);
      expect(result.data.contentItems.length).toBeGreaterThan(0);
    });

    it('should update a content item', async () => {
      const updateContentItem = tools.updateContentItem;
      expect(updateContentItem).toBeDefined();

      const result = await updateContentItem.execute({
        websiteId: testWebsiteId,
        contentItemId: testContentItemId,
        content: {
          title: 'Gaming Laptop - Updated',
          description: 'Updated description: High-performance gaming laptop with RTX 4080 graphics card and Intel i9 processor. Now with 32GB RAM.',
          price: '$2299.99', // Price reduced
          category: 'Electronics',
          inStock: false, // Out of stock
          sku: 'LAP-001'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.content).toContain('Updated description');
    });
  });

  describe('Echo Tool', () => {
    it('should echo back the input message', async () => {
      const echoTool = tools.echoTool;
      expect(echoTool).toBeDefined();

      const result = await echoTool.execute({
        message: 'Test message for echo tool'
      });

      expect(result.success).toBe(true);
      expect(result.data.echo).toBe('Test message for echo tool');
      expect(result.data).toHaveProperty('timestamp');
    });
  });
});