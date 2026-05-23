import { GET, POST } from '../route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ContentRepository } from '@/lib/services/unified-content-repository';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findUnique: jest.fn(),
    },
    websiteSharedComponent: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn().mockResolvedValue({ accountId: 'account-1', userId: 'user-789' }),
}));

jest.mock('@/lib/auth/ownership', () => ({
  assertWebsiteOwnership: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/unified-content-repository', () => ({
  ContentRepository: {
    createSharedComponent: jest.fn(),
  },
}));

describe('Global Components API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/studio/site-builder/global-components', () => {
    it('creates a shared component through the unified repository', async () => {
      const mockWebsite = { id: 'website-123', name: 'Test Site' };
      const lastModified = new Date('2024-01-01T00:00:00Z');
      const mockSharedComponent = {
        id: 'shared-456',
        websiteId: 'website-123',
        websiteComponentTypeId: 'header',
        name: 'Header',
        category: 'header',
        content: { color: 'blue' },
        usageCount: 0,
        lastModified,
        createdBy: 'user-789',
      };

      (prisma.website.findUnique as jest.Mock).mockResolvedValue(mockWebsite);
      (prisma.websiteSharedComponent.findFirst as jest.Mock).mockResolvedValue(null);
      (ContentRepository.createSharedComponent as jest.Mock).mockResolvedValue({ id: 'shared-456' });
      (prisma.websiteSharedComponent.findUniqueOrThrow as jest.Mock).mockResolvedValue(mockSharedComponent);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'website-123',
          name: 'Header',
          type: 'header',
          category: 'header',
          content: { color: 'blue' },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        id: 'shared-456',
        data: {
          id: 'shared-456',
          componentId: 'header',
          name: 'Header',
          type: 'header',
          properties: { color: 'blue' },
          usageCount: 0,
          lastModified: lastModified.toISOString(),
          createdBy: 'user-789',
        },
      });
      expect(assertWebsiteOwnership).toHaveBeenCalledWith(prisma, 'account-1', 'website-123');
      expect(ContentRepository.createSharedComponent).toHaveBeenCalledWith({
        websiteId: 'website-123',
        websiteComponentTypeId: 'header',
        name: 'Header',
        category: 'header',
        content: { color: 'blue' },
        createdBy: 'user-789',
      });
    });

    it('returns 404 when website not found', async () => {
      (prisma.website.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'non-existent',
          name: 'Header',
          type: 'header',
          category: 'header',
          content: {},
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Website not found');
      expect(ContentRepository.createSharedComponent).not.toHaveBeenCalled();
    });

    it('returns duplicate-name errors before creating', async () => {
      (prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'website-123' });
      (prisma.websiteSharedComponent.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-shared' });

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'website-123',
          name: 'Header',
          type: 'header',
          category: 'header',
          content: {},
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('A global component with this name already exists');
      expect(ContentRepository.createSharedComponent).not.toHaveBeenCalled();
    });

    it('validates request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'website-123',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
      expect(data.details).toBeDefined();
    });
  });

  describe('GET /api/studio/site-builder/global-components', () => {
    it('lists all shared components for a website', async () => {
      const firstModified = new Date('2024-01-01T00:00:00Z');
      const secondModified = new Date('2024-01-02T00:00:00Z');
      (prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'shared-1',
          websiteComponentTypeId: 'header',
          name: 'Header',
          content: {},
          usageCount: 5,
          lastModified: firstModified,
          createdBy: 'user-1',
        },
        {
          id: 'shared-2',
          websiteComponentTypeId: 'footer',
          name: 'Footer',
          content: { theme: 'dark' },
          usageCount: 3,
          lastModified: secondModified,
          createdBy: 'user-2',
        },
      ]);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components?websiteId=website-123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
      expect(data.components).toEqual([
        {
          id: 'shared-1',
          componentId: 'header',
          name: 'Header',
          type: 'header',
          properties: {},
          usageCount: 5,
          lastModified: firstModified.toISOString(),
          createdBy: 'user-1',
        },
        {
          id: 'shared-2',
          componentId: 'footer',
          name: 'Footer',
          type: 'footer',
          properties: { theme: 'dark' },
          usageCount: 3,
          lastModified: secondModified.toISOString(),
          createdBy: 'user-2',
        },
      ]);
      expect(assertWebsiteOwnership).toHaveBeenCalledWith(prisma, 'account-1', 'website-123');
      expect(prisma.websiteSharedComponent.findMany).toHaveBeenCalledWith({
        where: { websiteId: 'website-123' },
        orderBy: { name: 'asc' },
      });
    });

    it('omits shared components without explicit type or content instead of synthesizing fallbacks', async () => {
      (prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'valid',
          websiteComponentTypeId: 'header',
          name: 'Header',
          content: { title: 'Header' },
          usageCount: 1,
          lastModified: new Date('2024-01-01T00:00:00Z'),
          createdBy: 'user-1',
        },
        {
          id: 'missing-type',
          websiteComponentTypeId: '',
          name: 'Missing type',
          content: { title: 'Missing type' },
          usageCount: 0,
          lastModified: new Date('2024-01-01T00:00:00Z'),
          createdBy: 'user-1',
        },
        {
          id: 'missing-content',
          websiteComponentTypeId: 'footer',
          name: 'Missing content',
          content: null,
          usageCount: 0,
          lastModified: new Date('2024-01-01T00:00:00Z'),
          createdBy: 'user-1',
        },
      ]);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components?websiteId=website-123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.components).toHaveLength(1);
      expect(data.components[0]).toEqual(expect.objectContaining({
        id: 'valid',
        type: 'header',
        properties: { title: 'Header' },
      }));
    });

    it('returns 400 when websiteId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('websiteId is required');
      expect(prisma.websiteSharedComponent.findMany).not.toHaveBeenCalled();
    });
  });
});
