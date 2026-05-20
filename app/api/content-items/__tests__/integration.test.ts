import { GET, POST } from '../route';
import { GET as GETBYID, PUT as PUTBYID, DELETE as DELETEBYID } from '../[id]/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/services', () => ({
  ServiceFactory: {
    getInstance: jest.fn(() => ({
      pageService: {
        createPage: jest.fn((data) => Promise.resolve({
          id: 'new-page-id',
          ...data,
          structure: { slug: data.slug, fullPath: `/${data.slug}` },
        })),
        updatePage: jest.fn((id, data) => Promise.resolve({
          id,
          ...data,
        })),
      },
      contentDataService: {
        createContentData: jest.fn((data) => Promise.resolve({
          id: 'new-data-id',
          ...data,
        })),
        updateContentData: jest.fn((id, data) => Promise.resolve({
          id,
          ...data,
        })),
      },
      structureService: {
        createStructure: jest.fn(),
        updateStructure: jest.fn(),
      },
    })),
  },
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    websitePage: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    websiteCustomContentData: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    websiteStructure: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    contentType: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    website: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(prisma)),
  },
}));

// Get prisma from the mock for TypeScript
import { prisma } from '@/lib/prisma';

describe('Content Items API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/content-items', () => {
    it('should return websitePages when contentTypeId references a page type', async () => {
      const mockPages = [
        {
          id: '1',
          websiteId: 'test-site',
          type: 'page',
          title: 'Test Page',
          content: { components: [] },
          metadata: {},
          contentTypeId: 'page-type',
          status: 'published',
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          contentType: { id: 'page-type', category: 'page', website: { id: 'test-site' } },
          website: { id: 'test-site' },
        },
      ];

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'page-type', 
        category: 'page' 
      });
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages);
      (prisma.websitePage.count as jest.Mock).mockResolvedValue(1);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/content-items?websiteId=test-site&contentTypeId=page-type');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data).toHaveLength(1);
      expect(data.pagination.total).toBe(1);
      expect(prisma.websitePage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { websiteId: 'test-site', contentTypeId: 'page-type' },
        })
      );
    });

    it('should return websitePages for folder type content', async () => {
      const mockFolders = [
        {
          id: '2',
          websiteId: 'test-site',
          type: 'folder',
          title: 'Test Folder',
          content: null,
          metadata: {},
          contentTypeId: 'folder-type',
          status: 'published',
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          contentType: { id: 'folder-type', category: 'page', website: { id: 'test-site' } },
          website: { id: 'test-site' },
        },
      ];

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'folder-type', 
        category: 'page' 
      });
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockFolders);
      (prisma.websitePage.count as jest.Mock).mockResolvedValue(1);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/content-items?websiteId=test-site&contentTypeId=folder-type');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data).toHaveLength(1);
      expect(prisma.websitePage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { websiteId: 'test-site', contentTypeId: 'folder-type' },
        })
      );
    });

    it('should return websiteCustomContentData when contentTypeId references a component type', async () => {
      const mockData = [
        {
          id: '3',
          websiteId: 'test-site',
          title: 'Test Data',
          data: { field: 'value' },
          contentTypeId: 'data-type',
          status: 'published',
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          contentType: { id: 'data-type', category: 'component', website: { id: 'test-site' } },
          website: { id: 'test-site' },
        },
      ];

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({ 
        id: 'data-type', 
        category: 'component' 
      });
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue(mockData);
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(1);
      // Mock empty page results since we're looking for component type
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.websitePage.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/content-items?websiteId=test-site&contentTypeId=data-type');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(data.data).toHaveLength(1);
      expect(data.pagination.total).toBe(1);
      expect(prisma.websiteCustomContentData.findMany).toHaveBeenCalled();
    });

    it('should handle pagination correctly', async () => {
      const mockPages = Array.from({ length: 5 }, (_, i) => ({
        id: `page-${i}`,
        websiteId: 'test-site',
        type: 'page',
        title: `Page ${i}`,
        content: {},
        metadata: {},
        contentTypeId: 'page-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: { id: 'page-type', category: 'page', website: { id: 'test-site' } },
        website: { id: 'test-site' },
      }));

      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages.slice(2, 4));
      (prisma.websitePage.count as jest.Mock).mockResolvedValue(5);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/content-items?websiteId=test-site&page=2&limit=2');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(2);
      expect(data.pagination.total).toBe(5);
      expect(data.pagination.page).toBe(2);
      expect(data.pagination.limit).toBe(2);
      expect(prisma.websitePage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 2,
          take: 2,
        })
      );
    });

    it('should return all content when no contentTypeId is specified', async () => {
      const mockPages = [{
        id: 'page-1',
        websiteId: 'test-site',
        type: 'page',
        title: 'Page 1',
        content: {},
        metadata: {},
        contentTypeId: 'page-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: { id: 'page-type', category: 'page', website: { id: 'test-site' } },
        website: { id: 'test-site' },
      }];

      const mockCustomData = [{
        id: 'data-1',
        websiteId: 'test-site',
        title: 'Data 1',
        data: { field: 'value' },
        contentTypeId: 'data-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: { id: 'data-type', category: 'component', website: { id: 'test-site' } },
        website: { id: 'test-site' },
      }];

      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages);
      (prisma.websitePage.count as jest.Mock).mockResolvedValue(1);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue(mockCustomData);
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(1);
      
      const request = new NextRequest('http://localhost:3000/api/content-items?websiteId=test-site');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
    });

    it('should handle empty results gracefully', async () => {
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.websitePage.count as jest.Mock).mockResolvedValue(0);
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/content-items?websiteId=test-site');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(0);
      expect(data.pagination.total).toBe(0);
    });
  });

  describe('POST /api/content-items', () => {
    it('should create a websitePage when contentType category is page', async () => {
      const newPage = {
        websiteId: 'test-site',
        title: 'New Page',
        slug: 'new-page',
        content: { components: [] },
        metadata: { seo: {} },
        contentTypeId: 'page-type',
      };

      const createdPage = {
        id: 'new-page-id',
        websiteId: 'test-site',
        type: 'page',
        title: 'New Page',
        content: { components: [] },
        metadata: { seo: {} },
        contentTypeId: 'page-type',
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: { id: 'page-type', category: 'page' },
        website: { id: 'test-site' },
      };

      const mockContentType = {
        id: 'page-type',
        category: 'page',
      };

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue(mockContentType);
      (prisma.websitePage.create as jest.Mock).mockResolvedValue(createdPage);
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(createdPage);
      (prisma.websiteStructure.create as jest.Mock).mockResolvedValue({
        id: 'struct-id',
        websitePageId: 'new-page-id',
        slug: 'new-page',
        fullPath: '/new-page',
      });

      // Create a properly mocked request
      const bodyText = JSON.stringify(newPage);
      const request = {
        headers: {
          get: jest.fn((name) => name === 'content-type' ? 'application/json' : null),
        },
        text: jest.fn(() => Promise.resolve(bodyText)),
        json: jest.fn(() => Promise.resolve(newPage)),
      } as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBe('new-page-id');
      expect(data.modelType).toBe('websitePage');
    });

    it('should create a websiteCustomContentData when contentType category is component', async () => {
      const newData = {
        websiteId: 'test-site',
        title: 'New Data Record',
        slug: 'new-data-record',
        content: { field1: 'value1', field2: 'value2' },
        contentTypeId: 'data-type',
      };

      const createdData = {
        id: 'new-data-id',
        websiteId: 'test-site',
        title: 'New Data Record',
        data: newData.content,
        contentTypeId: 'data-type',
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: { id: 'data-type', category: 'component' },
        website: { id: 'test-site' },
      };

      const mockContentType = {
        id: 'data-type',
        category: 'component',
      };

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue(mockContentType);
      (prisma.websiteCustomContentData.create as jest.Mock).mockResolvedValue(createdData);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(createdData);

      // Create a properly mocked request
      const bodyText = JSON.stringify(newData);
      const request = {
        headers: {
          get: jest.fn((name) => name === 'content-type' ? 'application/json' : null),
        },
        text: jest.fn(() => Promise.resolve(bodyText)),
        json: jest.fn(() => Promise.resolve(newData)),
      } as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBe('new-data-id');
      expect(data.modelType).toBe('websiteCustomContentData');
    });

    it('should handle validation errors', async () => {
      const invalidData = {
        websiteId: 'test-site',
        // Missing required fields: title, slug, content, contentTypeId
      };

      // Create a properly mocked request
      const bodyText = JSON.stringify(invalidData);
      const request = {
        headers: {
          get: jest.fn((name) => name === 'content-type' ? 'application/json' : null),
        },
        text: jest.fn(() => Promise.resolve(bodyText)),
        json: jest.fn(() => Promise.resolve(invalidData)),
      } as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('Invalid request body');
    });

    it('should handle database errors gracefully', async () => {
      const newPage = {
        websiteId: 'test-site',
        title: 'New Page',
        slug: 'new-page',
        content: { components: [] },
        contentTypeId: 'page-type',
      };

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({ id: 'page-type', category: 'page' });
      (prisma.websitePage.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Create a properly mocked request
      const bodyText = JSON.stringify(newPage);
      const request = {
        headers: {
          get: jest.fn((name) => name === 'content-type' ? 'application/json' : null),
        },
        text: jest.fn(() => Promise.resolve(bodyText)),
        json: jest.fn(() => Promise.resolve(newPage)),
      } as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Failed to create content item');
    });
  });

  describe('GET /api/content-items/[id]', () => {
    it('should retrieve a websitePage by id', async () => {
      const mockPage = {
        id: 'page-1',
        websiteId: 'test-site',
        type: 'page',
        title: 'Test Page',
        content: { components: [] },
        metadata: {},
        contentTypeId: 'page-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: { id: 'page-type', category: 'page', fields: {} },
        website: { id: 'test-site', metadata: {}, settings: {} },
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(mockPage);

      const request = new NextRequest('http://localhost:3000/api/content-items/page-1');
      const response = await GETBYID(request, { params: Promise.resolve({ id: 'page-1' }) });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe('page-1');
      expect(result.data.modelType).toBe('websitePage');
      expect(prisma.websitePage.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'page-1' },
        })
      );
    });

    it('should retrieve websiteCustomContentData by id', async () => {
      const mockData = {
        id: 'data-1',
        websiteId: 'test-site',
        title: 'Test Data',
        data: { field: 'value' },
        contentTypeId: 'data-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: { id: 'data-type', category: 'component', fields: {} },
        website: { id: 'test-site', metadata: {}, settings: {} },
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(mockData);

      const request = new NextRequest('http://localhost:3000/api/content-items/data-1');
      const response = await GETBYID(request, { params: Promise.resolve({ id: 'data-1' }) });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe('data-1');
      expect(result.data.modelType).toBe('websiteCustomContentData');
    });

    it('should return 404 when item not found', async () => {
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/content-items/non-existent');
      const response = await GETBYID(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error.message).toContain('Content item not found');
    });
  });

  describe('PUT /api/content-items/[id]', () => {
    it('should update a websitePage', async () => {
      const existingPage = {
        id: 'page-1',
        websiteId: 'test-site',
        type: 'page',
        title: 'Old Title',
        content: { components: [] },
        metadata: {},
        contentTypeId: 'page-type',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updateData = {
        title: 'Updated Title',
        content: { components: [{ type: 'hero' }] },
      };

      const updatedPage = {
        ...existingPage,
        ...updateData,
        updatedAt: new Date(),
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(existingPage);
      (prisma.websitePage.update as jest.Mock).mockResolvedValue(updatedPage);

      const request = new NextRequest('http://localhost:3000/api/content-items/page-1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUTBYID(request, { params: Promise.resolve({ id: 'page-1' }) });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toBeDefined();
      expect(result.data.title).toBe('Updated Title');
      expect(result.data.modelType).toBe('websitePage');
      expect(prisma.websitePage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'page-1' },
          data: expect.objectContaining(updateData),
        })
      );
    });

    it('should update websiteCustomContentData', async () => {
      const existingData = {
        id: 'data-1',
        websiteId: 'test-site',
        title: 'Old Data',
        data: { field: 'old' },
        contentTypeId: 'data-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: { id: 'data-type', category: 'component', fields: {} },
      };

      const updateData = {
        title: 'Updated Data',
        content: { field: 'new', extra: 'value' },
      };

      const updatedData = {
        ...existingData,
        title: updateData.title,
        data: updateData.content,
        updatedAt: new Date(),
        contentType: { id: 'data-type', category: 'component', fields: {} },
        website: { id: 'test-site', metadata: {}, settings: {} },
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingData) // For existence check
        .mockResolvedValueOnce(updatedData); // For update result
      (prisma.websiteCustomContentData.update as jest.Mock).mockResolvedValue(updatedData);

      const request = new NextRequest('http://localhost:3000/api/content-items/data-1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUTBYID(request, { params: Promise.resolve({ id: 'data-1' }) });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toBeDefined();
      expect(result.data.title).toBe('Updated Data');
      expect(result.data.modelType).toBe('websiteCustomContentData');
      expect(prisma.websiteCustomContentData.update).toHaveBeenCalled();
    });

    it('should return 404 when updating non-existent item', async () => {
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/content-items/non-existent', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated' }),
      });

      const response = await PUTBYID(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error.message).toContain('Content item not found');
    });
  });

  describe('DELETE /api/content-items/[id]', () => {
    it('should soft delete a websitePage by archiving it', async () => {
      const mockPage = {
        id: 'page-1',
        websiteId: 'test-site',
        type: 'page',
        title: 'Page to Archive',
        status: 'published',
      };

      const archivedPage = {
        ...mockPage,
        status: 'archived',
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(mockPage);
      (prisma.websitePage.update as jest.Mock).mockResolvedValue(archivedPage);

      const request = new NextRequest('http://localhost:3000/api/content-items/page-1');
      const response = await DELETEBYID(request, { params: Promise.resolve({ id: 'page-1' }) });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toBeDefined();
      expect(result.data.status).toBe('archived');
      expect(result.data.message).toContain('archived successfully');
      expect(result.data.modelType).toBe('websitePage');
      expect(prisma.websitePage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'page-1' },
          data: { status: 'archived' },
        })
      );
    });

    it('should soft delete websiteCustomContentData by archiving it', async () => {
      const mockData = {
        id: 'data-1',
        websiteId: 'test-site',
        title: 'Data to Archive',
        status: 'published',
      };

      const archivedData = {
        ...mockData,
        status: 'archived',
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(mockData);
      (prisma.websiteCustomContentData.update as jest.Mock).mockResolvedValue(archivedData);

      const request = new NextRequest('http://localhost:3000/api/content-items/data-1');
      const response = await DELETEBYID(request, { params: Promise.resolve({ id: 'data-1' }) });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toBeDefined();
      expect(result.data.status).toBe('archived');
      expect(result.data.message).toContain('archived successfully');
      expect(result.data.modelType).toBe('websiteCustomContentData');
      expect(prisma.websiteCustomContentData.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'data-1' },
          data: { status: 'archived' },
        })
      );
    });

    it('should return 404 when deleting non-existent item', async () => {
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/content-items/non-existent');
      const response = await DELETEBYID(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error.message).toContain('Content item not found');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors', async () => {
      (prisma.websitePage.findMany as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const request = new NextRequest('http://localhost:3000/api/content-items?websiteId=test-site');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('Failed to fetch');
    });

    it('should validate required fields in POST requests', async () => {
      const invalidPage = {
        websiteId: 'test-site',
        // Missing title, slug, content, contentTypeId
      };

      // Create a properly mocked request
      const bodyText = JSON.stringify(invalidPage);
      const request = {
        headers: {
          get: jest.fn((name) => name === 'content-type' ? 'application/json' : null),
        },
        text: jest.fn(() => Promise.resolve(bodyText)),
        json: jest.fn(() => Promise.resolve(invalidPage)),
      } as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('Invalid request body');
    });

    it('should handle malformed JSON in request body', async () => {
      // Create a properly mocked request with invalid JSON
      const request = {
        headers: {
          get: jest.fn((name) => name === 'content-type' ? 'application/json' : null),
        },
        text: jest.fn(() => Promise.resolve('invalid json')),
        json: jest.fn(() => Promise.reject(new Error('Invalid JSON'))),
      } as unknown as NextRequest;

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error.message).toContain('Invalid JSON');
    });

    it('should maintain backward compatibility in response format', async () => {
      const mockPage = {
        id: 'page-1',
        websiteId: 'test-site',
        type: 'page',
        title: 'Test Page',
        content: { components: [] },
        metadata: { seo: { title: 'SEO Title' } },
        contentTypeId: 'page-type',
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        contentType: { id: 'page-type', category: 'page', fields: {} },
        website: { id: 'test-site', metadata: {}, settings: {} },
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(mockPage);

      const request = new NextRequest('http://localhost:3000/api/content-items/page-1');
      const response = await GETBYID(request, { params: Promise.resolve({ id: 'page-1' }) });

      expect(response.status).toBe(200);
      const result = await response.json();
      
      // Verify backward compatible fields are present in data object
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('websiteId');
      expect(result.data).toHaveProperty('title');
      expect(result.data).toHaveProperty('content');
      expect(result.data).toHaveProperty('metadata');
      expect(result.data).toHaveProperty('slug');
      expect(result.data).toHaveProperty('modelType');
    });
  });
});