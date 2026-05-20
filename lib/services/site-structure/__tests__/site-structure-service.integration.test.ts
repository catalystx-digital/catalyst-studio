import { SiteStructureService } from '../site-structure-service';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

describe('SiteStructureService Integration Tests', () => {
  let service: SiteStructureService;
  let testWebsiteId: string;
  let testContentTypeId: string;

  beforeAll(async () => {
    service = new SiteStructureService(prisma);
    
    // Create test website and content type
    const website = await prisma.website.create({
      data: {
        name: `Test Website ${Date.now()}`,
        category: 'business'
      }
    });
    testWebsiteId = website.id;

    const timestamp = Date.now();
    const contentType = await prisma.contentType.create({
      data: {
        name: `TestPage_${timestamp}`,
        key: `test_page_${timestamp}`,
        pluralName: `TestPages_${timestamp}`,
        websiteId: testWebsiteId,
        fields: {},
        category: 'page'
      }
    });
    testContentTypeId = contentType.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.websiteStructure.deleteMany({
      where: { websiteId: testWebsiteId }
    });
    await prisma.websitePage.deleteMany({
      where: { websiteId: testWebsiteId }
    });
    await prisma.contentType.deleteMany({
      where: { websiteId: testWebsiteId }
    });
    await prisma.website.delete({
      where: { id: testWebsiteId }
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clear site structure for each test
    await prisma.websiteStructure.deleteMany({
      where: { websiteId: testWebsiteId }
    });
  });

  describe('Complete Tree Operations', () => {
    it('should create and retrieve a complete tree structure', async () => {
      // Create root node
      const root = await service.create({
        websiteId: testWebsiteId,
        slug: 'home',
        title: 'Home'  // Note: title is required by interface but not stored in DB
      });

      // Create child nodes
      const about = await service.create({
        websiteId: testWebsiteId,
        parentId: root.id,
        slug: 'about',
        title: 'About Us'
      });

      const products = await service.create({
        websiteId: testWebsiteId,
        parentId: root.id,
        slug: 'products',
        title: 'Products'
      });

      // Create grandchild
      const team = await service.create({
        websiteId: testWebsiteId,
        parentId: about.id,
        slug: 'team',
        title: 'Our Team'
      });

      // Get complete tree
      const tree = await service.getTree(testWebsiteId);

      expect(tree.id).toBe(root.id);
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0].id).toBe(about.id);
      expect(tree.children[0].children).toHaveLength(1);
      expect(tree.children[0].children[0].id).toBe(team.id);
    });

    it('should correctly calculate paths and depths', async () => {
      const root = await service.create({
        websiteId: testWebsiteId,
        slug: 'root',
        title: 'Root'
      });

      const level1 = await service.create({
        websiteId: testWebsiteId,
        parentId: root.id,
        slug: 'level1',
        title: 'Level 1'
      });

      const level2 = await service.create({
        websiteId: testWebsiteId,
        parentId: level1.id,
        slug: 'level2',
        title: 'Level 2'
      });

      expect(root.fullPath).toBe('/root');
      expect(root.pathDepth).toBe(1);
      expect(level1.fullPath).toBe('/root/level1');
      expect(level1.pathDepth).toBe(2);
      expect(level2.fullPath).toBe('/root/level1/level2');
      expect(level2.pathDepth).toBe(3);
    });
  });

  describe('Move Operations with Path Recalculation', () => {
    it('should move node and update all descendant paths', async () => {
      // Create initial structure
      const parent1 = await service.create({
        websiteId: testWebsiteId,
        slug: 'parent1',
        title: 'Parent 1'
      });

      const parent2 = await service.create({
        websiteId: testWebsiteId,
        slug: 'parent2',
        title: 'Parent 2'
      });

      const child = await service.create({
        websiteId: testWebsiteId,
        parentId: parent1.id,
        slug: 'child',
        title: 'Child'
      });

      const grandchild = await service.create({
        websiteId: testWebsiteId,
        parentId: child.id,
        slug: 'grandchild',
        title: 'Grandchild'
      });

      // Move child to parent2
      const movedChild = await service.moveNode(child.id, parent2.id);

      // Verify paths updated
      expect(movedChild.fullPath).toBe('/parent2/child');
      expect(movedChild.pathDepth).toBe(2);

      // Check grandchild path was updated
      const updatedGrandchild = await prisma.websiteStructure.findUnique({
        where: { id: grandchild.id }
      });

      expect(updatedGrandchild?.fullPath).toBe('/parent2/child/grandchild');
      expect(updatedGrandchild?.pathDepth).toBe(3);
    });

    it('should prevent circular references', async () => {
      const parent = await service.create({
        websiteId: testWebsiteId,
        slug: 'parent',
        title: 'Parent'
      });

      const child = await service.create({
        websiteId: testWebsiteId,
        parentId: parent.id,
        slug: 'child',
        title: 'Child'
      });

      const grandchild = await service.create({
        websiteId: testWebsiteId,
        parentId: child.id,
        slug: 'grandchild',
        title: 'Grandchild'
      });

      // Try to move parent under grandchild (should fail)
      await expect(service.moveNode(parent.id, grandchild.id))
        .rejects.toThrow('circular reference');
    });
  });

  describe('Bulk Operations Performance', () => {
    it('should complete bulk operations within 1 second for 100 nodes', async () => {
      const nodes = [];
      for (let i = 0; i < 100; i++) {
        nodes.push({
          websiteId: testWebsiteId,
          slug: `node-${i}`,
          title: `Node ${i}`
        });
      }

      const startTime = Date.now();
      const created = await service.bulkCreate(nodes);
      const endTime = Date.now();

      expect(created).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle bulk updates efficiently', async () => {
      // Create nodes
      const nodes = [];
      for (let i = 0; i < 50; i++) {
        const node = await service.create({
          websiteId: testWebsiteId,
          slug: `update-node-${i}`,
          title: `Update Node ${i}`
        });
        nodes.push(node);
      }

      // Prepare bulk updates
      const updates = nodes.map(node => ({
        id: node.id,
        updates: { title: `Updated ${node.title}` }
      }));

      const startTime = Date.now();
      const updated = await service.bulkUpdate(updates);
      const endTime = Date.now();

      expect(updated).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback all changes on error', async () => {
      const parent = await service.create({
        websiteId: testWebsiteId,
        slug: 'transaction-parent',
        title: 'Transaction Parent'
      });

      // Count nodes before
      const countBefore = await prisma.websiteStructure.count({
        where: { websiteId: testWebsiteId }
      });

      // Try bulk create with one invalid node (duplicate slug)
      const nodes = [
        {
          websiteId: testWebsiteId,
          parentId: parent.id,
          slug: 'valid-1',
          title: 'Valid 1'
        },
        {
          websiteId: testWebsiteId,
          parentId: parent.id,
          slug: 'transaction-parent', // Duplicate slug
          title: 'Invalid'
        }
      ];

      try {
        await service.bulkCreate(nodes);
      } catch (error) {
        // Expected to fail
      }

      // Count should be same as before
      const countAfter = await prisma.websiteStructure.count({
        where: { websiteId: testWebsiteId }
      });

      expect(countAfter).toBe(countBefore);
    });
  });

  describe('Tree Validation and Repair', () => {
    it('should identify and repair orphaned nodes', async () => {
      // Create a normal node
      const parent = await service.create({
        websiteId: testWebsiteId,
        slug: 'valid-parent',
        title: 'Valid Parent'
      });

      // Create an orphaned node by directly inserting with non-existent parent
      const orphan = await prisma.websiteStructure.create({
        data: {
          websiteId: testWebsiteId,
          parentId: uuidv4(), // Non-existent parent
          slug: 'orphan',
          fullPath: '/orphan',
          pathDepth: 1,
          position: 0,
          weight: 0,
          title: 'Orphan Node'
        }
      });

      // Validate tree
      const validationReport = await service.validateTree(testWebsiteId);
      expect(validationReport.valid).toBe(false);
      expect(validationReport.errors).toContain('Found 1 orphaned nodes');

      // Repair tree
      const repairReport = await service.repairTree(testWebsiteId);
      expect(repairReport.valid).toBe(true);

      // Check orphan was moved to root
      const repairedOrphan = await prisma.websiteStructure.findUnique({
        where: { id: orphan.id }
      });
      expect(repairedOrphan?.parentId).toBeNull();
    });

    it('should fix path inconsistencies', async () => {
      // Create nodes with incorrect paths
      const parent = await prisma.websiteStructure.create({
        data: {
          websiteId: testWebsiteId,
          slug: 'parent',
          fullPath: '/parent',
          pathDepth: 1,
          position: 0,
          weight: 0,
          title: 'Parent'
        }
      });

      const child = await prisma.websiteStructure.create({
        data: {
          websiteId: testWebsiteId,
          parentId: parent.id,
          slug: 'child',
          fullPath: '/wrong/path', // Incorrect path
          pathDepth: 99, // Incorrect depth
          position: 0,
          weight: 0,
          title: 'Child'
        }
      });

      // Validate paths
      const validationReport = await service.validatePaths(testWebsiteId);
      expect(validationReport.valid).toBe(false);

      // Repair tree
      await service.repairTree(testWebsiteId);

      // Check paths were fixed
      const fixedChild = await prisma.websiteStructure.findUnique({
        where: { id: child.id }
      });
      expect(fixedChild?.fullPath).toBe('/parent/child');
      expect(fixedChild?.pathDepth).toBe(2);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent reads safely', async () => {
      // Create test structure
      const root = await service.create({
        websiteId: testWebsiteId,
        slug: 'concurrent-root',
        title: 'Concurrent Root'
      });

      for (let i = 0; i < 10; i++) {
        await service.create({
          websiteId: testWebsiteId,
          parentId: root.id,
          slug: `child-${i}`,
          title: `Child ${i}`
        });
      }

      // Execute concurrent reads
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(service.getTree(testWebsiteId));
        promises.push(service.getDescendants(root.id));
        promises.push(service.getAncestors(root.id));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(60);
    });

    it('should handle position updates correctly', async () => {
      const parent = await service.create({
        websiteId: testWebsiteId,
        slug: 'position-parent',
        title: 'Position Parent'
      });

      // Create siblings
      const siblings = [];
      for (let i = 0; i < 5; i++) {
        const sibling = await service.create({
          websiteId: testWebsiteId,
          parentId: parent.id,
          slug: `sibling-${i}`,
          title: `Sibling ${i}`
        });
        siblings.push(sibling);
      }

      // Reorder siblings
      const newPositions = siblings.map((s, i) => ({
        id: s.id,
        position: 4 - i // Reverse order
      }));

      await service.reorderSiblings(parent.id, testWebsiteId, newPositions);

      // Verify new order
      const reorderedSiblings = await prisma.websiteStructure.findMany({
        where: {
          parentId: parent.id,
          websiteId: testWebsiteId
        },
        orderBy: { position: 'asc' }
      });

      expect(reorderedSiblings[0].slug).toBe('sibling-4');
      expect(reorderedSiblings[4].slug).toBe('sibling-0');
    });
  });

  describe('Breadcrumb Generation', () => {
    it('should generate accurate breadcrumb trail', async () => {
      const home = await service.create({
        websiteId: testWebsiteId,
        slug: 'home',
        title: 'Home'
      });

      const products = await service.create({
        websiteId: testWebsiteId,
        parentId: home.id,
        slug: 'products',
        title: 'Products'
      });

      const electronics = await service.create({
        websiteId: testWebsiteId,
        parentId: products.id,
        slug: 'electronics',
        title: 'Electronics'
      });

      const laptops = await service.create({
        websiteId: testWebsiteId,
        parentId: electronics.id,
        slug: 'laptops',
        title: 'Laptops'
      });

      const breadcrumbs = await service.getBreadcrumbs(laptops.id);

      expect(breadcrumbs).toHaveLength(4);
      expect(breadcrumbs[0].title).toBe('Home');
      expect(breadcrumbs[1].title).toBe('Products');
      expect(breadcrumbs[2].title).toBe('Electronics');
      expect(breadcrumbs[3].title).toBe('Laptops');
      expect(breadcrumbs[3].path).toBe('/home/products/electronics/laptops');
    });
  });
});