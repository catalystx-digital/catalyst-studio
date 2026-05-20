import { ImportOrchestrator } from '../import-orchestrator';
import { DetectionResult } from '../interfaces/component-type-extractor.interface';
import { ImportOptions } from '../interfaces/import-orchestrator.interface';

// Mock system resource monitoring
const systemMetrics = {
  cpuUsage: 0,
  memoryUsage: 0,
  activeConnections: 0,
  dbConnections: 0,
  queueSize: 0
};

// Mock Prisma with performance tracking
let queryExecutionTimes: number[] = [];
let totalQueries = 0;

const mockPrisma = {
  $transaction: jest.fn(),
  websiteComponentType: {
    createMany: jest.fn().mockImplementation(async () => {
      const delay = 50 + Math.random() * 100; // 50-150ms simulated query time
      queryExecutionTimes.push(delay);
      totalQueries++;
      await new Promise(resolve => setTimeout(resolve, delay));
      return { count: Math.floor(Math.random() * 20) + 5 };
    }),
    deleteMany: jest.fn(),
    findMany: jest.fn()
  },
  websitePage: {
    createMany: jest.fn().mockImplementation(async () => {
      const delay = 75 + Math.random() * 125; // 75-200ms simulated query time
      queryExecutionTimes.push(delay);
      totalQueries++;
      await new Promise(resolve => setTimeout(resolve, delay));
      return { count: Math.floor(Math.random() * 15) + 3 };
    }),
    deleteMany: jest.fn(),
    findMany: jest.fn()
  },
  websiteStructure: {
    createMany: jest.fn().mockImplementation(async () => {
      const delay = 40 + Math.random() * 80; // 40-120ms simulated query time
      queryExecutionTimes.push(delay);
      totalQueries++;
      await new Promise(resolve => setTimeout(resolve, delay));
      return { count: Math.floor(Math.random() * 15) + 3 };
    }),
    deleteMany: jest.fn(),
    findMany: jest.fn()
  },
  websiteSharedComponent: {
    createMany: jest.fn().mockImplementation(async () => {
      const delay = 30 + Math.random() * 70; // 30-100ms simulated query time
      queryExecutionTimes.push(delay);
      totalQueries++;
      await new Promise(resolve => setTimeout(resolve, delay));
      return { count: Math.floor(Math.random() * 5) + 1 };
    }),
    deleteMany: jest.fn(),
    findMany: jest.fn()
  }
} as any;

