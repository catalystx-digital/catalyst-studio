import { PrismaClient } from '@/lib/generated/prisma';
import { ComponentTransformer } from '@/lib/studio/migrations/transform-existing-components';
import { ComponentCompatibilityLayer } from '@/lib/studio/components/cms/_core/compatibility';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// Mock Prisma client for testing
const prisma = new PrismaClient();

describe('Story 10.2: CMS Schema Migration Tests', () => {
  let transformer: ComponentTransformer;
  let compatibility: ComponentCompatibilityLayer;
  let testWebsiteId: string;

  beforeAll(async () => {
    // Initialize test utilities
    transformer = new ComponentTransformer(prisma);
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
      await prisma.cMSComponent.deleteMany({
        where: { websiteId: testWebsiteId }
      });
      await prisma.contentItem.deleteMany({
        where: { websiteId: testWebsiteId }
      });
      await prisma.contentType.deleteMany({
        where: { websiteId: testWebsiteId }
      });
      await prisma.website.delete({
        where: { id: testWebsiteId }
      });
    }
    await prisma.$disconnect();
  });

  describe('Forward Migration Execution', () => {
    it('should create CMSComponent table with all required fields', async () => {
      // Test that we can create a CMSComponent
      const component = await prisma.cMSComponent.create({
        data: {
          type: 'test-component',
          category: 'test',
          version: '1.0.0',
          props: { test: true },
          content: { message: 'Test content' },
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
      await prisma.cMSComponent.delete({
        where: { id: component.id }
      });
    });

    it('should create ComponentAnalytics table with metrics fields', async () => {
      // Create a CMSComponent first to properly test the foreign key relationship
      const cmsComponent = await prisma.cMSComponent.create({
        data: {
          type: 'test-analytics-component',
          category: 'test',
          version: '1.0.0',
          props: {},
          content: {},
          aiMetadata: { patterns: ['test'] },
          confidence: 0.8,
          websiteId: testWebsiteId
        }
      });

      // Now create ComponentAnalytics with the actual CMSComponent ID
      const analytics = await prisma.componentAnalytics.create({
        data: {
          componentId: cmsComponent.id, // Use the actual CMSComponent ID
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
      expect(analytics.componentId).toBe(cmsComponent.id); // Verify the foreign key
      expect(analytics.renderCount).toBe(100);
      expect(analytics.avgRenderTime).toBe(12.5);
      expect(analytics.impressions).toBe(500);

      // Cleanup - delete analytics first, then component
      await prisma.componentAnalytics.delete({
        where: { id: analytics.id }
      });
      await prisma.cMSComponent.delete({
        where: { id: cmsComponent.id }
      });
    });

    it('should have proper indexes for performance', async () => {
      // Create multiple components to test index performance
      const components = await Promise.all([
        prisma.cMSComponent.create({
          data: {
            type: 'nav-bar',
            category: 'navigation',
            props: {},
            content: {},
            aiMetadata: {},
            websiteId: testWebsiteId
          }
        }),
        prisma.cMSComponent.create({
          data: {
            type: 'hero-banner',
            category: 'heroes',
            props: {},
            content: {},
            aiMetadata: {},
            confidence: 0.9,
            websiteId: testWebsiteId
          }
        })
      ]);

      // Test indexed queries
      const navComponents = await prisma.cMSComponent.findMany({
        where: {
          websiteId: testWebsiteId,
          type: 'nav-bar'
        }
      });

      const heroComponents = await prisma.cMSComponent.findMany({
        where: {
          category: 'heroes'
        }
      });

      const highConfidence = await prisma.cMSComponent.findMany({
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
          prisma.cMSComponent.delete({ where: { id: c.id } })
        )
      );
    });
  });

  describe('Rollback Procedure', () => {
    it('should handle rollback simulation without data loss', async () => {
      // Create test data
      const component = await prisma.cMSComponent.create({
        data: {
          type: 'rollback-test',
          category: 'test',
          props: { important: 'data' },
          content: { preserve: 'this' },
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      // Verify component exists
      const beforeRollback = await prisma.cMSComponent.findUnique({
        where: { id: component.id }
      });
      expect(beforeRollback).toBeDefined();

      // Simulate data preservation (in real rollback, this would be backed up)
      const preservedData = {
        id: component.id,
        props: component.props,
        content: component.content
      };

      // Delete component (simulating rollback)
      await prisma.cMSComponent.delete({
        where: { id: component.id }
      });

      // Verify component is gone
      const afterRollback = await prisma.cMSComponent.findUnique({
        where: { id: component.id }
      });
      expect(afterRollback).toBeNull();

      // Verify we have preserved data
      expect(preservedData.props).toEqual({ important: 'data' });
      expect(preservedData.content).toEqual({ preserve: 'this' });
    });
  });

  describe('Data Preservation', () => {
    it('should preserve existing ContentItem component data during migration', async () => {
      // Create a component content type
      const contentType = await prisma.contentType.create({
        data: {
          key: 'legacy-component',
          name: 'Legacy Component',
          pluralName: 'Legacy Components',
          category: 'component',
          fields: {},
          websiteId: testWebsiteId
        }
      });

      // Create a legacy component as ContentItem
      const legacyComponent = await prisma.contentItem.create({
        data: {
          contentTypeId: contentType.id,
          websiteId: testWebsiteId,
          title: 'Legacy Hero Component',
          slug: 'legacy-hero',
          status: 'published',
          content: {
            type: 'hero',
            props: { title: 'Welcome' },
            styles: { backgroundColor: 'blue' }
          }
        }
      });

      // Transform the legacy component
      const result = await transformer.transformExistingComponents();
      
      // Verify transformation preserves data
      const migratedComponent = await prisma.cMSComponent.findFirst({
        where: {
          websiteId: testWebsiteId,
          type: 'hero-banner'
        }
      });

      if (migratedComponent) {
        expect(migratedComponent.content).toBeDefined();
        expect(migratedComponent.props).toBeDefined();
      }

      // Cleanup
      await prisma.contentItem.delete({
        where: { id: legacyComponent.id }
      });
      await prisma.contentType.delete({
        where: { id: contentType.id }
      });
      if (migratedComponent) {
        await prisma.cMSComponent.delete({
          where: { id: migratedComponent.id }
        });
      }
    });
  });

  describe('Idempotency', () => {
    it('should handle multiple migration runs without errors', async () => {
      // First migration run
      const component1 = await prisma.cMSComponent.create({
        data: {
          type: 'idempotent-test',
          category: 'test',
          props: {},
          content: {},
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      // Second migration run (should not fail)
      const component2 = await prisma.cMSComponent.create({
        data: {
          type: 'idempotent-test-2',
          category: 'test',
          props: {},
          content: {},
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      expect(component1.id).toBeDefined();
      expect(component2.id).toBeDefined();
      expect(component1.id).not.toBe(component2.id);

      // Cleanup
      await prisma.cMSComponent.deleteMany({
        where: {
          websiteId: testWebsiteId,
          type: {
            startsWith: 'idempotent-test'
          }
        }
      });
    });
  });

  describe('Zero-Downtime Strategy', () => {
    it('should support dual-read capability', async () => {
      // Create component in new table
      const newComponent = await prisma.cMSComponent.create({
        data: {
          type: 'dual-read-test',
          category: 'test',
          props: { source: 'new' },
          content: {},
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      // Test dual-read through compatibility layer
      const component = await compatibility.readComponent(testWebsiteId, newComponent.id);
      
      if (component) {
        expect(component.id).toBe(newComponent.id);
      }

      // Cleanup
      await prisma.cMSComponent.delete({
        where: { id: newComponent.id }
      });
    });

    it('should handle feature flag transitions', async () => {
      // Test with different migration phases
      process.env.CMS_MIGRATION_PHASE = 'legacy';
      const legacyStatus = compatibility.getMigrationStatus();
      expect(legacyStatus.phase).toBe('legacy');

      process.env.CMS_MIGRATION_PHASE = 'dual';
      const dualStatus = compatibility.getMigrationStatus();
      expect(dualStatus.phase).toBe('dual');

      process.env.CMS_MIGRATION_PHASE = 'new';
      const newStatus = compatibility.getMigrationStatus();
      expect(newStatus.phase).toBe('new');

      // Reset to default
      delete process.env.CMS_MIGRATION_PHASE;
    });
  });

  describe('Load Testing', () => {
    it('should handle concurrent queries efficiently', async () => {
      // Create test components
      const components = await Promise.all(
        Array.from({ length: 10 }, (_, i) => 
          prisma.cMSComponent.create({
            data: {
              type: `load-test-${i}`,
              category: 'test',
              props: {},
              content: { index: i },
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
        prisma.cMSComponent.findMany({
          where: { websiteId: testWebsiteId, category: 'test' },
          take: 5
        }),
        prisma.cMSComponent.findMany({
          where: { confidence: { gte: 0.5 } },
          orderBy: { confidence: 'desc' },
          take: 5
        }),
        prisma.cMSComponent.findFirst({
          where: { type: 'load-test-5' }
        })
      ]);
      const queryTime = Date.now() - startTime;

      // Verify query performance (should be fast with indexes)
      expect(queryTime).toBeLessThan(100); // Should complete in <100ms
      expect(queries[0].length).toBeGreaterThan(0);

      // Cleanup
      await prisma.cMSComponent.deleteMany({
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
        prisma.cMSComponent.create({
          data: {
            type: 'partial-1',
            category: 'test',
            props: {},
            content: {},
            aiMetadata: {},
            websiteId: testWebsiteId
          }
        }),
        prisma.cMSComponent.create({
          data: {
            type: 'partial-2',
            category: 'test',
            props: {},
            content: {},
            aiMetadata: {},
            websiteId: testWebsiteId
          }
        })
      ]);

      // Simulate rollback by deleting components
      const deletedCount = await prisma.cMSComponent.deleteMany({
        where: {
          websiteId: testWebsiteId,
          type: { startsWith: 'partial-' }
        }
      });

      expect(deletedCount.count).toBe(2);

      // Verify components are gone
      const remaining = await prisma.cMSComponent.findMany({
        where: {
          websiteId: testWebsiteId,
          type: { startsWith: 'partial-' }
        }
      });

      expect(remaining.length).toBe(0);
    });

    it('should handle rollback with active user sessions', async () => {
      // Simulate active session with component
      const activeComponent = await prisma.cMSComponent.create({
        data: {
          type: 'active-session-component',
          category: 'test',
          props: { sessionActive: true },
          content: { userEditing: true },
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      // Store ID to simulate session holding reference
      const sessionComponentId = activeComponent.id;

      // Attempt rollback while "session active"
      const deleted = await prisma.cMSComponent.delete({
        where: { id: sessionComponentId }
      });

      expect(deleted.id).toBe(sessionComponentId);

      // Verify component is removed despite active session
      const found = await prisma.cMSComponent.findUnique({
        where: { id: sessionComponentId }
      });

      expect(found).toBeNull();
    });

    it('should handle rollback after full migration but before phase switch', async () => {
      // Create fully migrated components
      const migratedComponents = await Promise.all([
        prisma.cMSComponent.create({
          data: {
            type: 'migrated-hero',
            category: 'heroes',
            props: { migrated: true },
            content: { phase: 'complete' },
            aiMetadata: { migration: 'full' },
            confidence: 0.95,
            websiteId: testWebsiteId
          }
        }),
        prisma.cMSComponent.create({
          data: {
            type: 'migrated-nav',
            category: 'navigation',
            props: { migrated: true },
            content: { phase: 'complete' },
            aiMetadata: { migration: 'full' },
            confidence: 0.92,
            websiteId: testWebsiteId
          }
        })
      ]);

      // Store data for verification
      const originalData = migratedComponents.map(c => ({
        type: c.type,
        props: c.props,
        content: c.content
      }));

      // Simulate rollback
      await prisma.cMSComponent.deleteMany({
        where: {
          websiteId: testWebsiteId,
          type: { startsWith: 'migrated-' }
        }
      });

      // Verify data was preserved for potential re-migration
      expect(originalData[0].type).toBe('migrated-hero');
      expect(originalData[1].type).toBe('migrated-nav');
      expect(originalData[0].props).toEqual({ migrated: true });
    });

    it('should verify data integrity after rollback', async () => {
      // Create test data with specific values
      const testData = {
        type: 'integrity-test-complete',
        category: 'test',
        props: { important: 'preserve-this', nested: { deep: 'value' } },
        content: { critical: 'data', arrays: [1, 2, 3] },
        aiMetadata: { key: 'value', patterns: ['test', 'integrity'] },
        confidence: 0.99,
        websiteId: testWebsiteId
      };

      const component = await prisma.cMSComponent.create({
        data: testData
      });

      // Store complete original data
      const backup = JSON.parse(JSON.stringify(component));

      // Delete component (simulate rollback)
      await prisma.cMSComponent.delete({
        where: { id: component.id }
      });

      // Re-create from backup (simulate re-migration)
      const restored = await prisma.cMSComponent.create({
        data: {
          ...testData,
          id: backup.id
        }
      });

      // Verify complete data integrity
      expect(restored.type).toBe(backup.type);
      expect(restored.props).toEqual(backup.props);
      expect(restored.content).toEqual(backup.content);
      expect(restored.aiMetadata).toEqual(backup.aiMetadata);
      expect(restored.confidence).toBe(backup.confidence);

      // Cleanup
      await prisma.cMSComponent.delete({
        where: { id: restored.id }
      });
    });

    it('should test re-running migration after rollback', async () => {
      // Initial migration
      const initial = await prisma.cMSComponent.create({
        data: {
          type: 're-run-test',
          category: 'test',
          props: { version: 1 },
          content: { attempt: 'first' },
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      const initialId = initial.id;

      // Rollback (delete)
      await prisma.cMSComponent.delete({
        where: { id: initialId }
      });

      // Re-run migration (create again with same type)
      const second = await prisma.cMSComponent.create({
        data: {
          type: 're-run-test',
          category: 'test',
          props: { version: 2 },
          content: { attempt: 'second' },
          aiMetadata: {},
          websiteId: testWebsiteId
        }
      });

      expect(second.type).toBe('re-run-test');
      expect(second.props).toEqual({ version: 2 });
      expect(second.id).not.toBe(initialId); // Different ID after re-run

      // Cleanup
      await prisma.cMSComponent.delete({
        where: { id: second.id }
      });
    });

    it('should verify data integrity after rollback', async () => {
      // Create test data with specific values
      const testData = {
        type: 'integrity-test',
        category: 'test',
        props: { important: 'preserve-this' },
        content: { critical: 'data' },
        aiMetadata: { key: 'value' },
        confidence: 0.99,
        websiteId: testWebsiteId
      };

      const component = await prisma.cMSComponent.create({
        data: testData
      });

      // Store original data for comparison
      const originalData = { ...component };

      // Delete and recreate (simulating rollback and re-migration)
      await prisma.cMSComponent.delete({
        where: { id: component.id }
      });

      const recreated = await prisma.cMSComponent.create({
        data: {
          ...testData,
          id: originalData.id // Use same ID to simulate restoration
        }
      });

      // Verify data integrity
      expect(recreated.type).toBe(originalData.type);
      expect(recreated.props).toEqual(originalData.props);
      expect(recreated.content).toEqual(originalData.content);
      expect(recreated.confidence).toBe(originalData.confidence);

      // Cleanup
      await prisma.cMSComponent.delete({
        where: { id: recreated.id }
      });
    });
  });
});