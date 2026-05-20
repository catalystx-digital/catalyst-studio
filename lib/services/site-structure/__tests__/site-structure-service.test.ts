import { SiteStructureService } from '../site-structure-service';
import { PrismaClient } from '@prisma/client';
import { NodeNotFoundError, CircularReferenceError, InvalidOperationError } from '../errors';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    siteStructure: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    }
  }
}));

describe('SiteStructureService', () => {
  let service: SiteStructureService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = require('@/lib/prisma').prisma;
    service = new SiteStructureService(mockPrisma);
  });

  describe('Tree Operations', () => {
    describe('getTree', () => {
      it('should build a tree structure from flat nodes', async () => {
        const mockNodes = [
          {
            id: 'root-1',
            websiteId: 'website-1',
            parentId: null,
            title: 'Home',
            slug: 'home',
            fullPath: '/home',
            pathDepth: 1,
            position: 0,
            weight: 0,
            contentItemId: null,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 'child-1',
            websiteId: 'website-1',
            parentId: 'root-1',
            title: 'About',
            slug: 'about',
            fullPath: '/home/about',
            pathDepth: 2,
            position: 0,
            weight: 0,
            contentItemId: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];

        mockPrisma.websiteStructure.findMany.mockResolvedValue(mockNodes);

        const tree = await service.getTree('website-1');

        expect(tree.id).toBe('root-1');
        expect(tree.children).toHaveLength(1);
        expect(tree.children[0].id).toBe('child-1');
      });

      it('should handle empty tree', async () => {
        mockPrisma.websiteStructure.findMany.mockResolvedValue([]);

        const tree = await service.getTree('website-1');

        expect(tree.id).toBe('root');
        expect(tree.children).toHaveLength(0);
      });
    });

    describe('getAncestors', () => {
      it('should return ancestors in correct order', async () => {
        const mockNode = {
          id: 'child-2',
          parentId: 'child-1',
          websiteId: 'website-1',
          title: 'Grandchild',
          slug: 'grandchild',
          fullPath: '/home/about/grandchild',
          pathDepth: 3,
          position: 0,
          weight: 0,
          contentItemId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const mockParent = {
          id: 'child-1',
          parentId: 'root-1',
          websiteId: 'website-1',
          title: 'About',
          slug: 'about',
          fullPath: '/home/about',
          pathDepth: 2,
          position: 0,
          weight: 0,
          contentItemId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const mockGrandparent = {
          id: 'root-1',
          parentId: null,
          websiteId: 'website-1',
          title: 'Home',
          slug: 'home',
          fullPath: '/home',
          pathDepth: 1,
          position: 0,
          weight: 0,
          contentItemId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        mockPrisma.websiteStructure.findUnique
          .mockResolvedValueOnce(mockNode)
          .mockResolvedValueOnce(mockParent)
          .mockResolvedValueOnce(mockGrandparent);

        const ancestors = await service.getAncestors('child-2');

        expect(ancestors).toHaveLength(2);
        expect(ancestors[0].id).toBe('root-1');
        expect(ancestors[1].id).toBe('child-1');
      });

      it('should throw error for non-existent node', async () => {
        mockPrisma.websiteStructure.findUnique.mockResolvedValue(null);

        await expect(service.getAncestors('non-existent')).rejects.toThrow(NodeNotFoundError);
      });
    });

    describe('getDescendants', () => {
      it('should return all descendants recursively', async () => {
        const mockNode = { id: 'root-1', websiteId: 'website-1' };
        const mockChildren = [
          { id: 'child-1', parentId: 'root-1' },
          { id: 'child-2', parentId: 'root-1' }
        ];
        const mockGrandchildren = [
          { id: 'grandchild-1', parentId: 'child-1' }
        ];

        mockPrisma.websiteStructure.findUnique.mockResolvedValue(mockNode);
        mockPrisma.websiteStructure.findMany
          .mockResolvedValueOnce(mockChildren)
          .mockResolvedValueOnce(mockGrandchildren)
          .mockResolvedValueOnce([]);

        const descendants = await service.getDescendants('root-1');

        expect(descendants).toHaveLength(3);
        expect(descendants.map(d => d.id)).toContain('child-1');
        expect(descendants.map(d => d.id)).toContain('child-2');
        expect(descendants.map(d => d.id)).toContain('grandchild-1');
      });
    });
  });

  describe('CRUD Operations', () => {
    describe('create', () => {
      it('should create a new node with calculated path and position', async () => {
        const mockParent = {
          id: 'parent-1',
          fullPath: '/parent',
          pathDepth: 1
        };

        const mockSiblings = [
          { position: 0 },
          { position: 1 }
        ];

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const txMock = {
            siteStructure: {
              findUnique: jest.fn().mockResolvedValue(mockParent),
              findMany: jest.fn().mockResolvedValue(mockSiblings),
              create: jest.fn().mockResolvedValue({
                id: 'new-node',
                websiteId: 'website-1',
                parentId: 'parent-1',
                slug: 'new-page',
                fullPath: '/parent/new-page',
                pathDepth: 2,
                position: 2,
                weight: 0,
                title: 'New Page'
              })
            }
          };
          return callback(txMock);
        });

        const result = await service.create({
          websiteId: 'website-1',
          parentId: 'parent-1',
          slug: 'new-page',
          title: 'New Page'
        });

        expect(result.fullPath).toBe('/parent/new-page');
        expect(result.pathDepth).toBe(2);
        expect(result.position).toBe(2);
      });
    });

    describe('update', () => {
      it('should update node and recalculate paths if slug changes', async () => {
        const mockNode = {
          id: 'node-1',
          parentId: 'parent-1',
          slug: 'old-slug',
          fullPath: '/parent/old-slug',
          pathDepth: 2
        };

        const mockParent = {
          id: 'parent-1',
          fullPath: '/parent'
        };

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const txMock = {
            siteStructure: {
              findUnique: jest.fn()
                .mockResolvedValueOnce(mockNode)
                .mockResolvedValueOnce(mockParent),
              update: jest.fn().mockResolvedValue({
                ...mockNode,
                slug: 'new-slug',
                fullPath: '/parent/new-slug'
              }),
              findMany: jest.fn().mockResolvedValue([])
            }
          };
          return callback(txMock);
        });

        const result = await service.update('node-1', {
          slug: 'new-slug'
        });

        expect(result.slug).toBe('new-slug');
        expect(result.fullPath).toBe('/parent/new-slug');
      });
    });

    describe('delete', () => {
      it('should delete node and all descendants', async () => {
        const mockNode = {
          id: 'node-1',
          parentId: 'parent-1'
        };

        const mockDescendants = [
          { id: 'child-1' },
          { id: 'grandchild-1' }
        ];

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const txMock = {
            siteStructure: {
              findUnique: jest.fn().mockResolvedValue(mockNode),
              findMany: jest.fn()
                .mockResolvedValueOnce(mockDescendants)
                .mockResolvedValueOnce([]),
              delete: jest.fn().mockResolvedValue({}),
              update: jest.fn()
            }
          };
          return callback(txMock);
        });

        // Mock getDescendants
        jest.spyOn(service, 'getDescendants').mockResolvedValue(mockDescendants as any);

        await service.delete('node-1');

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });
    });
  });

  describe('Move Operations', () => {
    describe('moveNode', () => {
      it('should move node to new parent and update paths', async () => {
        const mockNode = {
          id: 'node-1',
          parentId: 'old-parent',
          slug: 'my-page',
          fullPath: '/old-parent/my-page',
          pathDepth: 2
        };

        const mockNewParent = {
          id: 'new-parent',
          fullPath: '/new-parent',
          pathDepth: 1
        };

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const txMock = {
            siteStructure: {
              findUnique: jest.fn()
                .mockResolvedValueOnce(mockNode)
                .mockResolvedValueOnce(mockNewParent),
              findMany: jest.fn().mockResolvedValue([]),
              update: jest.fn().mockResolvedValue({
                ...mockNode,
                parentId: 'new-parent',
                fullPath: '/new-parent/my-page',
                pathDepth: 2
              })
            }
          };
          return callback(txMock);
        });

        // Mock validation
        jest.spyOn(service, 'validateMove').mockResolvedValue(true);

        const result = await service.moveNode('node-1', 'new-parent');

        expect(result.parentId).toBe('new-parent');
        expect(result.fullPath).toBe('/new-parent/my-page');
      });

      it('should throw error for circular reference', async () => {
        jest.spyOn(service, 'validateMove').mockResolvedValue(false);

        await expect(service.moveNode('node-1', 'descendant-1')).rejects.toThrow(CircularReferenceError);
      });
    });

    describe('wouldCreateCycle', () => {
      it('should detect circular reference', async () => {
        const mockDescendants = [
          { id: 'child-1' },
          { id: 'grandchild-1' }
        ];

        jest.spyOn(service, 'getDescendants').mockResolvedValue(mockDescendants as any);

        const result = await service.wouldCreateCycle('parent-1', 'grandchild-1');

        expect(result).toBe(true);
      });

      it('should allow valid move', async () => {
        jest.spyOn(service, 'getDescendants').mockResolvedValue([]);

        const result = await service.wouldCreateCycle('node-1', 'unrelated-node');

        expect(result).toBe(false);
      });
    });
  });

  describe('Position Management', () => {
    describe('reorderSiblings', () => {
      it('should update positions for siblings', async () => {
        const positions = [
          { id: 'node-1', position: 2 },
          { id: 'node-2', position: 0 },
          { id: 'node-3', position: 1 }
        ];

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const txMock = {
            siteStructure: {
              findMany: jest.fn().mockResolvedValue([
                { id: 'node-1' },
                { id: 'node-2' },
                { id: 'node-3' }
              ]),
              update: jest.fn().mockResolvedValue({})
            }
          };
          return callback(txMock);
        });

        await service.reorderSiblings('parent-1', 'website-1', positions);

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it('should throw error if nodes dont belong to parent', async () => {
        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const txMock = {
            siteStructure: {
              findMany: jest.fn().mockResolvedValue([
                { id: 'node-1' }
              ])
            }
          };
          return callback(txMock);
        });

        const positions = [
          { id: 'node-1', position: 0 },
          { id: 'node-2', position: 1 }
        ];

        await expect(service.reorderSiblings('parent-1', 'website-1', positions))
          .rejects.toThrow(InvalidOperationError);
      });
    });

    describe('swapPositions', () => {
      it('should swap positions of two nodes', async () => {
        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const txMock = {
            siteStructure: {
              findUnique: jest.fn()
                .mockResolvedValueOnce({ id: 'node-1', parentId: 'parent-1', position: 0 })
                .mockResolvedValueOnce({ id: 'node-2', parentId: 'parent-1', position: 1 }),
              update: jest.fn().mockResolvedValue({})
            }
          };
          return callback(txMock);
        });

        await service.swapPositions('node-1', 'node-2');

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it('should throw error if nodes have different parents', async () => {
        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const txMock = {
            siteStructure: {
              findUnique: jest.fn()
                .mockResolvedValueOnce({ id: 'node-1', parentId: 'parent-1', position: 0 })
                .mockResolvedValueOnce({ id: 'node-2', parentId: 'parent-2', position: 0 })
            }
          };
          return callback(txMock);
        });

        await expect(service.swapPositions('node-1', 'node-2'))
          .rejects.toThrow(InvalidOperationError);
      });
    });
  });

  describe('Validation', () => {
    describe('validateTree', () => {
      it('should identify tree issues', async () => {
        const mockNodes = [
          {
            id: 'node-1',
            parentId: null,
            slug: 'home',
            fullPath: '/home',
            pathDepth: 1
          },
          {
            id: 'node-2',
            parentId: 'non-existent',
            slug: 'orphan',
            fullPath: '/orphan',
            pathDepth: 1
          },
          {
            id: 'node-3',
            parentId: null,
            slug: 'home',
            fullPath: '/home',
            pathDepth: 1
          }
        ];

        mockPrisma.websiteStructure.findMany.mockResolvedValue(mockNodes);
        jest.spyOn(service, 'findOrphanedNodes').mockResolvedValue([mockNodes[1]] as any);
        jest.spyOn(service, 'validatePaths').mockResolvedValue({
          valid: true,
          errors: [],
          warnings: [],
          summary: 'No path issues'
        });

        const report = await service.validateTree('website-1');

        expect(report.valid).toBe(false);
        expect(report.errors).toContain('Found 1 orphaned nodes');
        expect(report.errors.length).toBeGreaterThan(1); // Also duplicate slug error
      });
    });

    describe('findOrphanedNodes', () => {
      it('should find nodes with non-existent parents', async () => {
        const mockNodes = [
          { id: 'node-1', parentId: null },
          { id: 'node-2', parentId: 'node-1' },
          { id: 'node-3', parentId: 'non-existent' }
        ];

        mockPrisma.websiteStructure.findMany.mockResolvedValue(mockNodes);

        const orphaned = await service.findOrphanedNodes('website-1');

        expect(orphaned).toHaveLength(1);
        expect(orphaned[0].id).toBe('node-3');
      });
    });

    describe('repairTree', () => {
      it('should fix tree issues', async () => {
        const mockNodes = [
          {
            id: 'orphan-1',
            parentId: 'non-existent',
            slug: 'orphan',
            fullPath: '/wrong',
            pathDepth: 99
          }
        ];

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          const txMock = {
            siteStructure: {
              findMany: jest.fn().mockResolvedValue(mockNodes),
              update: jest.fn().mockResolvedValue({})
            }
          };
          return callback(txMock);
        });

        jest.spyOn(service, 'validateTree').mockResolvedValue({
          valid: false,
          errors: ['Found orphaned nodes'],
          warnings: [],
          summary: 'Issues found'
        });

        jest.spyOn(service, 'findOrphanedNodes').mockResolvedValue(mockNodes as any);

        const report = await service.repairTree('website-1');

        expect(report.valid).toBe(true);
        expect(report.warnings.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('bulkCreate', () => {
      it('should create multiple nodes in transaction', async () => {
        const nodes = [
          { websiteId: 'website-1', slug: 'page1', title: 'Page 1' },
          { websiteId: 'website-1', slug: 'page2', title: 'Page 2' }
        ];

        jest.spyOn(service, 'create')
          .mockResolvedValueOnce({ id: 'node-1' } as any)
          .mockResolvedValueOnce({ id: 'node-2' } as any);

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          return callback({});
        });

        const result = await service.bulkCreate(nodes);

        expect(result).toHaveLength(2);
        expect(service.create).toHaveBeenCalledTimes(2);
      });
    });

    describe('bulkMove', () => {
      it('should validate all moves before executing', async () => {
        const moves = [
          { nodeId: 'node-1', newParentId: 'parent-1' },
          { nodeId: 'node-2', newParentId: 'parent-2' }
        ];

        jest.spyOn(service, 'validateMove').mockResolvedValue(true);
        jest.spyOn(service, 'moveNode')
          .mockResolvedValueOnce({ id: 'node-1' } as any)
          .mockResolvedValueOnce({ id: 'node-2' } as any);

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          return callback({});
        });

        const result = await service.bulkMove(moves);

        expect(service.validateMove).toHaveBeenCalledTimes(2);
        expect(service.moveNode).toHaveBeenCalledTimes(2);
        expect(result).toHaveLength(2);
      });

      it('should reject all moves if any would create cycle', async () => {
        const moves = [
          { nodeId: 'node-1', newParentId: 'parent-1' },
          { nodeId: 'node-2', newParentId: 'child-of-node-2' }
        ];

        jest.spyOn(service, 'validateMove')
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false);

        mockPrisma.$transaction.mockImplementation(async (callback) => {
          return callback({});
        });

        await expect(service.bulkMove(moves)).rejects.toThrow(CircularReferenceError);
      });
    });
  });
});