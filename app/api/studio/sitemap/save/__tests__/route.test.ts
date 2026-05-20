import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { pageOrchestrator } from '@/lib/services/site-structure/page-orchestrator';
import { siteStructureService } from '@/lib/services/site-structure/site-structure-service';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    websiteStructure: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    websitePage: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    contentType: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/site-structure/page-orchestrator', () => ({
  pageOrchestrator: {
    createPage: jest.fn(),
  },
}));

jest.mock('@/lib/services/site-structure/site-structure-service', () => ({
  siteStructureService: {
    create: jest.fn(),
    update: jest.fn(),
    moveNode: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('POST /api/studio/sitemap/save', () => {
  let consoleErrorSpy: jest.SpyInstance;
  const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
  const mockedOrchestrator = pageOrchestrator as jest.Mocked<typeof pageOrchestrator>;
  const mockedSiteStructureService = siteStructureService as jest.Mocked<typeof siteStructureService>;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.clearAllMocks();

    mockedPrisma.$transaction.mockImplementation(async (callback: any) => {
      return await callback();
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('rejects creating a second Home page', async () => {
    mockedPrisma.websiteStructure.findMany.mockResolvedValueOnce([
      {
        slug: 'home',
        fullPath: '/',
        websitePage: { title: 'Home', metadata: { pageType: 'Home' } },
      } as any,
    ]);
    mockedPrisma.websitePage.findMany.mockResolvedValueOnce([]);
    mockedPrisma.contentType.findUnique.mockResolvedValue({ id: 'ct-home', websiteId: 'site-123' } as any);

    const body = {
      websiteId: 'site-123',
      operations: [
        {
          type: 'CREATE' as const,
          data: {
            title: 'Home',
            slug: 'home',
            parentId: null,
            contentTypeId: 'ct-home',
            contentTypeCategory: 'page' as const,
            components: [{ id: 'c1', type: 'hero', props: {} }],
            metadata: { pageType: 'Home' },
          },
        },
      ],
    };

    const request = new NextRequest('http://localhost/api/studio/sitemap/save', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(false);
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0].success).toBe(false);
    expect(payload.results[0].error).toBe('Home page already exists for this site');
    expect(mockedOrchestrator.createPage).not.toHaveBeenCalled();
  });

  it('rejects creating a second Home page with alternate naming', async () => {
    mockedPrisma.websiteStructure.findMany.mockResolvedValueOnce([
      {
        slug: 'home',
        fullPath: '/',
        websitePage: { title: 'Home', metadata: { pageType: 'Home' } },
      } as any,
    ]);
    mockedPrisma.websitePage.findMany.mockResolvedValueOnce([]);
    mockedPrisma.contentType.findUnique.mockResolvedValue({ id: 'ct-home', websiteId: 'site-123' } as any);

    const body = {
      websiteId: 'site-123',
      operations: [
        {
          type: 'CREATE' as const,
          data: {
            title: 'Homepage',
            slug: 'home-page',
            parentId: null,
            contentTypeId: 'ct-home',
            contentTypeCategory: 'page' as const,
            components: [{ id: 'c1', type: 'hero', props: {} }],
            metadata: { pageType: 'Home Page' },
          },
        },
      ],
    };

    const request = new NextRequest('http://localhost/api/studio/sitemap/save', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(false);
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0].success).toBe(false);
    expect(payload.results[0].error).toBe('Home page already exists for this site');
    expect(mockedOrchestrator.createPage).not.toHaveBeenCalled();
  });

  it('allows Home creation when none exists', async () => {
    mockedPrisma.websiteStructure.findMany.mockResolvedValueOnce([]);
    mockedPrisma.websitePage.findMany.mockResolvedValueOnce([]);
    mockedPrisma.contentType.findUnique.mockResolvedValueOnce({ id: 'ct-home', websiteId: 'site-123' } as any);
    mockedOrchestrator.createPage.mockResolvedValueOnce({ websiteStructure: { id: 'struct-1' } } as any);

    const body = {
      websiteId: 'site-123',
      operations: [
        {
          type: 'CREATE' as const,
          data: {
            title: 'Home',
            slug: 'home',
            parentId: null,
            contentTypeId: 'ct-home',
            contentTypeCategory: 'page' as const,
            components: [{ id: 'c1', type: 'hero', props: {} }],
            metadata: { pageType: 'Home' },
          },
        },
      ],
    };

    const request = new NextRequest('http://localhost/api/studio/sitemap/save', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.results[0].success).toBe(true);
    expect(mockedOrchestrator.createPage).toHaveBeenCalledTimes(1);
  });
  it('rejects updating a page to become Home when a Home already exists', async () => {
    mockedPrisma.websiteStructure.findUnique.mockResolvedValueOnce({
      id: 'node-2',
      parentId: null,
      slug: 'about',
      title: 'About',
      websitePageId: 'page-2',
      websitePage: { id: 'page-2', title: 'About', metadata: {} },
    } as any);
    mockedPrisma.websiteStructure.findMany.mockResolvedValueOnce([
      {
        id: 'home-1',
        slug: 'home',
        fullPath: '/',
        websitePage: { id: 'page-home', title: 'Home', metadata: { pageType: 'Home' } },
      } as any,
    ]);
    mockedPrisma.websitePage.findMany.mockResolvedValueOnce([]);

    const body = {
      websiteId: 'site-123',
      operations: [
        {
          type: 'UPDATE' as const,
          nodeId: 'node-2',
          data: {
            metadata: { pageType: 'Home' },
          },
        },
      ],
    };

    const request = new NextRequest('http://localhost/api/studio/sitemap/save', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(false);
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0].success).toBe(false);
    expect(payload.results[0].error).toBe('Home page already exists for this site');
    expect(mockedSiteStructureService.update).not.toHaveBeenCalled();
  });

  it('rejects updating a nested page to become Home', async () => {
    mockedPrisma.websiteStructure.findUnique.mockResolvedValueOnce({
      id: 'node-3',
      parentId: 'parent-1',
      slug: 'services',
      title: 'Services',
      websitePageId: 'page-3',
      websitePage: { id: 'page-3', title: 'Services', metadata: {} },
    } as any);
    mockedPrisma.websiteStructure.findMany.mockResolvedValueOnce([]);
    mockedPrisma.websitePage.findMany.mockResolvedValueOnce([]);

    const body = {
      websiteId: 'site-123',
      operations: [
        {
          type: 'UPDATE' as const,
          nodeId: 'node-3',
          data: {
            metadata: { pageType: 'Home' },
          },
        },
      ],
    };

    const request = new NextRequest('http://localhost/api/studio/sitemap/save', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(false);
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0].success).toBe(false);
    expect(payload.results[0].error).toBe('Home page must be created at the root level');
    expect(mockedSiteStructureService.update).not.toHaveBeenCalled();
  });

  it('allows updating the existing Home page', async () => {
    mockedPrisma.websiteStructure.findUnique.mockResolvedValueOnce({
      id: 'home-1',
      parentId: null,
      slug: 'home',
      title: 'Home',
      websitePageId: 'page-home',
      websitePage: { id: 'page-home', title: 'Home', metadata: { pageType: 'Home' } },
    } as any);
    mockedPrisma.websiteStructure.findMany.mockResolvedValueOnce([
      {
        id: 'home-1',
        slug: 'home',
        fullPath: '/',
        websitePage: { id: 'page-home', title: 'Home', metadata: { pageType: 'Home' } },
      } as any,
    ]);
    mockedPrisma.websitePage.findMany.mockResolvedValueOnce([
      { id: 'page-home', title: 'Home', metadata: { pageType: 'Home' } } as any,
    ]);

    const body = {
      websiteId: 'site-123',
      operations: [
        {
          type: 'UPDATE' as const,
          nodeId: 'home-1',
          data: { title: 'Homepage' },
        },
      ],
    };

    const request = new NextRequest('http://localhost/api/studio/sitemap/save', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.results[0].success).toBe(true);
    expect(mockedSiteStructureService.update).toHaveBeenCalledTimes(1);
  });

  it('rejects moving the Home page under another node', async () => {
    mockedPrisma.websiteStructure.findUnique.mockResolvedValueOnce({
      slug: 'home',
      title: 'Home',
      websitePage: { title: 'Home', metadata: { pageType: 'Home' } },
    } as any);

    const body = {
      websiteId: 'site-123',
      operations: [
        {
          type: 'MOVE' as const,
          nodeId: 'home-1',
          newParentId: 'node-2',
        },
      ],
    };

    const request = new NextRequest('http://localhost/api/studio/sitemap/save', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(false);
    expect(payload.results[0].success).toBe(false);
    expect(payload.results[0].error).toBe('Home page must be created at the root level');
    expect(mockedSiteStructureService.moveNode).not.toHaveBeenCalled();
  });

  it('allows creating non-home pages with home substring when a Home exists', async () => {
    mockedPrisma.websiteStructure.findMany.mockResolvedValueOnce([
      {
        slug: 'home',
        fullPath: '/',
        websitePage: { title: 'Home', metadata: { pageType: 'Home' } },
      } as any,
    ]);
    mockedPrisma.websitePage.findMany.mockResolvedValueOnce([]);
    mockedPrisma.contentType.findUnique.mockResolvedValue({ id: 'ct-page', websiteId: 'site-123' } as any);
    mockedOrchestrator.createPage.mockResolvedValueOnce({ websiteStructure: { id: 'struct-2' } } as any);

    const body = {
      websiteId: 'site-123',
      operations: [
        {
          type: 'CREATE' as const,
          data: {
            title: 'Homeowners Resources',
            slug: 'homeowners-resources',
            parentId: null,
            contentTypeId: 'ct-page',
            contentTypeCategory: 'page' as const,
            components: [{ id: 'c1', type: 'hero', props: {} }],
            metadata: { pageType: 'Homeowners Resources' },
          },
        },
      ],
    };

    const request = new NextRequest('http://localhost/api/studio/sitemap/save', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.results[0].success).toBe(true);
    expect(mockedOrchestrator.createPage).toHaveBeenCalledTimes(1);
  });

});

