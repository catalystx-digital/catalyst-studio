import { GET, PUT, DELETE } from '../[id]/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    websitePage: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    websiteCustomContentData: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('Content Items API - Single Item Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/content-items/[id]', () => {
    it('should return a WebsitePage when found', async () => {
      const mockPage = {
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
        contentType: {
          id: 'ct1',
          category: 'page',
          fields: {},
        },
        website: {
          id: 'web1',
          name: 'Test Website',
          metadata: {},
          settings: {},
        },
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(mockPage);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/content-items/page1');
      const params = Promise.resolve({ id: 'page1' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.id).toBe('page1');
      expect(data.data.modelType).toBe('websitePage');
      expect(data.data.title).toBe('Test Page');
    });

    it('should return WebsiteCustomContentData when page not found', async () => {
      const mockCustom = {
        id: 'custom1',
        websiteId: 'web1',
        title: 'Test Component',
        data: { field1: 'value1' },
        contentTypeId: 'ct2',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: {
          id: 'ct2',
          category: 'component',
          fields: {},
        },
        website: {
          id: 'web1',
          name: 'Test Website',
          metadata: {},
          settings: {},
        },
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(mockCustom);

      const request = new NextRequest('http://localhost/api/content-items/custom1');
      const params = Promise.resolve({ id: 'custom1' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.id).toBe('custom1');
      expect(data.data.modelType).toBe('websiteCustomContentData');
      expect(data.data.content).toEqual({ field1: 'value1' });
    });

    it('should return 404 when item not found in either model', async () => {
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/content-items/notfound');
      const params = Promise.resolve({ id: 'notfound' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.message).toBe('Content item not found');
    });
  });

  describe('PUT /api/content-items/[id]', () => {
    it('should update a WebsitePage', async () => {
      const existingPage = {
        id: 'page1',
        contentType: { category: 'page' },
      };
      const updatedPage = {
        ...existingPage,
        title: 'Updated Page',
        content: { components: ['new'] },
        metadata: { updated: true },
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
        websiteId: 'web1',
        contentTypeId: 'ct1',
        contentType: {
          id: 'ct1',
          category: 'page',
          fields: {},
        },
        website: {
          id: 'web1',
          name: 'Test Website',
          metadata: {},
          settings: {},
        },
      };

      (prisma.websitePage.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingPage)
        .mockResolvedValueOnce(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websitePage.update as jest.Mock).mockResolvedValue(updatedPage);

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({
          title: 'Updated Page',
          content: { components: ['new'] },
          metadata: { updated: true },
          status: 'published',
        }),
      } as Partial<NextRequest>;
      const params = Promise.resolve({ id: 'page1' });
      const response = await PUT(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.title).toBe('Updated Page');
      expect(data.data.modelType).toBe('websitePage');
      expect(prisma.websitePage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'page1' },
          data: expect.objectContaining({
            title: 'Updated Page',
            content: { components: ['new'] },
          }),
        })
      );
    });

    it('should update WebsiteCustomContentData', async () => {
      const existingCustom = {
        id: 'custom1',
        contentType: { category: 'component' },
      };
      const updatedCustom = {
        ...existingCustom,
        title: 'Updated Component',
        data: { field1: 'updated' },
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date(),
        websiteId: 'web1',
        contentTypeId: 'ct2',
        contentType: {
          id: 'ct2',
          category: 'component',
          fields: {},
        },
        website: {
          id: 'web1',
          name: 'Test Website',
          metadata: {},
          settings: {},
        },
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingCustom)
        .mockResolvedValueOnce(null);
      (prisma.websiteCustomContentData.update as jest.Mock).mockResolvedValue(updatedCustom);

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({
          title: 'Updated Component',
          content: { field1: 'updated' },
          status: 'published',
        }),
      } as Partial<NextRequest>;
      const params = Promise.resolve({ id: 'custom1' });
      const response = await PUT(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.title).toBe('Updated Component');
      expect(data.data.modelType).toBe('websiteCustomContentData');
      expect(prisma.websiteCustomContentData.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'custom1' },
          data: expect.objectContaining({
            title: 'Updated Component',
            data: { field1: 'updated' },
          }),
        })
      );
    });

    it('should return 404 when item not found', async () => {
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(null);

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ title: 'Updated' }),
      } as Partial<NextRequest>;
      const params = Promise.resolve({ id: 'notfound' });
      const response = await PUT(mockRequest, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.message).toBe('Content item not found');
    });

    it('should return 400 for invalid request body', async () => {
      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ title: '' }), // Empty title should fail validation
      };
      const params = Promise.resolve({ id: 'page1' });
      const response = await PUT(mockRequest as Request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Invalid request body');
    });
  });

  describe('DELETE /api/content-items/[id]', () => {
    it('should archive a WebsitePage', async () => {
      const existingPage = { id: 'page1', status: 'published' };
      const archivedPage = { ...existingPage, status: 'archived' };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(existingPage);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websitePage.update as jest.Mock).mockResolvedValue(archivedPage);

      const request = new NextRequest('http://localhost/api/content-items/page1', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: 'page1' });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.status).toBe('archived');
      expect(data.data.modelType).toBe('websitePage');
      expect(data.data.message).toBe('Content item archived successfully');
      expect(prisma.websitePage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'page1' },
          data: { status: 'archived' },
        })
      );
    });

    it('should archive WebsiteCustomContentData', async () => {
      const existingCustom = { id: 'custom1', status: 'published' };
      const archivedCustom = { ...existingCustom, status: 'archived' };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(existingCustom);
      (prisma.websiteCustomContentData.update as jest.Mock).mockResolvedValue(archivedCustom);

      const request = new NextRequest('http://localhost/api/content-items/custom1', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: 'custom1' });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.status).toBe('archived');
      expect(data.data.modelType).toBe('websiteCustomContentData');
      expect(prisma.websiteCustomContentData.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'custom1' },
          data: { status: 'archived' },
        })
      );
    });

    it('should return 404 when item not found', async () => {
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/content-items/notfound', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: 'notfound' });
      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.message).toBe('Content item not found');
    });
  });
});