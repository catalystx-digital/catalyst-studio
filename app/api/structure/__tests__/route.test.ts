import { NextRequest } from 'next/server';
import { GET, POST, PUT, DELETE } from '../route';
import { StructureService } from '@/lib/services/structure-service';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    websiteStructure: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/structure-service');

describe('/api/structure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return website structure tree', async () => {
      const mockService = {
        getStructureTree: jest.fn().mockResolvedValue([
          {
            id: 'struct-1',
            websiteId: 'site-1',
            pageId: 'page-1',
            parentId: null,
            slug: 'home',
            fullPath: '/',
            position: 0,
            isVisible: true,
            children: [
              {
                id: 'struct-2',
                websiteId: 'site-1',
                pageId: 'page-2',
                parentId: 'struct-1',
                slug: 'about',
                fullPath: '/about',
                position: 0,
                isVisible: true,
                children: [],
              },
            ],
          },
        ]),
      };
      (StructureService as jest.MockedClass<typeof StructureService>).mockImplementation(() => mockService as InstanceType<typeof StructureService>);

      const request = new NextRequest('http://localhost:3000/api/structure?websiteId=site-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tree).toHaveLength(1);
      expect(data.tree[0].slug).toBe('home');
      expect(data.tree[0].children).toHaveLength(1);
      expect(mockService.getStructureTree).toHaveBeenCalledWith('site-1');
    });

    it('should require websiteId parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/structure');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('websiteId is required');
    });

    it('should handle empty structure', async () => {
      const mockService = {
        getStructureTree: jest.fn().mockResolvedValue([]),
      };
      (StructureService as jest.MockedClass<typeof StructureService>).mockImplementation(() => mockService as InstanceType<typeof StructureService>);

      const request = new NextRequest('http://localhost:3000/api/structure?websiteId=site-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tree).toEqual([]);
    });

    it('should handle server errors', async () => {
      const mockService = {
        getStructureTree: jest.fn().mockRejectedValue(new Error('Database error')),
      };
      (StructureService as jest.MockedClass<typeof StructureService>).mockImplementation(() => mockService as InstanceType<typeof StructureService>);

      const request = new NextRequest('http://localhost:3000/api/structure?websiteId=site-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.message).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('should create a new structure entry', async () => {
      const mockService = {
        createStructure: jest.fn().mockResolvedValue({
          id: 'new-struct',
          websiteId: 'site-1',
          pageId: 'page-3',
          parentId: 'struct-1',
          slug: 'services',
          fullPath: '/services',
          position: 1,
          isVisible: true,
        }),
      };
      (StructureService as jest.MockedClass<typeof StructureService>).mockImplementation(() => mockService as InstanceType<typeof StructureService>);

      const request = new NextRequest('http://localhost:3000/api/structure', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'site-1',
          pageId: 'page-3',
          parentId: 'struct-1',
          slug: 'services',
          position: 1,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('new-struct');
      expect(mockService.createStructure).toHaveBeenCalledWith(expect.objectContaining({
        slug: 'services',
      }));
    });

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/structure', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'services',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Invalid request body');
    });

    it('should handle duplicate slug error', async () => {
      const mockService = {
        createStructure: jest.fn().mockRejectedValue(new Error('Slug already exists at this level')),
      };
      (StructureService as jest.MockedClass<typeof StructureService>).mockImplementation(() => mockService as InstanceType<typeof StructureService>);

      const request = new NextRequest('http://localhost:3000/api/structure', {
        method: 'POST',
        body: JSON.stringify({
          websiteId: 'site-1',
          pageId: 'page-3',
          parentId: null,
          slug: 'home',
          position: 0,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error.message).toBe('Slug already exists at this level');
    });
  });

  describe('PUT', () => {
    it('should update structure entry', async () => {
      const mockService = {
        getStructure: jest.fn().mockResolvedValue({ id: 'struct-1', slug: 'old-slug' }),
        updateStructure: jest.fn().mockResolvedValue({
          id: 'struct-1',
          slug: 'new-slug',
          fullPath: '/new-slug',
          position: 2,
        }),
      };
      (StructureService as jest.MockedClass<typeof StructureService>).mockImplementation(() => mockService as InstanceType<typeof StructureService>);

      const request = new NextRequest('http://localhost:3000/api/structure?id=struct-1', {
        method: 'PUT',
        body: JSON.stringify({
          slug: 'new-slug',
          position: 2,
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.slug).toBe('new-slug');
      expect(mockService.updateStructure).toHaveBeenCalledWith('struct-1', expect.objectContaining({
        slug: 'new-slug',
      }));
    });

    it('should require id parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/structure', {
        method: 'PUT',
        body: JSON.stringify({ slug: 'new-slug' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Structure ID is required');
    });

    it('should handle non-existent structure', async () => {
      const mockService = {
        getStructure: jest.fn().mockResolvedValue(null),
      };
      (StructureService as jest.MockedClass<typeof StructureService>).mockImplementation(() => mockService as InstanceType<typeof StructureService>);

      const request = new NextRequest('http://localhost:3000/api/structure?id=invalid', {
        method: 'PUT',
        body: JSON.stringify({ slug: 'new-slug' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.message).toBe('Structure entry not found');
    });
  });

  describe('DELETE', () => {
    it('should delete structure entry', async () => {
      const mockService = {
        getStructure: jest.fn().mockResolvedValue({ id: 'struct-1' }),
        deleteStructure: jest.fn().mockResolvedValue(undefined),
      };
      (StructureService as jest.MockedClass<typeof StructureService>).mockImplementation(() => mockService as InstanceType<typeof StructureService>);

      const request = new NextRequest('http://localhost:3000/api/structure?id=struct-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Structure entry deleted successfully');
      expect(mockService.deleteStructure).toHaveBeenCalledWith('struct-1');
    });

    it('should handle deletion with children error', async () => {
      const mockService = {
        getStructure: jest.fn().mockResolvedValue({ id: 'struct-1' }),
        deleteStructure: jest.fn().mockRejectedValue(new Error('Cannot delete structure with children')),
      };
      (StructureService as jest.MockedClass<typeof StructureService>).mockImplementation(() => mockService as InstanceType<typeof StructureService>);

      const request = new NextRequest('http://localhost:3000/api/structure?id=struct-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error.message).toBe('Cannot delete structure with children');
    });
  });
});