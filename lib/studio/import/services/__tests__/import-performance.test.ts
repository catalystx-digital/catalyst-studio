import { ImportOrchestrator, ImportOrchestratorConfig } from '../import-orchestrator';
import { ComponentTypeExtractor } from '../component-type-extractor';
import { PageBuilderService } from '../page-builder-service';
import { StructureService } from '../structure-service';
import { CanonicalSignatureSharedComponentDetector } from '../shared-component-detectors/canonical-signature-detector';
import { DetectionResult } from '../interfaces/component-type-extractor.interface';
import { ImportOptions } from '../interfaces/import-orchestrator.interface';

// Performance test utilities
interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  durationMs: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
  memoryDelta: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  databaseQueries: number;
}

interface PerformanceReport {
  testName: string;
  websiteSize: string;
  metrics: PerformanceMetrics;
  passed: boolean;
  issues: string[];
}

// Mock Prisma with query counting
let queryCount = 0;
const mockPrisma = {
  $transaction: jest.fn(),
  websiteComponentType: {
    createMany: jest.fn().mockImplementation(() => { queryCount++; return Promise.resolve({ count: 10 }); }),
    deleteMany: jest.fn().mockImplementation(() => { queryCount++; return Promise.resolve({ count: 0 }); }),
    findMany: jest.fn().mockImplementation(() => { queryCount++; return Promise.resolve([]); })
  },
  websitePage: {
    createMany: jest.fn().mockImplementation(() => { queryCount++; return Promise.resolve({ count: 10 }); }),
    deleteMany: jest.fn().mockImplementation(() => { queryCount++; return Promise.resolve({ count: 0 }); }),
    findMany: jest.fn().mockImplementation(() => { queryCount++; return Promise.resolve([]); }),
    updateMany: jest.fn().mockImplementation(() => { queryCount++; return Promise.resolve({ count: 0 }); })
  },
  websiteStructure: {
    createMany: jest.fn().mockImplementation(() => { queryCount++; return Promise.resolve({ count: 10 }); }),
    deleteMany: jest.fn().mockImplementation(() => { queryCount++; return Promise.resolve({ count: 0 }); }),
    findMany: jest.fn().mockImplementation(() => { queryCount++; return Promise.resolve([]); })
  },
  websiteSharedComponent: {
    createMany: jest.fn().mockImplementation(() => { queryCount++; return Promise.resolve({ count: 3 }); }),
    deleteMany: jest.fn().mockImplementation(() => { queryCount++; return Promise.resolve({ count: 0 }); }),
    findMany: jest.fn().mockImplementation(() => { queryCount++; return Promise.resolve([]); })
  }
} as any;

// Mock services with performance tracking
const mockComponentTypeExtractor = {
  extractPatterns: jest.fn(),
  reduceToTypes: jest.fn()
} as any;

const mockPageBuilderService = {
  createPagesInBatch: jest.fn()
} as any;

const mockStructureService = {
  createStructures: jest.fn()
} as any;

const mockSharedComponentDetector = {
  detectShared: jest.fn()
} as any;

