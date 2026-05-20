import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { ContentDataService } from '@/lib/services/content-data-service';
import {
  MockContentDataService,
  MockCustomContentData,
  MockConstructor
} from '@/lib/test-utils/mock-types';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    websiteCustomContentData: {
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

jest.mock('@/lib/services/content-data-service');

describe('/api/content/data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return paginated custom content data', async () => {
      const mockData: MockCustomContentData[] = [
        {
          id: 'data-1',
          contentTypeId: 'type-1',
          websiteId: 'site-1',
          title: 'Custom Data Entry',
          data: { field1: 'value1', field2: 'value2' },
          metadata: {},
          status: 'published',
          publishedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          contentType: { id: 'type-1', name: 'Custom Type' },
          website: { id: 'site-1', name: 'Test Site' },
        },
      ];

      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(1);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue(mockData);

      const request = new NextRequest('http://localhost:3000/api/content/data?page=1&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].id).toBe('data-1');
      expect(data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should filter by contentTypeId', async () => {
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(0);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/content/data?contentTypeId=type-123');
      await GET(request);

      expect(prisma.websiteCustomContentData.count).toHaveBeenCalledWith({
        where: {
          contentTypeId: 'type-123',
        },
      });
    });

    it('should filter by status', async () => {
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(0);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/content/data?status=draft');
      await GET(request);

      expect(prisma.websiteCustomContentData.count).toHaveBeenCalledWith({
        where: {
          status: 'draft',
        },
      });
    });

    it('should handle pagination correctly', async () => {
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(50);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/content/data?page=2&limit=20');
      await GET(request);

      expect(prisma.websiteCustomContentData.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
    });

    it('should handle server errors gracefully', async () => {
      (prisma.websiteCustomContentData.count as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/content/data');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should create new custom content data', async () => {
      const mockService = {
        createContentData: jest.fn().mockResolvedValue({
          id: 'new-data',
          title: 'New Custom Data',
          data: { field: 'value' },
          status: 'draft',
        }),
      };
      (ContentDataService as MockConstructor<MockContentDataService>).mockImplementation(() => mockService);

      const request = new NextRequest('http://localhost:3000/api/content/data', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'site-1',
          contentTypeId: 'type-1',
          title: 'New Custom Data',
          data: { field: 'value' },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('new-data');
      expect(mockService.createContentData).toHaveBeenCalledWith(expect.objectContaining({
        title: 'New Custom Data',
      }));
    });

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/content/data', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Missing Required Fields',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Invalid request body');
    });

    it('should handle content type not found error', async () => {
      const mockService = {
        createContentData: jest.fn().mockRejectedValue(new Error('Content type not found')),
      };
      (ContentDataService as MockConstructor<MockContentDataService>).mockImplementation(() => mockService);

      const request = new NextRequest('http://localhost:3000/api/content/data', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'site-1',
          contentTypeId: 'invalid-type',
          title: 'New Data',
          data: {},
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.message).toBe('Content type not found');
    });

    it('should handle server errors', async () => {
      const mockService = {
        createContentData: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      };
      (ContentDataService as MockConstructor<MockContentDataService>).mockImplementation(() => mockService);

      const request = new NextRequest('http://localhost:3000/api/content/data', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'site-1',
          contentTypeId: 'type-1',
          title: 'New Data',
          data: {},
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Internal server error');
    });
  });
});