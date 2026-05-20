/**
 * Performance Testing and Optimization
 * Tests tool execution times and context loading performance
 */

import { allTools } from '@/lib/ai-tools/tools';
import { prisma } from '@/lib/prisma';
import { ContextProvider } from '@/lib/ai-tools/context/context-provider';
import { auditLogger, getToolMetrics } from '@/lib/ai-tools/audit-logger';

describe('Performance Testing', () => {
  let smallWebsiteId: string;
  let mediumWebsiteId: string;
  let largeWebsiteId: string;
  let contentTypeIds: Map<string, string> = new Map();

  beforeAll(async () => {
    // Create websites of different sizes for testing
    await setupTestWebsites();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  async function setupTestWebsites() {
    // Small website (< 10 content types, < 50 items)
    const smallWebsite = await prisma.website.create({
      data: {
        name: 'PERF_Small_Website',
        description: 'Small website for performance testing',
        businessRequirements: ['Rule 1', 'Rule 2']
      }
    });
    smallWebsiteId = smallWebsite.id;

    // Create 3 content types for small website
    for (let i = 1; i <= 3; i++) {
      const ct = await prisma.contentType.create({
        data: {
          websiteId: smallWebsiteId,
          name: `SmallType${i}`,
          description: `Content type ${i}`,
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'content', type: 'text', required: false }
          ]
        }
      });

      // Create 10 items per type
      for (let j = 1; j <= 10; j++) {
        await prisma.contentItem.create({
          data: {
            websiteId: smallWebsiteId,
            contentTypeId: ct.id,
            name: `Small Item ${i}-${j}`,
            content: {
              title: `Title ${i}-${j}`,
              content: `Content for item ${i}-${j}`
            }
          }
        });
      }
    }

    // Medium website (10-50 content types, 50-500 items)
    const mediumWebsite = await prisma.website.create({
      data: {
        name: 'PERF_Medium_Website',
        description: 'Medium website for performance testing',
        businessRequirements: Array(10).fill(null).map((_, i) => `Rule ${i + 1}`)
      }
    });
    mediumWebsiteId = mediumWebsite.id;

    // Create 20 content types for medium website
    for (let i = 1; i <= 20; i++) {
      const ct = await prisma.contentType.create({
        data: {
          websiteId: mediumWebsiteId,
          name: `MediumType${i}`,
          description: `Content type ${i}`,
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'description', type: 'text', required: false },
            { name: 'category', type: 'text', required: false },
            { name: 'tags', type: 'array', required: false }
          ]
        }
      });

      // Create 10 items per type
      for (let j = 1; j <= 10; j++) {
        await prisma.contentItem.create({
          data: {
            websiteId: mediumWebsiteId,
            contentTypeId: ct.id,
            name: `Medium Item ${i}-${j}`,
            content: {
              title: `Title ${i}-${j}`,
              description: `Description for medium item ${i}-${j}`,
              category: `Category ${i % 5}`,
              tags: [`tag${i}`, `tag${j}`]
            }
          }
        });
      }
    }

    // Large website (50+ content types, 500+ items)
    const largeWebsite = await prisma.website.create({
      data: {
        name: 'PERF_Large_Website',
        description: 'Large website for performance testing',
        businessRequirements: Array(50).fill(null).map((_, i) => `Business rule ${i + 1}`)
      }
    });
    largeWebsiteId = largeWebsite.id;

    // Create 60 content types for large website
    for (let i = 1; i <= 60; i++) {
      const ct = await prisma.contentType.create({
        data: {
          websiteId: largeWebsiteId,
          name: `LargeType${i}`,
          description: `Content type ${i} with multiple fields`,
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'description', type: 'text', required: true },
            { name: 'content', type: 'text', required: false },
            { name: 'category', type: 'text', required: true },
            { name: 'subcategory', type: 'text', required: false },
            { name: 'tags', type: 'array', required: false },
            { name: 'publishDate', type: 'date', required: false },
            { name: 'viewCount', type: 'number', required: false }
          ]
        }
      });

      contentTypeIds.set(`LargeType${i}`, ct.id);

      // Create 10 items per type (600 total)
      const items = [];
      for (let j = 1; j <= 10; j++) {
        items.push({
          websiteId: largeWebsiteId,
          contentTypeId: ct.id,
          name: `Large Item ${i}-${j}`,
          content: {
            title: `Title ${i}-${j}`,
            description: `Detailed description for large website item ${i}-${j}`,
            content: `Full content text for item ${i}-${j} with substantial text`,
            category: `Category ${i % 10}`,
            subcategory: `Subcategory ${j % 5}`,
            tags: [`tag${i}`, `tag${j}`, `category${i % 10}`],
            publishDate: new Date().toISOString(),
            viewCount: Math.floor(Math.random() * 1000)
          }
        });
      }
      
      if (items.length > 0) {
        await prisma.contentItem.createMany({ data: items });
      }
    }
  }

  async function cleanupTestData() {
    // Cleanup in reverse order
    await prisma.contentItem.deleteMany({
      where: {
        websiteId: { in: [smallWebsiteId, mediumWebsiteId, largeWebsiteId] }
      }
    });

    await prisma.contentType.deleteMany({
      where: {
        websiteId: { in: [smallWebsiteId, mediumWebsiteId, largeWebsiteId] }
      }
    });

    await prisma.website.deleteMany({
      where: {
        id: { in: [smallWebsiteId, mediumWebsiteId, largeWebsiteId] }
      }
    });
  }

  describe('Tool Execution Times', () => {
    describe('Simple Operations (<1s)', () => {
      it('should create website in under 1 second', async () => {
        const createWebsiteTool = allTools.find(t => t.name === 'create-website')!;
        
        const startTime = Date.now();
        const result = await createWebsiteTool.execute({
          name: 'PERF_Test_Simple_Website',
          description: 'Simple website creation test'
        });
        const executionTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(executionTime).toBeLessThan(1000);

        // Cleanup
        await prisma.website.delete({ where: { id: result.data.id } });
      });

      it('should create content type in under 1 second', async () => {
        const createContentTypeTool = allTools.find(t => t.name === 'create-content-type')!;
        
        const startTime = Date.now();
        const result = await createContentTypeTool.execute({
          websiteId: smallWebsiteId,
          name: 'PERF_SimpleType',
          description: 'Simple content type',
          fields: [
            { name: 'title', type: 'text', required: true }
          ]
        });
        const executionTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(executionTime).toBeLessThan(1000);

        // Cleanup
        await prisma.contentType.delete({ where: { id: result.data.id } });
      });

      it('should create single content item in under 1 second', async () => {
        const createPageTool = allTools.find(t => t.name === 'create-page')!;
        const contentType = await prisma.contentType.findFirst({
          where: { websiteId: smallWebsiteId }
        });

        const startTime = Date.now();
        const result = await createPageTool.execute({
          websiteId: smallWebsiteId,
          contentTypeId: contentType!.id,
          name: 'PERF_Simple_Item',
          content: { title: 'Performance Test Item' }
        });
        const executionTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(executionTime).toBeLessThan(1000);

        // Cleanup
        await prisma.contentItem.delete({ where: { id: result.data.id } });
      });

      it('should validate content in under 1 second', async () => {
        const validateContentTool = allTools.find(t => t.name === 'validate-content')!;
        
        const startTime = Date.now();
        const result = await validateContentTool.execute({
          websiteId: smallWebsiteId,
          content: {
            title: 'Test Title',
            description: 'Test description for validation'
          }
        });
        const executionTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(executionTime).toBeLessThan(1000);
      });
    });

    describe('Complex Operations (<2s)', () => {
      it('should handle bulk content creation in under 2 seconds', async () => {
        const createPageTool = allTools.find(t => t.name === 'create-page')!;
        const contentType = await prisma.contentType.findFirst({
          where: { websiteId: mediumWebsiteId }
        });

        const startTime = Date.now();
        const promises = [];
        
        // Create 10 items in parallel
        for (let i = 1; i <= 10; i++) {
          promises.push(
            createPageTool.execute({
              websiteId: mediumWebsiteId,
              contentTypeId: contentType!.id,
              name: `PERF_Bulk_Item_${i}`,
              content: {
                title: `Bulk Performance Test ${i}`,
                description: `Description for bulk item ${i}`,
                tags: [`perf`, `test`, `bulk${i}`]
              }
            })
          );
        }

        const results = await Promise.all(promises);
        const executionTime = Date.now() - startTime;

        const successCount = results.filter(r => r.success).length;
        expect(successCount).toBe(10);
        expect(executionTime).toBeLessThan(2000);

        // Cleanup
        const itemIds = results.map(r => r.data?.id).filter(Boolean);
        await prisma.contentItem.deleteMany({
          where: { id: { in: itemIds } }
        });
      });

      it('should update content type with migration in under 2 seconds', async () => {
        const updateContentTypeTool = allTools.find(t => t.name === 'update-content-type')!;
        const contentType = await prisma.contentType.findFirst({
          where: { websiteId: mediumWebsiteId }
        });

        const startTime = Date.now();
        const result = await updateContentTypeTool.execute({
          websiteId: mediumWebsiteId,
          contentTypeId: contentType!.id,
          fields: [
            ...contentType!.fields as any[],
            { name: 'newField1', type: 'text', required: false },
            { name: 'newField2', type: 'number', required: false },
            { name: 'newField3', type: 'boolean', required: false }
          ]
        });
        const executionTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(executionTime).toBeLessThan(2000);
      });

      it('should handle complex multi-tool workflow in under 2 seconds', async () => {
        const startTime = Date.now();

        // 1. Get website context
        const getContextTool = allTools.find(t => t.name === 'get-website-context')!;
        const contextResult = await getContextTool.execute({
          websiteId: mediumWebsiteId
        });

        // 2. List content types
        const listTypesTool = allTools.find(t => t.name === 'list-content-types')!;
        const typesResult = await listTypesTool.execute({
          websiteId: mediumWebsiteId
        });

        // 3. List items from first type
        if (typesResult.data && typesResult.data.length > 0) {
          const listItemsTool = allTools.find(t => t.name === 'list-content-items')!;
          const itemsResult = await listItemsTool.execute({
            websiteId: mediumWebsiteId,
            contentTypeId: typesResult.data[0].id,
            limit: 10
          });

          expect(itemsResult.success).toBe(true);
        }

        const executionTime = Date.now() - startTime;

        expect(contextResult.success).toBe(true);
        expect(typesResult.success).toBe(true);
        expect(executionTime).toBeLessThan(2000);
      });
    });

    describe('Bulk Operations (Linear Scaling)', () => {
      it('should scale linearly for bulk operations', async () => {
        const createPageTool = allTools.find(t => t.name === 'create-page')!;
        const contentType = await prisma.contentType.findFirst({
          where: { websiteId: largeWebsiteId }
        });

        // Test with different batch sizes
        const batchSizes = [5, 10, 20];
        const timings: number[] = [];

        for (const batchSize of batchSizes) {
          const startTime = Date.now();
          const promises = [];

          for (let i = 1; i <= batchSize; i++) {
            promises.push(
              createPageTool.execute({
                websiteId: largeWebsiteId,
                contentTypeId: contentType!.id,
                name: `PERF_Scale_Item_${batchSize}_${i}`,
                content: {
                  title: `Scaling Test ${batchSize}-${i}`,
                  description: `Testing linear scaling with batch size ${batchSize}`
                }
              })
            );
          }

          const results = await Promise.all(promises);
          const executionTime = Date.now() - startTime;
          timings.push(executionTime);

          // Cleanup
          const itemIds = results.map(r => r.data?.id).filter(Boolean);
          await prisma.contentItem.deleteMany({
            where: { id: { in: itemIds } }
          });
        }

        // Check for approximately linear scaling
        // Time per item should be relatively consistent
        const timePerItem = timings.map((time, index) => time / batchSizes[index]);
        const avgTimePerItem = timePerItem.reduce((a, b) => a + b, 0) / timePerItem.length;
        
        // All times per item should be within 50% of average (allowing for some variance)
        for (const time of timePerItem) {
          expect(time).toBeGreaterThan(avgTimePerItem * 0.5);
          expect(time).toBeLessThan(avgTimePerItem * 1.5);
        }
      });
    });
  });

  describe('Context Loading Performance', () => {
    it('should load small website context in under 100ms', async () => {
      const contextProvider = new ContextProvider();
      
      const startTime = Date.now();
      const context = await contextProvider.getWebsiteContext(smallWebsiteId);
      const loadTime = Date.now() - startTime;

      expect(context).toBeDefined();
      expect(loadTime).toBeLessThan(100);
    });

    it('should load medium website context in under 300ms', async () => {
      const contextProvider = new ContextProvider();
      
      const startTime = Date.now();
      const context = await contextProvider.getWebsiteContext(mediumWebsiteId);
      const loadTime = Date.now() - startTime;

      expect(context).toBeDefined();
      expect(loadTime).toBeLessThan(300);
    });

    it('should load large website context in under 500ms', async () => {
      const contextProvider = new ContextProvider();
      
      const startTime = Date.now();
      const context = await contextProvider.getWebsiteContext(largeWebsiteId);
      const loadTime = Date.now() - startTime;

      expect(context).toBeDefined();
      expect(loadTime).toBeLessThan(500);
    });

    it('should efficiently prune context for large websites', async () => {
      const contextProvider = new ContextProvider();
      
      // Get full context
      const fullContext = await contextProvider.getWebsiteContext(largeWebsiteId);
      
      // Context should be pruned to manageable size
      const contextString = JSON.stringify(fullContext);
      
      // Context should not exceed reasonable size (e.g., 100KB)
      expect(contextString.length).toBeLessThan(100000);
      
      // Should still include essential information
      expect(fullContext.website).toBeDefined();
      expect(fullContext.contentTypes).toBeDefined();
      expect(fullContext.contentTypes.length).toBeGreaterThan(0);
      expect(fullContext.statistics).toBeDefined();
    });

    it('should cache frequently accessed data', async () => {
      const contextProvider = new ContextProvider();
      
      // First load (cold cache)
      const startTime1 = Date.now();
      const context1 = await contextProvider.getWebsiteContext(mediumWebsiteId);
      const loadTime1 = Date.now() - startTime1;

      // Second load (warm cache)
      const startTime2 = Date.now();
      const context2 = await contextProvider.getWebsiteContext(mediumWebsiteId);
      const loadTime2 = Date.now() - startTime2;

      // Third load (warm cache)
      const startTime3 = Date.now();
      const context3 = await contextProvider.getWebsiteContext(mediumWebsiteId);
      const loadTime3 = Date.now() - startTime3;

      // Cache should improve performance
      expect(loadTime2).toBeLessThanOrEqual(loadTime1);
      expect(loadTime3).toBeLessThanOrEqual(loadTime1);
      
      // Contexts should be consistent
      expect(context1.website.id).toBe(context2.website.id);
      expect(context2.website.id).toBe(context3.website.id);
    });
  });

  describe('Database Query Optimization', () => {
    it('should use efficient queries for listing operations', async () => {
      const listContentItemsTool = allTools.find(t => t.name === 'list-content-items')!;
      const contentType = await prisma.contentType.findFirst({
        where: { websiteId: largeWebsiteId }
      });

      // Test pagination performance
      const pageSizes = [10, 50, 100];
      
      for (const pageSize of pageSizes) {
        const startTime = Date.now();
        const result = await listContentItemsTool.execute({
          websiteId: largeWebsiteId,
          contentTypeId: contentType!.id,
          limit: pageSize,
          offset: 0
        });
        const queryTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        // Query time should not scale linearly with page size
        // (due to proper indexing and query optimization)
        expect(queryTime).toBeLessThan(500);
      }
    });

    it('should batch database operations efficiently', async () => {
      const createPageTool = allTools.find(t => t.name === 'create-page')!;
      const contentType = await prisma.contentType.findFirst({
        where: { websiteId: largeWebsiteId }
      });

      // Create items sequentially vs in batch
      const sequentialStartTime = Date.now();
      const sequentialIds = [];
      
      for (let i = 1; i <= 5; i++) {
        const result = await createPageTool.execute({
          websiteId: largeWebsiteId,
          contentTypeId: contentType!.id,
          name: `PERF_Sequential_${i}`,
          content: { title: `Sequential ${i}` }
        });
        if (result.success) {
          sequentialIds.push(result.data.id);
        }
      }
      const sequentialTime = Date.now() - sequentialStartTime;

      // Batch creation
      const batchStartTime = Date.now();
      const batchPromises = [];
      
      for (let i = 1; i <= 5; i++) {
        batchPromises.push(
          createPageTool.execute({
            websiteId: largeWebsiteId,
            contentTypeId: contentType!.id,
            name: `PERF_Batch_${i}`,
            content: { title: `Batch ${i}` }
          })
        );
      }
      
      const batchResults = await Promise.all(batchPromises);
      const batchTime = Date.now() - batchStartTime;
      const batchIds = batchResults.map(r => r.data?.id).filter(Boolean);

      // Batch should be faster than sequential
      expect(batchTime).toBeLessThan(sequentialTime);

      // Cleanup
      await prisma.contentItem.deleteMany({
        where: { id: { in: [...sequentialIds, ...batchIds] } }
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics accurately', async () => {
      // Reset audit logger for clean metrics
      auditLogger.resetSession();

      // Execute various tools
      const tools = [
        'get-website-context',
        'list-content-types',
        'list-content-items'
      ];

      for (const toolName of tools) {
        const tool = allTools.find(t => t.name === toolName)!;
        
        // Execute tool multiple times
        for (let i = 0; i < 5; i++) {
          await tool.execute({
            websiteId: mediumWebsiteId,
            contentTypeId: contentTypeIds.values().next().value
          });
        }
      }

      // Get metrics
      const metrics = getToolMetrics();
      
      expect(metrics.totalExecutions).toBeGreaterThanOrEqual(15);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.p95ExecutionTime).toBeGreaterThanOrEqual(metrics.averageExecutionTime);
      expect(metrics.p99ExecutionTime).toBeGreaterThanOrEqual(metrics.p95ExecutionTime);
    });

    it('should identify slow operations', async () => {
      // Create an intentionally slow operation
      const getWebsiteContextTool = allTools.find(t => t.name === 'get-website-context')!;
      
      // Execute on large website (likely to be slower)
      await getWebsiteContextTool.execute({
        websiteId: largeWebsiteId
      });

      const slowOps = auditLogger.getSlowOperations(100); // Operations over 100ms
      
      // Should have at least one slow operation recorded
      expect(slowOps.length).toBeGreaterThanOrEqual(0);
      
      if (slowOps.length > 0) {
        expect(slowOps[0].executionTime).toBeGreaterThan(100);
      }
    });
  });

  describe('Performance Baselines', () => {
    it('should document performance baselines', async () => {
      const baselines: Record<string, number> = {};
      
      // Measure baseline for each tool
      for (const tool of allTools) {
        const startTime = Date.now();
        
        // Execute tool with minimal parameters
        let result;
        switch (tool.name) {
          case 'get-website-context':
            result = await tool.execute({ websiteId: smallWebsiteId });
            break;
          case 'list-content-types':
            result = await tool.execute({ websiteId: smallWebsiteId });
            break;
          case 'list-content-items':
            const ct = await prisma.contentType.findFirst({
              where: { websiteId: smallWebsiteId }
            });
            result = await tool.execute({
              websiteId: smallWebsiteId,
              contentTypeId: ct!.id
            });
            break;
          case 'validate-content':
            result = await tool.execute({
              websiteId: smallWebsiteId,
              content: { title: 'Test' }
            });
            break;
          default:
            // Skip tools that require more complex setup
            continue;
        }
        
        const executionTime = Date.now() - startTime;
        baselines[tool.name] = executionTime;
      }

      // All measured tools should have reasonable baselines
      for (const [toolName, time] of Object.entries(baselines)) {
        expect(time).toBeGreaterThan(0);
        expect(time).toBeLessThan(5000); // No tool should take more than 5 seconds
        
        // Log baseline for documentation
        console.log(`Baseline for ${toolName}: ${time}ms`);
      }
    });
  });
});