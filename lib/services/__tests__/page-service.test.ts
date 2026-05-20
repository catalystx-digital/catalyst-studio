import { PageService } from '../page-service';
import { PrismaClient, Prisma } from '@prisma/client';
import { CreatePageDto, UpdatePageDto } from '../interfaces/page-service.interface';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    $transaction: jest.fn(),
    websitePage: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    websiteStructure: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

describe('PageService', () => {
  let service: PageService;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    service = new PageService(prisma);
    jest.clearAllMocks();
  });

  describe('createPage', () => {
    it('should create a page with structure', async () => {
      const createDto: CreatePageDto = {
        websiteId: 'web-1',
        type: 'page',
        title: 'Test Page',
        content: { components: [] },
        slug: 'test-page',
      };

      const mockPage = {
        id: 'page-1',
        websiteId: 'web-1',
        type: 'page',
        title: 'Test Page',
        content: { components: [] },
      };

      const mockStructure = {
        id: 'struct-1',
        websiteId: 'web-1',
        websitePageId: 'page-1',
        slug: 'test-page',
        fullPath: '/test-page',
        parentId: null,
        position: 0,
      };

      // Mock transaction
      prisma.$transaction.mockImplementation(async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const tx = {
          websitePage: {
            create: jest.fn().mockResolvedValue(mockPage),
          },
          websiteStructure: {
            create: jest.fn().mockResolvedValue(mockStructure),
            update: jest.fn().mockResolvedValue(mockStructure),
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      });

      const result = await service.createPage(createDto);

      expect(result).toEqual({ ...mockPage, structure: mockStructure });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should handle page creation failure', async () => {
      const createDto: CreatePageDto = {
        websiteId: 'web-1',
        type: 'page',
        title: 'Test Page',
      };

      prisma.$transaction.mockRejectedValue(new Error('Database error'));

      await expect(service.createPage(createDto)).rejects.toThrow('Database error');
    });
  });

  describe('getPage', () => {
    it('should retrieve a page by ID', async () => {
      const mockPage = {
        id: 'page-1',
        websiteId: 'web-1',
        type: 'page',
        title: 'Test Page',
      };

      prisma.websitePage.findUnique.mockResolvedValue(mockPage);

      const result = await service.getPage('page-1');

      expect(result).toEqual(mockPage);
      expect(prisma.websitePage.findUnique).toHaveBeenCalledWith({
        where: { id: 'page-1' },
      });
    });

    it('should return null for non-existent page', async () => {
      prisma.websitePage.findUnique.mockResolvedValue(null);

      const result = await service.getPage('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updatePage', () => {
    it('should update page and structure', async () => {
      const updateDto: UpdatePageDto = {
        title: 'Updated Title',
        slug: 'updated-slug',
      };

      const mockPage = {
        id: 'page-1',
        websiteId: 'web-1',
        type: 'page',
        title: 'Updated Title',
      };

      const mockStructure = {
        id: 'struct-1',
        websiteId: 'web-1',
        websitePageId: 'page-1',
        slug: 'updated-slug',
        fullPath: '/updated-slug',
      };

      prisma.$transaction.mockImplementation(async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const tx = {
          websitePage: {
            update: jest.fn().mockResolvedValue(mockPage),
          },
          websiteStructure: {
            findFirst: jest.fn().mockResolvedValue(mockStructure),
            update: jest.fn().mockResolvedValue(mockStructure),
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      });

      const result = await service.updatePage('page-1', updateDto);

      expect(result).toEqual({ ...mockPage, structure: mockStructure });
    });
  });

  describe('deletePage', () => {
    it('should delete page and structure', async () => {
      prisma.$transaction.mockImplementation(async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const tx = {
          websiteStructure: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          websitePage: {
            delete: jest.fn().mockResolvedValue({ id: 'page-1' }),
          },
        };
        return fn(tx);
      });

      await service.deletePage('page-1');

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('getPagesByWebsite', () => {
    it('should retrieve all pages for a website', async () => {
      const mockPages = [
        { id: 'page-1', websiteId: 'web-1', title: 'Page 1' },
        { id: 'page-2', websiteId: 'web-1', title: 'Page 2' },
      ];

      prisma.websitePage.findMany.mockResolvedValue(mockPages);

      const result = await service.getPagesByWebsite('web-1');

      expect(result).toEqual(mockPages);
      expect(prisma.websitePage.findMany).toHaveBeenCalledWith({
        where: { websiteId: 'web-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('setPagePublished', () => {
    it('should publish a page', async () => {
      const mockPage = {
        id: 'page-1',
        isPublished: true,
      };

      prisma.websitePage.update.mockResolvedValue(mockPage);

      const result = await service.setPagePublished('page-1', true);

      expect(result).toEqual(mockPage);
      expect(prisma.websitePage.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: { isPublished: true },
      });
    });

    it('should unpublish a page', async () => {
      const mockPage = {
        id: 'page-1',
        isPublished: false,
      };

      prisma.websitePage.update.mockResolvedValue(mockPage);

      const result = await service.setPagePublished('page-1', false);

      expect(result).toEqual(mockPage);
      expect(prisma.websitePage.update).toHaveBeenCalledWith({
        where: { id: 'page-1' },
        data: { isPublished: false },
      });
    });
  });

  describe('duplicatePage', () => {
    it('should duplicate a page', async () => {
      const originalPage = {
        id: 'page-1',
        websiteId: 'web-1',
        type: 'page',
        title: 'Original Page',
        content: { components: [] },
      };

      const duplicatedPage = {
        id: 'page-2',
        websiteId: 'web-1',
        type: 'page',
        title: 'Original Page (Copy)',
        content: { components: [] },
        isPublished: false,
      };

      const mockStructure = {
        id: 'struct-2',
        websiteId: 'web-1',
        websitePageId: 'page-2',
        slug: 'original-page-copy',
        fullPath: '/original-page-copy',
      };

      prisma.$transaction.mockImplementation(async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const tx = {
          websitePage: {
            findUnique: jest.fn().mockResolvedValue(originalPage),
            create: jest.fn().mockResolvedValue(duplicatedPage),
          },
          websiteStructure: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ parentId: null }) // Original structure
              .mockResolvedValueOnce(null), // Check for unique slug
            create: jest.fn().mockResolvedValue(mockStructure),
            update: jest.fn().mockResolvedValue(mockStructure),
          },
        };
        return fn(tx);
      });

      const result = await service.duplicatePage('page-1');

      expect(result).toEqual({ ...duplicatedPage, structure: mockStructure });
    });
  });
});