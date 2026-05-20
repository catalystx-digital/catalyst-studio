import { NextRequest, NextResponse } from 'next/server';
import { middleware } from './middleware';
import { urlResolver } from '@/lib/services/url-resolution/url-resolver';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/services/url-resolution/url-resolver', () => ({
  urlResolver: {
    resolveUrl: jest.fn()
  }
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    redirect: {
      findFirst: jest.fn()
    }
  }
}));

// Mock NextResponse methods
const mockRedirect = jest.fn();
const mockJson = jest.fn();
const mockNext = jest.fn(() => ({
  headers: new Map()
}));

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    next: jest.fn(() => ({
      headers: {
        set: jest.fn()
      }
    })),
    redirect: jest.fn((url, status) => ({ url, status })),
    json: jest.fn((data, options) => ({ data, ...options }))
  }
}));

describe('Middleware', () => {
  const mockWebsiteId = 'default-website-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildRequest = (pathname: string, init?: { headers?: HeadersInit; url?: string; includeWebsiteId?: boolean }) => {
    const headers = new Headers(init?.headers);
    if (init?.includeWebsiteId !== false && !headers.has('x-website-id')) {
      headers.set('x-website-id', mockWebsiteId);
    }

    return {
      nextUrl: { pathname },
      headers,
      ...(init?.url ? { url: init.url } : {}),
    } as unknown as NextRequest;
  };

  describe('bypass paths', () => {
    it.each([
      '/_next/static/chunk.js',
      '/api/pages',
      '/favicon.ico',
      '/robots.txt',
      '/static/image.png',
      '/images/logo.svg',
      '/fonts/font.woff'
    ])('should bypass middleware for %s', async (pathname) => {
      const request = buildRequest(pathname);

      await middleware(request);

      expect(urlResolver.resolveUrl).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalled();
    });
  });

  describe('page resolution', () => {
    it('should resolve valid page paths', async () => {
      const pathname = '/about';
      const mockPage = {
        siteStructure: {
          id: 'page1',
          fullPath: '/about',
          isActive: true
        },
        contentItem: {
          id: 'content1',
          title: 'About'
        }
      };

      (urlResolver.resolveUrl as jest.Mock).mockResolvedValue({
        success: true,
        data: mockPage
      });

      const request = buildRequest(pathname);

      const mockResponse = {
        headers: {
          set: jest.fn()
        }
      };
      (NextResponse.next as jest.Mock).mockReturnValue(mockResponse);

      const response = await middleware(request);

      expect(urlResolver.resolveUrl).toHaveBeenCalledWith(pathname, {
        websiteId: mockWebsiteId,
        caseInsensitive: false
      });

      expect(mockResponse.headers.set).toHaveBeenCalledWith('x-page-id', 'page1');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('x-content-id', 'content1');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('x-page-path', '/about');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('x-resolution-time', expect.any(String));
    });

    it('should handle unpublished pages (soft 404)', async () => {
      const pathname = '/draft';
      const mockPage = {
        siteStructure: {
          id: 'page2',
          fullPath: '/draft',
          isActive: false // Unpublished
        },
        contentItem: null
      };

      (urlResolver.resolveUrl as jest.Mock).mockResolvedValue({
        success: true,
        data: mockPage
      });

      const request = buildRequest(pathname);

      const mockResponse = {
        headers: {
          set: jest.fn()
        }
      };
      (NextResponse.next as jest.Mock).mockReturnValue(mockResponse);

      await middleware(request);

      expect(mockResponse.headers.set).toHaveBeenCalledWith('x-404-type', 'soft');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('x-404-path', pathname);
      expect(mockResponse.headers.set).toHaveBeenCalledWith('x-page-id', 'page2');
    });
  });

  describe('404 handling', () => {
    it('should handle non-existent pages (hard 404)', async () => {
      const pathname = '/nonexistent';

      (urlResolver.resolveUrl as jest.Mock).mockResolvedValue({
        success: true,
        data: null
      });

      (prisma.redirect.findFirst as jest.Mock).mockResolvedValue(null);

      const request = buildRequest(pathname);

      const mockResponse = {
        headers: {
          set: jest.fn()
        }
      };
      (NextResponse.next as jest.Mock).mockReturnValue(mockResponse);

      await middleware(request);

      expect(prisma.redirect.findFirst).toHaveBeenCalledWith({
        where: {
          websiteId: mockWebsiteId,
          sourcePath: pathname,
          isActive: true
        }
      });

      expect(mockResponse.headers.set).toHaveBeenCalledWith('x-404-type', 'hard');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('x-404-path', pathname);
    });
  });

  describe('redirect handling', () => {
    it('should handle 301 permanent redirects', async () => {
      const pathname = '/old-page';
      const targetPath = '/new-page';

      (urlResolver.resolveUrl as jest.Mock).mockResolvedValue({
        success: true,
        data: null
      });

      (prisma.redirect.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          sourcePath: pathname,
          targetPath,
          redirectType: 301,
          isActive: true
        })
        .mockResolvedValueOnce(null); // No further redirects

      const request = buildRequest(pathname, { url: 'http://localhost:3000/old-page' });

      await middleware(request);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL(targetPath, 'http://localhost:3000/old-page'),
        301
      );
    });

    it('should handle 302 temporary redirects', async () => {
      const pathname = '/maintenance';
      const targetPath = '/under-construction';

      (urlResolver.resolveUrl as jest.Mock).mockResolvedValue({
        success: true,
        data: null
      });

      (prisma.redirect.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          sourcePath: pathname,
          targetPath,
          redirectType: 302,
          isActive: true
        })
        .mockResolvedValueOnce(null);

      const request = buildRequest(pathname, { url: 'http://localhost:3000/maintenance' });

      await middleware(request);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL(targetPath, 'http://localhost:3000/maintenance'),
        302
      );
    });

    it('should handle redirect chains (max 3 hops)', async () => {
      const pathname = '/redirect1';

      (urlResolver.resolveUrl as jest.Mock).mockResolvedValue({
        success: true,
        data: null
      });

      (prisma.redirect.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          sourcePath: '/redirect1',
          targetPath: '/redirect2',
          redirectType: 301
        })
        .mockResolvedValueOnce({
          sourcePath: '/redirect2',
          targetPath: '/redirect3',
          redirectType: 301
        })
        .mockResolvedValueOnce({
          sourcePath: '/redirect3',
          targetPath: '/final',
          redirectType: 301
        })
        .mockResolvedValueOnce(null); // /final has no redirect

      const request = buildRequest(pathname, { url: 'http://localhost:3000/redirect1' });

      await middleware(request);

      expect(prisma.redirect.findFirst).toHaveBeenCalledTimes(3);
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/final', 'http://localhost:3000/redirect1'),
        301
      );
    });

    it('should prevent redirect loops', async () => {
      const pathname = '/loop1';

      (urlResolver.resolveUrl as jest.Mock).mockResolvedValue({
        success: true,
        data: null
      });

      (prisma.redirect.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          sourcePath: '/loop1',
          targetPath: '/loop2',
          redirectType: 301
        })
        .mockResolvedValueOnce({
          sourcePath: '/loop2',
          targetPath: '/loop1', // Loop back
          redirectType: 301
        });

      const request = buildRequest(pathname, { url: 'http://localhost:3000/loop1' });

      await middleware(request);

      // Should stop at the loop detection
      expect(NextResponse.redirect).toHaveBeenCalledWith(
        new URL('/loop2', 'http://localhost:3000/loop1'),
        301
      );
    });
  });

  describe('error handling', () => {
    it('should handle URL validation errors', async () => {
      const pathname = '/../etc/passwd';

      (urlResolver.resolveUrl as jest.Mock).mockResolvedValue({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Path traversal detected'
        }
      });

      const request = buildRequest(pathname);

      await middleware(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: { code: 'VALIDATION_ERROR', message: 'Path traversal detected' } },
        { status: 400 }
      );
    });

    it('should continue on middleware errors', async () => {
      const pathname = '/about';

      (urlResolver.resolveUrl as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = buildRequest(pathname);

      await middleware(request);

      expect(NextResponse.next).toHaveBeenCalled();
    });

    it('should continue if redirect check fails', async () => {
      const pathname = '/nonexistent';

      (urlResolver.resolveUrl as jest.Mock).mockResolvedValue({
        success: true,
        data: null
      });

      (prisma.redirect.findFirst as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = buildRequest(pathname);

      const mockResponse = {
        headers: {
          set: jest.fn()
        }
      };
      (NextResponse.next as jest.Mock).mockReturnValue(mockResponse);

      await middleware(request);

      // Should still return 404 headers even if redirect check fails
      expect(mockResponse.headers.set).toHaveBeenCalledWith('x-404-type', 'hard');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('x-404-path', pathname);
    });
  });

  describe('performance', () => {
    it('should add resolution time header', async () => {
      const pathname = '/about';
      const mockPage = {
        siteStructure: {
          id: 'page1',
          fullPath: '/about',
          isActive: true
        },
        contentItem: { id: 'content1' }
      };

      (urlResolver.resolveUrl as jest.Mock).mockResolvedValue({
        success: true,
        data: mockPage
      });

      const request = buildRequest(pathname);

      const mockResponse = {
        headers: {
          set: jest.fn()
        }
      };
      (NextResponse.next as jest.Mock).mockReturnValue(mockResponse);

      await middleware(request);

      expect(mockResponse.headers.set).toHaveBeenCalledWith(
        'x-resolution-time',
        expect.any(String)
      );

      // Verify the time is a valid number
      const timeCall = (mockResponse.headers.set as jest.Mock).mock.calls.find(
        call => call[0] === 'x-resolution-time'
      );
      expect(parseInt(timeCall[1])).toBeGreaterThanOrEqual(0);
    });
  });
});