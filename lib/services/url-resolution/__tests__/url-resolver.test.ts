import { UrlResolver } from '../url-resolver';
import { prisma } from '@/lib/prisma';
import { ErrorCode } from '@/lib/services/types';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    siteStructure: {
      findFirst: jest.fn()
    }
  }
}));

describe('UrlResolver', () => {
  let resolver: UrlResolver;
  const mockWebsiteId = 'test-website-id';

  beforeEach(() => {
    resolver = new UrlResolver();
    jest.clearAllMocks();
    resolver.clearCache();
  });

  describe('path normalization', () => {
    it('should normalize root path', async () => {
      const paths = ['', '/', '//'];
      
      for (const path of paths) {
        (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValueOnce({
          id: 'root',
          fullPath: '/',
          contentItem: null
        });

        const result = await resolver.resolveUrl(path, { websiteId: mockWebsiteId });
        
        expect(result.success).toBe(true);
        expect(prisma.siteStructure.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              fullPath: '/'
            })
          })
        );
      }
    });

    it('should remove trailing slashes', async () => {
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue({
        id: 'page1',
        fullPath: '/about',
        contentItem: null
      });

      const result = await resolver.resolveUrl('/about/', { websiteId: mockWebsiteId });
      
      expect(result.success).toBe(true);
      expect(prisma.siteStructure.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fullPath: '/about'
          })
        })
      );
    });

    it('should remove duplicate slashes', async () => {
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue({
        id: 'page1',
        fullPath: '/about/team',
        contentItem: null
      });

      const result = await resolver.resolveUrl('/about//team', { websiteId: mockWebsiteId });
      
      expect(result.success).toBe(true);
      expect(prisma.siteStructure.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fullPath: '/about/team'
          })
        })
      );
    });

    it('should handle paths without leading slash', async () => {
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue({
        id: 'page1',
        fullPath: '/about',
        contentItem: null
      });

      const result = await resolver.resolveUrl('about', { websiteId: mockWebsiteId });
      
      expect(result.success).toBe(true);
      expect(prisma.siteStructure.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fullPath: '/about'
          })
        })
      );
    });

    it('should remove query parameters and hash', async () => {
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue({
        id: 'page1',
        fullPath: '/about',
        contentItem: null
      });

      const result = await resolver.resolveUrl('/about?param=value#section', { websiteId: mockWebsiteId });
      
      expect(result.success).toBe(true);
      expect(prisma.siteStructure.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fullPath: '/about'
          })
        })
      );
    });
  });

  describe('case sensitivity', () => {
    it('should perform case-sensitive lookup by default', async () => {
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(null);

      await resolver.resolveUrl('/About', { websiteId: mockWebsiteId });
      
      expect(prisma.siteStructure.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            websiteId: mockWebsiteId,
            fullPath: '/About'
          }
        })
      );
    });

    it('should perform case-insensitive lookup when configured', async () => {
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue({
        id: 'page1',
        fullPath: '/about',
        contentItem: null
      });

      await resolver.resolveUrl('/About', { 
        websiteId: mockWebsiteId,
        caseInsensitive: true 
      });
      
      expect(prisma.siteStructure.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            websiteId: mockWebsiteId,
            fullPath: {
              equals: '/About',
              mode: 'insensitive'
            }
          }
        })
      );
    });
  });

  describe('caching', () => {
    it('should cache successful resolutions', async () => {
      const mockPage = {
        id: 'page1',
        websiteId: mockWebsiteId,
        fullPath: '/about',
        contentItem: { id: 'content1', title: 'About' },
        parentId: null,
        contentItemId: 'content1',
        slug: 'about',
        position: 0,
        depth: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(mockPage);

      // First call - should hit database
      const result1 = await resolver.resolveUrl('/about', { websiteId: mockWebsiteId });
      expect(result1.success).toBe(true);
      expect(prisma.siteStructure.findFirst).toHaveBeenCalledTimes(1);

      // Second call - should hit cache
      const result2 = await resolver.resolveUrl('/about', { websiteId: mockWebsiteId });
      expect(result2.success).toBe(true);
      expect(prisma.siteStructure.findFirst).toHaveBeenCalledTimes(1); // Still 1

      const stats = resolver.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should cache 404 results', async () => {
      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(null);

      // First call - should hit database
      const result1 = await resolver.resolveUrl('/nonexistent', { websiteId: mockWebsiteId });
      expect(result1.success).toBe(true);
      expect(result1.data).toBeNull();
      expect(prisma.siteStructure.findFirst).toHaveBeenCalledTimes(1);

      // Second call - should hit cache
      const result2 = await resolver.resolveUrl('/nonexistent', { websiteId: mockWebsiteId });
      expect(result2.success).toBe(true);
      expect(result2.data).toBeNull();
      expect(prisma.siteStructure.findFirst).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should clear cache when requested', async () => {
      const mockPage = {
        id: 'page1',
        fullPath: '/about',
        contentItem: null
      };

      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(mockPage);

      // First call
      await resolver.resolveUrl('/about', { websiteId: mockWebsiteId });
      expect(prisma.siteStructure.findFirst).toHaveBeenCalledTimes(1);

      // Clear cache
      resolver.clearCache();

      // Should hit database again
      await resolver.resolveUrl('/about', { websiteId: mockWebsiteId });
      expect(prisma.siteStructure.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('path validation', () => {
    it('should reject paths with directory traversal', async () => {
      const maliciousPaths = [
        '../etc/passwd',
        '../../private',
        './hidden',
        '/..',
        '/path/../../../etc'
      ];

      for (const path of maliciousPaths) {
        const result = await resolver.resolveUrl(path, { websiteId: mockWebsiteId });
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toContain('traversal');
      }
    });

    it('should reject encoded path traversal attempts', async () => {
      const encodedPaths = [
        '%2e%2e/etc/passwd',
        '%2e%2e%2f%2e%2e%2fprivate',
        '/%2e%2e'
      ];

      for (const path of encodedPaths) {
        const result = await resolver.resolveUrl(path, { websiteId: mockWebsiteId });
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('should reject paths with invalid characters', async () => {
      const invalidPaths = [
        '/path<script>',
        '/path;drop table',
        '/path|command',
        '/path&param',
        '/path*wildcard'
      ];

      for (const path of invalidPaths) {
        const result = await resolver.resolveUrl(path, { websiteId: mockWebsiteId });
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toContain('invalid characters');
      }
    });

    it('should reject paths exceeding maximum length', async () => {
      const longPath = '/' + 'a'.repeat(2001);
      
      const result = await resolver.resolveUrl(longPath, { websiteId: mockWebsiteId });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(result.error?.message).toContain('maximum length');
    });

    it('should reject paths with null bytes', async () => {
      const pathWithNull = '/path\0/file';
      
      const result = await resolver.resolveUrl(pathWithNull, { websiteId: mockWebsiteId });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(result.error?.message).toContain('null bytes');
    });

    it('should accept valid paths', async () => {
      const validPaths = [
        '/',
        '/about',
        '/about-us',
        '/products/category-1/item-2',
        '/path-with-numbers-123',
        '/UPPERCASE',
        '/MixedCase'
      ];

      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue({
        id: 'page1',
        fullPath: '/test',
        contentItem: null
      });

      for (const path of validPaths) {
        const result = await resolver.resolveUrl(path, { websiteId: mockWebsiteId });
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      (prisma.siteStructure.findFirst as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await resolver.resolveUrl('/about', { websiteId: mockWebsiteId });
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(result.error?.details).toMatchObject({
        path: '/about',
        error: 'Database connection failed'
      });
    });
  });

  describe('performance', () => {
    it('should resolve URLs quickly from cache', async () => {
      const mockPage = {
        id: 'page1',
        fullPath: '/about',
        contentItem: null
      };

      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(mockPage);

      // Warm up cache
      await resolver.resolveUrl('/about', { websiteId: mockWebsiteId });

      // Measure cache hit time
      const start = Date.now();
      await resolver.resolveUrl('/about', { websiteId: mockWebsiteId });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2); // Should be under 2ms for cache hit
    });
  });
});