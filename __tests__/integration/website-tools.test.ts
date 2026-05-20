import { getWebsiteContext } from '@/lib/ai-tools/tools/website/get-website-context';
import { updateBusinessRequirements } from '@/lib/ai-tools/tools/website/update-business-requirements';
import { validateContent } from '@/lib/ai-tools/tools/website/validate-content';
import { WebsiteService } from '@/lib/services/website-service';

// Mock dependencies
jest.mock('@/lib/services/website-service');
jest.mock('@/lib/db/client', () => ({
  getClient: jest.fn(() => ({
    $transaction: jest.fn(async (callback) => {
      const tx = {
        website: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'test-website-id',
            name: 'Test Blog',
            category: 'blog',
            isActive: true,
            metadata: JSON.stringify({
              contentTypes: ['article'],
              seoRequirements: { titleMaxLength: 60 },
            }),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          update: jest.fn().mockResolvedValue({
            id: 'test-website-id',
            name: 'Test Blog',
            category: 'blog',
            isActive: true,
            metadata: JSON.stringify({
              contentTypes: ['article', 'news'],
              seoRequirements: { titleMaxLength: 70 },
              requiredFields: { article: ['title', 'content', 'author'] },
            }),
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          create: jest.fn(),
          delete: jest.fn(),
        },
      };
      return callback(tx);
    }),
  })),
}));
jest.mock('@/lib/ai-tools/business-rules', () => ({
  businessRules: {
    validateForCategory: jest.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
    getRequiredFields: jest.fn().mockReturnValue(['title', 'content', 'author']),
    suggestFields: jest.fn().mockReturnValue([]),
  },
}));

describe('Website Tools Integration', () => {
  let mockWebsiteService: jest.Mocked<WebsiteService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWebsiteService = WebsiteService as any;
  });

  it('should work together to manage website context and validate content', async () => {
    // Setup initial website
    const initialWebsite = {
      id: 'test-website-id',
      name: 'Test Blog',
      category: 'blog',
      isActive: true,
      metadata: JSON.stringify({
        contentTypes: ['article'],
        seoRequirements: { titleMaxLength: 60 },
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Step 1: Get initial context
    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(initialWebsite);
    
    const contextResult = await getWebsiteContext.execute({ websiteId: 'test-website-id' });
    
    expect(contextResult.success).toBe(true);
    expect(contextResult.data.businessRequirements.category).toBe('blog');
    expect(contextResult.data.businessRequirements.contentTypes).toEqual(['article']);

    // Step 2: Update business requirements
    const updatedWebsite = {
      ...initialWebsite,
      metadata: JSON.stringify({
        contentTypes: ['article', 'news'],
        seoRequirements: { titleMaxLength: 70 },
        requiredFields: { article: ['title', 'content', 'author'] },
      }),
    };

    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(initialWebsite);
    mockWebsiteService.prototype.updateWebsite = jest.fn().mockResolvedValue(updatedWebsite);

    const updateResult = await updateBusinessRequirements.execute({
      websiteId: 'test-website-id',
      contentTypes: ['article', 'news'],
      seoRequirements: { titleMaxLength: 70 },
      requiredFields: { article: ['title', 'content', 'author'] },
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.data.updated.contentTypes).toEqual(['article', 'news']);

    // Step 3: Validate content against updated requirements
    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(updatedWebsite);

    const contentToValidate = {
      title: 'Test Article',
      content: 'This is the article content',
      author: 'John Doe',
    };

    const validateResult = await validateContent.execute({
      websiteId: 'test-website-id',
      contentType: 'article',
      content: contentToValidate,
      strictMode: false,
    });

    expect(validateResult.success).toBe(true);
    // Content should be valid as it has all required fields
    expect(validateResult.data.valid).toBe(true);
  });

  it('should validate that tools handle errors gracefully', async () => {
    // Test error handling in get-website-context
    mockWebsiteService.prototype.getWebsite = jest.fn().mockRejectedValue(new Error('Database error'));
    
    const contextResult = await getWebsiteContext.execute({ websiteId: 'error-test-id' });
    
    expect(contextResult.success).toBe(false);
    expect(contextResult.error).toBe('Database error');

    // Test error handling in update-business-requirements
    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(null);
    
    const updateResult = await updateBusinessRequirements.execute({
      websiteId: 'non-existent-id',
      category: 'blog',
    });
    
    expect(updateResult.success).toBe(false);
    expect(updateResult.error).toContain('not found');

    // Test error handling in validate-content
    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(null);
    
    const validateResult = await validateContent.execute({
      websiteId: 'non-existent-id',
      contentType: 'article',
      content: { title: 'Test' },
      strictMode: false,
    });
    
    expect(validateResult.success).toBe(false);
    expect(validateResult.error).toContain('not found');
  });

  it('should maintain performance requirements', async () => {
    const website = {
      id: 'perf-test-id',
      name: 'Performance Test',
      category: 'blog',
      isActive: true,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock a fast response
    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(website);

    const startTime = Date.now();
    const result = await getWebsiteContext.execute({ websiteId: 'perf-test-id' });
    const executionTime = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
    expect(result.data.executionTime).toBeDefined();
  });
});