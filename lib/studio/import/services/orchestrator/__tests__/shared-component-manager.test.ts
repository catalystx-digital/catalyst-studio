import { persistSharedComponentsAndUpdatePages } from '../shared-component-manager'

describe('persistSharedComponentsAndUpdatePages', () => {
  it('persists renderable component content for shared navigation records', async () => {
    const createdSharedComponent = {
      id: 'shared-nav',
      websiteComponentTypeId: 'nav-type',
      name: 'Main Navigation',
      content: {},
      config: {},
      usageCount: 2,
    }
    const prisma = {
      websiteComponentType: {
        findFirst: jest.fn().mockResolvedValue({ id: 'generic-type', type: 'shared-generic', category: 'content' }),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { id: 'nav-type', type: 'navbar', category: 'navigation' },
        ]),
      },
      websiteSharedComponent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdSharedComponent),
        update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          ...createdSharedComponent,
          ...data,
        })),
      },
      websitePage: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any

    const sharedComponentDetector = {
      updatePageReferences: jest.fn(),
    } as any

    await persistSharedComponentsAndUpdatePages({
      prisma,
      websiteId: 'website-1',
      sharedComponentDetector,
      pages: [],
      componentTypes: [],
      candidates: [
        {
          name: 'Main Navigation',
          category: 'navigation',
          pattern: {
            type: 'navbar',
            frequency: 2,
            confidence: 0.95,
            structure: {},
          },
          pages: ['page-1', 'page-2'],
          instances: [
            {
              id: 'nav-1',
              type: 'navbar',
              content: {
                logo: { text: 'Mozilla', href: '/' },
                menuItems: [{ label: 'Firefox', href: '/firefox/' }],
              },
              props: {
                region: 'header',
                placementBucket: 'top',
                semanticTokens: ['mozilla', 'firefox'],
                metadata: { source: 'dom-navigation-recovery' },
              },
            },
          ],
        },
      ],
    })

    expect(prisma.websiteSharedComponent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        websiteId: 'website-1',
        websiteComponentTypeId: 'nav-type',
        name: 'Main Navigation',
        usageCount: 2,
        content: {
          logo: { text: 'Mozilla', href: '/' },
          menuItems: [{ label: 'Firefox', href: '/firefox/' }],
          region: 'header',
          placementBucket: 'top',
          semanticTokens: ['mozilla', 'firefox'],
        },
      }),
    })
  })

  it('does not create shared nav records from signature-only content', async () => {
    const prisma = {
      websiteComponentType: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      websiteSharedComponent: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      websitePage: {
        findMany: jest.fn(),
      },
    } as any

    const result = await persistSharedComponentsAndUpdatePages({
      prisma,
      websiteId: 'website-1',
      sharedComponentDetector: { updatePageReferences: jest.fn() } as any,
      pages: [{ id: 'page-1', content: { components: [] } }],
      componentTypes: [],
      candidates: [
        {
          name: 'Main Navigation',
          category: 'navigation',
          pattern: {
            type: 'navbar',
            frequency: 2,
            confidence: 0.95,
            structure: {},
          },
          pages: ['page-1', 'page-2'],
          instances: [
            {
              id: 'nav-1',
              type: 'navbar',
              content: {},
              props: {
                region: 'header',
                hasLogo: true,
                menuItemCount: '4-8',
                semanticTokens: ['mozilla', 'firefox'],
              },
            },
          ],
        },
      ],
    })

    expect(result.sharedComponents).toEqual([])
    expect(result.updatedPages).toEqual([{ id: 'page-1', content: { components: [] } }])
    expect(prisma.websiteSharedComponent.create).not.toHaveBeenCalled()
    expect(prisma.websitePage.findMany).not.toHaveBeenCalled()
  })

  it('promotes serialized renderable props content before applying the nav guard', async () => {
    const createdSharedComponent = {
      id: 'shared-nav',
      websiteComponentTypeId: 'nav-type',
      name: 'Main Navigation',
      content: {},
      config: {},
      usageCount: 2,
    }
    const prisma = {
      websiteComponentType: {
        findFirst: jest.fn().mockResolvedValue({ id: 'generic-type', type: 'shared-generic', category: 'content' }),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { id: 'nav-type', type: 'navbar', category: 'navigation' },
        ]),
      },
      websiteSharedComponent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdSharedComponent),
        update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          ...createdSharedComponent,
          ...data,
        })),
      },
      websitePage: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any

    await persistSharedComponentsAndUpdatePages({
      prisma,
      websiteId: 'website-1',
      sharedComponentDetector: { updatePageReferences: jest.fn() } as any,
      pages: [],
      componentTypes: [],
      candidates: [
        {
          name: 'Main Navigation',
          category: 'navigation',
          pattern: {
            type: 'navbar',
            frequency: 2,
            confidence: 0.95,
            structure: {},
          },
          pages: ['page-1', 'page-2'],
          instances: [
            {
              id: 'nav-1',
              type: 'navbar',
              content: {},
              props: {
                region: 'header',
                menuItemCount: '4-8',
                semanticTokens: ['mozilla', 'firefox'],
                content: JSON.stringify({
                  logo: { text: 'Mozilla', href: '/' },
                  menuItems: [{ label: 'Firefox', href: '/firefox/' }],
                }),
              },
            },
          ],
        },
      ],
    })

    expect(prisma.websiteSharedComponent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: {
          logo: { text: 'Mozilla', href: '/' },
          menuItems: [{ label: 'Firefox', href: '/firefox/' }],
          region: 'header',
          menuItemCount: '4-8',
          semanticTokens: ['mozilla', 'firefox'],
        },
      }),
    })
  })
})
