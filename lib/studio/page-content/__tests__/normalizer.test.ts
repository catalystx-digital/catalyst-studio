import {
  normalizePageContent,
  pageContentV1Schema,
  normalizeComponents,
  normalizeProps,
  toCanonicalPageContent,
} from '@/lib/studio/page-content'

describe('page content normalizer', () => {
  it('normalizes canonical components into PageContentV1', () => {
    const result = normalizePageContent({
      components: [
        {
          id: 'hero-1',
          type: 'hero-banner',
          parentId: null,
          position: 0,
          props: { content: { heading: 'Hello' } },
          content: {},
          styles: { desktop: { paddingTop: 24 } },
          metadata: { source: 'test' },
        },
      ],
      regions: {
        main: ['hero-banner'],
      },
    })

    expect(result.diagnostics).toEqual([])
    expect(result.pageContent.version).toBe(1)
    expect(result.pageContent.components).toHaveLength(1)
    expect(result.pageContent.components[0]).toMatchObject({
      id: 'hero-1',
      type: 'hero-banner',
      parentId: null,
      position: 0,
      props: { content: { heading: 'Hello' } },
    })
    expect(pageContentV1Schema.parse(result.pageContent)).toEqual(result.pageContent)
  })

  it('adapts legacy sections and componentType entries', () => {
    const result = normalizePageContent({
      sections: [
        {
          componentType: 'feature-grid',
          data: {
            content: { heading: 'Features' },
          },
        },
      ],
    })

    expect(result.pageContent.components).toHaveLength(1)
    expect(result.pageContent.components[0]).toMatchObject({
      id: 'component-0',
      type: 'feature-grid',
      parentId: null,
      position: 0,
      props: {
        content: { heading: 'Features' },
      },
    })
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'PAGE_CONTENT_LEGACY_SECTIONS',
      'PAGE_CONTENT_COMPONENT_ID_MISSING',
    ])
  })

  it('parses JSON string page content before adapting components', () => {
    const result = normalizePageContent(JSON.stringify({
      sections: [
        {
          id: 'section-1',
          componentType: 'text-block',
          data: { content: { text: 'Hello' } },
        },
      ],
    }))

    expect(result.pageContent.components).toHaveLength(1)
    expect(result.pageContent.components[0]).toMatchObject({
      id: 'section-1',
      type: 'text-block',
      props: { content: { text: 'Hello' } },
    })
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'PAGE_CONTENT_JSON_STRING',
      'PAGE_CONTENT_LEGACY_SECTIONS',
    ])
  })

  it('parses JSON content from props.text without overwriting non-empty content', () => {
    const props = normalizeProps({
      text: JSON.stringify({
        heading: 'From text',
        slides: [{ title: 'Slide 1' }],
      }),
      content: {
        heading: 'Existing heading',
        slides: [],
      },
    })

    expect(props.content).toEqual({
      heading: 'Existing heading',
      slides: [{ title: 'Slide 1' }],
    })
  })

  it('skips invalid component entries with diagnostics', () => {
    const diagnostics: ReturnType<typeof normalizePageContent>['diagnostics'] = []
    const components = normalizeComponents([null, 'bad', { type: 'text-block' }], diagnostics)

    expect(components).toHaveLength(1)
    expect(components[0]).toMatchObject({
      id: 'component-2',
      type: 'text-block',
      parentId: null,
      position: 2,
    })
    expect(diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'PAGE_CONTENT_COMPONENT_INVALID',
      'PAGE_CONTENT_COMPONENT_INVALID',
      'PAGE_CONTENT_COMPONENT_ID_MISSING',
    ])
  })

  it('builds canonical persisted content while preserving extension fields', () => {
    const content = toCanonicalPageContent(
      {
        customField: 'keep-me',
        sections: [{ componentType: 'text-block', data: { content: { text: 'Legacy' } } }],
      },
      [{ id: 'a', type: 'text-block' }]
    )

    expect(content).toMatchObject({
      version: 1,
      customField: 'keep-me',
      components: [
        {
          id: 'a',
          type: 'text-block',
          parentId: null,
          position: 0,
          props: {},
          content: {},
          styles: {},
          metadata: {},
        },
      ],
    })
  })

  it('preserves component-level extension fields during normalization and canonical writes', () => {
    const content = toCanonicalPageContent({
      components: [
        {
          id: 'hero-1',
          type: 'hero-banner',
          parentId: null,
          position: 0,
          props: { content: { heading: 'Hello' } },
          bindings: { heading: 'cms.title' },
          regionHint: 'main',
          isShared: false,
        },
      ],
    })

    expect(content.components).toEqual([
      expect.objectContaining({
        id: 'hero-1',
        type: 'hero-banner',
        bindings: { heading: 'cms.title' },
        regionHint: 'main',
        isShared: false,
      }),
    ])
  })
})
