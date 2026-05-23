/** @jest-environment node */

import { graphql } from 'graphql';

import type { GraphqlContext } from '@/lib/studio/graphql/types';
import { ucsGraphqlSchema } from '@/lib/studio/graphql/schema';
import sampleSite from '@/mock-data/ucs/sample-site.json';
import { AccountApiKeyScope } from '@/lib/generated/prisma';
import { resolveUcsPageBySlug } from '@/lib/studio/headless/ucs/page-resolver';
import type { ResolvedInstance, ResolvedPage } from '@/lib/services/unified-content-repository';

jest.mock('@/lib/studio/headless/ucs/page-resolver', () => ({
  resolveUcsPageBySlug: jest.fn(),
}));

const mockedResolver = resolveUcsPageBySlug as jest.MockedFunction<typeof resolveUcsPageBySlug>;

const website = sampleSite.website;
const homePage = sampleSite.pages.home;
const sharedNav = sampleSite.sharedComponents[0];

const resolvedInstances: ResolvedInstance[] = [
  {
    id: 'cmp_hero',
    type: 'hero',
    position: 0,
    parentId: null,
    sharedId: 'shared_nav',
    isShared: true,
    hasOverrides: true,
    effectiveProps: {
      headline: 'Peak flavor without the sugar crash',
      links: sharedNav.content.links,
    },
  },
  {
    id: 'cmp_intro',
    type: 'rich-text',
    position: 1,
    parentId: null,
    sharedId: null,
    isShared: false,
    hasOverrides: false,
    effectiveProps: {
      text: 'We roast in small batches every Monday.',
    },
  },
];

const resolvedPageFixture: ResolvedPage = {
  pageId: homePage.id,
  websiteId: website.id,
  title: homePage.title,
  components: resolvedInstances,
};

const baseAuth = {
  accountId: website.accountId,
  keyId: 'key_test',
  websiteId: website.id,
  scopes: [AccountApiKeyScope.ACCOUNT_READ],
  rateLimits: {
    key: { allowed: true, remaining: 50, limit: 120 },
    ip: { allowed: true, remaining: 10, limit: 20 },
  },
};

function createContext(overrides: Partial<GraphqlContext> = {}): GraphqlContext {
  const services = {
    website: {
      getWebsite: jest.fn().mockResolvedValue(website),
      getWebsitesConnection: jest.fn().mockResolvedValue({
        edges: [
          {
            cursor: Buffer.from(`${website.id}:${website.createdAt}`).toString('base64'),
            node: website,
          },
        ],
        pageInfo: {
          endCursor: Buffer.from(`${website.id}:${website.createdAt}`).toString('base64'),
          hasNextPage: false,
        },
        totalCount: 1,
      }),
    },
    page: {
      getPage: jest.fn(),
    },
    structure: {
      getStructureByPageId: jest.fn(),
    },
  };

  const loaders = {
    pageById: { load: jest.fn() },
    structureByPageId: { load: jest.fn().mockResolvedValue({ fullPath: '/' }) },
    sharedComponentById: {
      load: jest.fn().mockResolvedValue({
        id: sharedNav.id,
        name: sharedNav.name,
        websiteId: website.id,
        websiteComponentTypeId: sharedNav.componentTypeId,
        websiteComponentType: { type: sharedNav.componentType },
        content: sharedNav.content,
        config: sharedNav.config,
      }),
    },
  };

  const repositories = {
    unifiedContent: {
      getPageWithResolvedComponents: jest.fn().mockResolvedValue(resolvedPageFixture),
    },
    designSystem: {
      findMany: jest.fn().mockResolvedValue(sampleSite.designSystems),
    },
  };

  const context: GraphqlContext = {
    auth: baseAuth,
    prisma: {} as never,
    loaders: loaders as never,
    services: services as never,
    repositories: repositories as never,
    sharedComponentCache: new Map(),
    requestId: 'req-test',
    ...overrides,
  };

  return context;
}

