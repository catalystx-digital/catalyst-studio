import { UrlResolver } from '../url-resolver';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    siteStructure: {
      findFirst: jest.fn()
    }
  }
}));

describe('UrlResolver Performance Tests', () => {
  let resolver: UrlResolver;
  const mockWebsiteId = 'test-website-id';

  beforeEach(() => {
    resolver = new UrlResolver();
    jest.clearAllMocks();
    resolver.clearCache();
  });

  describe('resolution performance', () => {
    it('should resolve single URL in under 10ms', async () => {
      const mockPage = {
        id: 'page1',
        fullPath: '/about',
        contentItem: null,
        websiteId: mockWebsiteId,
        parentId: null,
        contentItemId: null,
        slug: 'about',
        position: 0,
        depth: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(mockPage);

      // Warm up
      await resolver.resolveUrl('/about', { websiteId: mockWebsiteId });

      // Measure
      const start = performance.now();
      const result = await resolver.resolveUrl('/test', { websiteId: mockWebsiteId });
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10);
    });

    it('should resolve cached URL in under 2ms', async () => {
      const mockPage = {
        id: 'page1',
        fullPath: '/cached',
        contentItem: null
      };

      (prisma.siteStructure.findFirst as jest.Mock).mockResolvedValue(mockPage);

      // First call - populate cache
      await resolver.resolveUrl('/cached', { websiteId: mockWebsiteId });

      // Measure cache hit
      const start = performance.now();
      const result = await resolver.resolveUrl('/cached', { websiteId: mockWebsiteId });
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(2);
    });

    it('should handle 100 concurrent resolutions', async () => {
      const mockPages = Array.from({ length: 100 }, (_, i) => ({
        id: `page${i}`,
        fullPath: `/path${i}`,
        contentItem: null
      }));

      (prisma.siteStructure.findFirst as jest.Mock).mockImplementation(
        ({ where }) => {
          const path = where.fullPath;
          const index = parseInt(path.replace('/path', ''));
          return Promise.resolve(mockPages[index] || null);
        }
      );

      const paths = Array.from({ length: 100 }, (_, i) => `/path${i}`);
      
      const start = performance.now();
      const results = await Promise.all(
        paths.map(path => resolver.resolveUrl(path, { websiteId: mockWebsiteId }))
      );
      const duration = performance.now() - start;

      expect(results.every(r => r.success)).toBe(true);
      expect(duration / 100).toBeLessThan(10); // Average < 10ms per resolution
    });

    it('should maintain 95th percentile under 15ms for 500 resolutions', async () => {
      const mockPage = {
        id: 'page1',
        fullPath: '/test',
        contentItem: null
      };

      // Mock with slight random delay to simulate real conditions
      (prisma.siteStructure.findFirst as jest.Mock).mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve(mockPage), Math.random() * 5);
        })
      );

      const timings: number[] = [];
      const paths = Array.from({ length: 500 }, (_, i) => `/test${i % 50}`); // 50 unique paths

      for (const path of paths) {
        const start = performance.now();
        await resolver.resolveUrl(path, { websiteId: mockWebsiteId });
        timings.push(performance.now() - start);
      }

      timings.sort((a, b) => a - b);
      const percentile95 = timings[Math.floor(timings.length * 0.95)];

      expect(percentile95).toBeLessThan(15);
    });

    it('should handle cache eviction properly', async () => {
      // Create a resolver with small cache
      const smallCacheResolver = new UrlResolver();
      
      // Mock pages
      (prisma.siteStructure.findFirst as jest.Mock).mockImplementation(
        ({ where }) => Promise.resolve({
          id: `page-${where.fullPath}`,
          fullPath: where.fullPath,
          contentItem: null
        })
      );

      // Fill cache beyond limit (default is 100)
      const paths = Array.from({ length: 150 }, (_, i) => `/path${i}`);
      
      for (const path of paths) {
        await smallCacheResolver.resolveUrl(path, { websiteId: mockWebsiteId });
      }

      const stats = smallCacheResolver.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(100);
    });
  });

  describe('cache effectiveness', () => {
    it('should achieve high cache hit rate for repeated paths', async () => {
      const popularPaths = ['/home', '/about', '/products', '/contact'];
      
      (prisma.siteStructure.findFirst as jest.Mock).mockImplementation(
        ({ where }) => Promise.resolve({
          id: `page-${where.fullPath}`,
          fullPath: where.fullPath,
          contentItem: null
        })
      );

      // Simulate traffic pattern - popular pages accessed frequently
      for (let i = 0; i < 100; i++) {
        const path = popularPaths[i % popularPaths.length];
        await resolver.resolveUrl(path, { websiteId: mockWebsiteId });
      }

      const stats = resolver.getCacheStats();
      const hitRate = stats.hitRate;

      // Should have high hit rate since we're repeatedly accessing same paths
      expect(hitRate).toBeGreaterThan(0.9); // 90%+ hit rate
    });

    it('should handle mixed traffic patterns efficiently', async () => {
      (prisma.siteStructure.findFirst as jest.Mock).mockImplementation(
        ({ where }) => Promise.resolve({
          id: `page-${where.fullPath}`,
          fullPath: where.fullPath,
          contentItem: null
        })
      );

      const hotPaths = ['/home', '/about', '/products'];
      const coldPaths = Array.from({ length: 50 }, (_, i) => `/cold${i}`);

      const timings: number[] = [];

      // Mix of hot (80%) and cold (20%) paths
      for (let i = 0; i < 100; i++) {
        const path = Math.random() < 0.8 
          ? hotPaths[Math.floor(Math.random() * hotPaths.length)]
          : coldPaths[Math.floor(Math.random() * coldPaths.length)];

        const start = performance.now();
        await resolver.resolveUrl(path, { websiteId: mockWebsiteId });
        timings.push(performance.now() - start);
      }

      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      expect(avgTime).toBeLessThan(5); // Average should be low due to cache hits
    });
  });

  describe('memory usage', () => {
    it('should not leak memory with cache operations', async () => {
      (prisma.siteStructure.findFirst as jest.Mock).mockImplementation(
        ({ where }) => Promise.resolve({
          id: `page-${where.fullPath}`,
          fullPath: where.fullPath,
          contentItem: { 
            id: 'content1',
            data: { large: 'x'.repeat(1000) } // Simulate larger objects
          }
        })
      );

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        await resolver.resolveUrl(`/path${i % 100}`, { websiteId: mockWebsiteId });
        
        // Periodically clear to simulate long-running process
        if (i % 200 === 0) {
          resolver.clearCache();
        }
      }

      const stats = resolver.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(100);
    });
  });

  describe('concurrent access patterns', () => {
    it('should handle concurrent access to same path efficiently', async () => {
      let callCount = 0;
      (prisma.siteStructure.findFirst as jest.Mock).mockImplementation(
        () => new Promise(resolve => {
          callCount++;
          setTimeout(() => resolve({
            id: 'page1',
            fullPath: '/concurrent',
            contentItem: null
          }), 10);
        })
      );

      // Launch multiple concurrent requests for same path
      const promises = Array.from({ length: 10 }, () => 
        resolver.resolveUrl('/concurrent', { websiteId: mockWebsiteId })
      );

      const start = performance.now();
      const results = await Promise.all(promises);
      const duration = performance.now() - start;

      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // Should complete quickly despite concurrent access
      expect(duration).toBeLessThan(50);
      
      // Database should be called multiple times (no request coalescing in this implementation)
      expect(callCount).toBeGreaterThan(1);
    });
  });
});