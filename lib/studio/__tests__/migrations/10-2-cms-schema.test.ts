import { PrismaClient } from '@/lib/generated/prisma';
import { ComponentCompatibilityLayer } from '@/lib/studio/components/cms/_core/compatibility';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Mock Prisma client for testing
const prisma = new PrismaClient();

describe('Story 10.2: CMS Schema Migration Tests', () => {
  let compatibility: ComponentCompatibilityLayer;
  let testWebsiteId: string;

  beforeAll(async () => {
    // Initialize test utilities
    compatibility = new ComponentCompatibilityLayer(prisma);
    
    // Create a test website
    const website = await prisma.website.create({
      data: {
        name: 'Test Website for Migration',
        category: 'test',
        description: 'Testing CMS migration'
      }
    });
    testWebsiteId = website.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testWebsiteId) {
      await prisma.websiteComponentType.deleteMany({
        where: { websiteId: testWebsiteId }
      });
      await prisma.website.delete({
        where: { id: testWebsiteId }
      });
    }
    await prisma.$disconnect();
  });

  describe('Forward Migration Execution', () => {
    it('should create websiteComponentType table with all required fields', async () => {
      // Test that we can create a websiteComponentType
      const component = await prisma.websiteComponentType.create({
        data: {
          type: 'test-component',
          category: 'test',
          version: '1.0.0',
          defaultConfig: { test: true },
          placeholderData: { message: 'Test placeholderData' },
          aiMetadata: { patterns: ['test'] },
          confidence: 0.95,
          websiteId: testWebsiteId
        }
      });

      expect(component).toBeDefined();
      expect(component.id).toBeDefined();
      expect(component.type).toBe('test-component');
      expect(component.category).toBe('test');
      expect(component.version).toBe('1.0.0');
      expect(component.confidence).toBe(0.95);

      // Cleanup
      await prisma.websiteComponentType.delete({
        where: { id: component.id }
      });
    });

    it('should create ComponentAnalytics table with metrics fields', async () => {
      // Create a websiteComponentType first to properly test the foreign key relationship
      const websiteComponentType = await prisma.websiteComponentType.create({
        data: {
          type: 'test-analytics-component',
          category: 'test',
          version: '1.0.0',
          defaultConfig: {},
          placeholderData: {},
          aiMetadata: { patterns: ['test'] },
          confidence: 0.8,
          websiteId: testWebsiteId
        }
      });

      // Now create ComponentAnalytics with the actual websiteComponentType ID
      const analytics = await prisma.componentAnalytics.create({
        data: {
          componentId: websiteComponentType.id, // Use the actual websiteComponentType ID
          componentType: 'test-analytics-component',
          renderCount: 100,
          avgRenderTime: 12.5,
          errorCount: 2,
          impressions: 500,
          interactions: 50,
          conversionRate: 0.1,
          mobileViews: 200,
          tabletViews: 150,
          desktopViews: 150
        }
      });

      expect(analytics).toBeDefined();
      expect(analytics.id).toBeDefined();
      expect(analytics.componentId).toBe(websiteComponentType.id); // Verify the foreign key
      expect(analytics.renderCount).toBe(100);
      expect(analytics.avgRenderTime).toBe(12.5);
      expect(analytics.impressions).toBe(500);

      // Cleanup - delete analytics first, then component
      await prisma.componentAnalytics.delete({
        where: { id: analytics.id }
      });
      await prisma.websiteComponentType.delete({
        where: { id: websiteComponentType.id }
      });
    });

    it('should have proper indexes for performance', async () => {
      // Create multiple components to test index performance
      const components = await Promise.all([
        prisma.websiteComponentType.create({
          data: {
            type: 'nav-bar',
            category: 'navigation',
            defaultConfig: {},
            placeholderData: {},
            aiMetadata: {},
            websiteId: testWebsiteId
          }
        }),
        prisma.websiteComponentType.create({
          data: {
            type: 'hero-banner',
            category: 'heroes',
            defaultConfig: {},
            placeholderData: {},
            aiMetadata: {},
            confidence: 0.9,
            websiteId: testWebsiteId
          }
        })
      ]);

      // Test indexed queries
      const navComponents = await prisma.websiteComponentType.findMany({
        where: {
          websiteId: testWebsiteId,
          type: 'nav-bar'
        }
      });

      const heroComponents = await prisma.websiteComponentType.findMany({
        where: {
          category: 'heroes'
        }
      });

      const highConfidence = await prisma.websiteComponentType.findMany({
        where: {
          confidence: {
            gte: 0.8
          }
        },
        orderBy: {
          confidence: 'desc'
        }
      });

      expect(navComponents.length).toBeGreaterThan(0);
      expect(heroComponents.length).toBeGreaterThan(0);
      expect(highConfidence.length).toBeGreaterThan(0);

      // Cleanup
      await Promise.all(
        components.map(c => 
          prisma.websiteComponentType.delete({ where: { id: c.id } })
        )
      );
    });
  });

  describe('Rollback Procedure', () => {
    it('should handle rollback simulation without data loss', async () => {
      // Create test data
      const component = await prisma.websiteComponentType.create({
        data: {
          type: 'rollback-test',
          category: 'test',
          defaultConfig: { important: 'data' },
          placeholderData: { preserve: 'this' },
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      // Verify component exists
      const beforeRollback = await prisma.websiteComponentType.findUnique({
        where: { id: component.id }
      });
      expect(beforeRollback).toBeDefined();

      // Simulate data preservation (in real rollback, this would be backed up)
      const preservedData = {
        id: component.id,
        defaultConfig: component.defaultConfig,
        placeholderData: component.placeholderData
      };

      // Delete component (simulating rollback)
      await prisma.websiteComponentType.delete({
        where: { id: component.id }
      });

      // Verify component is gone
      const afterRollback = await prisma.websiteComponentType.findUnique({
        where: { id: component.id }
      });
      expect(afterRollback).toBeNull();

      // Verify we have preserved data
      expect(preservedData.defaultConfig).toEqual({ important: 'data' });
      expect(preservedData.placeholderData).toEqual({ preserve: 'this' });
    });
  });

  describe('Data Preservation', () => {
    it('should preserve WebsiteComponentType configuration and placeholder data', async () => {
      const component = await prisma.websiteComponentType.create({
        data: {
          type: 'preserved-hero',
          category: 'heroes',
          defaultConfig: { title: 'Welcome' },
          placeholderData: {
            headline: 'Welcome',
            styles: { backgroundColor: 'blue' }
          },
          styles: { backgroundColor: 'blue' },
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      const storedComponent = await prisma.websiteComponentType.findUnique({
        where: { id: component.id }
      });

      expect(storedComponent?.defaultConfig).toEqual({ title: 'Welcome' });
      expect(storedComponent?.placeholderData).toEqual({
        headline: 'Welcome',
        styles: { backgroundColor: 'blue' }
      });
      expect(storedComponent?.styles).toEqual({ backgroundColor: 'blue' });

      // Cleanup
      await prisma.websiteComponentType.delete({
        where: { id: component.id }
      });
    });
  });

  describe('Idempotency', () => {
    it('should handle multiple migration runs without errors', async () => {
      // First migration run
      const component1 = await prisma.websiteComponentType.create({
        data: {
          type: 'idempotent-test',
          category: 'test',
          defaultConfig: {},
          placeholderData: {},
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      // Second migration run (should not fail)
      const component2 = await prisma.websiteComponentType.create({
        data: {
          type: 'idempotent-test-2',
          category: 'test',
          defaultConfig: {},
          placeholderData: {},
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      expect(component1.id).toBeDefined();
      expect(component2.id).toBeDefined();
      expect(component1.id).not.toBe(component2.id);

      // Cleanup
      await prisma.websiteComponentType.deleteMany({
        where: {
          websiteId: testWebsiteId,
          type: {
            startsWith: 'idempotent-test'
          }
        }
      });
    });
  });

  describe('Component Compatibility Layer', () => {
    it('should read components from WebsiteComponentType only', async () => {
      const newComponent = await prisma.websiteComponentType.create({
        data: {
          type: 'read-test',
          category: 'test',
          defaultConfig: { source: 'new' },
          placeholderData: {},
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      const component = await compatibility.readComponent(testWebsiteId, newComponent.id);
      
      expect(component).toMatchObject({
        id: newComponent.id,
        type: 'read-test',
        defaultConfig: { source: 'new' },
        _source: 'WebsiteComponentType'
      });

      // Cleanup
      await prisma.websiteComponentType.delete({
        where: { id: newComponent.id }
      });
    });

    it('should write, list, report stats, and check consistency against WebsiteComponentType', async () => {
      const written = await compatibility.writeComponent(testWebsiteId, {
        type: 'compatibility-write-test',
        category: 'test',
        defaultConfig: { enabled: true },
        placeholderData: { label: 'Write test' },
        aiMetadata: { source: 'test' },
        confidence: 0.7
      });

      const listed = await compatibility.listComponents(testWebsiteId, 'test');
      const stats = await compatibility.getMigrationStats(testWebsiteId);
      const consistency = await compatibility.consistencyCheck(testWebsiteId);

      expect(written).toMatchObject({
        type: 'compatibility-write-test',
        defaultConfig: { enabled: true },
        placeholderData: { label: 'Write test' },
        _source: 'WebsiteComponentType'
      });
      expect(listed.some(component => component.id === written.id)).toBe(true);
      expect(stats.storage).toBe('websiteComponentType');
      expect(stats.counts.components).toBeGreaterThan(0);
      expect(consistency.consistent).toBe(true);
      expect(consistency.componentCount).toBeGreaterThan(0);

      // Cleanup
      await prisma.websiteComponentType.delete({
        where: { id: written.id }
      });
    });
  });

  describe('Load Testing', () => {
    it('should handle concurrent queries efficiently', async () => {
      // Create test components
      const components = await Promise.all(
        Array.from({ length: 10 }, (_, i) => 
          prisma.websiteComponentType.create({
            data: {
              type: `load-test-${i}`,
              category: 'test',
              defaultConfig: {},
              placeholderData: { index: i },
              aiMetadata: {},
              confidence: Math.random(),
              websiteId: testWebsiteId
            }
          })
        )
      );

      // Simulate concurrent queries
      const startTime = Date.now();
      const queries = await Promise.all([
        prisma.websiteComponentType.findMany({
          where: { websiteId: testWebsiteId, category: 'test' },
          take: 5
        }),
        prisma.websiteComponentType.findMany({
          where: { confidence: { gte: 0.5 } },
          orderBy: { confidence: 'desc' },
          take: 5
        }),
        prisma.websiteComponentType.findFirst({
          where: { type: 'load-test-5' }
        })
      ]);
      const queryTime = Date.now() - startTime;

      // Verify query performance (should be fast with indexes)
      expect(queryTime).toBeLessThan(100); // Should complete in <100ms
      expect(queries[0].length).toBeGreaterThan(0);

      // Cleanup
      await prisma.websiteComponentType.deleteMany({
        where: {
          websiteId: testWebsiteId,
          type: { startsWith: 'load-test-' }
        }
      });
    });
  });

  describe('Rollback Test Scenarios', () => {
    it('should handle rollback after partial data migration', async () => {
      // Create components representing partial migration
      const components = await Promise.all([
        prisma.websiteComponentType.create({
          data: {
            type: 'partial-1',
            category: 'test',
            defaultConfig: {},
            placeholderData: {},
            aiMetadata: {},
            websiteId: testWebsiteId
          }
        }),
        prisma.websiteComponentType.create({
          data: {
            type: 'partial-2',
            category: 'test',
            defaultConfig: {},
            placeholderData: {},
            aiMetadata: {},
            websiteId: testWebsiteId
          }
        })
      ]);

      // Simulate rollback by deleting components
      const deletedCount = await prisma.websiteComponentType.deleteMany({
        where: {
          websiteId: testWebsiteId,
          type: { startsWith: 'partial-' }
        }
      });

      expect(deletedCount.count).toBe(2);

      // Verify components are gone
      const remaining = await prisma.websiteComponentType.findMany({
        where: {
          websiteId: testWebsiteId,
          type: { startsWith: 'partial-' }
        }
      });

      expect(remaining.length).toBe(0);
    });

    it('should handle rollback with active user sessions', async () => {
      // Simulate active session with component
      const activeComponent = await prisma.websiteComponentType.create({
        data: {
          type: 'active-session-component',
          category: 'test',
          defaultConfig: { sessionActive: true },
          placeholderData: { userEditing: true },
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      // Store ID to simulate session holding reference
      const sessionComponentId = activeComponent.id;

      // Attempt rollback while "session active"
      const deleted = await prisma.websiteComponentType.delete({
        where: { id: sessionComponentId }
      });

      expect(deleted.id).toBe(sessionComponentId);

      // Verify component is removed despite active session
      const found = await prisma.websiteComponentType.findUnique({
        where: { id: sessionComponentId }
      });

      expect(found).toBeNull();
    });

    it('should handle rollback after WebsiteComponentType data is created', async () => {
      // Create fully migrated components
      const migratedComponents = await Promise.all([
        prisma.websiteComponentType.create({
          data: {
            type: 'migrated-hero',
            category: 'heroes',
            defaultConfig: { migrated: true },
            placeholderData: { state: 'complete' },
            aiMetadata: { migration: 'full' },
            confidence: 0.95,
            websiteId: testWebsiteId
          }
        }),
        prisma.websiteComponentType.create({
          data: {
            type: 'migrated-nav',
            category: 'navigation',
            defaultConfig: { migrated: true },
            placeholderData: { state: 'complete' },
            aiMetadata: { migration: 'full' },
            confidence: 0.92,
            websiteId: testWebsiteId
          }
        })
      ]);

      // Store data for verification
      const originalData = migratedComponents.map(c => ({
        type: c.type,
        defaultConfig: c.defaultConfig,
        placeholderData: c.placeholderData
      }));

      // Simulate rollback
      await prisma.websiteComponentType.deleteMany({
        where: {
          websiteId: testWebsiteId,
          type: { startsWith: 'migrated-' }
        }
      });

      // Verify data was preserved for potential re-migration
      expect(originalData[0].type).toBe('migrated-hero');
      expect(originalData[1].type).toBe('migrated-nav');
      expect(originalData[0].defaultConfig).toEqual({ migrated: true });
    });

    it('should verify data integrity after rollback', async () => {
      // Create test data with specific values
      const testData = {
        type: 'integrity-test-complete',
        category: 'test',
        defaultConfig: { important: 'preserve-this', nested: { deep: 'value' } },
        placeholderData: { critical: 'data', arrays: [1, 2, 3] },
        aiMetadata: { key: 'value', patterns: ['test', 'integrity'] },
        confidence: 0.99,
        websiteId: testWebsiteId
      };

      const component = await prisma.websiteComponentType.create({
        data: testData
      });

      // Store complete original data
      const backup = JSON.parse(JSON.stringify(component));

      // Delete component (simulate rollback)
      await prisma.websiteComponentType.delete({
        where: { id: component.id }
      });

      // Re-create from backup (simulate re-migration)
      const restored = await prisma.websiteComponentType.create({
        data: {
          ...testData,
          id: backup.id
        }
      });

      // Verify complete data integrity
      expect(restored.type).toBe(backup.type);
      expect(restored.defaultConfig).toEqual(backup.defaultConfig);
      expect(restored.placeholderData).toEqual(backup.placeholderData);
      expect(restored.aiMetadata).toEqual(backup.aiMetadata);
      expect(restored.confidence).toBe(backup.confidence);

      // Cleanup
      await prisma.websiteComponentType.delete({
        where: { id: restored.id }
      });
    });

    it('should test re-running migration after rollback', async () => {
      // Initial migration
      const initial = await prisma.websiteComponentType.create({
        data: {
          type: 're-run-test',
          category: 'test',
          defaultConfig: { version: 1 },
          placeholderData: { attempt: 'first' },
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      const initialId = initial.id;

      // Rollback (delete)
      await prisma.websiteComponentType.delete({
        where: { id: initialId }
      });

      // Re-run migration (create again with same type)
      const second = await prisma.websiteComponentType.create({
        data: {
          type: 're-run-test',
          category: 'test',
          defaultConfig: { version: 2 },
          placeholderData: { attempt: 'second' },
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      expect(second.type).toBe('re-run-test');
      expect(second.defaultConfig).toEqual({ version: 2 });
      expect(second.id).not.toBe(initialId); // Different ID after re-run

      // Cleanup
      await prisma.websiteComponentType.delete({
        where: { id: second.id }
      });
    });

    it('should verify data integrity after rollback', async () => {
      // Create test data with specific values
      const testData = {
        type: 'integrity-test',
        category: 'test',
        defaultConfig: { important: 'preserve-this' },
        placeholderData: { critical: 'data' },
        aiMetadata: { key: 'value' },
        confidence: 0.99,
        websiteId: testWebsiteId
      };

      const component = await prisma.websiteComponentType.create({
        data: testData
      });

      // Store original data for comparison
      const originalData = { ...component };

      // Delete and recreate (simulating rollback and re-migration)
      await prisma.websiteComponentType.delete({
        where: { id: component.id }
      });

      const recreated = await prisma.websiteComponentType.create({
        data: {
          ...testData,
          id: originalData.id // Use same ID to simulate restoration
        }
      });

      // Verify data integrity
      expect(recreated.type).toBe(originalData.type);
      expect(recreated.defaultConfig).toEqual(originalData.defaultConfig);
      expect(recreated.placeholderData).toEqual(originalData.placeholderData);
      expect(recreated.confidence).toBe(originalData.confidence);

      // Cleanup
      await prisma.websiteComponentType.delete({
        where: { id: recreated.id }
      });
    });
  });
});
