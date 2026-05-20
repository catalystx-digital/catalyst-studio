import { GET } from '../impact/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    websiteSharedComponent: {
      findUnique: jest.fn()
    },
    websitePage: {
      findMany: jest.fn()
    },
    websiteStructure: {
      findMany: jest.fn()
    },
    websiteCustomContentData: {
      findMany: jest.fn()
    }
  }
}));

describe('Impact Analysis API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should analyze impact for a global component', async () => {
    const mockSharedComponent = {
      id: 'comp-123',
      name: 'Header',
      componentTypeId: 'type-header',
      websiteId: 'website-1',
      props: {},
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    };

    // Note: Usage is now tracked within page content, not a separate table

    const mockPages = [
      {
        id: 'page-1',
        title: 'Home',
        slug: 'home',
        websiteId: 'website-1',
        content: {
          components: [
            { id: '1', type: 'shared', sharedComponentId: 'comp-123' }
          ]
        },
        status: 'published',
        updatedAt: new Date('2024-01-01'),
        publishedAt: new Date('2024-01-01')
      },
      {
        id: 'page-2',
        title: 'About',
        slug: 'about',
        websiteId: 'website-1',
        content: {
          components: [
            { id: '2', type: 'shared', sharedComponentId: 'comp-123', overrides: { color: 'red' } }
          ]
        },
        status: 'draft',
        updatedAt: new Date('2024-01-02'),
        publishedAt: null
      }
    ];

    const mockSiteStructures = [
      { websitePageId: 'page-1', fullPath: '/', websiteId: 'website-1' },
      { websitePageId: 'page-2', fullPath: '/about', websiteId: 'website-1' }
    ];

    (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockSharedComponent);
    (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(mockPages);
    (prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(mockSiteStructures);
    (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/global-components/comp-123/impact');
    const response = await GET(request, { params: Promise.resolve({ id: 'comp-123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.affectedPages).toHaveLength(2);
    expect(data.affectedPages[0]).toMatchObject({
      id: 'page-1',
      title: 'Home',
      path: '/',
      status: 'published',
      isPublished: true,
      hasOverrides: false
    });
    expect(data.affectedPages[1]).toMatchObject({
      id: 'page-2',
      title: 'About',
      path: '/about',
      status: 'draft',
      isPublished: false,
      hasOverrides: true
    });
    expect(data).toMatchObject({
      totalCount: 2,
      publishedCount: 1,
      statusCounts: {
        published: 1,
        draft: 1
      },
      severity: 'low',
      draftCount: 1
    });
  });

  it('should return 404 when global component not found', async () => {
    (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/global-components/non-existent/impact');
    const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Global component not found' });
  });

  it('should calculate severity based on published page count', async () => {
    const mockSharedComponent = {
      id: 'comp-123',
      name: 'Header',
      componentTypeId: 'type-header',
      websiteId: 'website-1',
      props: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Usage is now tracked within page content

    const createMockPages = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `page-${i}`,
        title: `Page ${i}`,
        slug: `page-${i}`,
        websiteId: 'website-1',
        content: {
          components: [
            { id: `comp-${i}`, type: 'shared', sharedComponentId: 'comp-123' }
          ]
        },
        status: 'published',
        updatedAt: new Date(),
        publishedAt: new Date()
      }));

    // Test high severity (>10 published pages)
    (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockSharedComponent);
    (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(createMockPages(15));
    (prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/global-components/comp-123/impact');
    const response = await GET(request, { params: Promise.resolve({ id: 'comp-123' }) });
    const data = await response.json();

    expect(data.severity).toBe('high');
    expect(data.publishedCount).toBe(15);
  });

  it('should handle components with no usages', async () => {
    const mockSharedComponent = {
      id: 'comp-123',
      name: 'Unused Component',
      componentTypeId: 'type-section',
      websiteId: 'website-1',
      props: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockSharedComponent);
    (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/global-components/comp-123/impact');
    const response = await GET(request, { params: Promise.resolve({ id: 'comp-123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      affectedPages: [],
      totalCount: 0,
      publishedCount: 0,
      statusCounts: {},
      severity: 'low'
    });
  });
});