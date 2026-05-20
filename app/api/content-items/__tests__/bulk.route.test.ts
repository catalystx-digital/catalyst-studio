import { POST, DELETE } from '../bulk/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    contentType: {
      findMany: jest.fn(),
    },
    websitePage: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    websiteCustomContentData: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('Content Items API - Bulk Operations Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/content-items/bulk', () => {
    it('should bulk create pages and custom content', async () => {
      const contentTypes = [
        { id: 'ct1', category: 'page' },
        { id: 'ct2', category: 'component' },
      ];
      const items = [
        {
          contentTypeId: 'ct1',
          websiteId: 'web1',
          title: 'Page 1',
          slug: 'page-1',
          content: { components: [] },
        },
        {
          contentTypeId: 'ct2',
          websiteId: 'web1',
          title: 'Component 1',
          slug: 'component-1',
          content: { field1: 'value1' },
        },
      ];

      const mockCreatedItems = [
        {
          id: 'page1',
          websiteId: 'web1',
          type: 'page',
          title: 'Page 1',
          content: { components: [] },
          contentTypeId: 'ct1',
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'custom1',
          websiteId: 'web1',
          title: 'Component 1',
          data: { field1: 'value1' },
          contentTypeId: 'ct2',
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.contentType.findMany as jest.Mock).mockResolvedValue(contentTypes);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          const tx = {
            websitePage: { create: jest.fn().mockImplementation((data) => ({ ...data.data, id: 'page1' })) },
            websiteCustomContentData: { create: jest.fn().mockImplementation((data) => ({ ...data.data, id: 'custom1' })) },
          };
          return await callback(tx);
        }
        return mockCreatedItems;
      });

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ items }),
      } as Partial<NextRequest>;
      
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toHaveLength(2);
      expect(data.message).toContain('Successfully created 2');
    });

    it('should handle all pages', async () => {
      const contentTypes = [{ id: 'ct1', category: 'page' }];
      const items = [
        {
          contentTypeId: 'ct1',
          websiteId: 'web1',
          title: 'Page 1',
          slug: 'page-1',
          content: {},
        },
        {
          contentTypeId: 'ct1',
          websiteId: 'web1',
          title: 'Page 2',
          slug: 'page-2',
          content: {},
        },
      ];

      (prisma.contentType.findMany as jest.Mock).mockResolvedValue(contentTypes);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          websitePage: {
            create: jest.fn().mockImplementation((data) => ({
              ...data.data,
              id: `page${Math.random()}`,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          },
          websiteCustomContentData: { create: jest.fn() },
        };
        return await callback(tx);
      });

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ items }),
      } as Partial<NextRequest>;
      
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].modelType).toBe('websitePage');
      expect(data.data[1].modelType).toBe('websitePage');
    });

    it('should return 400 for empty items array', async () => {
      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ items: [] }),
      } as Partial<NextRequest>;
      
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Items array is required and must not be empty');
    });

    it('should return 400 for missing required fields', async () => {
      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({
          items: [
            { title: 'Missing Fields' }, // Missing contentTypeId, websiteId, content
          ],
        }),
      } as Partial<NextRequest>;
      
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('missing required fields');
    });

    it('should handle transaction errors', async () => {
      const items = [
        {
          contentTypeId: 'ct1',
          websiteId: 'web1',
          title: 'Page 1',
          slug: 'page-1',
          content: {},
        },
      ];

      (prisma.contentType.findMany as jest.Mock).mockResolvedValue([{ id: 'ct1', category: 'page' }]);
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ items }),
      } as Partial<NextRequest>;
      
      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Failed to bulk create content items');
    });
  });

  describe('DELETE /api/content-items/bulk', () => {
    it('should bulk archive pages and custom content', async () => {
      const ids = ['page1', 'page2', 'custom1'];
      const pages = [{ id: 'page1' }, { id: 'page2' }];
      const customData = [{ id: 'custom1' }];

      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(pages);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue(customData);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          websitePage: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
          websiteCustomContentData: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        };
        return await callback(tx);
      });

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ ids }),
      } as Partial<NextRequest>;
      
      const response = await DELETE(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.count).toBe(3);
      expect(data.data.pageCount).toBe(2);
      expect(data.data.customCount).toBe(1);
      expect(data.data.message).toContain('Successfully archived 3');
    });

    it('should handle only pages', async () => {
      const ids = ['page1', 'page2'];
      const pages = [{ id: 'page1' }, { id: 'page2' }];

      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(pages);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          websitePage: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
          websiteCustomContentData: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        };
        return await callback(tx);
      });

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ ids }),
      } as Partial<NextRequest>;
      
      const response = await DELETE(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.count).toBe(2);
      expect(data.data.pageCount).toBe(2);
      expect(data.data.customCount).toBe(0);
    });

    it('should handle only custom content', async () => {
      const ids = ['custom1', 'custom2'];
      const customData = [{ id: 'custom1' }, { id: 'custom2' }];

      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue(customData);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          websitePage: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          websiteCustomContentData: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
        };
        return await callback(tx);
      });

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ ids }),
      } as Partial<NextRequest>;
      
      const response = await DELETE(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.count).toBe(2);
      expect(data.data.pageCount).toBe(0);
      expect(data.data.customCount).toBe(2);
    });

    it('should return 400 for empty ids array', async () => {
      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ ids: [] }),
      } as Partial<NextRequest>;
      
      const response = await DELETE(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('IDs array is required and must not be empty');
    });

    it('should handle items not found', async () => {
      const ids = ['notfound1', 'notfound2'];

      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          websitePage: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          websiteCustomContentData: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        };
        return await callback(tx);
      });

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ ids }),
      } as Partial<NextRequest>;
      
      const response = await DELETE(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.count).toBe(0);
      expect(data.data.message).toContain('Successfully archived 0');
    });

    it('should handle transaction errors', async () => {
      const ids = ['page1'];

      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([{ id: 'page1' }]);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      const mockRequest = {
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ ids }),
      } as Partial<NextRequest>;
      
      const response = await DELETE(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Failed to bulk archive content items');
    });
  });
});