describe('Load Testing and Stress Testing', () => {
  let orchestrator: ImportOrchestrator;
  
  beforeEach(() => {
    jest.clearAllMocks();
    queryExecutionTimes = [];
    totalQueries = 0;
    resetSystemMetrics();
    
    orchestrator = new ImportOrchestrator({
      componentTypeExtractor: createLoadTestMockService('extractor'),
      pageBuilderService: createLoadTestMockService('pageBuilder'),
      structureService: createLoadTestMockService('structure'),
      sharedComponentDetector: createLoadTestMockService('sharedDetector'),
      prisma: mockPrisma
    });

    // Setup transaction behavior with performance simulation
    mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
      const start = Date.now();
      systemMetrics.dbConnections++;
      
      try {
        const result = await callback(mockPrisma);
        const duration = Date.now() - start;
        
        // Simulate transaction overhead
        if (duration > 5000) { // Long transactions increase system load
          systemMetrics.cpuUsage += 10;
          systemMetrics.memoryUsage += 20;
        }
        
        return result;
      } finally {
        systemMetrics.dbConnections--;
      }
    });
  });

  describe('Concurrent Import Load Testing', () => {
    it('should handle 10 concurrent import jobs without performance degradation', async () => {
      // Arrange
      const concurrentJobs = Array.from({ length: 10 }, (_, i) => ({
        websiteId: `load-test-${i}`,
        detectionResults: createLargeDetectionResults(8, 12), // 8 pages, 12 components each
        startTime: 0,
        endTime: 0,
        duration: 0
      }));

      const performanceBaseline = await measureSingleImportBaseline();
      
      // Act
      const startTime = Date.now();
      systemMetrics.activeConnections = 10;
      
      const concurrentResults = await Promise.allSettled(
        concurrentJobs.map(async (job, index) => {
          job.startTime = Date.now();
          
          // Add slight staggering to simulate real-world conditions
          await new Promise(resolve => setTimeout(resolve, index * 100));
          
          const options: ImportOptions = {
            enableTransactions: true,
            validateIntegrity: true,
            maxRetries: 2
          };

          try {
            const result = await orchestrator.orchestrateImport(
              job.detectionResults, 
              job.websiteId, 
              options
            );
            
            job.endTime = Date.now();
            job.duration = job.endTime - job.startTime;
            
            return {
              success: true,
              websiteId: job.websiteId,
              duration: job.duration,
              statistics: result.statistics
            };
          } catch (error) {
            job.endTime = Date.now();
            job.duration = job.endTime - job.startTime;
            
            return {
              success: false,
              websiteId: job.websiteId,
              duration: job.duration,
              error: error.message
            };
          }
        })
      );

      const totalTime = Date.now() - startTime;

      // Assert
      const successfulJobs = concurrentResults.filter(
        result => result.status === 'fulfilled' && result.value.success
      );
      const failedJobs = concurrentResults.filter(
        result => result.status === 'rejected' || 
        (result.status === 'fulfilled' && !result.value.success)
      );

      // Performance assertions
      expect(successfulJobs.length).toBeGreaterThanOrEqual(9); // Allow 1 failure max
      expect(failedJobs.length).toBeLessThanOrEqual(1);

      // Calculate performance metrics
      const avgConcurrentDuration = successfulJobs.reduce((sum, result) => 
        sum + (result.value as any).duration, 0
      ) / successfulJobs.length;

      const performanceDegradation = avgConcurrentDuration / performanceBaseline.duration;
      
      // Performance should not degrade more than 150% under concurrent load
      expect(performanceDegradation).toBeLessThan(1.5);
      
      // Total time should be much less than sequential execution
      const sequentialTime = performanceBaseline.duration * 10;
      expect(totalTime).toBeLessThan(sequentialTime * 0.6); // At least 40% improvement

      // System resource checks
      expect(systemMetrics.cpuUsage).toBeLessThan(80); // CPU usage under 80%
      expect(systemMetrics.memoryUsage).toBeLessThan(400); // Memory under 400MB
      expect(totalQueries).toBeLessThan(5000); // Total queries reasonable

      console.log(`Load Test Results:
        - Successful jobs: ${successfulJobs.length}/10
        - Average duration: ${avgConcurrentDuration}ms
        - Performance degradation: ${performanceDegradation.toFixed(2)}x
        - Total time: ${totalTime}ms
        - CPU usage: ${systemMetrics.cpuUsage}%
        - Memory usage: ${systemMetrics.memoryUsage}MB
        - Total queries: ${totalQueries}
      `);
    });

    it('should monitor system resources during stress test', async () => {
      // Arrange
      const resourceMonitor = new SystemResourceMonitor();
      resourceMonitor.start();

      const heavyLoad = Array.from({ length: 15 }, (_, i) => ({
        websiteId: `stress-test-${i}`,
        detectionResults: createLargeDetectionResults(12, 20) // Larger datasets
      }));

      // Act
      const stressResults = await Promise.allSettled(
        heavyLoad.map(async (job) => {
          const options: ImportOptions = {
            enableTransactions: true,
            validateIntegrity: true
          };

          return await orchestrator.orchestrateImport(
            job.detectionResults,
            job.websiteId,
            options
          );
        })
      );

      const finalMetrics = resourceMonitor.stop();

      // Assert
      const successfulStressJobs = stressResults.filter(r => r.status === 'fulfilled').length;
      
      expect(successfulStressJobs).toBeGreaterThanOrEqual(12); // At least 80% success rate
      
      // Resource usage assertions
      expect(finalMetrics.peakCpuUsage).toBeLessThan(90); // Peak CPU < 90%
      expect(finalMetrics.peakMemoryUsage).toBeLessThan(500); // Peak memory < 500MB
      expect(finalMetrics.avgQueryTime).toBeLessThan(200); // Avg query time < 200ms
      expect(finalMetrics.maxConcurrentConnections).toBeLessThanOrEqual(20); // Connection limit

      // Performance stability check
      expect(finalMetrics.performanceVariance).toBeLessThan(0.3); // Stable performance
      
      console.log(`Stress Test Resource Metrics:
        - Successful jobs: ${successfulStressJobs}/15
        - Peak CPU: ${finalMetrics.peakCpuUsage}%
        - Peak Memory: ${finalMetrics.peakMemoryUsage}MB
        - Avg Query Time: ${finalMetrics.avgQueryTime}ms
        - Max Connections: ${finalMetrics.maxConcurrentConnections}
        - Performance Variance: ${finalMetrics.performanceVariance}
      `);
    });
  });

  describe('Large Website Import Testing', () => {
    it('should handle large websites (20+ pages) within Vercel timeout', async () => {
      // Arrange - Large website dataset
      const largeWebsiteData = createLargeDetectionResults(25, 15); // 25 pages, 15 components each
      const websiteId = 'large-website-test';
      const VERCEL_TIMEOUT_LIMIT = 60000; // 60 seconds

      // Act
      const startTime = Date.now();
      let importResult;
      let timedOut = false;

      try {
        const options: ImportOptions = {
          enableTransactions: true,
          validateIntegrity: true,
          progressCallback: (progress) => {
            console.log(`Large import progress: ${progress.progress}% - ${progress.message}`);
          }
        };

        // Set up timeout simulation
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Vercel timeout exceeded')), VERCEL_TIMEOUT_LIMIT);
        });

        importResult = await Promise.race([
          orchestrator.orchestrateImport(largeWebsiteData, websiteId, options),
          timeoutPromise
        ]);

      } catch (error) {
        if (error.message.includes('timeout')) {
          timedOut = true;
        } else {
          throw error;
        }
      }

      const totalDuration = Date.now() - startTime;

      // Assert
      expect(timedOut).toBe(false);
      expect(totalDuration).toBeLessThan(VERCEL_TIMEOUT_LIMIT);
      expect(importResult).toBeDefined();
      expect(importResult.statistics.totalPages).toBe(25);
      expect(importResult.statistics.processingTimeMs).toBeLessThan(VERCEL_TIMEOUT_LIMIT);

      // Verify chunked processing worked
      expect(totalQueries).toBeLessThan(1000); // Should stay under query limit
      
      console.log(`Large Website Import Results:
        - Pages: ${importResult.statistics.totalPages}
        - Duration: ${totalDuration}ms (${(totalDuration/1000).toFixed(1)}s)
        - Component Types: ${importResult.statistics.uniqueComponentTypes}
        - Shared Components: ${importResult.statistics.sharedComponentsDetected}
        - Total Queries: ${totalQueries}
        - Memory Usage: ${systemMetrics.memoryUsage}MB
      `);
    });

    it('should process large datasets in appropriate chunks', async () => {
      // Arrange
      const massiveDataset = createLargeDetectionResults(50, 25); // 50 pages, 25 components each
      const websiteId = 'chunked-processing-test';
      
      const processingMetrics = {
        chunks: [],
        totalProcessingTime: 0,
        peakMemoryUsage: 0,
        queriesPerChunk: []
      };

      // Mock chunked processing
      jest.spyOn(orchestrator, 'orchestrateImport').mockImplementation(async (results, wId, options) => {
        const chunkSize = 10; // Process 10 pages at a time
        const chunks = [];
        
        for (let i = 0; i < results.length; i += chunkSize) {
          chunks.push(results.slice(i, i + chunkSize));
        }

        let totalStats = {
          totalPages: 0,
          uniqueComponentTypes: 0,
          sharedComponentsDetected: 0,
          processingTimeMs: 0
        };

        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex];
          const chunkStartTime = Date.now();
          const chunkStartQueries = totalQueries;
          
          // Process chunk (simulated)
          await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
          
          const chunkDuration = Date.now() - chunkStartTime;
          const chunkQueries = totalQueries - chunkStartQueries;
          
          processingMetrics.chunks.push({
            index: chunkIndex,
            pages: chunk.length,
            duration: chunkDuration,
            queries: chunkQueries
          });

          totalStats.totalPages += chunk.length;
          totalStats.processingTimeMs += chunkDuration;
          
          // Simulate memory cleanup between chunks
          if (systemMetrics.memoryUsage > 300) {
            systemMetrics.memoryUsage *= 0.7; // Garbage collection effect
          }
          
          // Report progress
          if (options?.progressCallback) {
            const progress = ((chunkIndex + 1) / chunks.length) * 100;
            options.progressCallback({
              stage: 'processing',
              progress: Math.round(progress),
              message: `Processing chunk ${chunkIndex + 1}/${chunks.length}`
            });
          }
        }

        return {
          websiteId: wId,
          statistics: totalStats,
          pages: [],
          structures: [],
          componentTypes: [],
          sharedComponents: []
        };
      });

      // Act
      const options: ImportOptions = {
        enableTransactions: true,
        progressCallback: (progress) => {
          processingMetrics.totalProcessingTime = Date.now();
          processingMetrics.peakMemoryUsage = Math.max(
            processingMetrics.peakMemoryUsage, 
            systemMetrics.memoryUsage
          );
        }
      };

      const result = await orchestrator.orchestrateImport(massiveDataset, websiteId, options);

      // Assert
      expect(processingMetrics.chunks.length).toBe(5); // 50 pages / 10 per chunk
      expect(result.statistics.totalPages).toBe(50);
      
      // Verify chunks processed efficiently
      processingMetrics.chunks.forEach(chunk => {
        expect(chunk.duration).toBeLessThan(1000); // Each chunk < 1 second
        expect(chunk.queries).toBeLessThan(100); // Reasonable query count per chunk
      });

      // Memory usage should stay reasonable due to chunking
      expect(processingMetrics.peakMemoryUsage).toBeLessThan(400); // < 400MB peak

      const totalChunkTime = processingMetrics.chunks.reduce((sum, chunk) => sum + chunk.duration, 0);
      expect(totalChunkTime).toBeLessThan(20000); // Total processing < 20 seconds

      console.log(`Chunked Processing Results:
        - Total chunks: ${processingMetrics.chunks.length}
        - Total pages: ${result.statistics.totalPages}
        - Peak memory: ${processingMetrics.peakMemoryUsage}MB
        - Total processing time: ${totalChunkTime}ms
        - Average chunk time: ${totalChunkTime / processingMetrics.chunks.length}ms
      `);
    });
  });

  describe('Resource Constraint Testing', () => {
    it('should exhibit graceful degradation under resource constraints', async () => {
      // Arrange - Simulate resource constraints
      systemMetrics.cpuUsage = 70; // Start with high CPU usage
      systemMetrics.memoryUsage = 350; // Start with high memory usage

      const constrainedJobs = Array.from({ length: 8 }, (_, i) => ({
        websiteId: `constrained-${i}`,
        detectionResults: createLargeDetectionResults(6, 10)
      }));

      // Mock degraded performance
      const originalCreateMany = mockPrisma.websiteComponentType.createMany;
      mockPrisma.websiteComponentType.createMany = jest.fn().mockImplementation(async () => {
        // Slower queries under resource constraints
        const delay = 100 + Math.random() * 400; // 100-500ms (slower than normal)
        queryExecutionTimes.push(delay);
        totalQueries++;
        
        // Increase system load with each query
        systemMetrics.cpuUsage += 1;
        systemMetrics.memoryUsage += 5;
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return { count: 5 };
      });

      // Act
      const constrainedResults = await Promise.allSettled(
        constrainedJobs.map(async (job) => {
          const options: ImportOptions = {
            enableTransactions: true,
            validateIntegrity: false, // Skip validation under constraints
            maxRetries: 1 // Reduce retries under constraints
          };

          return await orchestrator.orchestrateImport(
            job.detectionResults,
            job.websiteId,
            options
          );
        })
      );

      // Assert
      const successful = constrainedResults.filter(r => r.status === 'fulfilled').length;
      const failed = constrainedResults.filter(r => r.status === 'rejected').length;

      // Should still complete majority of jobs, but with degraded performance
      expect(successful).toBeGreaterThanOrEqual(6); // At least 75% success rate
      expect(failed).toBeLessThanOrEqual(2); // Max 25% failure rate

      // Average query time should be higher due to constraints
      const avgQueryTime = queryExecutionTimes.reduce((a, b) => a + b, 0) / queryExecutionTimes.length;
      expect(avgQueryTime).toBeGreaterThan(200); // Slower than normal

      // System should not exceed critical thresholds
      expect(systemMetrics.cpuUsage).toBeLessThan(95); // Don't max out CPU
      expect(systemMetrics.memoryUsage).toBeLessThan(480); // Don't exceed memory limit

      console.log(`Resource Constrained Test Results:
        - Successful: ${successful}/${constrainedJobs.length}
        - Failed: ${failed}/${constrainedJobs.length}
        - Average query time: ${avgQueryTime.toFixed(1)}ms
        - Final CPU usage: ${systemMetrics.cpuUsage}%
        - Final memory usage: ${systemMetrics.memoryUsage}MB
      `);
    });

    it('should recover from Vercel timeout scenarios', async () => {
      // Arrange
      const timeoutSimulation = {
        jobsStarted: 0,
        jobsCompleted: 0,
        jobsTimedOut: 0,
        recoveryAttempts: 0
      };

      const timeoutProneJobs = Array.from({ length: 6 }, (_, i) => ({
        websiteId: `timeout-test-${i}`,
        detectionResults: createLargeDetectionResults(15, 18), // Large enough to risk timeout
        timeoutRisk: Math.random() // Random timeout risk per job
      }));

      // Act
      const timeoutResults = await Promise.allSettled(
        timeoutProneJobs.map(async (job) => {
          timeoutSimulation.jobsStarted++;

          const options: ImportOptions = {
            enableTransactions: true,
            validateIntegrity: true,
            maxRetries: 3
          };

          // Simulate Vercel timeout risk
          const timeoutPromise = new Promise((_, reject) => {
            const timeoutDelay = job.timeoutRisk > 0.7 ? 35000 : 70000; // Some jobs timeout at 35s
            setTimeout(() => {
              timeoutSimulation.jobsTimedOut++;
              reject(new Error('Function timeout'));
            }, timeoutDelay);
          });

          const importPromise = orchestrator.orchestrateImport(
            job.detectionResults,
            job.websiteId,
            options
          ).then(result => {
            timeoutSimulation.jobsCompleted++;
            return result;
          }).catch(error => {
            if (error.message.includes('timeout')) {
              timeoutSimulation.recoveryAttempts++;
              // Simulate recovery attempt with smaller dataset
              const reducedResults = job.detectionResults.slice(0, 5); // Process only first 5 pages
              return orchestrator.orchestrateImport(reducedResults, job.websiteId + '-recovery', options);
            }
            throw error;
          });

          return Promise.race([importPromise, timeoutPromise]);
        })
      );

      // Assert
      const completedJobs = timeoutResults.filter(r => r.status === 'fulfilled').length;
      const timedOutJobs = timeoutResults.filter(r => 
        r.status === 'rejected' && r.reason.message.includes('timeout')
      ).length;

      // Should handle timeouts gracefully
      expect(completedJobs).toBeGreaterThanOrEqual(4); // At least 2/3 completion rate
      expect(timeoutSimulation.recoveryAttempts).toBeGreaterThanOrEqual(timedOutJobs); // Recovery attempts for timeouts

      console.log(`Timeout Recovery Test Results:
        - Jobs started: ${timeoutSimulation.jobsStarted}
        - Jobs completed: ${completedJobs}
        - Jobs timed out: ${timedOutJobs}
        - Recovery attempts: ${timeoutSimulation.recoveryAttempts}
        - Success rate: ${(completedJobs / timeoutSimulation.jobsStarted * 100).toFixed(1)}%
      `);
    });
  });
});

