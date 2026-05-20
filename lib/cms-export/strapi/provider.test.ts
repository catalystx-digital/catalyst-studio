import { StrapiProvider } from './provider'
import type { UnifiedContent } from '@/lib/services/export/content-orchestrator'

describe('StrapiProvider template integration', () => {
  it('sends template metadata when creating pages', async () => {
    const provider = new StrapiProvider() as any
    provider.apiToken = 'token'
    provider.loadContentTypes = async () => {}
    provider.resolveCollectionFor = () => ({
      collection: 'pages',
      uid: 'api::page.page',
      attrs: new Set(['title', 'templateKey', 'templateProps']),
      dynamicZones: new Map()
    })

    const recorded: any[] = []
    provider.req = async (_path: string, options: any) => {
      recorded.push(JSON.parse(options.body))
      return { data: { data: { id: 'entry-1', documentId: 'entry-1' } } }
    }

    const item: UnifiedContent = {
      id: 'page-1',
      source: 'WebsitePage',
      type: 'page',
      title: 'Landing',
      contentTypeId: 'page',
      content: {},
      metadata: {},
      url: '/landing',
      parentId: undefined,
      components: [],
      publishedAt: null,
      status: 'published',
      templateKey: 'marketing/home-default',
      templateProps: { primaryCallToAction: 'Join now' }
    }

    const bundle = {
      website: { id: 'site-1', name: 'Test Site' },
      contentTypes: [],
      unifiedContent: [item],
      componentUsage: [],
      components: [],
      folders: { root: [], totalFolders: 0, maxDepth: 0, pathMappings: {} },
      metadata: {
        exportDate: new Date().toISOString(),
        websiteId: 'site-1',
        version: '1.0.0'
      }
    }

    const result = await provider.syncUnifiedBundle(bundle)
    expect(result.successCount).toBe(1)
    expect(recorded).toHaveLength(1)
    expect(recorded[0].data.templateKey).toBe('marketing/home-default')
    expect(recorded[0].data.templateProps).toEqual({ primaryCallToAction: 'Join now' })
  })
})
