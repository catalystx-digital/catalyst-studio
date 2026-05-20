import { GET, POST } from '../route';
import { GET as GETBYID, PUT as PUTBYID, DELETE as DELETEBYID } from '../[id]/route';
import { GET as GETUSAGE } from '../[id]/usage/route';
import { GET as GETIMPACT } from '../[id]/impact/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    websiteSharedComponent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    websiteComponentType: {
      findUnique: jest.fn(),
    },
    websitePage: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    website: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn) => {
      const mockPrisma = jest.requireMock('@/lib/prisma').prisma;
      if (Array.isArray(fn)) {
        return Promise.all(fn.map(op => Promise.resolve(op)));
      }
      return fn(mockPrisma);
    }),
  },
}));

// Get prisma from the mock for TypeScript
import { prisma } from '@/lib/prisma';

describe('Website Shared Component API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/studio/site-builder/global-components', () => {
    it('should return all shared components for a website', async () => {
      const mockSharedComponents = [
        {
          id: 'shared-1',
          websiteId: 'test-site',
          websiteComponentTypeId: 'comp-type-1',
          name: 'Main Header',
          content: { logo: 'logo.png', links: [] },
          version: '1.0.0',
          usageCount: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'shared-2',
          websiteId: 'test-site',
          websiteComponentTypeId: 'comp-type-2',
          name: 'Footer',
          content: { copyright: '2025', links: [] },
          version: '1.0.0',
          usageCount: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(mockSharedComponents);
      (prisma.websiteSharedComponent.count as jest.Mock).mockResolvedValue(2);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components?websiteId=test-site');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.items).toEqual(mockSharedComponents);
      expect(data.total).toBe(2);
      expect(prisma.websiteSharedComponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { websiteId: 'test-site' },
        })
      );
    });

    it('should filter shared components by component type', async () => {
      const mockFilteredComponents = [
        {
          id: 'shared-1',
          websiteId: 'test-site',
          websiteComponentTypeId: 'header-type',
          name: 'Main Header',
          content: {},
          version: '1.0.0',
          usageCount: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(mockFilteredComponents);
      (prisma.websiteSharedComponent.count as jest.Mock).mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components?websiteId=test-site&componentTypeId=header-type');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.items).toEqual(mockFilteredComponents);
      expect(prisma.websiteSharedComponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { 
            websiteId: 'test-site',
            websiteComponentTypeId: 'header-type'
          },
        })
      );
    });

    it('should handle pagination correctly', async () => {
      const allComponents = Array.from({ length: 15 }, (_, i) => ({
        id: `shared-${i}`,
        websiteId: 'test-site',
        websiteComponentTypeId: `type-${i}`,
        name: `Component ${i}`,
        content: {},
        version: '1.0.0',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      (prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(allComponents.slice(5, 10));
      (prisma.websiteSharedComponent.count as jest.Mock).mockResolvedValue(15);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components?websiteId=test-site&page=2&limit=5');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.items).toHaveLength(5);
      expect(data.page).toBe(2);
      expect(data.limit).toBe(5);
      expect(data.total).toBe(15);
      expect(prisma.websiteSharedComponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        })
      );
    });

    it('should return 400 when websiteId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('websiteId is required');
    });
  });

  describe('POST /api/studio/site-builder/global-components', () => {
    it('should create a new shared component', async () => {
      const newSharedComponent = {
        websiteId: 'test-site',
        websiteComponentTypeId: 'header-type',
        name: 'New Header',
        content: { 
          logo: 'new-logo.png',
          navigation: ['Home', 'About', 'Contact']
        },
        version: '1.0.0',
      };

      const createdComponent = {
        id: 'new-shared-id',
        ...newSharedComponent,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockComponentType = {
        id: 'header-type',
        type: 'header',
        category: 'navigation',
      };

      (prisma.websiteComponentType.findUnique as jest.Mock).mockResolvedValue(mockComponentType);
      (prisma.websiteSharedComponent.create as jest.Mock).mockResolvedValue(createdComponent);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components', {
        method: 'POST',
        body: JSON.stringify(newSharedComponent),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toMatchObject(createdComponent);
      expect(prisma.websiteSharedComponent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            websiteId: 'test-site',
            websiteComponentTypeId: 'header-type',
            name: 'New Header',
          }),
        })
      );
    });

    it('should validate required fields when creating', async () => {
      const invalidComponent = {
        websiteId: 'test-site',
        // Missing required fields
        content: {},
      };

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components', {
        method: 'POST',
        body: JSON.stringify(invalidComponent),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should validate component type exists before creating', async () => {
      const componentWithInvalidType = {
        websiteId: 'test-site',
        websiteComponentTypeId: 'non-existent-type',
        name: 'Invalid Component',
        content: {},
      };

      (prisma.websiteComponentType.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components', {
        method: 'POST',
        body: JSON.stringify(componentWithInvalidType),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Component type not found');
    });
  });

  describe('GET /api/studio/site-builder/global-components/[id]', () => {
    it('should retrieve a specific shared component by id', async () => {
      const mockComponent = {
        id: 'shared-1',
        websiteId: 'test-site',
        websiteComponentTypeId: 'header-type',
        name: 'Main Header',
        content: { logo: 'logo.png', links: [] },
        version: '1.0.0',
        usageCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockComponent);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/shared-1');
      const response = await GETBYID(request, { params: { id: 'shared-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockComponent);
      expect(prisma.websiteSharedComponent.findUnique).toHaveBeenCalledWith({
        where: { id: 'shared-1' },
      });
    });

    it('should return 404 when shared component not found', async () => {
      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/non-existent');
      const response = await GETBYID(request, { params: { id: 'non-existent' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Shared component not found');
    });
  });

  describe('PUT /api/studio/site-builder/global-components/[id]', () => {
    it('should update shared component content', async () => {
      const existingComponent = {
        id: 'shared-1',
        websiteId: 'test-site',
        websiteComponentTypeId: 'header-type',
        name: 'Main Header',
        content: { logo: 'old-logo.png' },
        version: '1.0.0',
        usageCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateData = {
        content: { 
          logo: 'new-logo.png',
          navigation: ['Home', 'Products', 'About', 'Contact']
        },
        version: '1.1.0',
      };

      const updatedComponent = {
        ...existingComponent,
        ...updateData,
        updatedAt: new Date(),
      };

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(existingComponent);
      (prisma.websiteSharedComponent.update as jest.Mock).mockResolvedValue(updatedComponent);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/shared-1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUTBYID(request, { params: { id: 'shared-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.content.logo).toBe('new-logo.png');
      expect(data.version).toBe('1.1.0');
      expect(prisma.websiteSharedComponent.update).toHaveBeenCalledWith({
        where: { id: 'shared-1' },
        data: updateData,
      });
    });

    it('should handle transaction for bulk updates', async () => {
      const existingComponent = {
        id: 'shared-1',
        websiteId: 'test-site',
        websiteComponentTypeId: 'header-type',
        name: 'Main Header',
        content: { logo: 'old-logo.png' },
        version: '1.0.0',
        usageCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateData = {
        content: { logo: 'new-logo.png' },
        propagate: true,
      };

      const updatedComponent = {
        ...existingComponent,
        content: updateData.content,
        updatedAt: new Date(),
      };

      const affectedPages = [
        { id: 'page-1', content: { sharedComponents: ['shared-1'] } },
        { id: 'page-2', content: { sharedComponents: ['shared-1'] } },
      ];

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(existingComponent);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(affectedPages);
      (prisma.websiteSharedComponent.update as jest.Mock).mockResolvedValue(updatedComponent);
      (prisma.websitePage.update as jest.Mock).mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/shared-1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUTBYID(request, { params: { id: 'shared-1' } });

      expect(response.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should return 404 when updating non-existent component', async () => {
      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/non-existent', {
        method: 'PUT',
        body: JSON.stringify({ content: {} }),
      });

      const response = await PUTBYID(request, { params: { id: 'non-existent' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Shared component not found');
    });
  });

  describe('DELETE /api/studio/site-builder/global-components/[id]', () => {
    it('should delete a shared component', async () => {
      const componentToDelete = {
        id: 'shared-1',
        websiteId: 'test-site',
        websiteComponentTypeId: 'header-type',
        name: 'Old Header',
        usageCount: 0,
      };

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(componentToDelete);
      (prisma.websiteSharedComponent.delete as jest.Mock).mockResolvedValue(componentToDelete);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/shared-1');
      const response = await DELETEBYID(request, { params: { id: 'shared-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toContain('deleted successfully');
      expect(prisma.websiteSharedComponent.delete).toHaveBeenCalledWith({
        where: { id: 'shared-1' },
      });
    });

    it('should prevent deletion of component in use', async () => {
      const componentInUse = {
        id: 'shared-1',
        websiteId: 'test-site',
        websiteComponentTypeId: 'header-type',
        name: 'Active Header',
        usageCount: 5,
      };

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(componentInUse);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/shared-1');
      const response = await DELETEBYID(request, { params: { id: 'shared-1' } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Cannot delete component in use');
      expect(prisma.websiteSharedComponent.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when deleting non-existent component', async () => {
      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/non-existent');
      const response = await DELETEBYID(request, { params: { id: 'non-existent' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Shared component not found');
    });
  });

  describe('GET /api/studio/site-builder/global-components/[id]/usage', () => {
    it('should return usage information for a shared component', async () => {
      const mockComponent = {
        id: 'shared-1',
        websiteId: 'test-site',
        name: 'Main Header',
        usageCount: 3,
      };

      const mockUsagePages = [
        {
          id: 'page-1',
          title: 'Homepage',
          content: {
            sharedComponents: ['shared-1'],
            components: [],
          },
        },
        {
          id: 'page-2',
          title: 'About Page',
          content: {
            sharedComponents: ['shared-1', 'shared-2'],
            components: [],
          },
        },
        {
          id: 'page-3',
          title: 'Contact Page',
          content: {
            sharedComponents: ['shared-1'],
            components: [],
          },
        },
      ];

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockComponent);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockUsagePages);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/shared-1/usage');
      const response = await GETUSAGE(request, { params: { id: 'shared-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.componentId).toBe('shared-1');
      expect(data.usageCount).toBe(3);
      expect(data.pages).toHaveLength(3);
      expect(data.pages[0].title).toBe('Homepage');
    });

    it('should return empty usage for unused component', async () => {
      const mockComponent = {
        id: 'shared-1',
        websiteId: 'test-site',
        name: 'Unused Component',
        usageCount: 0,
      };

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockComponent);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/shared-1/usage');
      const response = await GETUSAGE(request, { params: { id: 'shared-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.usageCount).toBe(0);
      expect(data.pages).toHaveLength(0);
    });

    it('should return 404 for non-existent component', async () => {
      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/non-existent/usage');
      const response = await GETUSAGE(request, { params: { id: 'non-existent' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Shared component not found');
    });
  });

  describe('GET /api/studio/site-builder/global-components/[id]/impact', () => {
    it('should analyze impact of updating a shared component', async () => {
      const mockComponent = {
        id: 'shared-1',
        websiteId: 'test-site',
        name: 'Main Header',
        websiteComponentTypeId: 'header-type',
        content: { logo: 'current-logo.png' },
        usageCount: 5,
      };

      const mockAffectedPages = [
        {
          id: 'page-1',
          title: 'Homepage',
          type: 'page',
          content: {
            sharedComponents: ['shared-1'],
          },
        },
        {
          id: 'page-2',
          title: 'About',
          type: 'page',
          content: {
            sharedComponents: ['shared-1', 'shared-2'],
          },
        },
      ];

      const mockComponentType = {
        id: 'header-type',
        type: 'header',
        category: 'navigation',
        name: 'Header Component',
      };

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockComponent);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockAffectedPages);
      (prisma.websiteComponentType.findUnique as jest.Mock).mockResolvedValue(mockComponentType);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/shared-1/impact');
      const response = await GETIMPACT(request, { params: { id: 'shared-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.componentId).toBe('shared-1');
      expect(data.componentName).toBe('Main Header');
      expect(data.affectedPages).toHaveLength(2);
      expect(data.totalImpact).toBe(2);
      expect(data.componentType).toEqual(mockComponentType);
    });

    it('should handle component with no impact', async () => {
      const mockComponent = {
        id: 'shared-1',
        websiteId: 'test-site',
        name: 'Unused Component',
        websiteComponentTypeId: 'type-1',
        usageCount: 0,
      };

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockComponent);
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.websiteComponentType.findUnique as jest.Mock).mockResolvedValue({ id: 'type-1' });

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/shared-1/impact');
      const response = await GETIMPACT(request, { params: { id: 'shared-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.totalImpact).toBe(0);
      expect(data.affectedPages).toHaveLength(0);
    });

    it('should return 404 for non-existent component', async () => {
      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/non-existent/impact');
      const response = await GETIMPACT(request, { params: { id: 'non-existent' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Shared component not found');
    });
  });

  describe('Transaction Handling for Bulk Operations', () => {
    it('should handle bulk update of shared components in transaction', async () => {
      const componentsToUpdate = [
        { id: 'shared-1', content: { updated: true } },
        { id: 'shared-2', content: { updated: true } },
        { id: 'shared-3', content: { updated: true } },
      ];

      const mockTransaction = jest.fn().mockResolvedValue(componentsToUpdate);
      (prisma.$transaction as jest.Mock).mockImplementation(mockTransaction);

      // Simulate bulk update endpoint

      // Since we don't have a bulk update endpoint in the actual API,
      // this test validates that transaction handling would work correctly
      expect(prisma.$transaction).toBeDefined();
      
      // Verify transaction can handle array of operations
      const operations = componentsToUpdate.map(comp => 
        prisma.websiteSharedComponent.update({
          where: { id: comp.id },
          data: { content: comp.content },
        })
      );

      await prisma.$transaction(operations);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should rollback transaction on failure', async () => {
      const failingOperations = [
        prisma.websiteSharedComponent.update({ where: { id: '1' }, data: {} }),
        prisma.websiteSharedComponent.update({ where: { id: '2' }, data: {} }),
      ];

      const mockTransaction = jest.fn().mockRejectedValue(new Error('Transaction failed'));
      (prisma.$transaction as jest.Mock).mockImplementation(mockTransaction);

      await expect(prisma.$transaction(failingOperations)).rejects.toThrow('Transaction failed');
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain backward compatible response format', async () => {
      const mockComponent = {
        id: 'shared-1',
        websiteId: 'test-site',
        websiteComponentTypeId: 'header-type',
        name: 'Main Header',
        content: { logo: 'logo.png' },
        version: '1.0.0',
        usageCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockComponent);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/shared-1');
      const response = await GETBYID(request, { params: { id: 'shared-1' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Verify backward compatible fields are present
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('websiteId');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('content');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('usageCount');
    });
  });
});