import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { PageService } from '@/lib/services/page-service';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    websitePage: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    website: {
      findUnique: jest.fn(),
    },
    contentType: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/page-service');

describe('/api/content/pages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return paginated pages successfully', async () => {
      const mockPages = [
        {
          id: 'page-1',
          contentTypeId: 'type-1',
          websiteId: 'site-1',
          type: 'page',
          title: 'Test Page',
          content: { components: [] },
          metadata: {},
          status: 'draft',
          publishedAt: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          description: 'Test description',
          seoTitle: 'Test SEO Title',
          seoDescription: 'Test SEO Description',
          seoKeywords: 'test, keywords',
          ogImage: null,
          contentType: { id: 'type-1', name: 'Page', website: { id: 'site-1', name: 'Test Site' } },
          website: { id: 'site-1', name: 'Test Site' },
          structure: null,
        },
      ];

      (prisma.websitePage.count as jest.Mock).mockResolvedValue(1);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages);

      const request = new NextRequest('http://localhost:3000/api/content/pages?page=1&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].id).toBe('page-1');
      expect(data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should filter by status', async () => {
      (prisma.websitePage.count as jest.Mock).mockResolvedValue(0);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/content/pages?status=published');
      await GET(request);

      expect(prisma.websitePage.count).toHaveBeenCalledWith({
        where: {
          type: { in: ['page', 'folder'] },
          status: 'published',
        },
      });
    });

    it('should filter by websiteId', async () => {
      (prisma.websitePage.count as jest.Mock).mockResolvedValue(0);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/content/pages?websiteId=site-123');
      await GET(request);

      expect(prisma.websitePage.count).toHaveBeenCalledWith({
        where: {
          type: { in: ['page', 'folder'] },
          websiteId: 'site-123',
        },
      });
    });

    it('should handle invalid query parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/content/pages?page=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Invalid query parameters');
    });

    it('should handle server errors gracefully', async () => {
      (prisma.websitePage.count as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/content/pages');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should create a new page successfully', async () => {
      const mockPageService = {
        createPage: jest.fn().mockResolvedValue({
          id: 'new-page',
          title: 'New Page',
          type: 'page',
          status: 'draft',
        }),
      };
      (PageService as jest.MockedClass<typeof PageService>).mockImplementation(() => mockPageService as unknown as InstanceType<typeof PageService>);

      const request = new NextRequest('http://localhost:3000/api/content/pages', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'site-1',
          contentTypeId: 'type-1',
          title: 'New Page',
          type: 'page',
          content: { components: [] },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('new-page');
      expect(mockPageService.createPage).toHaveBeenCalledWith(expect.objectContaining({
        title: 'New Page',
        type: 'page',
      }));
    });

    it('should handle validation errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/content/pages', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required fields
          title: 'New Page',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Invalid request body');
    });

    it('should handle service layer errors', async () => {
      const mockPageService = {
        createPage: jest.fn().mockRejectedValue(new Error('Content type not found')),
      };
      (PageService as jest.MockedClass<typeof PageService>).mockImplementation(() => mockPageService as unknown as InstanceType<typeof PageService>);

      const request = new NextRequest('http://localhost:3000/api/content/pages', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'site-1',
          contentTypeId: 'invalid-type',
          title: 'New Page',
          type: 'page',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.message).toBe('Content type not found');
    });
  });
});