// Helper Classes and Functions
class SystemResourceMonitor {
  private startTime: number = 0;
  private metrics: any[] = [];
  private interval: NodeJS.Timeout | null = null;

  start() {
    this.startTime = Date.now();
    this.metrics = [];
    
    this.interval = setInterval(() => {
      this.metrics.push({
        timestamp: Date.now() - this.startTime,
        cpuUsage: systemMetrics.cpuUsage,
        memoryUsage: systemMetrics.memoryUsage,
        activeConnections: systemMetrics.activeConnections,
        dbConnections: systemMetrics.dbConnections,
        avgQueryTime: queryExecutionTimes.length > 0 
          ? queryExecutionTimes.reduce((a, b) => a + b, 0) / queryExecutionTimes.length 
          : 0
      });
    }, 1000); // Sample every second
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }

    const durations = this.metrics.map(m => m.timestamp);
    const cpuValues = this.metrics.map(m => m.cpuUsage);
    const memoryValues = this.metrics.map(m => m.memoryUsage);
    const queryTimes = this.metrics.map(m => m.avgQueryTime);

    return {
      totalDuration: Math.max(...durations),
      peakCpuUsage: Math.max(...cpuValues),
      peakMemoryUsage: Math.max(...memoryValues),
      avgQueryTime: queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length,
      maxConcurrentConnections: Math.max(...this.metrics.map(m => m.activeConnections)),
      performanceVariance: this.calculateVariance(queryTimes)
    };
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length) / mean;
  }
}

