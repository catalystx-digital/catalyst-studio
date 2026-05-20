import { POST, GET } from '../route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findUnique: jest.fn()
    },
    globalComponent: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn()
    },
    globalComponentUsage: {
      count: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn()
    }
  }
}));

describe('Global Components API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/studio/site-builder/global-components', () => {
    it('should create a new global component', async () => {
      const mockWebsite = { id: 'website-123', name: 'Test Site' };
      const mockGlobalComponent = {
        id: 'comp-456',
        componentId: 'comp-456',
        websiteId: 'website-123',
        name: 'Header',
        type: 'header',
        properties: { color: 'blue' },
        usageCount: 0,
        createdBy: 'user-789',
        usages: []
      };

      (prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite);
      (prisma.globalComponent.upsert as jest.Mock).mockResolvedValue(mockGlobalComponent);
      (prisma.globalComponentUsage.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/global-components', {
        method: 'POST',
        body: JSON.stringify({
          componentId: 'comp-456',
          websiteId: 'website-123',
          name: 'Header',
          type: 'header',
          properties: { color: 'blue' },
          makeGlobal: true,
          createdBy: 'user-789'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: 'comp-456',
        componentId: 'comp-456',
        name: 'Header',
        usageCount: 0,
        affectedPages: 0
      });

      expect(prisma.globalComponent.upsert).toHaveBeenCalledWith({
        where: { id: 'comp-456' },
        create: expect.objectContaining({
          id: 'comp-456',
          componentId: 'comp-456',
          websiteId: 'website-123',
          name: 'Header',
          type: 'header',
          properties: { color: 'blue' },
          createdBy: 'user-789',
          usageCount: 0
        }),
        update: expect.objectContaining({
          name: 'Header',
          properties: { color: 'blue' },
          type: 'header'
        }),
        include: { usages: true }
      });
    });

    it('should return 404 when website not found', async () => {
      (prisma.website.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/global-components', {
        method: 'POST',
        body: JSON.stringify({
          componentId: 'comp-456',
          websiteId: 'non-existent',
          name: 'Header',
          type: 'header',
          properties: {},
          makeGlobal: true,
          createdBy: 'user-789'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: 'Website not found' });
    });

    it('should validate request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/global-components', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required fields
          websiteId: 'website-123'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
      expect(data.details).toBeDefined();
    });

    it('should remove component from global when makeGlobal is false', async () => {
      (prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-123' });
      (prisma.globalComponent.delete as jest.Mock).mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/global-components', {
        method: 'POST',
        body: JSON.stringify({
          componentId: 'comp-456',
          websiteId: 'website-123',
          name: 'Header',
          type: 'header',
          properties: {},
          makeGlobal: false,
          createdBy: 'user-789'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isGlobal).toBe(false);
    });
  });

  describe('GET /api/studio/site-builder/global-components', () => {
    it('should list all global components for a website', async () => {
      const mockComponents = [
        {
          id: 'comp-1',
          componentId: 'comp-1',
          name: 'Header',
          type: 'header',
          properties: {},
          lastModified: new Date('2024-01-01'),
          createdBy: 'user-1',
          _count: { usages: 5 }
        },
        {
          id: 'comp-2',
          componentId: 'comp-2',
          name: 'Footer',
          type: 'footer',
          properties: {},
          lastModified: new Date('2024-01-02'),
          createdBy: 'user-2',
          _count: { usages: 3 }
        }
      ];

      (prisma.globalComponent.findMany as jest.Mock).mockResolvedValue(mockComponents);

      const request = new NextRequest('http://localhost:3000/api/global-components?websiteId=website-123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.components).toHaveLength(2);
      expect(data.components[0]).toEqual({
        id: 'comp-1',
        componentId: 'comp-1',
        name: 'Header',
        type: 'header',
        properties: {},
        usageCount: 5,
        lastModified: mockComponents[0].lastModified.toISOString(),
        createdBy: 'user-1'
      });

      expect(prisma.globalComponent.findMany).toHaveBeenCalledWith({
        where: { websiteId: 'website-123' },
        include: { _count: { select: { usages: true } } },
        orderBy: { name: 'asc' }
      });
    });

    it('should return error when websiteId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/global-components');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'websiteId is required' });
    });
  });
});