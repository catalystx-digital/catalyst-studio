import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import { siteStructureService } from '@/lib/services/site-structure/site-structure-service';
import { unifiedLayoutService } from '@/lib/studio/services/layout/unified-layout-service';
import { viewportQueryService } from '@/lib/studio/services/spatial/viewport-query-service';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findUnique: jest.fn(),
    },
    websiteStructure: {
      findMany: jest.fn(),
    },
    websitePage: {
      findMany: jest.fn(),
    },
    websiteSharedComponent: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn().mockResolvedValue({ accountId: 'account-1' }),
}));

jest.mock('@/lib/auth/ownership', () => ({
  assertWebsiteOwnership: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/site-structure/site-structure-service', () => ({
  siteStructureService: {
    getTree: jest.fn(),
  },
}));

jest.mock('@/lib/studio/services/layout/unified-layout-service', () => ({
  LAYOUT_CONSTANTS: {
    LARGE_SITE_THRESHOLD: 50,
    NODE_WIDTH: 320,
    NODE_HEIGHT: 180,
  },
  unifiedLayoutService: {
    ensurePositionsExist: jest.fn(),
  },
}));

jest.mock('@/lib/studio/services/spatial/viewport-query-service', () => ({
  viewportQueryService: {
    getAllPositions: jest.fn(),
  },
}));

describe('GET /api/studio/sitemap/[websiteId]', () => {
  const mockedPrisma = prisma as any;
  const mockedSiteStructureService = siteStructureService as jest.Mocked<typeof siteStructureService>;
  const mockedUnifiedLayoutService = unifiedLayoutService as jest.Mocked<typeof unifiedLayoutService>;
  const mockedViewportQueryService = viewportQueryService as jest.Mocked<typeof viewportQueryService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockedUnifiedLayoutService.ensurePositionsExist.mockResolvedValue(false);
    mockedPrisma.website.findUnique.mockResolvedValue({ revision: 7 });
    mockedPrisma.websiteStructure.findMany.mockResolvedValue([
      {
        id: 'structure-1',
        parentId: null,
        websitePageId: 'page-1',
        websitePage: { metadata: {} },
      },
    ]);
    mockedSiteStructureService.getTree.mockResolvedValue({
      id: 'structure-1',
      websiteId: 'website-1',
      slug: 'home',
      fullPath: '/',
      parentId: null,
      websitePageId: 'page-1',
      websitePage: { metadata: {} },
      children: [],
    } as any);
    mockedViewportQueryService.getAllPositions.mockResolvedValue([
      {
        structureId: 'structure-1',
        x: 10,
        y: 20,
        width: 320,
        height: 180,
      },
    ] as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('surfaces missing shared component references without resolved empty content', async () => {
    mockedPrisma.websitePage.findMany.mockResolvedValue([
      {
        id: 'page-1',
        title: 'Home',
        status: 'draft',
        metadata: {},
        content: {
          version: 1,
          components: [
            {
              id: 'component-1',
              type: 'header',
              parentId: null,
              position: 0,
              props: {
                sharedComponentId: 'missing-shared-1',
              },
              content: {},
              styles: {},
              metadata: {},
            },
          ],
        },
      },
    ]);
    mockedPrisma.websiteSharedComponent.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/studio/sitemap/website-1?mode=full');
    const response = await GET(request, { params: Promise.resolve({ websiteId: 'website-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    const component = payload.nodes[0].data.components[0];
    expect(component.props).not.toHaveProperty('_resolvedSharedContent');
    expect(component.props._sharedComponentResolution).toEqual(expect.objectContaining({
      status: 'missing',
      sharedComponentId: 'missing-shared-1',
      diagnostic: expect.objectContaining({
        code: 'MISSING_SHARED_COMPONENT',
        componentId: 'component-1',
      }),
    }));
    expect(component.metadata.sharedComponentResolution).toEqual({
      status: 'missing',
      sharedComponentId: 'missing-shared-1',
    });
    expect(payload.nodes[0].data.sharedComponentDiagnostics).toEqual([
      expect.objectContaining({
        code: 'MISSING_SHARED_COMPONENT',
        sharedComponentId: 'missing-shared-1',
      }),
    ]);
    expect(payload.meta.sharedComponentDiagnostics).toEqual([
      expect.objectContaining({
        code: 'MISSING_SHARED_COMPONENT',
        sharedComponentId: 'missing-shared-1',
      }),
    ]);
  });
});
