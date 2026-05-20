import { BundleExporter } from '../bundle-exporter'
import { prisma } from '@/lib/prisma'

// Local prisma mock for this suite
jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: { findUnique: jest.fn() },
    contentType: { findMany: jest.fn() },
    websitePage: { findMany: jest.fn() },
    websiteCustomContentData: { findMany: jest.fn() },
    websiteSharedComponent: { findMany: jest.fn() },
    websiteStructure: { findMany: jest.fn(), findFirst: jest.fn() },
  }
}))

// Minimal provider that bypasses preflight by not exposing compile
class MinimalProvider {
  getCompiledTypeSupport() { return {} as any }
}

describe('BundleExporter — shared overrides integration', () => {
  const websiteId = 'site-1'
  let service: BundleExporter

  beforeEach(() => {
    jest.resetAllMocks()
    service = new BundleExporter(new MinimalProvider() as any)
  })

  it('exports component props as content+overrides deep-merged and surfaces hasOverrides in metadata', async () => {
    // Arrange: website
    ;(prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: websiteId, name: 'Test Site' })
    // Arrange: content types (minimal Page)
    ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue([
      { id: 'ct-page', key: 'page', name: 'Page', pluralName: 'Pages', category: 'page', fields: [] }
    ])
    // Arrange: a page with one shared header instance with overrides
    ;(prisma.websitePage.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'page-1',
        websiteId,
        type: 'page',
        title: 'Home',
        contentTypeId: 'ct-page',
        content: {
          components: [
            {
              id: 'inst-1',
              type: 'header',
              isShared: true,
              sharedComponentId: 'shared-1',
              position: 0,
              properties: { overrides: { title: 'Local Title' }, hasOverrides: true }
            }
          ]
        }
      }
    ])
    // Arrange: shared row with canonical content
    ;(prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'shared-1',
        websiteId,
        content: { title: 'Global Title', links: ['a'] },
        config: { defaultProps: { title: 'Legacy Title' } },
        websiteComponentType: { type: 'header' }
      }
    ])
    // Structures not used here
    ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([])

    // Act
    const result = await service.export(websiteId, { includeComponents: true, includeFolders: false })

    // Assert
    expect(result.components).toBeDefined()
    expect(result.components!.length).toBe(1)
    const comp = result.components![0]
    expect(comp.type).toBe('header')
    expect(comp.props).toEqual({ title: 'Local Title', links: ['a'] })
    // Negative assertions: no linkage/metadata inside props
    expect('overrides' in (comp.props as any)).toBe(false)
    expect('hasOverrides' in (comp.props as any)).toBe(false)
    expect('sharedComponentId' in (comp.props as any)).toBe(false)
    expect(comp.metadata?.isShared).toBe(true)
    expect(comp.metadata?.sharedId).toBe('shared-1')
    expect(comp.metadata?.hasOverrides).toBe(true)
  })

  it('exports shared component without overrides and sets metadata.hasOverrides=false', async () => {
    const websiteId = 'site-1'
    ;(prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: websiteId, name: 'Test Site' })
    ;(prisma.contentType.findMany as jest.Mock).mockResolvedValue([
      { id: 'ct-page', key: 'page', name: 'Page', pluralName: 'Pages', category: 'page', fields: [] }
    ])
    ;(prisma.websitePage.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'page-1',
        websiteId,
        type: 'page',
        title: 'Home',
        contentTypeId: 'ct-page',
        content: {
          components: [
            {
              id: 'inst-1',
              type: 'header',
              isShared: true,
              sharedComponentId: 'shared-1',
              position: 0,
              properties: { }
            }
          ]
        }
      }
    ])
    ;(prisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'shared-1',
        websiteId,
        content: { title: 'Global Title', links: ['a'] },
        config: { defaultProps: { title: 'Legacy Title' } },
        websiteComponentType: { type: 'header' }
      }
    ])
    ;(prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue([])

    const result = await service.export(websiteId, { includeComponents: true, includeFolders: false })
    const comp = result.components![0]
    expect(comp.props).toEqual({ title: 'Global Title', links: ['a'] })
    expect(comp.metadata?.hasOverrides).toBe(false)
  })
})
