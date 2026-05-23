import { SharedComponentService } from '../component-service'

describe('SharedComponentService shared content contract', () => {
  it('strips legacy defaultProps from config when creating shared components', async () => {
    const prisma = {
      websiteComponentType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'type-1' }),
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
      content: { title: 'Header' },
      config: {
        category: 'header',
        defaultProps: { title: 'Legacy Header' },
      },
    })

    expect(prisma.websiteSharedComponent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: { title: 'Header' },
        config: { category: 'header' },
      }),
    })
  })

  it('strips legacy defaultProps from config when updating shared components', async () => {
    const prisma = {
      websiteSharedComponent: {
        update: jest.fn().mockResolvedValue({ id: 'shared-1' }),
      },
    } as any
    const service = new SharedComponentService(prisma)

    await service.updateSharedComponent('shared-1', {
      config: {
        category: 'footer',
        defaultProps: { title: 'Legacy Footer' },
      },
    })

    expect(prisma.websiteSharedComponent.update).toHaveBeenCalledWith({
      where: { id: 'shared-1' },
      data: {
        config: { category: 'footer' },
      },
    })
  })

  it('strips legacy defaultProps from config when cloning shared components', async () => {
    const prisma = {
      websiteSharedComponent: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'shared-1',
          websiteId: 'site-1',
          websiteComponentTypeId: 'type-1',
          name: 'Header',
          content: { title: 'Header' },
          config: {
            category: 'header',
            defaultProps: { title: 'Legacy Header' },
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
      },
    })
  })
})