describe('Import Performance Benchmark Tests', () => {
  let orchestrator: ImportOrchestrator;
  let mockConfig: ImportOrchestratorConfig;
  const performanceReports: PerformanceReport[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    queryCount = 0;

    mockConfig = {
      componentTypeExtractor: mockComponentTypeExtractor,
      pageBuilderService: mockPageBuilderService,
      structureService: mockStructureService,
      sharedComponentDetector: mockSharedComponentDetector,
      prisma: mockPrisma
    };

    orchestrator = new ImportOrchestrator(mockConfig);
    
    // Setup mock transaction to execute callback directly
    mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
      return await callback();
    });
  });

  afterAll(() => {
    // Generate performance report
    generatePerformanceReport();
  });

  describe('Timing Measurements', () => {
    const testCases = [
      {
        name: 'Small Website (3 pages)',
        pages: 3,
        componentsPerPage: 8,
        expectedTimeLimit: 10000, // 10 seconds
        websiteSize: 'small'
      },
      {
        name: 'Medium Website (7 pages)',
        pages: 7,
        componentsPerPage: 12,
        expectedTimeLimit: 20000, // 20 seconds
        websiteSize: 'medium'
      },
      {
        name: 'Large Website (10 pages)',
        pages: 10,
        componentsPerPage: 15,
        expectedTimeLimit: 30000, // 30 seconds (requirement: <30s for 10 pages)
        websiteSize: 'large'
      }
    ];

    testCases.forEach(testCase => {
      it(`should complete ${testCase.name} import within ${testCase.expectedTimeLimit}ms`, async () => {
        const detectionResults = generateMockDetectionResults(testCase.pages, testCase.componentsPerPage);
        const websiteId = `perf-test-${testCase.websiteSize}-${Date.now()}`;

        // Setup service mocks with realistic delays
        setupServiceMocks(testCase.pages, testCase.componentsPerPage);

        const metrics = await measurePerformance(async () => {
          const options: ImportOptions = {
            enableTransactions: true,
            validateIntegrity: true
          };

          return await orchestrator.orchestrateImport(detectionResults, websiteId, options);
        });

        const report: PerformanceReport = {
          testName: testCase.name,
          websiteSize: testCase.websiteSize,
          metrics,
          passed: metrics.durationMs < testCase.expectedTimeLimit,
          issues: []
        };

        // Check timing requirement
        if (metrics.durationMs >= testCase.expectedTimeLimit) {
          report.issues.push(`Import took ${metrics.durationMs}ms, exceeds limit of ${testCase.expectedTimeLimit}ms`);
        }

        performanceReports.push(report);

        expect(metrics.durationMs).toBeLessThan(testCase.expectedTimeLimit);
        expect(metrics.durationMs).toBeGreaterThan(100); // Sanity check - should take some time
      });
    });
  });

  describe('Memory Usage Tracking', () => {
    it('should stay under 500MB memory limit during large import', async () => {
      const detectionResults = generateMockDetectionResults(10, 20); // Large dataset
      const websiteId = `memory-test-${Date.now()}`;

      setupServiceMocks(10, 20);

      const metrics = await measurePerformance(async () => {
        const options: ImportOptions = {
          enableTransactions: true,
          validateIntegrity: true
        };

        return await orchestrator.orchestrateImport(detectionResults, websiteId, options);
      });

      const report: PerformanceReport = {
        testName: 'Memory Usage Test (10 pages, 20 components each)',
        websiteSize: 'large',
        metrics,
        passed: true,
        issues: []
      };

      // Convert bytes to MB for easier reading
      const memoryUsedMB = metrics.memoryAfter.heapUsed / (1024 * 1024);
      const memoryDeltaMB = metrics.memoryDelta.heapUsed / (1024 * 1024);

      // Check memory usage limits (500MB = 524,288,000 bytes)
      const memoryLimitBytes = 500 * 1024 * 1024;
      
      if (metrics.memoryAfter.heapUsed > memoryLimitBytes) {
        report.passed = false;
        report.issues.push(`Memory usage ${memoryUsedMB.toFixed(2)}MB exceeds 500MB limit`);
      }

      if (metrics.memoryDelta.heapUsed > memoryLimitBytes * 0.8) { // 80% of limit for delta
        report.issues.push(`Memory delta ${memoryDeltaMB.toFixed(2)}MB is concerning (>400MB)`);
      }

      performanceReports.push(report);

      expect(metrics.memoryAfter.heapUsed).toBeLessThan(memoryLimitBytes);
      expect(memoryUsedMB).toBeLessThan(500);
    });

    it('should manage memory efficiently with garbage collection hints', async () => {
      // Test memory management with multiple imports
      const imports = [
        { pages: 5, components: 10 },
        { pages: 3, components: 15 },
        { pages: 7, components: 8 }
      ];

      let totalMemoryDelta = 0;

      for (let i = 0; i < imports.length; i++) {
        const importConfig = imports[i];
        const detectionResults = generateMockDetectionResults(importConfig.pages, importConfig.components);
        const websiteId = `gc-test-${i}-${Date.now()}`;

        setupServiceMocks(importConfig.pages, importConfig.components);

        const metrics = await measurePerformance(async () => {
          const options: ImportOptions = {
            enableTransactions: true,
            validateIntegrity: true
          };

          const result = await orchestrator.orchestrateImport(detectionResults, websiteId, options);
          
          // Simulate garbage collection hint
          if (global.gc) {
            global.gc();
          }

          return result;
        });

        totalMemoryDelta += metrics.memoryDelta.heapUsed;
      }

      // Memory delta should not continuously grow (indicating memory leaks)
      const averageMemoryDelta = totalMemoryDelta / imports.length;
      const averageDeltaMB = averageMemoryDelta / (1024 * 1024);

      expect(averageDeltaMB).toBeLessThan(100); // Each import should not leak >100MB on average
    });
  });

  describe('Database Query Count Optimization', () => {
    it('should stay under 1000 database queries per import', async () => {
      const detectionResults = generateMockDetectionResults(10, 15); // 10 pages, 15 components each
      const websiteId = `query-count-test-${Date.now()}`;

      setupServiceMocks(10, 15);

      queryCount = 0; // Reset counter

      const metrics = await measurePerformance(async () => {
        const options: ImportOptions = {
          enableTransactions: true,
          validateIntegrity: true
        };

        return await orchestrator.orchestrateImport(detectionResults, websiteId, options);
      });

      const report: PerformanceReport = {
        testName: 'Database Query Count Test',
        websiteSize: 'large',
        metrics: { ...metrics, databaseQueries: queryCount },
        passed: queryCount < 1000,
        issues: []
      };

      if (queryCount >= 1000) {
        report.issues.push(`Query count ${queryCount} exceeds limit of 1000`);
      }

      performanceReports.push(report);

      expect(queryCount).toBeLessThan(1000);
      expect(queryCount).toBeGreaterThan(10); // Should execute some queries
    });

    it('should optimize queries through batching', async () => {
      const detectionResults = generateMockDetectionResults(5, 10);
      const websiteId = `batch-test-${Date.now()}`;

      setupServiceMocks(5, 10);

      queryCount = 0;

      await measurePerformance(async () => {
        const options: ImportOptions = {
          enableTransactions: true,
          validateIntegrity: true
        };

        return await orchestrator.orchestrateImport(detectionResults, websiteId, options);
      });

      // With 5 pages and proper batching, should not exceed 50 queries
      // Expected queries: component types, pages, structures, shared components + some lookups
      expect(queryCount).toBeLessThan(50);
      
      // Verify batching efficiency: queries should not scale linearly with data size
      const queryToDataRatio = queryCount / (5 * 10); // queries per (page * components)
      expect(queryToDataRatio).toBeLessThan(0.5); // Should be much less than 1 query per data item
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain consistent performance across multiple runs', async () => {
      const runs = 3;
      const durations: number[] = [];
      const memoryUsages: number[] = [];

      for (let i = 0; i < runs; i++) {
        const detectionResults = generateMockDetectionResults(5, 10);
        const websiteId = `consistency-test-${i}-${Date.now()}`;

        setupServiceMocks(5, 10);

        const metrics = await measurePerformance(async () => {
          const options: ImportOptions = {
            enableTransactions: true,
            validateIntegrity: true
          };

          return await orchestrator.orchestrateImport(detectionResults, websiteId, options);
        });

        durations.push(metrics.durationMs);
        memoryUsages.push(metrics.memoryAfter.heapUsed);
      }

      // Check consistency - variance should not be too high
      const avgDuration = durations.reduce((a, b) => a + b, 0) / runs;
      const durationVariance = durations.reduce((acc, duration) => {
        return acc + Math.pow(duration - avgDuration, 2);
      }, 0) / runs;
      const durationStdDev = Math.sqrt(durationVariance);

      // Standard deviation should be less than 50% of average (reasonable consistency)
      expect(durationStdDev).toBeLessThan(avgDuration * 0.5);

      // All runs should complete in reasonable time
      durations.forEach(duration => {
        expect(duration).toBeLessThan(15000); // 15 seconds max for 5-page site
      });
    });
  });
});

