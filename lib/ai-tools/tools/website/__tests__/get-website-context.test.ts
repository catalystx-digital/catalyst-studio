import { getWebsiteContext } from '../get-website-context';
import { WebsiteService } from '@/lib/services/website-service';
import { prisma } from '@/lib/prisma';
import { resolveUniversalMediaService } from '@/lib/services/export/helpers/media-service-loader';

// Mock WebsiteService
jest.mock('@/lib/services/website-service');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    websiteMedia: {
      findMany: jest.fn()
    }
  }
}));
jest.mock('@/lib/services/export/helpers/media-service-loader', () => ({
  resolveUniversalMediaService: jest.fn()
}));

describe('getWebsiteContext tool', () => {
  let mockWebsiteService: jest.Mocked<WebsiteService>;
  const prismaMock = prisma as unknown as { websiteMedia: { findMany: jest.Mock } };
  const mediaServiceMock = resolveUniversalMediaService as jest.Mock;
  const buildMediaService = (assets?: Map<string, any>) => ({
    getAssetsForWebsiteByIds: jest.fn().mockResolvedValue(assets ?? new Map())
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockWebsiteService = WebsiteService as any;
    prismaMock.websiteMedia.findMany.mockResolvedValue([]);
    mediaServiceMock.mockResolvedValue(buildMediaService());
  });

  it('should retrieve website context successfully', async () => {
    const mockWebsite = {
      id: 'test-website-id',
      name: 'Test Website',
      category: 'blog',
      description: 'Test website description',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15'),
      metadata: JSON.stringify({
        contentTypes: ['article', 'news'],
        requiredFields: { article: ['title', 'content'] },
        validationRules: { minTitleLength: 10 },
        seoRequirements: { titleMaxLength: 60 },
        customRules: [],
      }),
      contentTypes: [{ id: '1' }, { id: '2' }],
      contentItems: [{ id: 'item1' }],
    };

    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(mockWebsite);

    const result = await getWebsiteContext.execute({ websiteId: 'test-website-id' });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.website.id).toBe('test-website-id');
    expect(result.data.website.name).toBe('Test Website');
    expect(result.data.businessRequirements.category).toBe('blog');
    expect(result.data.websiteMetadata.contentTypes).toEqual(['article', 'news']);
    expect(result.data.mediaCatalog).toEqual([]);
    expect(result.data.executionTime).toBeDefined();
  });

  it('should return error when website not found', async () => {
    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(null);

    const result = await getWebsiteContext.execute({ websiteId: 'non-existent-id' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Website with ID non-existent-id not found');
  });

  it('should handle service errors gracefully', async () => {
    mockWebsiteService.prototype.getWebsite = jest.fn().mockRejectedValue(new Error('Database error'));

    const result = await getWebsiteContext.execute({ websiteId: 'test-website-id' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database error');
    expect(result.executionTime).toBeDefined();
  });

  it('should complete execution within 2 seconds', async () => {
    const mockWebsite = {
      id: 'test-website-id',
      name: 'Test Website',
      category: 'blog',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockWebsiteService.prototype.getWebsite = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockWebsite), 100))
    );

    const startTime = Date.now();
    const result = await getWebsiteContext.execute({ websiteId: 'test-website-id' });
    const executionTime = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(executionTime).toBeLessThan(2000);
  });

  it('should handle websites with minimal metadata', async () => {
    const minimalWebsite = {
      id: 'minimal-id',
      name: 'Minimal Website',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(minimalWebsite);

    const result = await getWebsiteContext.execute({ websiteId: 'minimal-id' });

    expect(result.success).toBe(true);
    expect(result.data.businessRequirements.category).toBe('general');
    expect(result.data.businessRequirements.contentTypes).toEqual([]);
    expect(result.data.websiteMetadata).toEqual({});
    expect(result.data.mediaCatalog).toEqual([]);
  });

  it('should include media catalog when assets exist', async () => {
    const mockWebsite = {
      id: 'media-site',
      name: 'Media Site',
      category: 'portfolio',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };

    mockWebsiteService.prototype.getWebsite = jest.fn().mockResolvedValue(mockWebsite);
    prismaMock.websiteMedia.findMany.mockResolvedValue([{ id: 'media-1' }]);

    const assetMap = new Map([
      ['media-1', {
        id: 'media-1',
        mimeType: 'image/png',
        width: 1200,
        height: 800,
        duration: null,
        altText: 'Hero Image',
        signedUrl: 'https://example.com/signed.png',
        publicUrl: 'https://example.com/public.png',
        originalUrl: 'https://cdn.origin/image.png'
      }]
    ]);

    const serviceInstance = buildMediaService(assetMap);
    mediaServiceMock.mockResolvedValue(serviceInstance);

    const result = await getWebsiteContext.execute({ websiteId: 'media-site' });

    expect(result.success).toBe(true);
    expect(prismaMock.websiteMedia.findMany).toHaveBeenCalledWith({
      where: { websiteId: 'media-site' },
      select: { id: true },
      take: 250
    });
    expect(serviceInstance.getAssetsForWebsiteByIds).toHaveBeenCalledWith('media-site', new Set(['media-1']));
    expect(result.data.mediaCatalog).toEqual([
      expect.objectContaining({
        id: 'media-1',
        altText: 'Hero Image',
        signedUrl: 'https://example.com/signed.png'
      })
    ]);
  });
});
