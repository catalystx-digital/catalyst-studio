import { listContentTypes } from '../list-content-types';
import * as contentTypeService from '@/lib/services/content-type-service';

jest.mock('@/lib/services/content-type-service');

describe('listContentTypes', () => {
  const mockContentTypes = [
    {
      id: 'ct1',
      websiteId: 'web1',
      name: 'Blog Post',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'content', type: 'richtext', required: true }
      ],
      settings: { published: true },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    },
    {
      id: 'ct2',
      websiteId: 'web1',
      name: 'Product',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'price', type: 'number', required: true }
      ],
      settings: { published: true },
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02')
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list all content types without filter', async () => {
    (contentTypeService.getContentTypes as jest.Mock).mockResolvedValue(mockContentTypes);

    const result = await listContentTypes.execute({});

    expect(contentTypeService.getContentTypes).toHaveBeenCalledWith(undefined);
    expect(result.success).toBe(true);
    expect(result.contentTypes).toHaveLength(2);
    expect(result.count).toBe(2);
  });

  it('should filter content types by websiteId', async () => {
    const filteredTypes = [mockContentTypes[0]];
    (contentTypeService.getContentTypes as jest.Mock).mockResolvedValue(filteredTypes);

    const result = await listContentTypes.execute({ websiteId: 'web1' });

    expect(contentTypeService.getContentTypes).toHaveBeenCalledWith('web1');
    expect(result.success).toBe(true);
    expect(result.contentTypes).toHaveLength(1);
    expect(result.count).toBe(1);
  });

  it('should handle empty results', async () => {
    (contentTypeService.getContentTypes as jest.Mock).mockResolvedValue([]);

    const result = await listContentTypes.execute({});

    expect(result.success).toBe(true);
    expect(result.contentTypes).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Database connection failed');
    (contentTypeService.getContentTypes as jest.Mock).mockRejectedValue(error);

    const result = await listContentTypes.execute({});

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database connection failed');
  });

  it('should include execution time in response', async () => {
    (contentTypeService.getContentTypes as jest.Mock).mockResolvedValue(mockContentTypes);

    const result = await listContentTypes.execute({});

    expect(result.executionTime).toMatch(/^\d+ms$/);
  });

  it('should warn if execution exceeds 2 seconds', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    (contentTypeService.getContentTypes as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockContentTypes), 2100))
    );

    await listContentTypes.execute({});

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('exceeded 2s'));
    consoleSpy.mockRestore();
  });
});