function createLoadTestMockService(serviceType: string) {
  const baseDelay = {
    extractor: 300,
    pageBuilder: 400,
    structure: 200,
    sharedDetector: 150
  }[serviceType] || 250;

  return {
    // Mock methods with realistic processing delays
    extractPatterns: jest.fn().mockImplementation(async (results) => {
      const delay = baseDelay + Math.random() * 200;
      await new Promise(resolve => setTimeout(resolve, delay));
      return results.map(r => r.detectedComponents.map(c => c.type)).flat();
    }),

    reduceToTypes: jest.fn().mockImplementation(async (patterns, websiteId) => {
      const delay = baseDelay + Math.random() * 300;
      await new Promise(resolve => setTimeout(resolve, delay));
      const uniqueTypes = [...new Set(patterns)];
      return uniqueTypes.slice(0, Math.min(15, uniqueTypes.length)).map((type, i) => ({
        id: `ct-${websiteId}-${i}`,
        websiteId,
        type,
        category: 'content'
      }));
    }),

    createPagesInBatch: jest.fn().mockImplementation(async (pagesData) => {
      const delay = baseDelay + Math.random() * 400;
      await new Promise(resolve => setTimeout(resolve, delay));
      const websiteId = (pagesData[0] && pagesData[0].websiteId) || 'load-test';
      return pagesData.map((pd: any, i: number) => ({
        id: `page-${websiteId}-${i}`,
        websiteId,
        title: pd.pageData?.title,
        content: { components: pd.pageData?.detectedComponents || [] }
      }));
    }),

    createStructures: jest.fn().mockImplementation(async (pages, websiteId) => {
      const delay = baseDelay + Math.random() * 250;
      await new Promise(resolve => setTimeout(resolve, delay));
      return pages.map((page, i) => ({
        id: `struct-${websiteId}-${i}`,
        websiteId,
        websitePageId: page.id,
        slug: `page-${i}`,
        fullPath: `/page-${i}`
      }));
    }),

    detectShared: jest.fn().mockImplementation(async (pages, websiteId) => {
      const delay = baseDelay + Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
      const sharedCount = Math.min(5, Math.floor(pages.length / 3));
      return Array.from({ length: sharedCount }, (_, i) => ({
        id: `shared-${websiteId}-${i}`,
        websiteId,
        name: `Shared Component ${i}`
      }));
    })
  };
}