async function executeQuery(query: string, variables?: Record<string, unknown>, ctxOverrides?: Partial<GraphqlContext>) {
  const contextValue = createContext(ctxOverrides);
  const result = await graphql({
    schema: ucsGraphqlSchema,
    source: query,
    variableValues: variables,
    contextValue,
  });
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedResolver.mockResolvedValue({
    payload: {
      page: JSON.parse(JSON.stringify(homePage)),
      sharedComponents: JSON.parse(JSON.stringify(sampleSite.sharedComponents)),
      structure: {
        current: {
          id: 'struct_home',
          websitePageId: homePage.id,
          parentId: null,
          slug: '',
          fullPath: '/',
          position: 0,
          isFolder: false,
        },
        ancestors: [],
        children: [],
      },
      diagnostics: [],
    },
    diagnostics: [],
  });
});

describe('ucsGraphqlSchema', () => {
  it('returns website payloads', async () => {
    const result = await executeQuery(
      `
        query GetWebsite($id: ID!) {
          website(id: $id) {
            id
            name
            category
            createdAt
          }
        }
      `,
      { id: website.id },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toMatchSnapshot();
  });

  it('returns paginated websites with Relay fields', async () => {
    const result = await executeQuery(
      `
        query ListWebsites($first: Int) {
          websites(first: $first) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              cursor
              node {
                id
                name
              }
            }
          }
        }
      `,
      { first: 1 },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toMatchSnapshot();
  });

  it('maps page responses to snapshot-compatible shapes', async () => {
    const result = await executeQuery(
      `
        query PageBySlug($slug: String!, $websiteId: ID!) {
          page(slug: $slug, websiteId: $websiteId) {
            id
            title
            fullPath
            sharedComponentIds
            sharedComponents {
              id
              name
              componentType
            }
            components {
              id
              type
              sharedComponentId
              effectiveProps
              isSharedInstance
            }
            diagnostics {
              code
            }
          }
        }
      `,
      { slug: '/', websiteId: website.id },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toMatchSnapshot();
  });

  it('surfaces invalid page content diagnostics as a GraphQL error', async () => {
    const diagnostics = [
      {
        code: 'PAGE_CONTENT_JSON_PARSE_FAILED',
        level: 'error' as const,
        message: 'Page content JSON could not be parsed.',
        context: { pageId: homePage.id },
      },
    ];
    mockedResolver.mockResolvedValueOnce({
      payload: null,
      diagnostics,
    });

    const result = await executeQuery(
      `
        query PageBySlug($slug: String!, $websiteId: ID!) {
          page(slug: $slug, websiteId: $websiteId) {
            id
          }
        }
      `,
      { slug: '/', websiteId: website.id },
    );

    expect(result.data).toEqual({ page: null });
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].message).toBe('Invalid page content');
    expect(result.errors?.[0].extensions).toEqual({
      code: 'INVALID_PAGE_CONTENT',
      diagnostics,
    });
  });

  it('returns null without an error when the UCS slug is not found', async () => {
    mockedResolver.mockResolvedValueOnce({
      payload: null,
      diagnostics: [
        {
          code: 'UCS_SLUG_NOT_FOUND',
          level: 'info',
          message: 'No UCS page matched the requested slug.',
          context: { slug: '/missing' },
        },
      ],
    });

    const result = await executeQuery(
      `
        query PageBySlug($slug: String!, $websiteId: ID!) {
          page(slug: $slug, websiteId: $websiteId) {
            id
          }
        }
      `,
      { slug: '/missing', websiteId: website.id },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ page: null });
  });

  it('returns shared components when scoped to website', async () => {
    const result = await executeQuery(
      `
        query SharedComponent($id: ID!) {
          sharedComponent(id: $id) {
            id
            name
            componentType
            config
          }
        }
      `,
      { id: sharedNav.id },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toMatchSnapshot();
  });

  it('lists design systems for the website', async () => {
    const result = await executeQuery(
      `
        query DesignSystems($websiteId: ID!) {
          designSystems(websiteId: $websiteId) {
            id
            version
            conceptName
            isCurrent
          }
        }
      `,
      { websiteId: website.id },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toMatchSnapshot();
  });

  it('rejects pagination requests above the max page size', async () => {
    const result = await executeQuery(
      `
        query InvalidPagination {
          websites(first: 200) {
            totalCount
          }
        }
      `,
    );

    expect(result.errors?.[0].message).toContain('first must be less than or equal to 50');
  });
});
