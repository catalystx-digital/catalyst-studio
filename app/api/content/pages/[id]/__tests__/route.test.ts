import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from '../route';
import { PageService } from '@/lib/services/page-service';
import {
  MockPageService,
  MockConstructor
} from '@/lib/test-utils/mock-types';

// Mock dependencies
jest.mock('@/lib/services/page-service');

describe('/api/content/pages/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return a page by id', async () => {
      const mockPageService = {
        getPage: jest.fn().mockResolvedValue({
          id: 'page-1',
          title: 'Test Page',
          type: 'page',
          status: 'draft',
          content: { components: [] },
        }),
      };
      (PageService as MockConstructor<MockPageService>).mockImplementation(() => mockPageService);

      const request = new NextRequest('http://localhost:3000/api/content/pages/page-1');
      const response = await GET(request, { params: { id: 'page-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('page-1');
      expect(mockPageService.getPage).toHaveBeenCalledWith('page-1');
    });

    it('should return 404 for non-existent page', async () => {
      const mockPageService = {
        getPage: jest.fn().mockResolvedValue(null),
      };
      (PageService as MockConstructor<MockPageService>).mockImplementation(() => mockPageService);

      const request = new NextRequest('http://localhost:3000/api/content/pages/invalid-id');
      const response = await GET(request, { params: { id: 'invalid-id' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Page not found');
    });

    it('should return 400 when id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/content/pages/');
      const response = await GET(request, { params: { id: '' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Page ID is required');
    });

    it('should handle server errors', async () => {
      const mockPageService = {
        getPage: jest.fn().mockRejectedValue(new Error('Database error')),
      };
      (PageService as MockConstructor<MockPageService>).mockImplementation(() => mockPageService);

      const request = new NextRequest('http://localhost:3000/api/content/pages/page-1');
      const response = await GET(request, { params: { id: 'page-1' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('PUT', () => {
    it('should update a page successfully', async () => {
      const mockPageService = {
        getPage: jest.fn().mockResolvedValue({ id: 'page-1', title: 'Old Title' }),
        updatePage: jest.fn().mockResolvedValue({
          id: 'page-1',
          title: 'Updated Title',
          status: 'published',
        }),
      };
      (PageService as MockConstructor<MockPageService>).mockImplementation(() => mockPageService);

      const request = new NextRequest('http://localhost:3000/api/content/pages/page-1', {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Updated Title',
          status: 'published',
        }),
      });

      const response = await PUT(request, { params: { id: 'page-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe('Updated Title');
      expect(mockPageService.updatePage).toHaveBeenCalledWith('page-1', expect.objectContaining({
        title: 'Updated Title',
        status: 'published',
      }));
    });

    it('should return 404 when updating non-existent page', async () => {
      const mockPageService = {
        getPage: jest.fn().mockResolvedValue(null),
      };
      (PageService as MockConstructor<MockPageService>).mockImplementation(() => mockPageService);

      const request = new NextRequest('http://localhost:3000/api/content/pages/invalid-id', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated' }),
      });

      const response = await PUT(request, { params: { id: 'invalid-id' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Page not found');
    });

    it('should handle validation errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/content/pages/page-1', {
        method: 'PUT',
        body: JSON.stringify({ status: 'invalid-status' }),
      });

      const response = await PUT(request, { params: { id: 'page-1' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Invalid request body');
    });
  });

  describe('DELETE', () => {
    it('should delete a page successfully', async () => {
      const mockPageService = {
        getPage: jest.fn().mockResolvedValue({ id: 'page-1', title: 'Page to Delete' }),
        deletePage: jest.fn().mockResolvedValue(undefined),
      };
      (PageService as MockConstructor<MockPageService>).mockImplementation(() => mockPageService);

      const request = new NextRequest('http://localhost:3000/api/content/pages/page-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: 'page-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Page deleted successfully');
      expect(mockPageService.deletePage).toHaveBeenCalledWith('page-1');
    });

    it('should return 404 when deleting non-existent page', async () => {
      const mockPageService = {
        getPage: jest.fn().mockResolvedValue(null),
      };
      (PageService as MockConstructor<MockPageService>).mockImplementation(() => mockPageService);

      const request = new NextRequest('http://localhost:3000/api/content/pages/invalid-id', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: 'invalid-id' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Page not found');
    });

    it('should handle deletion errors', async () => {
      const mockPageService = {
        getPage: jest.fn().mockResolvedValue({ id: 'page-1' }),
        deletePage: jest.fn().mockRejectedValue(new Error('Cannot delete page with children')),
      };
      (PageService as MockConstructor<MockPageService>).mockImplementation(() => mockPageService);

      const request = new NextRequest('http://localhost:3000/api/content/pages/page-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: 'page-1' } });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Cannot delete page with children');
    });
  });
});