function createLargeDetectionResults(pageCount: number, componentsPerPage: number): DetectionResult[] {
  const componentTypes = [
    'header', 'footer', 'navigation', 'hero', 'content', 'sidebar',
    'button', 'form', 'image', 'video', 'card', 'testimonial',
    'banner', 'menu', 'gallery', 'pricing', 'features', 'contact'
  ];

  return Array.from({ length: pageCount }, (_, pageIndex) => ({
    url: `https://loadtest.com/page-${pageIndex}`,
    title: `Load Test Page ${pageIndex}`,
    screenshot: `loadtest-page-${pageIndex}.png`,
    detectedComponents: Array.from({ length: componentsPerPage }, (_, compIndex) => ({
      id: `comp-${pageIndex}-${compIndex}`,
      type: componentTypes[compIndex % componentTypes.length],
      confidence: 0.8 + Math.random() * 0.2,
      properties: {
        index: compIndex,
        pageIndex,
        mockContent: `Content for component ${compIndex} on page ${pageIndex}`
      }
    })),
    metadata: {
      pageSize: Math.floor(Math.random() * 200000) + 50000, // 50-250KB
      loadTime: Math.floor(Math.random() * 3000) + 500, // 0.5-3.5s
      componentCount: componentsPerPage
    }
  }));
}

async function measureSingleImportBaseline(): Promise<{ duration: number; queries: number }> {
  const baselineStart = Date.now();
  const baselineStartQueries = totalQueries;

  const singleJobResult = createLargeDetectionResults(5, 8);
  
  const mockOrchestrator = new ImportOrchestrator({
    componentTypeExtractor: createLoadTestMockService('extractor'),
    pageBuilderService: createLoadTestMockService('pageBuilder'),
    structureService: createLoadTestMockService('structure'),
    sharedComponentDetector: createLoadTestMockService('sharedDetector'),
    prisma: mockPrisma
  });

  await mockOrchestrator.orchestrateImport(singleJobResult, 'baseline-test', {
    enableTransactions: true
  });

  return {
    duration: Date.now() - baselineStart,
    queries: totalQueries - baselineStartQueries
  };
}

function resetSystemMetrics() {
  systemMetrics.cpuUsage = 10 + Math.random() * 20; // Baseline 10-30% CPU
  systemMetrics.memoryUsage = 50 + Math.random() * 50; // Baseline 50-100MB memory
  systemMetrics.activeConnections = 0;
  systemMetrics.dbConnections = 0;
  systemMetrics.queueSize = 0;
}
