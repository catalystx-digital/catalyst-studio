import { createContentType } from '../create-content-type';
import * as contentTypeService from '@/lib/services/content-type-service';
import { businessRules } from '@/lib/ai-tools/business-rules';
import { getClient } from '@/lib/db/client';

jest.mock('@/lib/services/content-type-service');
jest.mock('@/lib/ai-tools/business-rules');
jest.mock('@/lib/db/client');

describe('createContentType', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (businessRules.getRequiredFields as jest.Mock).mockReturnValue([]);
    (businessRules.suggestFields as jest.Mock).mockReturnValue([]);
    (businessRules.validateForCategory as jest.Mock).mockReturnValue({ valid: true });
  });

  it('should create a basic content type without category', async () => {
    const mockCreated = {
      id: 'ct-new',
      websiteId: 'web1',
      name: 'Custom Type',
      fields: [
        { name: 'title', type: 'text', required: true }
      ],
      settings: { autoInferred: true },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    (contentTypeService.createContentType as jest.Mock).mockResolvedValue(mockCreated);

    const result = await createContentType.execute({
      websiteId: 'web1',
      name: 'Custom Type',
      fields: [{ name: 'title', type: 'text', required: true }]
    });

    expect(result.success).toBe(true);
    expect(result.contentType.name).toBe('Custom Type');
    expect(result.inferredFieldsCount).toBe(1);
  });

  it('should add SEO fields for blog category', async () => {
    (contentTypeService.createContentType as jest.Mock).mockImplementation(async (params) => {
      return {
        id: 'ct-blog',
        websiteId: params.websiteId,
        name: params.name,
        fields: params.fields,
        settings: { category: 'blog', autoInferred: true },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    const result = await createContentType.execute({
      websiteId: 'web1',
      name: 'Blog Post',
      category: 'blog'
    });

    expect(result.success).toBe(true);
    expect(result.contentType.category).toBe('blog');
    
    // Check for SEO fields
    const fieldNames = result.contentType.fields.map((f: any) => f.name);
    expect(fieldNames).toContain('metaTitle');
    expect(fieldNames).toContain('metaDescription');
    expect(fieldNames).toContain('slug');
    expect(fieldNames).toContain('title');
    expect(fieldNames).toContain('content');
    expect(fieldNames).toContain('author');
    expect(fieldNames).toContain('publishDate');
  });

  it('should add product fields for e-commerce category', async () => {
    (contentTypeService.createContentType as jest.Mock).mockImplementation(async (params) => {
      return {
        id: 'ct-product',
        websiteId: params.websiteId,
        name: params.name,
        fields: params.fields,
        settings: { category: 'e-commerce', autoInferred: true },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    const result = await createContentType.execute({
      websiteId: 'web1',
      name: 'Product',
      category: 'e-commerce'
    });

    expect(result.success).toBe(true);
    expect(result.contentType.category).toBe('e-commerce');
    
    // Check for product fields
    const fieldNames = result.contentType.fields.map((f: any) => f.name);
    expect(fieldNames).toContain('name');
    expect(fieldNames).toContain('price');
    expect(fieldNames).toContain('sku');
    expect(fieldNames).toContain('stock');
    expect(fieldNames).toContain('availability');
    expect(fieldNames).toContain('images');
  });

  it('should add portfolio fields for portfolio category', async () => {
    (contentTypeService.createContentType as jest.Mock).mockImplementation(async (params) => {
      return {
        id: 'ct-portfolio',
        websiteId: params.websiteId,
        name: params.name,
        fields: params.fields,
        settings: { category: 'portfolio', autoInferred: true },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    const result = await createContentType.execute({
      websiteId: 'web1',
      name: 'Portfolio Item',
      category: 'portfolio'
    });

    expect(result.success).toBe(true);
    
    const fieldNames = result.contentType.fields.map((f: any) => f.name);
    expect(fieldNames).toContain('title');
    expect(fieldNames).toContain('client');
    expect(fieldNames).toContain('skills');
    expect(fieldNames).toContain('showcase');
  });

  it('should merge custom fields with inferred fields', async () => {
    (contentTypeService.createContentType as jest.Mock).mockImplementation(async (params) => {
      return {
        id: 'ct-custom-blog',
        websiteId: params.websiteId,
        name: params.name,
        fields: params.fields,
        settings: { category: 'blog', autoInferred: true },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    const customFields = [
      { name: 'customField', type: 'text', required: false }
    ];

    const result = await createContentType.execute({
      websiteId: 'web1',
      name: 'Custom Blog',
      category: 'blog',
      fields: customFields
    });

    expect(result.success).toBe(true);
    
    const fieldNames = result.contentType.fields.map((f: any) => f.name);
    expect(fieldNames).toContain('customField');
    expect(fieldNames).toContain('metaTitle'); // Inferred field
  });

  it('should handle transaction rollback on failure', async () => {
    const error = new Error('Transaction failed');
    (contentTypeService.createContentType as jest.Mock).mockRejectedValue(error);

    const result = await createContentType.execute({
      websiteId: 'web1',
      name: 'Failed Type'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction failed');
  });

  it('should warn if execution exceeds 2 seconds', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    (contentTypeService.createContentType as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        id: 'ct-slow',
        websiteId: 'web1',
        name: 'Slow Type',
        fields: [],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date()
      }), 2100))
    );

    await createContentType.execute({
      websiteId: 'web1',
      name: 'Slow Type'
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('exceeded 2s'));
    consoleSpy.mockRestore();
  });

  it('should not duplicate fields when inferring', async () => {
    (contentTypeService.createContentType as jest.Mock).mockImplementation(async (params) => {
      return {
        id: 'ct-no-dup',
        websiteId: params.websiteId,
        name: params.name,
        fields: params.fields,
        settings: { category: 'blog', autoInferred: true },
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    const result = await createContentType.execute({
      websiteId: 'web1',
      name: 'Blog with Title',
      category: 'blog',
      fields: [{ name: 'title', type: 'text', required: true, label: 'Custom Title' }]
    });

    expect(result.success).toBe(true);
    
    // Should only have one title field
    const titleFields = result.contentType.fields.filter((f: any) => f.name === 'title');
    expect(titleFields).toHaveLength(1);
    expect(titleFields[0].label).toBe('Custom Title'); // Custom field should take precedence
  });
});