import { NextRequest } from 'next/server';
import { GET } from './route';
import { pageOrchestrator } from '@/lib/services/site-structure/page-orchestrator';
import { prisma } from '@/lib/prisma';
import { ErrorCode } from '@/lib/services/types';

jest.mock('@/lib/services/site-structure/page-orchestrator', () => ({
  pageOrchestrator: {
    resolveUrl: jest.fn()
  }
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    contentItem: {
      findUnique: jest.fn()
    },
    siteStructure: {
      findMany: jest.fn()
    }
  }
}));

describe('GET /api/pages/resolve', () => {
  const mockWebsiteId = 'test-website-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildRequest = (url: string, options?: { headers?: HeadersInit; includeWebsiteId?: boolean }) => {
    const headers = new Headers(options?.headers);
    if (options?.includeWebsiteId !== false && !headers.has('x-website-id')) {
      headers.set('x-website-id', mockWebsiteId);
    }
    return new NextRequest(url, { headers });
  };

  describe('validation', () => {
    it('should require website ID', async () => {
      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/test',
        { includeWebsiteId: false }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(data.error.message).toContain('Website ID is required');
    });

    it('should accept website ID from header', async () => {
      const mockPage = {
        id: 'page1',
        fullPath: '/test',
        slug: 'test',
        depth: 1
      };

      (pageOrchestrator.resolveUrl as jest.Mock).mockResolvedValue(mockPage);

      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/test',
        { headers: { 'x-website-id': 'custom-website' }, includeWebsiteId: false }
      );

      const response = await GET(request);
      
      expect(pageOrchestrator.resolveUrl).toHaveBeenCalledWith('/test', 'custom-website');
      expect(response.status).toBe(200);
    });

    it('should require path parameter', async () => {
      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(data.error.message).toContain('Path parameter is required');
    });

    it('should reject path traversal attempts', async () => {
      const maliciousPaths = [
        '../etc/passwd',
        '../../private',
        './hidden',
        '/..',
        '/path/../../../etc'
      ];

      for (const path of maliciousPaths) {
        const request = buildRequest(
          `http://localhost:3000/api/pages/resolve?path=${encodeURIComponent(path)}`
        );

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(data.error.message).toContain('traversal');
      }
    });

    it('should reject paths with invalid characters', async () => {
      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/path<script>'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('invalid characters');
    });
  });

  describe('resolution', () => {
    it('should resolve existing page', async () => {
      const mockPage = {
        id: 'page1',
        fullPath: '/about',
        slug: 'about',
        parentId: null,
        depth: 1,
        position: 0,
        isActive: true,
        contentItemId: 'content1',
        websiteId: mockWebsiteId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (pageOrchestrator.resolveUrl as jest.Mock).mockResolvedValue(mockPage);

      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/about'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.pageId).toBe('page1');
      expect(data.data.path).toBe('/about');
      expect(data.data.slug).toBe('about');
    });

    it('should return 404 for non-existent page', async () => {
      (pageOrchestrator.resolveUrl as jest.Mock).mockResolvedValue(null);

      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/nonexistent'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ErrorCode.NOT_FOUND);
      expect(data.error.message).toContain('Page not found');
    });
  });

  describe('include parameters', () => {
    const mockPage = {
      id: 'page1',
      fullPath: '/test',
      slug: 'test',
      parentId: 'parent1',
      depth: 2,
      position: 1,
      isActive: true,
      contentItemId: 'content1',
      websiteId: mockWebsiteId,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02')
    };

    beforeEach(() => {
      (pageOrchestrator.resolveUrl as jest.Mock).mockResolvedValue(mockPage);
    });

    it('should include content when requested', async () => {
      const mockContent = {
        id: 'content1',
        title: 'Test Page',
        slug: 'test-page',
        data: { body: 'Content' },
        publishedAt: new Date(),
        status: 'published'
      };

      (prisma.contentItem.findUnique as jest.Mock).mockResolvedValue(mockContent);

      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/test&include=content'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.content).toBeDefined();
      expect(data.data.content.id).toBe('content1');
      expect(data.data.content.title).toBe('Test Page');
    });

    it('should include structure when requested', async () => {
      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/test&include=structure'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.structure).toBeDefined();
      expect(data.data.structure.parentId).toBe('parent1');
      expect(data.data.structure.depth).toBe(2);
      expect(data.data.structure.position).toBe(1);
    });

    it('should include children when requested', async () => {
      const mockChildren = [
        { id: 'child1', slug: 'child-1', fullPath: '/test/child-1', position: 0 },
        { id: 'child2', slug: 'child-2', fullPath: '/test/child-2', position: 1 }
      ];

      (prisma.siteStructure.findMany as jest.Mock).mockResolvedValue(mockChildren);

      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/test&include=children'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.children).toBeDefined();
      expect(data.data.children.length).toBe(2);
      expect(data.data.children[0].slug).toBe('child-1');
    });

    it('should include metadata when requested', async () => {
      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/test&include=meta'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.meta).toBeDefined();
      expect(data.data.meta.websiteId).toBe(mockWebsiteId);
      expect(data.data.meta.contentItemId).toBe('content1');
      expect(data.data.meta.createdAt).toBeDefined();
    });

    it('should support multiple include params', async () => {
      (prisma.contentItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'content1',
        title: 'Test'
      });
      (prisma.siteStructure.findMany as jest.Mock).mockResolvedValue([]);

      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/test&include=content,structure,children,meta'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.content).toBeDefined();
      expect(data.data.structure).toBeDefined();
      expect(data.data.children).toBeDefined();
      expect(data.data.meta).toBeDefined();
    });

    it('should use default includes when not specified', async () => {
      (prisma.contentItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'content1',
        title: 'Test'
      });

      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/test'
      );

      const response = await GET(request);
      const data = await response.json();

      // Default includes content and structure
      expect(data.data.content).toBeDefined();
      expect(data.data.structure).toBeDefined();
      // But not children or meta
      expect(data.data.children).toBeUndefined();
      expect(data.data.meta).toBeUndefined();
    });
  });

  describe('performance', () => {
    it('should include performance metrics', async () => {
      (pageOrchestrator.resolveUrl as jest.Mock).mockResolvedValue({
        id: 'page1',
        fullPath: '/test',
        slug: 'test'
      });

      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/test'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.meta).toBeDefined();
      expect(data.meta.duration).toMatch(/\d+ms/);
    });

    it('should complete within 100ms', async () => {
      (pageOrchestrator.resolveUrl as jest.Mock).mockResolvedValue({
        id: 'page1',
        fullPath: '/test',
        slug: 'test'
      });

      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/test'
      );

      const start = Date.now();
      await GET(request);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      (pageOrchestrator.resolveUrl as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = buildRequest(
        'http://localhost:3000/api/pages/resolve?path=/test'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(data.error.details.error).toContain('Database connection failed');
    });
  });
});