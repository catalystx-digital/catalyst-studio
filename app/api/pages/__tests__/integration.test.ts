import { GET as GETRESOLVE } from '../resolve/route';
import { GET as GETSITEMAP, POST as POSTSITEMAP, PUT as PUTSITEMAP } from '../../studio/sitemap/route';
import { POST as POSTBULK } from '../../studio/sitemap/bulk/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    websiteStructure: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    websitePage: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    website: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn) => {
      if (Array.isArray(fn)) {
        return Promise.all(fn.map(op => Promise.resolve(op)));
      }
      return fn(prisma);
    }),
  },
}));

describe('Page Resolution and Sitemap API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/pages/resolve', () => {
    it('should resolve page by URL path', async () => {
      const mockStructure = {
        id: 'struct-1',
        websiteId: 'test-site',
        slug: 'about',
        fullPath: '/about',
        websitePageId: 'page-1',
        parentId: null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPage = {
        id: 'page-1',
        websiteId: 'test-site',
        type: 'page',
        title: 'About Us',
        content: { components: [] },
        metadata: { seo: { title: 'About' } },
        contentTypeId: 'page-type',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websiteStructure.findFirst as jest.Mock).mockResolvedValue(mockStructure);
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(mockPage);

      const request = new NextRequest('http://localhost:3000/api/pages/resolve?websiteId=test-site&path=/about');
      const response = await GETRESOLVE(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.page).toEqual(mockPage);
      expect(data.structure).toEqual(mockStructure);
      expect(prisma.websiteStructure.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            websiteId: 'test-site',
            fullPath: '/about',
          },
        })
      );
    });

    it('should resolve homepage with root path', async () => {
      const mockHomepageStructure = {
        id: 'struct-home',
        websiteId: 'test-site',
        slug: '',
        fullPath: '/',
        websitePageId: 'page-home',
        parentId: null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockHomepage = {
        id: 'page-home',
        websiteId: 'test-site',
        type: 'page',
        title: 'Homepage',
        content: { components: [] },
        metadata: {},
        contentTypeId: 'page-type',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websiteStructure.findFirst as jest.Mock).mockResolvedValue(mockHomepageStructure);
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(mockHomepage);

      const request = new NextRequest('http://localhost:3000/api/pages/resolve?websiteId=test-site&path=/');
      const response = await GETRESOLVE(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.page.title).toBe('Homepage');
      expect(data.structure.fullPath).toBe('/');
    });

    it('should resolve nested page paths', async () => {
      const mockNestedStructure = {
        id: 'struct-nested',
        websiteId: 'test-site',
        slug: 'team',
        fullPath: '/about/team',
        websitePageId: 'page-team',
        parentId: 'struct-about',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTeamPage = {
        id: 'page-team',
        websiteId: 'test-site',
        type: 'page',
        title: 'Our Team',
        content: { components: [] },
        metadata: {},
        contentTypeId: 'page-type',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websiteStructure.findFirst as jest.Mock).mockResolvedValue(mockNestedStructure);
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(mockTeamPage);

      const request = new NextRequest('http://localhost:3000/api/pages/resolve?websiteId=test-site&path=/about/team');
      const response = await GETRESOLVE(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.page.title).toBe('Our Team');
      expect(data.structure.fullPath).toBe('/about/team');
      expect(data.structure.parentId).toBe('struct-about');
    });

    it('should return 404 for non-existent path', async () => {
      (prisma.websiteStructure.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/pages/resolve?websiteId=test-site&path=/non-existent');
      const response = await GETRESOLVE(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Page not found');
    });

    it('should return 400 when websiteId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/pages/resolve?path=/about');
      const response = await GETRESOLVE(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('websiteId is required');
    });

    it('should return 400 when path is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/pages/resolve?websiteId=test-site');
      const response = await GETRESOLVE(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('path is required');
    });
  });

  describe('GET /api/studio/sitemap', () => {
    it('should generate complete sitemap for website', async () => {
      const mockSitemapEntries = [
        {
          id: 'struct-1',
          websiteId: 'test-site',
          slug: '',
          fullPath: '/',
          websitePageId: 'page-1',
          parentId: null,
          position: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          websitePage: {
            id: 'page-1',
            title: 'Homepage',
            type: 'page',
          },
        },
        {
          id: 'struct-2',
          websiteId: 'test-site',
          slug: 'about',
          fullPath: '/about',
          websitePageId: 'page-2',
          parentId: null,
          position: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          websitePage: {
            id: 'page-2',
            title: 'About',
            type: 'page',
          },
        },
        {
          id: 'struct-3',
          websiteId: 'test-site',
          slug: 'team',
          fullPath: '/about/team',
          websitePageId: 'page-3',
          parentId: 'struct-2',
          position: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          websitePage: {
            id: 'page-3',
            title: 'Team',
            type: 'page',
          },
        },
      ];

      (prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockSitemapEntries);

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap?websiteId=test-site');
      const response = await GETSITEMAP(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sitemap).toHaveLength(3);
      expect(data.sitemap[0].fullPath).toBe('/');
      expect(data.sitemap[2].fullPath).toBe('/about/team');
      expect(data.sitemap[2].parentId).toBe('struct-2');
    });

    it('should generate hierarchical sitemap structure', async () => {
      const mockHierarchicalEntries = [
        {
          id: 'root',
          websiteId: 'test-site',
          slug: '',
          fullPath: '/',
          websitePageId: 'page-root',
          parentId: null,
          position: 0,
          children: [],
          websitePage: { title: 'Home' },
        },
        {
          id: 'products',
          websiteId: 'test-site',
          slug: 'products',
          fullPath: '/products',
          websitePageId: 'page-products',
          parentId: null,
          position: 1,
          children: [],
          websitePage: { title: 'Products' },
        },
        {
          id: 'product-1',
          websiteId: 'test-site',
          slug: 'widget',
          fullPath: '/products/widget',
          websitePageId: 'page-widget',
          parentId: 'products',
          position: 0,
          children: [],
          websitePage: { title: 'Widget' },
        },
      ];

      (prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockHierarchicalEntries);

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap?websiteId=test-site&format=tree');
      const response = await GETSITEMAP(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sitemap).toBeDefined();
      // Verify hierarchical structure is maintained
      const rootItems = data.sitemap.filter((item: Record<string, unknown>) => !item.parentId);
      expect(rootItems).toHaveLength(2);
    });

    it('should filter sitemap by page type', async () => {
      const mockFilteredEntries = [
        {
          id: 'struct-1',
          websiteId: 'test-site',
          slug: 'page1',
          fullPath: '/page1',
          websitePageId: 'page-1',
          parentId: null,
          position: 0,
          websitePage: {
            id: 'page-1',
            title: 'Page 1',
            type: 'page',
          },
        },
      ];

      (prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockFilteredEntries);

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap?websiteId=test-site&type=page');
      const response = await GETSITEMAP(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sitemap).toHaveLength(1);
      expect(data.sitemap[0].websitePage.type).toBe('page');
    });

    it('should return 400 when websiteId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/sitemap');
      const response = await GETSITEMAP(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('websiteId is required');
    });
  });

  describe('POST /api/studio/sitemap', () => {
    it('should create new sitemap entry', async () => {
      const newSitemapEntry = {
        websiteId: 'test-site',
        websitePageId: 'new-page',
        slug: 'new-page',
        parentId: null,
        position: 5,
      };

      const createdEntry = {
        id: 'new-struct',
        ...newSitemapEntry,
        fullPath: '/new-page',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPage = {
        id: 'new-page',
        websiteId: 'test-site',
        type: 'page',
        title: 'New Page',
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(mockPage);
      (prisma.websiteStructure.create as jest.Mock).mockResolvedValue(createdEntry);

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap', {
        method: 'POST',
        body: JSON.stringify(newSitemapEntry),
      });

      const response = await POSTSITEMAP(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.fullPath).toBe('/new-page');
      expect(prisma.websiteStructure.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            websiteId: 'test-site',
            websitePageId: 'new-page',
            slug: 'new-page',
            fullPath: '/new-page',
          }),
        })
      );
    });

    it('should create nested sitemap entry with correct path', async () => {
      const nestedEntry = {
        websiteId: 'test-site',
        websitePageId: 'nested-page',
        slug: 'nested',
        parentId: 'parent-struct',
        position: 0,
      };

      const parentStructure = {
        id: 'parent-struct',
        fullPath: '/parent',
        slug: 'parent',
      };

      const createdEntry = {
        id: 'nested-struct',
        ...nestedEntry,
        fullPath: '/parent/nested',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({ id: 'nested-page' });
      (prisma.websiteStructure.findUnique as jest.Mock).mockResolvedValue(parentStructure);
      (prisma.websiteStructure.create as jest.Mock).mockResolvedValue(createdEntry);

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap', {
        method: 'POST',
        body: JSON.stringify(nestedEntry),
      });

      const response = await POSTSITEMAP(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.fullPath).toBe('/parent/nested');
    });

    it('should validate page exists before creating structure', async () => {
      const invalidEntry = {
        websiteId: 'test-site',
        websitePageId: 'non-existent',
        slug: 'test',
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap', {
        method: 'POST',
        body: JSON.stringify(invalidEntry),
      });

      const response = await POSTSITEMAP(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Page not found');
    });
  });

  describe('PUT /api/studio/sitemap', () => {
    it('should update sitemap entry position', async () => {
      const updateData = {
        id: 'struct-1',
        position: 10,
      };

      const existingEntry = {
        id: 'struct-1',
        websiteId: 'test-site',
        slug: 'page',
        fullPath: '/page',
        position: 5,
        parentId: null,
      };

      const updatedEntry = {
        ...existingEntry,
        position: 10,
        updatedAt: new Date(),
      };

      (prisma.websiteStructure.findUnique as jest.Mock).mockResolvedValue(existingEntry);
      (prisma.websiteStructure.update as jest.Mock).mockResolvedValue(updatedEntry);

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUTSITEMAP(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.position).toBe(10);
    });

    it('should update parent and recalculate path', async () => {
      const updateData = {
        id: 'struct-1',
        parentId: 'new-parent',
      };

      const existingEntry = {
        id: 'struct-1',
        websiteId: 'test-site',
        slug: 'page',
        fullPath: '/page',
        parentId: null,
      };

      const newParent = {
        id: 'new-parent',
        fullPath: '/section',
        slug: 'section',
      };

      const updatedEntry = {
        ...existingEntry,
        parentId: 'new-parent',
        fullPath: '/section/page',
        updatedAt: new Date(),
      };

      (prisma.websiteStructure.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingEntry)
        .mockResolvedValueOnce(newParent);
      (prisma.websiteStructure.update as jest.Mock).mockResolvedValue(updatedEntry);

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUTSITEMAP(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fullPath).toBe('/section/page');
      expect(data.parentId).toBe('new-parent');
    });

    it('should return 404 when updating non-existent entry', async () => {
      (prisma.websiteStructure.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap', {
        method: 'PUT',
        body: JSON.stringify({ id: 'non-existent', position: 5 }),
      });

      const response = await PUTSITEMAP(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Structure entry not found');
    });
  });

  describe('POST /api/studio/sitemap/bulk', () => {
    it('should handle bulk sitemap operations in transaction', async () => {
      const bulkOperations = {
        websiteId: 'test-site',
        operations: [
          {
            type: 'create',
            data: {
              websitePageId: 'page-1',
              slug: 'page1',
              position: 0,
            },
          },
          {
            type: 'update',
            data: {
              id: 'struct-2',
              position: 1,
            },
          },
          {
            type: 'delete',
            data: {
              id: 'struct-3',
            },
          },
        ],
      };

      const mockResults = [
        { id: 'new-struct', fullPath: '/page1' },
        { id: 'struct-2', position: 1 },
        { success: true },
      ];

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockResults);
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({ id: 'page-1' });
      (prisma.websiteStructure.findUnique as jest.Mock).mockResolvedValue({ id: 'struct-2' });

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap/bulk', {
        method: 'POST',
        body: JSON.stringify(bulkOperations),
      });

      const response = await POSTBULK(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.results).toHaveLength(3);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should rollback all operations on failure', async () => {
      const bulkOperations = {
        websiteId: 'test-site',
        operations: [
          {
            type: 'create',
            data: {
              websitePageId: 'page-1',
              slug: 'page1',
            },
          },
          {
            type: 'invalid',
            data: {},
          },
        ],
      };

      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Invalid operation type'));

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap/bulk', {
        method: 'POST',
        body: JSON.stringify(bulkOperations),
      });

      const response = await POSTBULK(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Bulk operation failed');
    });

    it('should validate all operations before executing', async () => {
      const invalidBulkOps = {
        websiteId: 'test-site',
        operations: [
          {
            type: 'create',
            // Missing required data
          },
        ],
      };

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap/bulk', {
        method: 'POST',
        body: JSON.stringify(invalidBulkOps),
      });

      const response = await POSTBULK(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid operation data');
    });

    it('should handle large bulk operations efficiently', async () => {
      const largeBulkOps = {
        websiteId: 'test-site',
        operations: Array.from({ length: 100 }, (_, i) => ({
          type: 'create',
          data: {
            websitePageId: `page-${i}`,
            slug: `page-${i}`,
            position: i,
          },
        })),
      };

      const mockResults = largeBulkOps.operations.map((_, i) => ({
        id: `struct-${i}`,
        fullPath: `/page-${i}`,
      }));

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockResults);
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({ id: 'page-id' });

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap/bulk', {
        method: 'POST',
        body: JSON.stringify(largeBulkOps),
      });

      const response = await POSTBULK(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.results).toHaveLength(100);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('Hierarchical Relationship Validation', () => {
    it('should maintain parent-child relationships correctly', async () => {
      const parentEntry = {
        id: 'parent',
        websiteId: 'test-site',
        slug: 'parent',
        fullPath: '/parent',
        parentId: null,
        position: 0,
        children: [],
      };

      const childEntries = [
        {
          id: 'child-1',
          websiteId: 'test-site',
          slug: 'child1',
          fullPath: '/parent/child1',
          parentId: 'parent',
          position: 0,
        },
        {
          id: 'child-2',
          websiteId: 'test-site',
          slug: 'child2',
          fullPath: '/parent/child2',
          parentId: 'parent',
          position: 1,
        },
      ];

      (prisma.websiteStructure.findUnique as jest.Mock).mockResolvedValue(parentEntry);
      (prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(childEntries);

      // Verify children have correct parent reference
      expect(childEntries.every(child => child.parentId === 'parent')).toBe(true);
      
      // Verify path construction
      expect(childEntries[0].fullPath).toBe('/parent/child1');
      expect(childEntries[1].fullPath).toBe('/parent/child2');
    });

    it('should prevent circular parent references', async () => {
      const updateData = {
        id: 'struct-parent',
        parentId: 'struct-child', // Trying to set child as parent
      };

      const parentStruct = {
        id: 'struct-parent',
        parentId: null,
      };

      const childStruct = {
        id: 'struct-child',
        parentId: 'struct-parent', // Already a child of parent
      };

      (prisma.websiteStructure.findUnique as jest.Mock)
        .mockResolvedValueOnce(parentStruct)
        .mockResolvedValueOnce(childStruct);

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUTSITEMAP(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Circular reference detected');
    });

    it('should handle deep nesting correctly', async () => {
      const deeplyNestedStructure = {
        id: 'deep-nested',
        websiteId: 'test-site',
        slug: 'deep',
        fullPath: '/level1/level2/level3/deep',
        websitePageId: 'page-deep',
        parentId: 'level3',
        position: 0,
      };

      (prisma.websiteStructure.findFirst as jest.Mock).mockResolvedValue(deeplyNestedStructure);
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue({ id: 'page-deep' });

      const request = new NextRequest('http://localhost:3000/api/pages/resolve?websiteId=test-site&path=/level1/level2/level3/deep');
      const response = await GETRESOLVE(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.structure.fullPath).toBe('/level1/level2/level3/deep');
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large sitemap queries efficiently', async () => {
      const largeSitemap = Array.from({ length: 1000 }, (_, i) => ({
        id: `struct-${i}`,
        websiteId: 'test-site',
        slug: `page-${i}`,
        fullPath: `/page-${i}`,
        websitePageId: `page-${i}`,
        parentId: null,
        position: i,
        websitePage: {
          id: `page-${i}`,
          title: `Page ${i}`,
          type: 'page',
        },
      }));

      (prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(largeSitemap);

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap?websiteId=test-site');
      const response = await GETSITEMAP(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sitemap).toHaveLength(1000);
    });

    it('should use pagination for large result sets', async () => {
      const paginatedResults = Array.from({ length: 50 }, (_, i) => ({
        id: `struct-${i}`,
        websiteId: 'test-site',
        slug: `page-${i}`,
        fullPath: `/page-${i}`,
        websitePageId: `page-${i}`,
        parentId: null,
        position: i,
      }));

      (prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(paginatedResults);
      (prisma.websiteStructure.count as jest.Mock).mockResolvedValue(500);

      const request = new NextRequest('http://localhost:3000/api/studio/sitemap?websiteId=test-site&page=1&limit=50');
      const response = await GETSITEMAP(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sitemap).toHaveLength(50);
      expect(data.total).toBe(500);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(50);
    });
  });
});