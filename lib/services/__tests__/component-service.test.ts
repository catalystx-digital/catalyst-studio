import { SharedComponentService } from '../component-service'

describe('SharedComponentService shared content contract', () => {
  it('rejects legacy defaultProps in config when creating shared components', async () => {
    const prisma = {
      websiteComponentType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'type-1' }),
      },
      websiteSharedComponent: {
        create: jest.fn().mockResolvedValue({ id: 'shared-1' }),
      },
    } as any
    const service = new SharedComponentService(prisma)

    await expect(service.createSharedComponent({
      websiteId: 'site-1',
      websiteComponentTypeId: 'type-1',
      name: 'Header',
      content: { title: 'Header' },
      config: {
        category: 'header',
        defaultProps: { title: 'Legacy Header' },
      },
    })).rejects.toThrow('config.defaultProps is not accepted')
    expect(prisma.websiteSharedComponent.create).not.toHaveBeenCalled()
  })

  it('persists caller content only when component type has catalog defaults', async () => {
    const prisma = {
      websiteComponentType: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'type-1',
          defaultConfig: {
            props: { catalogOnlySentinel: 'default-config-sentinel' },
          },
          placeholderData: {
            catalogPlaceholderSentinel: 'placeholder-sentinel',
          },
        }),
      },
      websiteSharedComponent: {
        create: jest.fn().mockResolvedValue({ id: 'shared-1' }),
      },
    } as any
    const service = new SharedComponentService(prisma)

    await service.createSharedComponent({
      websiteId: 'site-1',
      websiteComponentTypeId: 'type-1',
      name: 'Header',
      content: { title: 'Caller Header' },
      config: { category: 'header' },
    })

    expect(prisma.websiteSharedComponent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: { title: 'Caller Header' },
      }),
    })
    const createArgs = prisma.websiteSharedComponent.create.mock.calls[0][0]
    expect(JSON.stringify(createArgs.data.content)).not.toContain('default-config-sentinel')
    expect(JSON.stringify(createArgs.data.content)).not.toContain('placeholder-sentinel')
  })

  it('rejects legacy defaultProps in config when updating shared components', async () => {
    const prisma = {
      websiteSharedComponent: {
        update: jest.fn().mockResolvedValue({ id: 'shared-1' }),
      },
    } as any
    const service = new SharedComponentService(prisma)

    await expect(service.updateSharedComponent('shared-1', {
      config: {
        category: 'footer',
        defaultProps: { title: 'Legacy Footer' },
      },
    })).rejects.toThrow('config.defaultProps is not accepted')
    expect(prisma.websiteSharedComponent.update).not.toHaveBeenCalled()
  })

  it('rejects cloning shared component config with legacy defaultProps', async () => {
    const prisma = {
      websiteSharedComponent: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'shared-1',
          websiteId: 'site-1',
          websiteComponentTypeId: 'type-1',
          name: 'Header',
          content: { title: 'Header' },
          createdBy: 'user-1',
          updatedBy: 'user-1',
          config: {
            category: 'header',
            defaultProps: { title: 'Legacy Header' },
          },
        }),
        create: jest.fn().mockResolvedValue({ id: 'shared-2' }),
      },
    } as any
    const service = new SharedComponentService(prisma)

    await expect(service.cloneSharedComponent('shared-1')).rejects.toThrow('config.defaultProps is not accepted')
    expect(prisma.websiteSharedComponent.create).not.toHaveBeenCalled()
  })

  it('clones shared component config when it is canonical metadata only', async () => {
    const prisma = {
      websiteSharedComponent: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'shared-1',
          websiteId: 'site-1',
          websiteComponentTypeId: 'type-1',
          name: 'Header',
          content: { title: 'Header' },
          createdBy: 'user-1',
          updatedBy: 'user-1',
          config: {
            category: 'header',
          },
        }),
        create: jest.fn().mockResolvedValue({ id: 'shared-2' }),
      },
    } as any
    const service = new SharedComponentService(prisma)

    await service.cloneSharedComponent('shared-1')

    expect(prisma.websiteSharedComponent.create).toHaveBeenCalledWith({
      data: {
        websiteId: 'site-1',
        websiteComponentTypeId: 'type-1',
        name: 'Header (Clone)',
        content: { title: 'Header' },
        config: { category: 'header' },
        createdBy: 'user-1',
        updatedBy: 'user-1',
      },
    })
  })

  it('counts nested canonical shared component usage', async () => {
    const prisma = {
      websiteSharedComponent: {
        findUnique: jest.fn().mockResolvedValue({ id: 'shared-1', websiteId: 'site-1' }),
      },
      websitePage: {
        findMany: jest.fn().mockResolvedValue([
          {
            content: {
              components: [
                {
                  id: 'parent-1',
                  type: 'section',
                  props: {},
                  children: [
                    {
                      id: 'child-1',
                      type: 'header',
                      props: { sharedComponentId: 'shared-1' },
                    },
                  ],
                },
              ],
            },
          },
          {
            content: {
              components: [
                {
                  id: 'other',
                  type: 'footer',
                  props: { sharedComponentId: 'shared-2' },
                },
              ],
            },
          },
        ]),
      },
    } as any
    const service = new SharedComponentService(prisma)

    await expect(service.getSharedComponentUsageCount('shared-1')).resolves.toBe(1)
  })

  it('finds pages using nested canonical shared component references', async () => {
    const prisma = {
      websiteSharedComponent: {
        findUnique: jest.fn().mockResolvedValue({ id: 'shared-1', websiteId: 'site-1' }),
      },
      websitePage: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'page-1',
            content: {
              components: [
                {
                  id: 'parent-1',
                  type: 'section',
                  props: {},
                  children: [
                    {
                      id: 'child-1',
                      type: 'header',
                      props: { sharedComponentId: 'shared-1' },
                    },
                  ],
                },
              ],
            },
          },
          {
            id: 'page-2',
            content: {
              components: [
                {
                  id: 'other',
                  type: 'footer',
                  props: { sharedComponentId: 'shared-2' },
                },
              ],
            },
          },
        ]),
      },
    } as any
    const service = new SharedComponentService(prisma)

    await expect(service.findPagesUsingSharedComponent('shared-1')).resolves.toEqual(['page-1'])
  })
})
