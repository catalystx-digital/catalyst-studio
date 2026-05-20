import { listContentItems } from '../list-content-items';
import { getClient } from '@/lib/db/client';
import { getPageCatalogSummary } from '@/lib/studio/pages/catalog';

jest.mock('@/lib/db/client', () => ({
  getClient: jest.fn()
}));

jest.mock('@/lib/studio/pages/catalog', () => ({
  getPageCatalogSummary: jest.fn()
}));

describe('AI Tools - List Content Items', () => {
  let mockPrisma: any;
  let templateSummaryMock: any;

  beforeEach(() => {
    jest.clearAllMocks();

    templateSummaryMock = {
      total: 3,
      generatedAt: new Date('2024-01-01').toISOString(),
      templates: [],
      categories: [],
      homeEligibleTemplates: []
    };

    (getPageCatalogSummary as jest.Mock).mockResolvedValue(templateSummaryMock);

    mockPrisma = {
      websitePage: {
        findMany: jest.fn(),
        count: jest.fn()
      },
      websiteCustomContentData: {
        findMany: jest.fn(),
        count: jest.fn()
      }
    };
    
    (getClient as jest.Mock).mockReturnValue(mockPrisma);
  });

  it('should query both websitePage and websiteCustomContentData models', async () => {
    const mockPages = [
      {
        id: 'page1',
        title: 'Test Page',
        type: 'page',
        content: { components: [] },
        metadata: {},
        websiteId: 'website1',
        contentTypeId: 'contentType1',
        status: 'published',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        contentType: {
          id: 'contentType1',
          name: 'Page',
          fields: {},
          category: 'page'
        },
        website: {
          id: 'website1',
          name: 'Test Website',
          category: 'business'
        }
      }
    ];

    const mockCustomContent = [
      {
        id: 'custom1',
        title: 'Test Custom Content',
        data: { field1: 'value1' },
        websiteId: 'website1',
        contentTypeId: 'contentType2',
        status: 'draft',
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-04'),
        contentType: {
          id: 'contentType2',
          name: 'Custom',
          fields: {},
          category: 'component'
        },
        website: {
          id: 'website1',
          name: 'Test Website',
          category: 'business'
        }
      }
    ];

    mockPrisma.websitePage.findMany.mockResolvedValue(mockPages);
    mockPrisma.websitePage.count.mockResolvedValue(1);
    mockPrisma.websiteCustomContentData.findMany.mockResolvedValue(mockCustomContent);
    mockPrisma.websiteCustomContentData.count.mockResolvedValue(1);

    const result = await listContentItems.execute({
      websiteId: 'website1',
      limit: 10,
      page: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });

    expect(getPageCatalogSummary).toHaveBeenCalledTimes(1);
    expect(result.templates).toEqual(templateSummaryMock);

    expect(result.success).toBe(true);
    expect(result.templates).toEqual(templateSummaryMock);
    expect(result.items).toHaveLength(2);
    expect(result.pagination.total).toBe(2);
    
    expect(mockPrisma.websitePage.findMany).toHaveBeenCalledWith({
      where: { websiteId: 'website1' },
      skip: 0,
      take: 10,
      orderBy: { updatedAt: 'desc' },
      include: {
        contentType: true,
        website: true
      }
    });
    
    expect(mockPrisma.websiteCustomContentData.findMany).toHaveBeenCalledWith({
      where: { websiteId: 'website1' },
      skip: 0,
      take: 10,
      orderBy: { updatedAt: 'desc' },
      include: {
        contentType: true,
        website: true
      }
    });
  });

  it('should include modelType field in response', async () => {
    const mockPage = {
      id: 'page1',
      title: 'Test Page',
      type: 'page',
      content: { components: [] },
      metadata: {},
      websiteId: 'website1',
      contentTypeId: 'contentType1',
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date(),
      contentType: {
        id: 'contentType1',
        name: 'Page',
        fields: {},
        category: 'page'
      },
      website: {
        id: 'website1',
        name: 'Test Website',
        category: 'business'
      }
    };

    mockPrisma.websitePage.findMany.mockResolvedValue([mockPage]);
    mockPrisma.websitePage.count.mockResolvedValue(1);
    mockPrisma.websiteCustomContentData.findMany.mockResolvedValue([]);
    mockPrisma.websiteCustomContentData.count.mockResolvedValue(0);

    const result = await listContentItems.execute({
      limit: 10,
      page: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });

    expect(result.success).toBe(true);
    expect(result.templates).toEqual(templateSummaryMock);
    expect(result.items[0].modelType).toBe('page');
  });

  it('should handle filtering by contentTypeId', async () => {
    mockPrisma.websitePage.findMany.mockResolvedValue([]);
    mockPrisma.websitePage.count.mockResolvedValue(0);
    mockPrisma.websiteCustomContentData.findMany.mockResolvedValue([]);
    mockPrisma.websiteCustomContentData.count.mockResolvedValue(0);

    const result = await listContentItems.execute({
      contentTypeId: 'contentType1',
      limit: 10,
      page: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });

    expect(result.templates).toEqual(templateSummaryMock);

    expect(mockPrisma.websitePage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contentTypeId: 'contentType1' }
      })
    );
    
    expect(mockPrisma.websiteCustomContentData.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contentTypeId: 'contentType1' }
      })
    );
  });

  it('should handle filtering by status', async () => {
    mockPrisma.websitePage.findMany.mockResolvedValue([]);
    mockPrisma.websitePage.count.mockResolvedValue(0);
    mockPrisma.websiteCustomContentData.findMany.mockResolvedValue([]);
    mockPrisma.websiteCustomContentData.count.mockResolvedValue(0);

    const result = await listContentItems.execute({
      status: 'published',
      limit: 10,
      page: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });

    expect(result.templates).toEqual(templateSummaryMock);

    expect(mockPrisma.websitePage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published' }
      })
    );
    
    expect(mockPrisma.websiteCustomContentData.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published' }
      })
    );
  });

  it('should handle pagination correctly', async () => {
    mockPrisma.websitePage.findMany.mockResolvedValue([]);
    mockPrisma.websitePage.count.mockResolvedValue(50);
    mockPrisma.websiteCustomContentData.findMany.mockResolvedValue([]);
    mockPrisma.websiteCustomContentData.count.mockResolvedValue(30);

    const result = await listContentItems.execute({
      limit: 20,
      page: 2,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });

    expect(result.success).toBe(true);
    expect(result.templates).toEqual(templateSummaryMock);
    expect(result.pagination.total).toBe(80);
    expect(result.pagination.totalPages).toBe(4);
    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.hasPrev).toBe(true);
    
    expect(mockPrisma.websitePage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20
      })
    );
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Database connection failed');
    mockPrisma.websitePage.findMany.mockRejectedValue(error);

    const result = await listContentItems.execute({
      limit: 10,
      page: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database connection failed');
    expect(result.templates).toBeNull();
    expect(result.executionTime).toBeDefined();
  });

  it('should sort merged results correctly', async () => {
    const mockPages = [
      {
        id: 'page1',
        title: 'Old Page',
        type: 'page',
        content: {},
        metadata: {},
        websiteId: 'website1',
        contentTypeId: 'contentType1',
        status: 'published',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        contentType: { id: 'ct1', name: 'Page', fields: {}, category: 'page' },
        website: { id: 'w1', name: 'Website', category: 'business' }
      }
    ];

    const mockCustomContent = [
      {
        id: 'custom1',
        title: 'New Custom',
        data: {},
        websiteId: 'website1',
        contentTypeId: 'contentType2',
        status: 'draft',
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-05'),
        contentType: { id: 'ct2', name: 'Custom', fields: {}, category: 'component' },
        website: { id: 'w1', name: 'Website', category: 'business' }
      }
    ];

    mockPrisma.websitePage.findMany.mockResolvedValue(mockPages);
    mockPrisma.websitePage.count.mockResolvedValue(1);
    mockPrisma.websiteCustomContentData.findMany.mockResolvedValue(mockCustomContent);
    mockPrisma.websiteCustomContentData.count.mockResolvedValue(1);

    const result = await listContentItems.execute({
      limit: 10,
      page: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });

    expect(result.success).toBe(true);
    expect(result.templates).toEqual(templateSummaryMock);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('custom1');
    expect(result.items[1].id).toBe('page1');
  });
});