// Helper Functions
function generateMockDetectionResults(pageCount: number, componentsPerPage: number): DetectionResult[] {
  const results: DetectionResult[] = [];

  for (let i = 0; i < pageCount; i++) {
    const components = [];
    
    for (let j = 0; j < componentsPerPage; j++) {
      components.push({
        id: `comp-${i}-${j}`,
        type: `component-type-${j % 8}`, // Vary types to test reduction
        confidence: 0.85 + (Math.random() * 0.15), // 0.85-1.0 confidence
        properties: {
          index: j,
          pageIndex: i,
          mockData: `test-data-${j}`
        }
      });
    }

    results.push({
      url: `https://test-site.example.com/page-${i}`,
      title: `Test Page ${i}`,
      screenshot: `screenshot-${i}.png`,
      detectedComponents: components,
      metadata: {
        analysisTime: 1000 + Math.random() * 2000, // 1-3 second analysis time
        componentCount: componentsPerPage,
        pageSize: Math.floor(Math.random() * 100000) + 50000 // 50-150KB
      }
    });
  }

  return results;
}

function setupServiceMocks(pageCount: number, componentsPerPage: number) {
  // Mock ComponentTypeExtractor - reduce components to types
  mockComponentTypeExtractor.extractPatterns.mockImplementation(async (results: DetectionResult[]) => {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    return results.flatMap(r => r.detectedComponents.map(c => `pattern-${c.type}`));
  });

  mockComponentTypeExtractor.reduceToTypes.mockImplementation(async (patterns: string[], websiteId: string) => {
    // Simulate processing time for type reduction
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    
    const uniquePatterns = [...new Set(patterns)];
    const maxTypes = Math.min(15, uniquePatterns.length); // Enforce <15 types limit
    
    return uniquePatterns.slice(0, maxTypes).map((pattern, index) => ({
      id: `ct-${websiteId}-${index}`,
      websiteId,
      type: pattern.replace('pattern-', ''),
      category: 'content',
      displayName: `Component Type ${index}`,
      defaultConfig: { index },
      placeholderData: {},
      aiMetadata: { confidence: 0.9 }
    }));
  });

  // Mock PageBuilderService
  mockPageBuilderService.createPagesInBatch.mockImplementation(async (pagesData: any[]) => {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400));
    
    const first = pagesData[0] || {};
    const websiteId = first.websiteId || 'test';
    return pagesData.map((pd, index) => ({
      id: `page-${websiteId}-${index}`,
      websiteId,
      title: pd.pageData?.title,
      type: 'page',
      content: {
        components: (pd.pageData?.detectedComponents || []).map((comp: any) => ({
          id: comp.id,
          typeId: (pd.componentTypes && pd.componentTypes[0]?.id) || 'default-type',
          type: comp.type,
          props: comp.properties
        }))
      },
      metadata: pd.pageData?.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  });

  // Mock StructureService
  mockStructureService.createStructures.mockImplementation(async (pages: any[], websiteId: string) => {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 200));
    
    return pages.map((page, index) => ({
      id: `struct-${websiteId}-${index}`,
      websiteId,
      websitePageId: page.id,
      slug: `page-${index}`,
      fullPath: `/page-${index}`,
      parentId: null,
      position: index,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  });

  // Mock SharedComponentDetector
  mockSharedComponentDetector.detectShared.mockImplementation(async (pages: any[], websiteId: string) => {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 150));
    
    const sharedCount = Math.min(5, Math.floor(pageCount / 3)); // Realistic shared component count
    
    return Array(sharedCount).fill(null).map((_, index) => ({
      id: `shared-${websiteId}-${index}`,
      websiteId,
      name: `Shared Component ${index}`,
      websiteComponentTypeId: `ct-${websiteId}-${index}`,
      content: { type: 'shared', index },
      usageCount: Math.floor(Math.random() * pageCount) + 2, // Used on 2+ pages
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  });
}

async function measurePerformance<T>(operation: () => Promise<T>): Promise<PerformanceMetrics> {
  // Force garbage collection before measurement if available
  if (global.gc) {
    global.gc();
  }

  const memoryBefore = process.memoryUsage();
  const startTime = Date.now();

  await operation();

  const endTime = Date.now();
  const memoryAfter = process.memoryUsage();

  return {
    startTime,
    endTime,
    durationMs: endTime - startTime,
    memoryBefore,
    memoryAfter,
    memoryDelta: {
      rss: memoryAfter.rss - memoryBefore.rss,
      heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
      heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
      external: memoryAfter.external - memoryBefore.external
    },
    databaseQueries: queryCount
  };
}

function generatePerformanceReport() {
  console.log('\n=== PERFORMANCE BENCHMARK REPORT ===');
  console.log('Generated on:', new Date().toISOString());
  console.log('Node.js version:', process.version);
  console.log('Platform:', process.platform);
  console.log('Memory limit (heap):', Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024), 'MB');
  
  console.log('\n--- Test Results ---');
  performanceReports.forEach(report => {
    console.log(`\nTest: ${report.testName}`);
    console.log(`Website Size: ${report.websiteSize}`);
    console.log(`Duration: ${report.metrics.durationMs}ms`);
    console.log(`Memory Used: ${Math.round(report.metrics.memoryAfter.heapUsed / 1024 / 1024)}MB`);
    console.log(`Memory Delta: ${Math.round(report.metrics.memoryDelta.heapUsed / 1024 / 1024)}MB`);
    if (report.metrics.databaseQueries) {
      console.log(`Database Queries: ${report.metrics.databaseQueries}`);
    }
    console.log(`Status: ${report.passed ? 'PASSED' : 'FAILED'}`);
    if (report.issues.length > 0) {
      console.log('Issues:');
      report.issues.forEach(issue => console.log(`  - ${issue}`));
    }
  });

  console.log('\n--- Performance Summary ---');
  const passedTests = performanceReports.filter(r => r.passed).length;
  const totalTests = performanceReports.length;
  console.log(`Tests Passed: ${passedTests}/${totalTests}`);
  
  const avgDuration = performanceReports.reduce((sum, r) => sum + r.metrics.durationMs, 0) / totalTests;
  const avgMemory = performanceReports.reduce((sum, r) => sum + r.metrics.memoryAfter.heapUsed, 0) / totalTests;
  
  console.log(`Average Duration: ${Math.round(avgDuration)}ms`);
  console.log(`Average Memory Usage: ${Math.round(avgMemory / 1024 / 1024)}MB`);
  
  console.log('\n--- Baseline Metrics for Future Regression Testing ---');
  console.log('Small Site (3 pages): Target <10s, <200MB');
  console.log('Medium Site (7 pages): Target <20s, <350MB');
  console.log('Large Site (10 pages): Target <30s, <500MB');
  console.log('Database Queries: Target <1000 per import');
  
  console.log('\n=== END PERFORMANCE REPORT ===\n');
}
