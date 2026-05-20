import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    websitePage: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    websiteCustomContentData: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    contentType: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Content Items API - Main Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/content-items', () => {
    it('should return pages for page content type', async () => {
      const mockContentType = { id: 'ct1', category: 'page' };
      const mockPages = [
        {
          id: 'page1',
          websiteId: 'web1',
          type: 'page',
          title: 'Test Page',
          content: { components: [] },
          metadata: { seo: {} },
          contentTypeId: 'ct1',
          status: 'draft',
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          contentType: mockContentType,
          website: { id: 'web1', name: 'Test Website' },
        },
      ];

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue(mockContentType);
      (prisma.websitePage.count as jest.Mock).mockResolvedValue(1);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages);
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(0);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/content-items?contentTypeId=ct1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].modelType).toBe('websitePage');
      expect(data.pagination.total).toBe(1);
    });

    it('should return custom content for component content type', async () => {
      const mockContentType = { id: 'ct2', category: 'component' };
      const mockCustomData = [
        {
          id: 'custom1',
          websiteId: 'web1',
          title: 'Test Component',
          data: { field1: 'value1' },
          contentTypeId: 'ct2',
          status: 'published',
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          contentType: mockContentType,
          website: { id: 'web1', name: 'Test Website' },
        },
      ];

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue(mockContentType);
      (prisma.websitePage.count as jest.Mock).mockResolvedValue(0);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(1);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue(mockCustomData);

      const request = new NextRequest('http://localhost/api/content-items?contentTypeId=ct2');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].modelType).toBe('websiteCustomContentData');
      expect(data.pagination.total).toBe(1);
    });

    it('should query both models when no content type specified', async () => {
      const mockPages = [
        {
          id: 'page1',
          websiteId: 'web1',
          type: 'page',
          title: 'Test Page',
          content: {},
          contentTypeId: 'ct1',
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
          contentType: { id: 'ct1', category: 'page', website: {} },
          website: { id: 'web1', name: 'Test Website' },
        },
      ];
      const mockCustomData = [
        {
          id: 'custom1',
          websiteId: 'web1',
          title: 'Test Component',
          data: {},
          contentTypeId: 'ct2',
          status: 'published',
          createdAt: new Date(),
          updatedAt: new Date(),
          contentType: { id: 'ct2', category: 'component', website: {} },
          website: { id: 'web1', name: 'Test Website' },
        },
      ];

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websitePage.count as jest.Mock).mockResolvedValue(1);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages);
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(1);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue(mockCustomData);

      const request = new NextRequest('http://localhost/api/content-items');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
    });

    it('should handle pagination correctly', async () => {
      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websitePage.count as jest.Mock).mockResolvedValue(50);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(0);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/content-items?page=2&limit=20');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.websitePage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
      expect(data.pagination.page).toBe(2);
      expect(data.pagination.totalPages).toBe(3);
      expect(data.pagination.hasNext).toBe(true);
      expect(data.pagination.hasPrev).toBe(true);
    });

    it('should return 400 for invalid query parameters', async () => {
      const request = new NextRequest('http://localhost/api/content-items?page=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Invalid query parameters');
    });
  });

  describe('POST /api/content-items', () => {
    it('should create a WebsitePage for page content type', async () => {
      const mockContentType = { id: 'ct1', category: 'page' };
      const requestBody = {
        contentTypeId: 'ct1',
        websiteId: 'web1',
        title: 'New Page',
        slug: 'new-page',
        content: { components: [] },
        metadata: { seo: {} },
      };
      const mockCreatedPage = {
        id: 'newpage1',
        ...requestBody,
        type: 'page',
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: mockContentType,
        website: { id: 'web1', name: 'Test Website' },
      };

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue(mockContentType);
      (prisma.websitePage.create as jest.Mock).mockResolvedValue(mockCreatedPage);

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: jest.fn().mockResolvedValue(JSON.stringify(requestBody)),
      } as Partial<NextRequest>;
      
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.id).toBe('newpage1');
      expect(data.data.modelType).toBe('websitePage');
      expect(prisma.websitePage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'New Page',
            type: 'page',
          }),
        })
      );
    });

    it('should create WebsiteCustomContentData for component content type', async () => {
      const mockContentType = { id: 'ct2', category: 'component' };
      const requestBody = {
        contentTypeId: 'ct2',
        websiteId: 'web1',
        title: 'New Component',
        slug: 'new-component',
        content: { field1: 'value1' },
      };
      const mockCreatedCustom = {
        id: 'newcustom1',
        websiteId: 'web1',
        title: 'New Component',
        data: requestBody.content,
        contentTypeId: 'ct2',
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: mockContentType,
        website: { id: 'web1', name: 'Test Website' },
      };

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue(mockContentType);
      (prisma.websiteCustomContentData.create as jest.Mock).mockResolvedValue(mockCreatedCustom);

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: jest.fn().mockResolvedValue(JSON.stringify(requestBody)),
      } as Partial<NextRequest>;
      
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.id).toBe('newcustom1');
      expect(data.data.modelType).toBe('websiteCustomContentData');
      expect(prisma.websiteCustomContentData.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'New Component',
            data: requestBody.content,
          }),
        })
      );
    });

    it('should return 404 when content type not found', async () => {
      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue(null);

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: jest.fn().mockResolvedValue(JSON.stringify({
          contentTypeId: 'invalid',
          websiteId: 'web1',
          title: 'New Page',
          slug: 'new-page',
          content: { test: 'data' },
        })),
      } as Partial<NextRequest>;
      
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.message).toBe('Content type not found');
    });

    it('should return 400 for missing required fields', async () => {
      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: jest.fn().mockResolvedValue(JSON.stringify({
          title: 'Missing Fields',
        })),
      } as Partial<NextRequest>;
      
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Invalid request body');
    });

    it('should return 400 for invalid content type header', async () => {
      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'text/plain' }),
        text: jest.fn().mockResolvedValue('not json'),
      } as Partial<NextRequest>;
      
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Content-Type must be application/json');
    });
  });
});