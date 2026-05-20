import { getContentType } from '../get-content-type';
import * as contentTypeService from '@/lib/services/content-type-service';

jest.mock('@/lib/services/content-type-service');

describe('getContentType', () => {
  const mockContentType = {
    id: 'ct1',
    websiteId: 'web1',
    name: 'Blog Post',
    fields: [
      { name: 'title', type: 'text', required: true },
      { name: 'content', type: 'richtext', required: true },
      { name: 'metaTitle', type: 'text', required: false },
      { name: 'metaDescription', type: 'text', required: false }
    ],
    settings: { published: true, seoEnabled: true },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15')
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get content type by ID successfully', async () => {
    (contentTypeService.getContentType as jest.Mock).mockResolvedValue(mockContentType);

    const result = await getContentType.execute({ id: 'ct1' });

    expect(contentTypeService.getContentType).toHaveBeenCalledWith('ct1');
    expect(result.success).toBe(true);
    expect(result.contentType).toEqual({
      id: mockContentType.id,
      websiteId: mockContentType.websiteId,
      name: mockContentType.name,
      fields: mockContentType.fields,
      settings: mockContentType.settings,
      createdAt: mockContentType.createdAt,
      updatedAt: mockContentType.updatedAt
    });
  });

  it('should handle not found content type', async () => {
    (contentTypeService.getContentType as jest.Mock).mockResolvedValue(null);

    const result = await getContentType.execute({ id: 'non-existent' });

    expect(contentTypeService.getContentType).toHaveBeenCalledWith('non-existent');
    expect(result.success).toBe(false);
    expect(result.error).toBe("Content type with ID 'non-existent' not found");
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Database error');
    (contentTypeService.getContentType as jest.Mock).mockRejectedValue(error);

    const result = await getContentType.execute({ id: 'ct1' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database error');
  });

  it('should include execution time in response', async () => {
    (contentTypeService.getContentType as jest.Mock).mockResolvedValue(mockContentType);

    const result = await getContentType.execute({ id: 'ct1' });

    expect(result.executionTime).toMatch(/^\d+ms$/);
  });

  it('should warn if execution exceeds 2 seconds', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    (contentTypeService.getContentType as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockContentType), 2100))
    );

    await getContentType.execute({ id: 'ct1' });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('exceeded 2s'));
    consoleSpy.mockRestore();
  });

  it('should validate required parameters', () => {
    const schema = getContentType.parameters;
    
    const validInput = { id: 'ct1' };
    expect(() => schema.parse(validInput)).not.toThrow();
    
    const invalidInput = {};
    expect(() => schema.parse(invalidInput)).toThrow();
  });
});