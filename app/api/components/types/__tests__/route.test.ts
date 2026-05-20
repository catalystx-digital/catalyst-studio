import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { prisma } from '@/lib/prisma';
import { ComponentService } from '@/lib/services/component-service';
import {
  MockComponentService,
  MockWebsiteComponentType,
  MockConstructor
} from '@/lib/test-utils/mock-types';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    websiteComponentType: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/component-service');

describe('/api/components/types', () => {
  const buildRequest = (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (!headers.has('x-website-id')) {
      headers.set('x-website-id', 'test-website');
    }
    return new NextRequest(url, { ...init, headers });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return component types with pagination', async () => {
      const mockComponentTypes: MockWebsiteComponentType[] = [
        {
          id: 'comp-1',
          type: 'hero',
          category: 'layout',
          name: 'Hero Component',
          description: 'A hero component',
          icon: 'hero-icon',
          defaultProperties: {},
          defaultContent: {},
          defaultStyles: {},
          aiMetadata: {},
          schema: {},
          version: '1.0.0',
          isActive: true,
          isLocked: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      (prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(1);
      (prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue(mockComponentTypes);

      const request = buildRequest('http://localhost:3000/api/components/types?page=1&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].type).toBe('hero');
      expect(data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should filter by category', async () => {
      (prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(0);
      (prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue([]);

      const request = buildRequest('http://localhost:3000/api/components/types?category=layout');
      await GET(request);

      expect(prisma.websiteComponentType.count).toHaveBeenCalledWith({
        where: {
          category: 'layout',
          isActive: true,
        },
      });
    });

    it('should filter inactive components by default', async () => {
      (prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(0);
      (prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue([]);

      const request = buildRequest('http://localhost:3000/api/components/types');
      await GET(request);

      expect(prisma.websiteComponentType.count).toHaveBeenCalledWith({
        where: {
          isActive: true,
        },
      });
    });

    it('should include inactive when specified', async () => {
      (prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(0);
      (prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue([]);

      const request = buildRequest('http://localhost:3000/api/components/types?includeInactive=true');
      await GET(request);

      expect(prisma.websiteComponentType.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('should handle server errors', async () => {
      (prisma.websiteComponentType.count as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = buildRequest('http://localhost:3000/api/components/types');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should create a new component type', async () => {
      const mockService = {
        createComponentType: jest.fn().mockResolvedValue({
          id: 'new-comp',
          type: 'button',
          category: 'ui',
          name: 'Button Component',
          version: '1.0.0',
          isActive: true,
        }),
      };
      (ComponentService as MockConstructor<MockComponentService>).mockImplementation(() => mockService);

      const request = buildRequest('http://localhost:3000/api/components/types', {
        method: 'POST',
        body: JSON.stringify({
          type: 'button',
          category: 'ui',
          name: 'Button Component',
          description: 'A button component',
          defaultProperties: { variant: 'primary' },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('new-comp');
      expect(mockService.createComponentType).toHaveBeenCalledWith(expect.objectContaining({
        type: 'button',
        category: 'ui',
      }));
    });

    it('should validate required fields', async () => {
      const request = buildRequest('http://localhost:3000/api/components/types', {
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

    it('should handle duplicate component type error', async () => {
      const mockService = {
        createComponentType: jest.fn().mockRejectedValue(new Error('Component type already exists')),
      };
      (ComponentService as MockConstructor<MockComponentService>).mockImplementation(() => mockService);

      const request = buildRequest('http://localhost:3000/api/components/types', {
        method: 'POST',
        body: JSON.stringify({
          type: 'hero',
          category: 'layout',
          name: 'Hero Component',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error.message).toBe('Component type already exists');
    });

    it('should set default values for optional fields', async () => {
      const mockService = {
        createComponentType: jest.fn().mockResolvedValue({
          id: 'new-comp',
          type: 'section',
          category: 'layout',
        }),
      };
      (ComponentService as MockConstructor<MockComponentService>).mockImplementation(() => mockService);

      const request = buildRequest('http://localhost:3000/api/components/types', {
        method: 'POST',
        body: JSON.stringify({
          type: 'section',
          category: 'layout',
          name: 'Section Component',
        }),
      });

      await POST(request);

      expect(mockService.createComponentType).toHaveBeenCalledWith(expect.objectContaining({
        defaultProperties: {},
        defaultContent: {},
        defaultStyles: {},
        aiMetadata: {},
        schema: {},
      }));
    });
  });
});

