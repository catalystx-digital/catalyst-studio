import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { SharedComponentService } from '@/lib/services/component-service';
import {
  MockSharedComponentService,
  MockWebsiteSharedComponent,
  MockConstructor
} from '@/lib/test-utils/mock-types';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    websiteSharedComponent: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    websiteComponentType: {
      findUnique: jest.fn(),
    },
    website: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/component-service');

describe('/api/components/shared', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return shared components with pagination', async () => {
      const mockSharedComponents: MockWebsiteSharedComponent[] = [
        {
          id: 'shared-1',
          websiteId: 'site-1',
          websiteComponentTypeId: 'type-1',
          name: 'Header Component',
          config: { logo: 'logo.png' },
          version: '1.0.0',
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          websiteComponentType: { id: 'type-1', type: 'header', name: 'Header' },
          website: { id: 'site-1', name: 'Test Site' },
        },
      ];

      (prisma.websiteSharedComponent.count as jest.Mock).mockResolvedValue(1);
      (prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(mockSharedComponents);

      const request = new NextRequest('http://localhost:3000/api/components/shared?page=1&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].name).toBe('Header Component');
      expect(data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should filter by websiteId', async () => {
      (prisma.websiteSharedComponent.count as jest.Mock).mockResolvedValue(0);
      (prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/components/shared?websiteId=site-123');
      await GET(request);

      expect(prisma.websiteSharedComponent.count).toHaveBeenCalledWith({
        where: {
          websiteId: 'site-123',
        },
      });
    });

    it('should filter by componentTypeId', async () => {
      (prisma.websiteSharedComponent.count as jest.Mock).mockResolvedValue(0);
      (prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/components/shared?componentTypeId=type-123');
      await GET(request);

      expect(prisma.websiteSharedComponent.count).toHaveBeenCalledWith({
        where: {
          websiteComponentTypeId: 'type-123',
        },
      });
    });

    it('should include relations in response', async () => {
      (prisma.websiteSharedComponent.count as jest.Mock).mockResolvedValue(0);
      (prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/components/shared');
      await GET(request);

      expect(prisma.websiteSharedComponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            websiteComponentType: true,
            website: true,
          },
        })
      );
    });

    it('should handle server errors', async () => {
      (prisma.websiteSharedComponent.count as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/components/shared');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should create a new shared component', async () => {
      const mockService = {
        createSharedComponent: jest.fn().mockResolvedValue({
          id: 'new-shared',
          websiteId: 'site-1',
          websiteComponentTypeId: 'type-1',
          name: 'Footer Component',
          config: { copyright: '2024' },
          version: '1.0.0',
          isActive: true,
        }),
      };
      (SharedComponentService as MockConstructor<MockSharedComponentService>).mockImplementation(() => mockService);

      const request = new NextRequest('http://localhost:3000/api/components/shared', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'site-1',
          websiteComponentTypeId: 'type-1',
          name: 'Footer Component',
          config: { copyright: '2024' },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('new-shared');
      expect(mockService.createSharedComponent).toHaveBeenCalledWith({
        websiteId: 'site-1',
        websiteComponentTypeId: 'type-1',
        name: 'Footer Component',
        config: { copyright: '2024' },
      });
    });

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/components/shared', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Missing Required Fields',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Invalid request body');
    });

    it('should handle component type not found error', async () => {
      const mockService = {
        createSharedComponent: jest.fn().mockRejectedValue(new Error('Component type not found')),
      };
      (SharedComponentService as MockConstructor<MockSharedComponentService>).mockImplementation(() => mockService);

      const request = new NextRequest('http://localhost:3000/api/components/shared', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'site-1',
          websiteComponentTypeId: 'invalid-type',
          name: 'Shared Component',
          config: {},
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.message).toBe('Component type not found');
    });

    it('should set default config if not provided', async () => {
      const mockService = {
        createSharedComponent: jest.fn().mockResolvedValue({
          id: 'new-shared',
          config: {},
        }),
      };
      (SharedComponentService as MockConstructor<MockSharedComponentService>).mockImplementation(() => mockService);

      const request = new NextRequest('http://localhost:3000/api/components/shared', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'site-1',
          websiteComponentTypeId: 'type-1',
          name: 'Shared Component',
        }),
      });

      await POST(request);

      expect(mockService.createSharedComponent).toHaveBeenCalledWith(expect.objectContaining({
        config: {},
      }));
    });

    it('should handle database errors', async () => {
      const mockService = {
        createSharedComponent: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      };
      (SharedComponentService as MockConstructor<MockSharedComponentService>).mockImplementation(() => mockService);

      const request = new NextRequest('http://localhost:3000/api/components/shared', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'site-1',
          websiteComponentTypeId: 'type-1',
          name: 'Shared Component',
          config: {},
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Internal server error');
    });
  });
});