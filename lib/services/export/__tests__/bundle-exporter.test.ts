jest.mock('@/lib/prisma', () => ({
  prisma: {
    website: {
      findUnique: jest.fn()
    }
  }
}))

jest.mock('../helpers/content-type-helpers', () => ({
  fetchContentTypes: jest.fn(),
  maybeEmitTypeDependencyPlan: jest.fn()
}))

jest.mock('../helpers/component-extraction', () => ({
  extractComponentsFromUnifiedContent: jest.fn()
}))

jest.mock('../helpers/content-item-helpers', () => ({
  transformUnifiedContentToExport: jest.fn(),
  attachMediaAssetsToContentItems: jest.fn()
}))

import { BundleExporter } from '../bundle-exporter'
import type { ICMSProvider } from '@/lib/cms-export/types'
import type { StandardExport, UnifiedExportBundle, UnifiedBundleSyncResult } from '../types'
import { extractComponentsFromUnifiedContent } from '../helpers/component-extraction'
import { transformUnifiedContentToExport, attachMediaAssetsToContentItems } from '../helpers/content-item-helpers'
import * as contentTypeHelpers from '../helpers/content-type-helpers'
import { prisma } from '@/lib/prisma'

describe('BundleExporter (bundle pipeline)', () => {
  const sampleExportData: StandardExport = {
    contentTypes: [],
    contentItems: [],
    components: [],
    folders: {
      root: [],
      totalFolders: 0,
      maxDepth: 0,
      pathMappings: {}
    },
    metadata: {
      exportDate: new Date().toISOString(),
      websiteId: 'site-1',
      version: '1.0.0'
    }
  }

  const sampleBundle: UnifiedExportBundle = {
    website: { id: 'site-1', name: 'Test Site' },
    contentTypes: [],
    unifiedContent: [],
    componentUsage: [],
    components: [],
    folders: {
      root: [],
      totalFolders: 0,
      maxDepth: 0,
      pathMappings: {}
    },
    metadata: sampleExportData.metadata
  }

  beforeEach(() => {
    ;(prisma.website.findUnique as jest.Mock).mockReset()
    ;(extractComponentsFromUnifiedContent as jest.Mock).mockReset()
    ;(transformUnifiedContentToExport as jest.Mock).mockReset()
    ;(attachMediaAssetsToContentItems as jest.Mock).mockReset()
    ;(contentTypeHelpers.fetchContentTypes as jest.Mock).mockReset()
    ;(contentTypeHelpers.maybeEmitTypeDependencyPlan as jest.Mock).mockReset()
  })

  class StubProvider implements ICMSProvider {
    readonly id = 'stub'

    public capability = {
      compile: jest.fn().mockReturnValue({ byKey: {}, all: [] }),
      configure: jest.fn(),
      ensure: jest.fn().mockResolvedValue(undefined),
      registerContentTypeMapping: jest.fn()
    }

    getContentType = jest.fn().mockResolvedValue(null)
    createContentType = jest.fn().mockResolvedValue({} as any)
    syncUnifiedBundle = jest
      .fn<
        [UnifiedExportBundle],
        Promise<UnifiedBundleSyncResult>
      >()
      .mockResolvedValue({ successCount: 1, failureCount: 0, details: [] })
    getCompiledTypeSupport() {
      return this.capability
    }
  }

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('returns export data when no provider is configured', async () => {
    const service = new BundleExporter()

    const prepareSpy = jest
      .spyOn(service as any, 'prepareExportBundle')
      .mockResolvedValue({ exportData: sampleExportData, bundle: sampleBundle })
    const validationSpy = jest.spyOn(service as any, 'applyValidation').mockResolvedValue(undefined)
    const dependencySpy = jest.spyOn(service as any, 'emitTypeDependencyPlan').mockResolvedValue(undefined)

    const result = await service.export('site-1')

    expect(result.exportData).toBe(sampleExportData)
    expect(prepareSpy).toHaveBeenCalledWith('site-1', {})
    expect(validationSpy).toHaveBeenCalledWith(sampleExportData, {})
    expect(dependencySpy).toHaveBeenCalledWith(sampleExportData)
  })

  it('delegates bundle sync to provider during export', async () => {
    const provider = new StubProvider()
    const service = new BundleExporter(provider)

    const prepareSpy = jest
      .spyOn(service as any, 'prepareExportBundle')
      .mockResolvedValue({ exportData: sampleExportData, bundle: sampleBundle })
    const validationSpy = jest.spyOn(service as any, 'applyValidation').mockResolvedValue(undefined)
    const dependencySpy = jest.spyOn(service as any, 'emitTypeDependencyPlan').mockResolvedValue(undefined)

    const result = await service.export('site-1')

    expect(provider.syncUnifiedBundle).toHaveBeenCalledWith(sampleBundle, { publish: false })
    expect(result.syncResults?.unifiedContent?.successCount).toBe(1)
    expect(result.exportData).toBe(sampleExportData)
    expect(prepareSpy).toHaveBeenCalledWith('site-1', {})
    expect(validationSpy).toHaveBeenCalledWith(sampleExportData, {})
    expect(dependencySpy).toHaveBeenCalledWith(sampleExportData)
  })

  it('propagates errors from provider sync', async () => {
    const provider = new StubProvider()
    const service = new BundleExporter(provider)

    jest.spyOn(service as any, 'prepareExportBundle').mockResolvedValue({ exportData: sampleExportData, bundle: sampleBundle })
    jest.spyOn(service as any, 'applyValidation').mockResolvedValue(undefined)
    jest.spyOn(service as any, 'emitTypeDependencyPlan').mockResolvedValue(undefined)

    const error = new Error('sync failed')
    provider.syncUnifiedBundle.mockRejectedValueOnce(error)

    await expect(service.export('site-1')).rejects.toThrow('sync failed')
  })

  describe('prepareExportBundle', () => {
    it('stitches unified content, components, and metadata into a unified bundle', async () => {
      const service = new BundleExporter()

      const unifiedContent = [
        {
          id: 'page-1',
          source: 'WebsitePage',
          type: 'page',
          title: 'Home',
          contentTypeId: 'page',
          content: { components: [] },
          url: '/',
          metadata: { pathDepth: 0 }
        },
        {
          id: 'data-1',
          source: 'WebsiteCustomContentData',
          type: 'data',
          title: 'Footer data',
          contentTypeId: 'footerData',
          content: { value: 1 }
        }
      ]

      const componentExtraction = {
        components: [
          {
            id: 'comp-1',
            type: 'hero',
            category: 'heroes',
            props: { title: 'Welcome' },
            content: { title: 'Welcome' },
            metadata: {
              pageId: 'page-1',
              parentId: null,
              position: 0,
              isShared: false
            }
          }
        ],
        usage: new Set(['hero'])
      }

      const transformedItems = [
        {
          id: 'page-1',
          contentTypeId: 'page',
          title: 'Home',
          slug: 'home',
          content: { headline: 'Welcome' },
          metadata: {}
        }
      ]

      const mediaAttached = transformedItems.map(item => ({ ...item, mediaAssets: [] }))

      const contentTypes = [
        { id: 'type-1', key: 'hero', name: 'Hero', pluralName: 'Heroes', category: 'heroes', fields: [] }
      ]

      const folderHierarchy = {
        root: [],
        totalFolders: 0,
        maxDepth: 0,
        pathMappings: {}
      }

      ;(prisma.website.findUnique as jest.Mock).mockResolvedValue({ id: 'site-1', name: 'Demo Site' })

      ;(extractComponentsFromUnifiedContent as jest.Mock).mockResolvedValue(componentExtraction)
      ;(transformUnifiedContentToExport as jest.Mock).mockReturnValue(transformedItems)
      ;(attachMediaAssetsToContentItems as jest.Mock).mockResolvedValue(mediaAttached)

      ;(contentTypeHelpers.fetchContentTypes as jest.Mock).mockResolvedValue(contentTypes)

      const gatherAllContent = jest.fn().mockResolvedValue(unifiedContent)
      const exportFolders = jest.fn().mockResolvedValue(folderHierarchy)

      ;(service as any).contentOrchestrator = { gatherAllContent }
      ;(service as any).componentExtractor = {}
      ;(service as any).folderExporter = {
        exportFolders,
        exportSelectedFolders: jest.fn()
      }

      const { exportData, bundle } = await (service as any).prepareExportBundle('site-1')

      expect(prisma.website.findUnique).toHaveBeenCalledWith({ where: { id: 'site-1' } })
      expect(gatherAllContent).toHaveBeenCalledWith('site-1')
      expect(extractComponentsFromUnifiedContent).toHaveBeenCalledWith({
        unifiedContent,
        websiteId: 'site-1',
        extractor: expect.anything()
      })
      expect(transformUnifiedContentToExport).toHaveBeenCalledWith(unifiedContent)
      expect(attachMediaAssetsToContentItems).toHaveBeenCalledWith(unifiedContent, transformedItems)
      expect(contentTypeHelpers.fetchContentTypes).toHaveBeenCalledWith({
        websiteId: 'site-1',
        componentUsage: componentExtraction.usage,
        provider: undefined
      })
      expect(exportFolders).toHaveBeenCalledWith('site-1')

      expect(exportData.contentTypes).toEqual(contentTypes)
      expect(exportData.contentItems).toEqual(mediaAttached)
      expect(exportData.components).toEqual([])
      expect(exportData.folders).toBe(folderHierarchy)
      expect(exportData.metadata.websiteId).toBe('site-1')
      expect(exportData.metadata.websiteName).toBe('Demo Site')
      expect(exportData.metadata.statistics?.components).toBe(0)
      expect(Array.isArray(bundle.unifiedContent)).toBe(true)
      const bundledPage = bundle.unifiedContent.find(item => item.id === 'page-1')
      expect(bundledPage?.components).toEqual([
        {
          id: 'comp-1',
          type: 'hero',
          position: 0,
          parentId: null,
          properties: { title: 'Welcome' },
          isShared: false,
          sharedId: undefined
        }
      ])
      expect(bundle.components).toEqual(componentExtraction.components)
      expect(bundle.componentUsage).toEqual(['hero'])
      expect(bundle.metadata.statistics?.contentItems).toBe(mediaAttached.length)
    })
  })
})
