import { ContentfulProvider } from './provider'
import type { UnifiedContent } from '@/lib/services/export/content-orchestrator'

describe('ContentfulProvider template integration', () => {
  it('includes template metadata when building entry payloads', async () => {
    const provider = new ContentfulProvider()
    const contentType = {
      name: 'Page',
      description: 'Test page type',
      fields: [
        { id: 'title', name: 'Title', type: 'Symbol', required: true },
        { id: 'templateKey', name: 'templateKey', type: 'Symbol' },
        { id: 'templateProps', name: 'templateProps', type: 'Object' }
      ]
    }

    const unified: UnifiedContent = {
      id: 'page-1',
      source: 'WebsitePage',
      type: 'page',
      title: 'Test page',
      contentTypeId: 'page',
      content: {},
      metadata: {},
      url: '/test',
      parentId: undefined,
      components: [],
      publishedAt: null,
      status: 'published',
      templateKey: 'marketing/home-default',
      templateProps: { primaryCallToAction: 'Sign up now' }
    }

    const { entryFields } = await (provider as any).buildEntryPayload(contentType, unified, new Map())

    expect(entryFields.templateKey['en-US']).toBe('marketing/home-default')
    expect(entryFields.templateProps['en-US']).toEqual({ primaryCallToAction: 'Sign up now' })
  })
})

