import { StructureService } from '../structure-service';
import { PrismaClient, Prisma } from '@prisma/client';
import { CreateStructureDto, UpdateStructureDto, MoveStructureDto } from '../interfaces/structure-service.interface';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    $transaction: jest.fn(),
    websiteStructure: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

describe('StructureService', () => {
  let service: StructureService;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    service = new StructureService(prisma);
    jest.clearAllMocks();
  });

  describe('createStructure', () => {
    it('should create a structure entry', async () => {
      const createDto: CreateStructureDto = {
        websiteId: 'web-1',
        slug: 'test-page',
        websitePageId: 'page-1',
      };

      const mockStructure = {
        id: 'struct-1',
        websiteId: 'web-1',
        slug: 'test-page',
        fullPath: '/test-page',
        websitePageId: 'page-1',
        parentId: null,
        position: 0,
        metadata: {},
      };

      prisma.websiteStructure.findFirst.mockResolvedValue(null);
      prisma.websiteStructure.create.mockResolvedValue(mockStructure);

      const result = await service.createStructure(createDto);

      expect(result).toEqual(mockStructure);
      expect(prisma.websiteStructure.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          websiteId: 'web-1',
          slug: 'test-page',
          fullPath: '/test-page',
          websitePageId: 'page-1',
          parentId: null,
          position: 0,
          metadata: {},
        }),
      });
    });

    it('should create child structure with parent path', async () => {
      const createDto: CreateStructureDto = {
        websiteId: 'web-1',
        slug: 'child-page',
        websitePageId: 'page-2',
        parentId: 'struct-1',
      };

      const parentStructure = {
        id: 'struct-1',
        fullPath: '/parent',
      };

      const mockStructure = {
        id: 'struct-2',
        websiteId: 'web-1',
        slug: 'child-page',
        fullPath: '/parent/child-page',
        websitePageId: 'page-2',
        parentId: 'struct-1',
        position: 0,
        metadata: {},
      };

      prisma.websiteStructure.findUnique.mockResolvedValue(parentStructure);
      prisma.websiteStructure.findFirst.mockResolvedValue(null);
      prisma.websiteStructure.create.mockResolvedValue(mockStructure);

      const result = await service.createStructure(createDto);

      expect(result).toEqual(mockStructure);
      expect(result.fullPath).toBe('/parent/child-page');
    });
  });

  describe('getStructure', () => {
    it('should retrieve a structure by ID', async () => {
      const mockStructure = {
        id: 'struct-1',
        websiteId: 'web-1',
        slug: 'test-page',
        fullPath: '/test-page',
      };

      prisma.websiteStructure.findUnique.mockResolvedValue(mockStructure);

      const result = await service.getStructure('struct-1');

      expect(result).toEqual(mockStructure);
      expect(prisma.websiteStructure.findUnique).toHaveBeenCalledWith({
        where: { id: 'struct-1' },
      });
    });
  });

  describe('updateStructure', () => {
    it('should update structure and regenerate path if needed', async () => {
      const updateDto: UpdateStructureDto = {
        slug: 'updated-slug',
      };

      const existingStructure = {
        id: 'struct-1',
        websiteId: 'web-1',
        slug: 'old-slug',
        fullPath: '/old-slug',
        parentId: null,
      };

      const updatedStructure = {
        ...existingStructure,
        slug: 'updated-slug',
        fullPath: '/updated-slug',
      };

      prisma.websiteStructure.findUnique.mockResolvedValue(existingStructure);
      prisma.websiteStructure.update.mockResolvedValue(updatedStructure);

      const result = await service.updateStructure('struct-1', updateDto);

      expect(result).toEqual(updatedStructure);
      expect(result.fullPath).toBe('/updated-slug');
    });
  });

  describe('deleteStructure', () => {
    it('should delete structure without children', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue(null); // No children
      prisma.websiteStructure.delete.mockResolvedValue({ id: 'struct-1' });

      await service.deleteStructure('struct-1');

      expect(prisma.websiteStructure.delete).toHaveBeenCalledWith({
        where: { id: 'struct-1' },
      });
    });

    it('should throw error when trying to delete structure with children', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue({ id: 'child-1' }); // Has children

      await expect(service.deleteStructure('struct-1')).rejects.toThrow(
        'Cannot delete structure with children'
      );
    });
  });

  describe('getStructureTree', () => {
    it('should build a tree structure', async () => {
      const structures = [
        { id: 'root-1', parentId: null, slug: 'root-1', position: 0 },
        { id: 'root-2', parentId: null, slug: 'root-2', position: 1 },
        { id: 'child-1', parentId: 'root-1', slug: 'child-1', position: 0 },
        { id: 'child-2', parentId: 'root-1', slug: 'child-2', position: 1 },
      ];

      prisma.websiteStructure.findMany.mockResolvedValue(structures);

      const result = await service.getStructureTree('web-1');

      expect(result).toHaveLength(2); // Two root nodes
      expect(result[0].children).toHaveLength(2); // First root has two children
      expect(result[1].children).toHaveLength(0); // Second root has no children
    });
  });

  describe('moveStructure', () => {
    it('should move structure to new parent', async () => {
      const moveDto: MoveStructureDto = {
        structureId: 'struct-2',
        newParentId: 'struct-3',
      };

      const structure = {
        id: 'struct-2',
        websiteId: 'web-1',
        slug: 'moved-page',
        parentId: 'struct-1',
      };

      const newParent = {
        id: 'struct-3',
        fullPath: '/new-parent',
      };

      const updatedStructure = {
        ...structure,
        parentId: 'struct-3',
        fullPath: '/new-parent/moved-page',
        position: 0,
      };

      prisma.$transaction.mockImplementation(async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const tx = {
          websiteStructure: {
            findUnique: jest.fn()
              .mockResolvedValueOnce(structure)
              .mockResolvedValueOnce(newParent)
              .mockResolvedValueOnce(null), // isDescendant check
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue(updatedStructure),
            findMany: jest.fn().mockResolvedValue([]), // No children
          },
        };
        return fn(tx);
      });

      const result = await service.moveStructure(moveDto);

      expect(result).toEqual(updatedStructure);
      expect(result.parentId).toBe('struct-3');
    });

    it('should prevent moving to own descendant', async () => {
      const moveDto: MoveStructureDto = {
        structureId: 'parent',
        newParentId: 'child',
      };

      prisma.$transaction.mockImplementation(async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const tx = {
          websiteStructure: {
            findUnique: jest.fn()
              .mockResolvedValueOnce({ id: 'parent', websiteId: 'web-1' })
              .mockResolvedValueOnce({ id: 'child', parentId: 'parent' })
              .mockResolvedValueOnce({ id: 'parent' }),
          },
        };
        return fn(tx);
      });

      await expect(service.moveStructure(moveDto)).rejects.toThrow(
        'Cannot move structure to its own descendant'
      );
    });
  });

  describe('generateUniqueSlug', () => {
    it('should generate unique slug', async () => {
      prisma.websiteStructure.findFirst
        .mockResolvedValueOnce({ slug: 'test-page' }) // First check - exists
        .mockResolvedValueOnce({ slug: 'test-page-1' }) // Second check - exists
        .mockResolvedValueOnce(null); // Third check - available

      const result = await service.generateUniqueSlug('web-1', 'test-page');

      expect(result).toBe('test-page-2');
    });

    it('should return original slug if unique', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue(null);

      const result = await service.generateUniqueSlug('web-1', 'unique-slug');

      expect(result).toBe('unique-slug');
    });
  });

  describe('validatePath', () => {
    it('should validate existing path', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue({ id: 'struct-1' });

      const result = await service.validatePath('web-1', '/valid/path');

      expect(result).toBe(true);
    });

    it('should invalidate non-existent path', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue(null);

      const result = await service.validatePath('web-1', '/invalid/path');

      expect(result).toBe(false);
    });

    it('should invalidate path not starting with /', async () => {
      const result = await service.validatePath('web-1', 'invalid/path');

      expect(result).toBe(false);
    });
  });

  describe('getBreadcrumbs', () => {
    it('should return breadcrumbs for structure', async () => {
      const structures = [
        { id: 'struct-3', slug: 'child', fullPath: '/root/parent/child', parentId: 'struct-2' },
        { id: 'struct-2', slug: 'parent', fullPath: '/root/parent', parentId: 'struct-1' },
        { id: 'struct-1', slug: 'root', fullPath: '/root', parentId: null },
      ];

      prisma.websiteStructure.findUnique
        .mockResolvedValueOnce(structures[0])
        .mockResolvedValueOnce(structures[1])
        .mockResolvedValueOnce(structures[2]);

      const result = await service.getBreadcrumbs('struct-3');

      expect(result).toEqual([
        { id: 'struct-1', slug: 'root', fullPath: '/root' },
        { id: 'struct-2', slug: 'parent', fullPath: '/root/parent' },
        { id: 'struct-3', slug: 'child', fullPath: '/root/parent/child' },
      ]);
    });
  });

  describe('hasChildren', () => {
    it('should return true if structure has children', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue({ id: 'child-1' });

      const result = await service.hasChildren('struct-1');

      expect(result).toBe(true);
    });

    it('should return false if structure has no children', async () => {
      prisma.websiteStructure.findFirst.mockResolvedValue(null);

      const result = await service.hasChildren('struct-1');

      expect(result).toBe(false);
    });
  });
});