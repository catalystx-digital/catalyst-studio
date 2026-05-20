import { UrlResolver } from '@/lib/services/url-resolution/url-resolver';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    siteStructure: {
      findFirst: jest.fn()
    }
  }
}));

function generateTestPaths(count: number): string[] {
  const paths: string[] = [];
  const categories = ['products', 'blog', 'about', 'services', 'support'];
  
  for (let i = 0; i < count; i++) {
    const category = categories[i % categories.length];
    const depth = Math.floor(Math.random() * 3) + 1;
    
    let path = `/${category}`;
    for (let d = 1; d < depth; d++) {
      path += `/item-${i}-${d}`;
    }
    paths.push(path);
  }
  
  return paths;
}

describe('URL Resolution Load Tests', () => {
  let resolver: UrlResolver;
  const mockWebsiteId = 'load-test-website';

  beforeEach(() => {
    resolver = new UrlResolver();
    jest.clearAllMocks();
    resolver.clearCache();

    // Mock database responses with realistic delay
    (prisma.siteStructure.findFirst as jest.Mock).mockImplementation(
      ({ where }) => new Promise(resolve => {
        // Simulate database latency (1-5ms)
        const delay = Math.random() * 4 + 1;
        setTimeout(() => {
          resolve({
            id: `page-${where.fullPath}`,
            websiteId: where.websiteId,
            fullPath: where.fullPath || where.fullPath.equals,
            slug: 'test',
            parentId: null,
            contentItemId: `content-${where.fullPath}`,
            position: 0,
            depth: 1,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            contentItem: {
              id: `content-${where.fullPath}`,
              title: 'Test Page',
              data: { body: 'Content' }
            }
          });
        }, delay);
      })
    );
  });

  describe('concurrent resolution load tests', () => {
    it('handles 500+ concurrent resolutions', async () => {
      const paths = generateTestPaths(500);
      
      const start = performance.now();
      const results = await Promise.all(
        paths.map(path => resolver.resolveUrl(path, { websiteId: mockWebsiteId }))
      );
      const duration = performance.now() - start;
      
      // All resolutions should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(500);
      
      // Average time per resolution should be under 10ms
      const avgTime = duration / 500;
      expect(avgTime).toBeLessThan(10);
      
      console.log(`Load test: 500 resolutions in ${duration.toFixed(2)}ms (avg: ${avgTime.toFixed(2)}ms)`);
    });

    it('handles 1000 resolutions with mixed patterns', async () => {
      // Mix of popular and long-tail paths
      const popularPaths = ['/home', '/products', '/about', '/contact', '/blog'];
      const longTailPaths = generateTestPaths(200);
      
      const paths: string[] = [];
      for (let i = 0; i < 1000; i++) {
        if (Math.random() < 0.7) {
          // 70% popular paths
          paths.push(popularPaths[Math.floor(Math.random() * popularPaths.length)]);
        } else {
          // 30% long-tail paths
          paths.push(longTailPaths[Math.floor(Math.random() * longTailPaths.length)]);
        }
      }
      
      const start = performance.now();
      const results = await Promise.all(
        paths.map(path => resolver.resolveUrl(path, { websiteId: mockWebsiteId }))
      );
      const duration = performance.now() - start;
      
      // Check success rate
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(1000);
      
      // Check cache effectiveness
      const stats = resolver.getCacheStats();
      expect(stats.hitRate).toBeGreaterThan(0.5); // Should have good hit rate for popular paths
      
      console.log(`Mixed pattern test: 1000 resolutions in ${duration.toFixed(2)}ms`);
      console.log(`Cache stats: ${stats.hits} hits, ${stats.misses} misses, ${(stats.hitRate * 100).toFixed(1)}% hit rate`);
    });

    it('handles burst traffic patterns', async () => {
      const burstSize = 100;
      const numberOfBursts = 5;
      const delayBetweenBursts = 10; // ms
      
      const timings: number[] = [];
      
      for (let burst = 0; burst < numberOfBursts; burst++) {
        const paths = generateTestPaths(burstSize);
        
        const start = performance.now();
        const results = await Promise.all(
          paths.map(path => resolver.resolveUrl(path, { websiteId: mockWebsiteId }))
        );
        const duration = performance.now() - start;
        
        timings.push(duration);
        
        // All should succeed
        expect(results.filter(r => r.success).length).toBe(burstSize);
        
        // Wait before next burst
        if (burst < numberOfBursts - 1) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBursts));
        }
      }
      
      // Check that burst handling remains consistent
      const avgBurstTime = timings.reduce((a, b) => a + b) / timings.length;
      const maxBurstTime = Math.max(...timings);
      
      expect(maxBurstTime).toBeLessThan(avgBurstTime * 2); // No severe degradation
      
      console.log(`Burst test: ${numberOfBursts} bursts of ${burstSize} requests`);
      console.log(`Burst timings: ${timings.map(t => t.toFixed(0)).join('ms, ')}ms`);
    });

    it('maintains performance with sustained load', async () => {
      const requestsPerSecond = 100;
      const durationSeconds = 5;
      const totalRequests = requestsPerSecond * durationSeconds;
      
      const paths = generateTestPaths(totalRequests);
      const batchSize = 10;
      const delayBetweenBatches = 1000 / (requestsPerSecond / batchSize);
      
      const timings: number[] = [];
      let successCount = 0;
      
      const startTime = Date.now();
      
      for (let i = 0; i < totalRequests; i += batchSize) {
        const batch = paths.slice(i, i + batchSize);
        
        const batchStart = performance.now();
        const results = await Promise.all(
          batch.map(path => resolver.resolveUrl(path, { websiteId: mockWebsiteId }))
        );
        const batchDuration = performance.now() - batchStart;
        
        timings.push(batchDuration / batch.length); // Per-request timing
        successCount += results.filter(r => r.success).length;
        
        // Maintain request rate
        const elapsed = Date.now() - startTime;
        const expectedElapsed = (i / requestsPerSecond) * 1000;
        if (expectedElapsed > elapsed) {
          await new Promise(resolve => setTimeout(resolve, expectedElapsed - elapsed));
        }
      }
      
      const totalDuration = Date.now() - startTime;
      
      // Check success rate
      expect(successCount).toBe(totalRequests);
      
      // Check performance consistency
      timings.sort((a, b) => a - b);
      const p50 = timings[Math.floor(timings.length * 0.5)];
      const p95 = timings[Math.floor(timings.length * 0.95)];
      const p99 = timings[Math.floor(timings.length * 0.99)];
      
      expect(p50).toBeLessThan(10); // Median under 10ms
      expect(p95).toBeLessThan(20); // 95th percentile under 20ms
      expect(p99).toBeLessThan(50); // 99th percentile under 50ms
      
      console.log(`Sustained load test: ${totalRequests} requests in ${(totalDuration/1000).toFixed(1)}s`);
      console.log(`Percentiles - P50: ${p50.toFixed(1)}ms, P95: ${p95.toFixed(1)}ms, P99: ${p99.toFixed(1)}ms`);
    });
  });

  describe('cache performance under load', () => {
    it('maintains cache effectiveness under high load', async () => {
      // Simulate realistic traffic - Pareto distribution (80/20 rule)
      const hotPaths = generateTestPaths(20); // 20% of paths
      const coldPaths = generateTestPaths(80); // 80% of paths
      
      const requests: string[] = [];
      for (let i = 0; i < 1000; i++) {
        if (Math.random() < 0.8) {
          // 80% of traffic to hot paths
          requests.push(hotPaths[Math.floor(Math.random() * hotPaths.length)]);
        } else {
          // 20% of traffic to cold paths
          requests.push(coldPaths[Math.floor(Math.random() * coldPaths.length)]);
        }
      }
      
      // Process requests in batches to simulate realistic load
      const batchSize = 50;
      const cacheStats: any[] = [];
      
      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        await Promise.all(
          batch.map(path => resolver.resolveUrl(path, { websiteId: mockWebsiteId }))
        );
        
        // Record cache stats periodically
        if (i % 100 === 0) {
          cacheStats.push(resolver.getCacheStats());
        }
      }
      
      const finalStats = resolver.getCacheStats();
      
      // Cache should be effective for hot paths
      expect(finalStats.hitRate).toBeGreaterThan(0.6); // 60%+ hit rate
      expect(finalStats.size).toBeLessThanOrEqual(100); // Within cache limits
      
      console.log(`Cache performance test: Final hit rate: ${(finalStats.hitRate * 100).toFixed(1)}%`);
      console.log(`Cache size: ${finalStats.size}, Hits: ${finalStats.hits}, Misses: ${finalStats.misses}`);
    });
  });

  describe('error handling under load', () => {
    it('handles mixed success/failure scenarios', async () => {
      // Mock some failures
      (prisma.siteStructure.findFirst as jest.Mock).mockImplementation(
        ({ where }) => new Promise((resolve, reject) => {
          const path = where.fullPath || where.fullPath?.equals || '';
          
          // Simulate 5% failure rate
          if (Math.random() < 0.05) {
            reject(new Error('Database connection error'));
          } else {
            // Simulate 10% not found
            if (Math.random() < 0.1) {
              resolve(null);
            } else {
              resolve({
                id: `page-${path}`,
                fullPath: path,
                contentItem: null
              });
            }
          }
        })
      );
      
      const paths = generateTestPaths(200);
      const results = await Promise.all(
        paths.map(path => resolver.resolveUrl(path, { websiteId: mockWebsiteId }))
      );
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      // Should handle errors gracefully
      expect(successCount).toBeGreaterThan(150); // Most should succeed
      expect(failureCount).toBeLessThan(50); // Some failures expected
      
      // Check error types
      const errors = results.filter(r => !r.success && r.error);
      const hasInternalErrors = errors.some(r => r.error?.code === 'INTERNAL_ERROR');
      expect(hasInternalErrors).toBe(true);
      
      console.log(`Error handling test: ${successCount} succeeded, ${failureCount} failed`);
    });
  });
});