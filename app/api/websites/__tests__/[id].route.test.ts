/**
 * Test suite for /api/websites/[id] dynamic route handlers
 * Updated for Next.js 15 App Router compatibility:
 * - Async params handling with Promise<{ id: string }>
 * - Proper NextRequest mocking for different HTTP methods
 * - Console error suppression for expected errors
 * - Enhanced error testing with Prisma error codes
 */
import { GET, PUT, DELETE } from '../[id]/route';
import { getClient } from '@/lib/db/client';
import { createTestRequest, createTestParams, suppressConsoleError, restoreConsoleError } from './test-helpers';
import { deleteWebsiteWithDependencies } from '@/lib/services/website-delete-service';

// Mock Prisma client
jest.mock('@/lib/db/client', () => ({
  getClient: jest.fn()
}));

jest.mock('@/lib/services/website-delete-service', () => ({
  deleteWebsiteWithDependencies: jest.fn()
}));

describe('/api/websites/[id]', () => {
  // Mock global Response for Next.js 15
  beforeAll(() => {
    global.Response = Response;
  });
  let mockPrisma: {
    website: {
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  const params = createTestParams({ id: 'test-id' });

  beforeEach(() => {
    mockPrisma = {
      website: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }
    };
    (getClient as jest.Mock).mockReturnValue(mockPrisma);
    suppressConsoleError();
  });

  afterEach(() => {
    jest.clearAllMocks();
    restoreConsoleError();
  });

  describe('GET /api/websites/[id]', () => {
    it('should return a single website', async () => {
      const mockWebsite = {
        id: 'test-id',
        name: 'Test Website',
        description: 'Test description',
        category: 'test',
        metadata: JSON.stringify({ test: true }),
        settings: JSON.stringify({ primaryColor: '#000' }),
        icon: '🌐',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.website.findUnique.mockResolvedValue(mockWebsite);

      const request = createTestRequest(undefined, 'http://localhost:3000/api/websites/test-id', 'GET');
      const response = await GET(request, { params });
      const data = await response.json();

      expect(mockPrisma.website.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' }
      });

      expect(data).toEqual({
        data: {
          ...mockWebsite,
          createdAt: mockWebsite.createdAt.toISOString(),
          updatedAt: mockWebsite.updatedAt.toISOString(),
          metadata: { test: true },
          settings: { primaryColor: '#000' }
        }
      });
    });

    it('should return 404 if website not found', async () => {
      mockPrisma.website.findUnique.mockResolvedValue(null);

      const request = createTestRequest(undefined, 'http://localhost:3000/api/websites/test-id', 'GET');
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/websites/[id]', () => {
    it('should update a website', async () => {
      const updateData = {
        name: 'Updated Website',
        settings: { primaryColor: '#ff0000' }
      };

      const existingWebsite = {
        id: 'test-id',
        name: 'Old Name',
        isActive: true
      };

      const updatedWebsite = {
        ...existingWebsite,
        ...updateData,
        settings: JSON.stringify(updateData.settings),
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.website.findUnique.mockResolvedValue(existingWebsite);
      mockPrisma.website.update.mockResolvedValue(updatedWebsite);

      const request = createTestRequest(updateData, 'http://localhost:3000/api/websites/test-id', 'PUT');

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(mockPrisma.website.update).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        data: expect.objectContaining({
          name: 'Updated Website',
          settings: JSON.stringify(updateData.settings)
        })
      });

      expect(data).toEqual({
        data: {
          ...updatedWebsite,
          createdAt: updatedWebsite.createdAt.toISOString(),
          updatedAt: updatedWebsite.updatedAt.toISOString(),
          metadata: null,
          settings: updateData.settings
        }
      });
    });

    it('should return 404 if website to update not found', async () => {
      mockPrisma.website.findUnique.mockResolvedValue(null);

      const request = createTestRequest({ name: 'Updated' }, 'http://localhost:3000/api/websites/test-id', 'PUT');

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should handle validation errors on update', async () => {
      const existingWebsite = {
        id: 'test-id',
        name: 'Old Name',
        isActive: true
      };

      mockPrisma.website.findUnique.mockResolvedValue(existingWebsite);

      const invalidUpdate = {
        name: '' // Invalid empty name
      };

      const request = createTestRequest(invalidUpdate, 'http://localhost:3000/api/websites/test-id', 'PUT');

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/websites/[id]', () => {
    it('should delete a website and cascade related data', async () => {
      (deleteWebsiteWithDependencies as jest.Mock).mockResolvedValue(undefined);

      const request = createTestRequest(undefined, 'http://localhost:3000/api/websites/test-id', 'DELETE');

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(deleteWebsiteWithDependencies).toHaveBeenCalledWith(mockPrisma, 'test-id');

      expect(data).toEqual({
        data: { message: 'Website deleted successfully' }
      });
    });

    it('should return 404 if website to delete not found', async () => {
      (deleteWebsiteWithDependencies as jest.Mock).mockRejectedValue({ code: 'P2025' });

      const request = createTestRequest(undefined, 'http://localhost:3000/api/websites/test-id', 'DELETE');

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });
});
