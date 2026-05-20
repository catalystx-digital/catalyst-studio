import { validateContent } from '../validate-content';
import { WebsiteService } from '@/lib/services/website-service';
import { businessRules } from '../../../business-rules';

// Mock dependencies
jest.mock('@/lib/services/website-service');
jest.mock('../../../business-rules', () => ({
  businessRules: {
    validateForCategory: jest.fn(),
    getRequiredFields: jest.fn(),
    suggestFields: jest.fn(),
  },
}));

describe('validateContent tool', () => {
  let mockWebsiteService: jest.Mocked<WebsiteService>;
  let mockBusinessRules: jest.Mocked<typeof businessRules>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWebsiteService = WebsiteService as any;
    mockBusinessRules = businessRules as any;
  });

  it('should validate content successfully with no errors', async () => {
    const mockWebsite = {
      id: 'test-website-id',
      category: 'blog',
      metadata: JSON.stringify({ customRules: [] }),
    };

    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(mockWebsite);
    mockBusinessRules.validateForCategory.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
    });
    mockBusinessRules.getRequiredFields.mockReturnValue(['title', 'content', 'author']);
    mockBusinessRules.suggestFields.mockReturnValue(['metaDescription', 'tags']);

    const content = {
      title: 'Test Article',
      content: 'Article content',
      author: 'John Doe',
    };

    const result = await validateContent.execute({
      websiteId: 'test-website-id',
      contentType: 'article',
      content,
      strictMode: false,
    });

    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(true);
    expect(result.data.category).toBe('blog');
    expect(result.data.errors).toEqual([]);
    expect(result.data.summary.totalErrors).toBe(0);
    expect(result.data.suggestions.recommendedFields).toContain('metaDescription');
  });

  it('should return validation errors for missing required fields', async () => {
    const mockWebsite = {
      id: 'test-website-id',
      category: 'ecommerce',
      metadata: null,
    };

    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(mockWebsite);
    mockBusinessRules.validateForCategory.mockResolvedValue({
      valid: false,
      errors: [{ field: 'price', message: 'Price must be positive' }],
      warnings: [],
    });
    mockBusinessRules.getRequiredFields.mockReturnValue(['title', 'price', 'sku']);
    mockBusinessRules.suggestFields.mockReturnValue([]);

    const content = {
      title: 'Test Product',
      // Missing price and sku
    };

    const result = await validateContent.execute({
      websiteId: 'test-website-id',
      contentType: 'product',
      content,
      strictMode: false,
    });

    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(false);
    expect(result.data.errors.length).toBeGreaterThan(0);
    expect(result.data.errors.some(e => e.field === 'price')).toBe(true);
    expect(result.data.errors.some(e => e.field === 'sku')).toBe(true);
    expect(result.data.summary.totalErrors).toBeGreaterThan(0);
  });

  it('should apply custom validation rules', async () => {
    const mockWebsite = {
      id: 'test-website-id',
      category: 'blog',
      metadata: JSON.stringify({
        customRules: [
          {
            name: 'title-length',
            description: 'Title must be long enough',
            condition: 'title exists',
            action: 'warning: Consider a longer title',
          },
        ],
      }),
    };

    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(mockWebsite);
    mockBusinessRules.validateForCategory.mockResolvedValue({ valid: true });
    mockBusinessRules.getRequiredFields.mockReturnValue(['title']);
    mockBusinessRules.suggestFields.mockReturnValue([]);

    const content = {
      title: 'Test Title',
    };

    const result = await validateContent.execute({
      websiteId: 'test-website-id',
      contentType: 'article',
      content,
      strictMode: false,
    });

    expect(result.success).toBe(true);
    // With a warning but still valid since not in strict mode
    expect(result.data.warnings.length).toBeGreaterThan(0);
  });

  it('should treat warnings as errors in strict mode', async () => {
    const mockWebsite = {
      id: 'test-website-id',
      category: 'blog',
      metadata: null,
    };

    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(mockWebsite);
    mockBusinessRules.validateForCategory.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [{ field: 'tags', message: 'Consider adding tags' }],
    });
    mockBusinessRules.getRequiredFields.mockReturnValue(['title']);
    mockBusinessRules.suggestFields.mockReturnValue(['tags', 'metaDescription']);

    const content = {
      title: 'Test Article',
    };

    const result = await validateContent.execute({
      websiteId: 'test-website-id',
      contentType: 'article',
      content,
      strictMode: true,
    });

    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(false);
    expect(result.data.errors.length).toBeGreaterThan(0);
    expect(result.data.warnings.length).toBe(0);
  });

  it('should return error when website not found', async () => {
    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(null);

    const result = await validateContent.execute({
      websiteId: 'non-existent-id',
      contentType: 'article',
      content: { title: 'Test' },
      strictMode: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Website with ID non-existent-id not found');
  });

  it('should calculate completeness percentage', async () => {
    const mockWebsite = {
      id: 'test-website-id',
      category: 'blog',
      metadata: null,
    };

    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(mockWebsite);
    mockBusinessRules.validateForCategory.mockResolvedValue({ valid: true });
    mockBusinessRules.getRequiredFields.mockReturnValue(['title', 'content', 'author', 'tags']);
    mockBusinessRules.suggestFields.mockReturnValue([]);

    const content = {
      title: 'Test Article',
      content: 'Article content',
      author: 'John Doe',
      // Missing 'tags', so 3 out of 4 fields = 75%
    };

    const result = await validateContent.execute({
      websiteId: 'test-website-id',
      contentType: 'article',
      content,
      strictMode: false,
    });

    expect(result.success).toBe(true);
    expect(result.data.summary.completeness).toBe(75);
  });

  it('should complete execution within 2 seconds', async () => {
    mockWebsiteService.prototype.getWebsite = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ id: 'test-id', category: 'blog' }), 100))
    );
    mockBusinessRules.validateForCategory.mockResolvedValue({ valid: true });
    mockBusinessRules.getRequiredFields.mockReturnValue(['title']);
    mockBusinessRules.suggestFields.mockReturnValue([]);

    const startTime = Date.now();
    const result = await validateContent.execute({
      websiteId: 'test-id',
      contentType: 'article',
      content: { title: 'Test' },
      strictMode: false,
    });
    const executionTime = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(executionTime).toBeLessThan(2000);
  });

  it('should handle validation errors gracefully', async () => {
    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue({ id: 'test-id', category: 'blog' });
    mockBusinessRules.validateForCategory.mockRejectedValue(new Error('Validation failed'));

    const result = await validateContent.execute({
      websiteId: 'test-id',
      contentType: 'article',
      content: { title: 'Test' },
      strictMode: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Validation failed');
  });
});