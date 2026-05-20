/**
 * Website Management Tools Integration Tests
 * Tests all website-related AI tools with various states and edge cases
 */

import { allTools } from '@/lib/ai-tools/tools';
import { prisma } from '@/lib/prisma';

describe('Website Management Tools', () => {
  let testWebsiteId: string;
  const websiteTools = allTools.filter(t => 
    ['get-website-context', 'update-business-requirements', 'validate-content'].includes(t.name)
  );

  beforeAll(async () => {
    // Create test website
    const website = await prisma.website.create({
      data: {
        name: 'TEST_Integration_Website',
        description: 'Website for integration testing',
        businessRequirements: [
          'All content must have a title',
          'Descriptions must be at least 50 characters',
          'Dates must be in ISO format'
        ]
      }
    });
    testWebsiteId = website.id;

    // Create test content types
    await prisma.contentType.create({
      data: {
        websiteId: testWebsiteId,
        name: 'Article',
        description: 'Article content type',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'content', type: 'text', required: true },
          { name: 'publishDate', type: 'date', required: true }
        ]
      }
    });

    await prisma.contentType.create({
      data: {
        websiteId: testWebsiteId,
        name: 'Page',
        description: 'Static page content type',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'slug', type: 'text', required: true },
          { name: 'content', type: 'text', required: true }
        ]
      }
    });
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

  describe('get-website-context', () => {
    const tool = websiteTools.find(t => t.name === 'get-website-context')!;

    it('should retrieve context for website with content', async () => {
      const result = await tool.execute({ websiteId: testWebsiteId });

      expect(result.success).toBe(true);
      expect(result.data.website.id).toBe(testWebsiteId);
      expect(result.data.website.name).toBe('TEST_Integration_Website');
      expect(result.data.contentTypes).toHaveLength(2);
      expect(result.data.businessRules).toHaveLength(3);
      expect(result.data.statistics).toMatchObject({
        totalContentTypes: 2,
        totalContentItems: 0,
        lastUpdated: expect.any(String)
      });
    });

    it('should handle empty website', async () => {
      // Create empty website
      const emptyWebsite = await prisma.website.create({
        data: {
          name: 'TEST_Empty_Website',
          description: 'Empty website for testing'
        }
      });

      const result = await tool.execute({ websiteId: emptyWebsite.id });

      expect(result.success).toBe(true);
      expect(result.data.contentTypes).toHaveLength(0);
      expect(result.data.businessRules).toHaveLength(0);
      expect(result.data.statistics.totalContentTypes).toBe(0);

      // Cleanup
      await prisma.website.delete({ where: { id: emptyWebsite.id } });
    });

    it('should handle non-existent website', async () => {
      const result = await tool.execute({ 
        websiteId: 'non-existent-id' 
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Website not found');
    });

    it('should include recent content when available', async () => {
      // Create some content items
      const contentType = await prisma.contentType.findFirst({
        where: { websiteId: testWebsiteId, name: 'Article' }
      });

      await prisma.contentItem.createMany({
        data: [
          {
            websiteId: testWebsiteId,
            contentTypeId: contentType!.id,
            name: 'Test Article 1',
            content: {
              title: 'First Article',
              content: 'This is the content of the first article for testing purposes',
              publishDate: '2025-01-14'
            }
          },
          {
            websiteId: testWebsiteId,
            contentTypeId: contentType!.id,
            name: 'Test Article 2',
            content: {
              title: 'Second Article',
              content: 'This is the content of the second article for testing purposes',
              publishDate: '2025-01-15'
            }
          }
        ]
      });

      const result = await tool.execute({ websiteId: testWebsiteId });

      expect(result.success).toBe(true);
      expect(result.data.recentContent).toHaveLength(2);
      expect(result.data.statistics.totalContentItems).toBe(2);

      // Cleanup
      await prisma.contentItem.deleteMany({
        where: { contentTypeId: contentType!.id }
      });
    });
  });

  describe('update-business-requirements', () => {
    const tool = websiteTools.find(t => t.name === 'update-business-requirements')!;

    it('should update business requirements successfully', async () => {
      const newRequirements = [
        'Content must be family-friendly',
        'All images must have alt text',
        'Links must open in new tabs'
      ];

      const result = await tool.execute({
        websiteId: testWebsiteId,
        requirements: newRequirements
      });

      expect(result.success).toBe(true);
      expect(result.data.businessRequirements).toEqual(newRequirements);

      // Verify persistence
      const website = await prisma.website.findUnique({
        where: { id: testWebsiteId }
      });
      expect(website!.businessRequirements).toEqual(newRequirements);
    });

    it('should handle empty requirements', async () => {
      const result = await tool.execute({
        websiteId: testWebsiteId,
        requirements: []
      });

      expect(result.success).toBe(true);
      expect(result.data.businessRequirements).toEqual([]);
    });

    it('should validate requirement format', async () => {
      const invalidRequirements = [
        'Valid requirement',
        '', // Empty string
        '   ', // Whitespace only
        'Another valid requirement'
      ];

      const result = await tool.execute({
        websiteId: testWebsiteId,
        requirements: invalidRequirements
      });

      expect(result.success).toBe(true);
      // Should filter out invalid requirements
      expect(result.data.businessRequirements).toHaveLength(2);
      expect(result.data.businessRequirements).not.toContain('');
      expect(result.data.businessRequirements).not.toContain('   ');
    });

    it('should handle non-existent website', async () => {
      const result = await tool.execute({
        websiteId: 'non-existent-id',
        requirements: ['Some requirement']
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Website not found');
    });

    it('should handle very long requirements list', async () => {
      const longRequirements = Array.from({ length: 100 }, (_, i) => 
        `Requirement ${i + 1}: This is a detailed business requirement for testing`
      );

      const result = await tool.execute({
        websiteId: testWebsiteId,
        requirements: longRequirements
      });

      expect(result.success).toBe(true);
      expect(result.data.businessRequirements).toHaveLength(100);
    });
  });

  describe('validate-content', () => {
    const tool = websiteTools.find(t => t.name === 'validate-content')!;

    beforeAll(async () => {
      // Reset business requirements for validation tests
      await prisma.website.update({
        where: { id: testWebsiteId },
        data: {
          businessRequirements: [
            'All content must have a title',
            'Descriptions must be at least 50 characters',
            'Dates must be in ISO format',
            'Prices must include currency symbol',
            'Email addresses must be valid'
          ]
        }
      });
    });

    it('should validate content successfully against rules', async () => {
      const validContent = {
        title: 'Valid Article Title',
        description: 'This is a valid description that meets the minimum character requirement for our business rules',
        publishDate: '2025-01-14',
        price: '$99.99',
        email: 'test@example.com'
      };

      const result = await tool.execute({
        websiteId: testWebsiteId,
        content: validContent
      });

      expect(result.success).toBe(true);
      expect(result.data.isValid).toBe(true);
      expect(result.data.violations).toHaveLength(0);
    });

    it('should detect missing title violation', async () => {
      const invalidContent = {
        description: 'Description without a title',
        publishDate: '2025-01-14'
      };

      const result = await tool.execute({
        websiteId: testWebsiteId,
        content: invalidContent
      });

      expect(result.success).toBe(true);
      expect(result.data.isValid).toBe(false);
      expect(result.data.violations).toContainEqual(
        expect.objectContaining({
          rule: 'All content must have a title',
          field: 'title'
        })
      );
    });

    it('should detect short description violation', async () => {
      const invalidContent = {
        title: 'Valid Title',
        description: 'Too short',
        publishDate: '2025-01-14'
      };

      const result = await tool.execute({
        websiteId: testWebsiteId,
        content: invalidContent
      });

      expect(result.success).toBe(true);
      expect(result.data.isValid).toBe(false);
      expect(result.data.violations).toContainEqual(
        expect.objectContaining({
          rule: 'Descriptions must be at least 50 characters',
          field: 'description'
        })
      );
    });

    it('should detect invalid date format', async () => {
      const invalidContent = {
        title: 'Valid Title',
        description: 'This is a valid description that meets the minimum character requirement',
        publishDate: '01/14/2025' // Wrong format
      };

      const result = await tool.execute({
        websiteId: testWebsiteId,
        content: invalidContent
      });

      expect(result.success).toBe(true);
      expect(result.data.isValid).toBe(false);
      expect(result.data.violations).toContainEqual(
        expect.objectContaining({
          rule: 'Dates must be in ISO format',
          violation: expect.stringContaining('Invalid ISO format')
        })
      );
    });

    it('should detect missing currency symbol', async () => {
      const invalidContent = {
        title: 'Product Title',
        description: 'This is a product description that meets the minimum character requirement',
        price: '99.99' // Missing currency symbol
      };

      const result = await tool.execute({
        websiteId: testWebsiteId,
        content: invalidContent
      });

      expect(result.success).toBe(true);
      expect(result.data.isValid).toBe(false);
      expect(result.data.violations).toContainEqual(
        expect.objectContaining({
          rule: 'Prices must include currency symbol',
          field: 'price'
        })
      );
    });

    it('should detect invalid email format', async () => {
      const invalidContent = {
        title: 'Contact Page',
        description: 'This is a contact page with an invalid email address for testing purposes',
        email: 'not-an-email'
      };

      const result = await tool.execute({
        websiteId: testWebsiteId,
        content: invalidContent
      });

      expect(result.success).toBe(true);
      expect(result.data.isValid).toBe(false);
      expect(result.data.violations).toContainEqual(
        expect.objectContaining({
          rule: 'Email addresses must be valid',
          field: 'email'
        })
      );
    });

    it('should handle content with no rules', async () => {
      // Create website with no rules
      const noRulesWebsite = await prisma.website.create({
        data: {
          name: 'TEST_No_Rules_Website',
          description: 'Website without business rules'
        }
      });

      const result = await tool.execute({
        websiteId: noRulesWebsite.id,
        content: { anything: 'goes' }
      });

      expect(result.success).toBe(true);
      expect(result.data.isValid).toBe(true);
      expect(result.data.violations).toHaveLength(0);

      // Cleanup
      await prisma.website.delete({ where: { id: noRulesWebsite.id } });
    });

    it('should handle complex nested content', async () => {
      const complexContent = {
        title: 'Complex Content',
        description: 'This is a complex content item with nested structures for comprehensive testing',
        metadata: {
          author: 'Test Author',
          tags: ['test', 'validation', 'complex'],
          publishDate: '2025-01-14'
        },
        sections: [
          {
            heading: 'Section 1',
            content: 'Section content with sufficient length for validation rules'
          },
          {
            heading: 'Section 2',
            content: 'Another section'
          }
        ],
        price: '$199.99',
        email: 'valid@example.com'
      };

      const result = await tool.execute({
        websiteId: testWebsiteId,
        content: complexContent
      });

      expect(result.success).toBe(true);
      // Should validate nested date and other fields
      expect(result.data.isValid).toBe(true);
    });

    it('should handle non-existent website', async () => {
      const result = await tool.execute({
        websiteId: 'non-existent-id',
        content: { title: 'Test' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Website not found');
    });
  });
});