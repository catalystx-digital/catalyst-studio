import {
  normalizePageContent,
  PageContentNormalizationError,
  pageContentV1Schema,
  normalizeComponents,
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
          props: { variant: 'split' },
          content: { heading: 'Hello' },
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
      props: { variant: 'split' },
      content: { heading: 'Hello' },
    })
    expect(pageContentV1Schema.parse(result.pageContent)).toEqual(result.pageContent)
  })

  it('defaults to canonical-read and derives content only from component.content', () => {
    const result = normalizePageContent({
      components: [
        {
          id: 'hero-1',
          type: 'hero-banner',
          props: {
            content: { heading: 'Legacy props.content heading' },
            text: JSON.stringify({ heading: 'Legacy props.text heading' }),
            eyebrow: 'Kept prop',
          },
          content: {},
        },
        {
          id: 'text-1',
          type: 'text-block',
          props: {
            content: { text: 'Legacy props.content text' },
            text: JSON.stringify({ text: 'Legacy props.text text' }),
            align: 'center',
          },
        },
        {
          id: 'feature-1',
          type: 'feature-grid',
          data: {
            content: { heading: 'Legacy data.content heading' },
            text: JSON.stringify({ heading: 'Legacy data.text heading' }),
            columns: 3,
          },
        },
      ],
    })

    expect(result.pageContent.components[0].content).toEqual({})
    expect(result.pageContent.components[0].props).toEqual({ eyebrow: 'Kept prop' })
    expect(result.pageContent.components[1].content).toEqual({})
    expect(result.pageContent.components[1].props).toEqual({ align: 'center' })
    expect(result.pageContent.components[2].content).toEqual({})
    expect(result.pageContent.components[2].props).toEqual({ columns: 3 })
    expect(result.pageContent.components[2]).not.toHaveProperty('data')
    expect(result.diagnostics).toEqual([])
  })

  it('canonical-read uses component.content over stale props mirrors and strips props.content and props.text', () => {
    const result = normalizePageContent({
      components: [
        {
          id: 'hero-1',
          type: 'hero-banner',
          props: {
            content: { heading: 'Stale props.content heading' },
            text: JSON.stringify({ heading: 'Stale props.text heading' }),
            variant: 'split',
          },
          content: { heading: 'Canonical heading' },
        },
      ],
    }, { mode: 'canonical-read' })

    const component = result.pageContent.components[0]
    expect(component.content).toEqual({ heading: 'Canonical heading' })
    expect(component.props).toEqual({ variant: 'split' })
    expect(result.diagnostics).toEqual([])
  })

  it('normalizes blog-list canonical content without reading legacy props mirrors', () => {
    const result = normalizePageContent({
      components: [
        {
          id: 'blog-1',
          type: 'blog-list',
          props: {
            content: {
              blogs: [{ id: 'legacy-id', title: 'Legacy post' }],
            },
          },
          content: {
            heading: 'News',
            blogs: [
              {
                id: 'canonical-id',
                title: 'Canonical post',
                date: '2026-05-01',
                topic: 'Product',
                image: { src: '/launch.jpg' },
              },
            ],
          },
        },
      ],
    })

    expect(result.pageContent.components[0].content).toEqual({
      heading: 'News',
      title: 'News',
      blogs: [
        {
          id: 'canonical-id',
          title: 'Canonical post',
          date: '2026-05-01',
          topic: 'Product',
          image: { src: '/launch.jpg' },
        },
      ],
      posts: [
        {
          id: 'canonical-id',
          title: 'Canonical post',
          date: '2026-05-01',
          topic: 'Product',
          image: { src: '/launch.jpg' },
          publishDate: '2026-05-01',
          categories: ['Product'],
          slug: 'canonical-id',
          thumbnail: { src: '/launch.jpg' },
        },
      ],
    })
    expect(result.pageContent.components[0].props).toEqual({})
  })

  it('reports JSON string page content and non-array components diagnostics', () => {
    const result = normalizePageContent(JSON.stringify({
      components: { id: 'not-array' },
    }))

    expect(result.pageContent.components).toEqual([])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'PAGE_CONTENT_JSON_STRING',
        severity: 'info',
        path: '$',
      }),
      expect.objectContaining({
        code: 'PAGE_CONTENT_COMPONENTS_INVALID',
        severity: 'warn',
        path: 'components',
      }),
    ])
  })

  it('treats explicit components as authoritative over legacy sections even when invalid', () => {
    const result = normalizePageContent({
      components: { id: 'not-array' },
      sections: [
        {
          id: 'section-1',
          type: 'text-block',
        },
      ],
    })

    expect(result.pageContent.components).toEqual([])
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'PAGE_CONTENT_COMPONENTS_INVALID',
    ])
  })

  it('reports malformed root JSON-like page string in canonical-read', () => {
    const result = normalizePageContent('{"components":')

    expect(result.pageContent.components).toEqual([])
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PAGE_CONTENT_JSON_PARSE_FAILED',
        severity: 'warn',
        path: '$',
      }),
    ]))
  })

  it('throws for malformed root JSON-like page string in strict-write', () => {
    try {
      normalizePageContent('{"components":', { mode: 'strict-write' })
      throw new Error('Expected strict normalization to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(PageContentNormalizationError)
      expect((error as PageContentNormalizationError).diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'PAGE_CONTENT_JSON_PARSE_FAILED',
          severity: 'error',
          path: '$',
        }),
      ]))
    }
  })

  it('reports malformed component.content in canonical-read', () => {
    const result = normalizePageContent({
      components: [
        {
          id: 'text-1',
          type: 'text-block',
          props: {},
          content: '{"text":',
        },
      ],
    })

    expect(result.pageContent.components[0].content).toEqual({})
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PAGE_CONTENT_COMPONENT_CONTENT_JSON_PARSE_FAILED',
        severity: 'warn',
        path: 'components[0].content',
      }),
    ]))
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

  it('rejects object props.content as a strict-write source', () => {
    try {
      toCanonicalPageContent(
        {},
        [
          {
            id: 'hero-1',
            type: 'hero-banner',
            parentId: null,
            position: 0,
            props: { content: { heading: 'Hello' } },
            content: {},
            styles: {},
            metadata: {},
          },
        ],
        { mode: 'strict-write' }
      )
      throw new Error('Expected strict canonical write to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(PageContentNormalizationError)
      expect((error as PageContentNormalizationError).diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: 'PAGE_CONTENT_COMPONENT_PROPS_CONTENT_LEGACY',
          path: 'components[0].props.content',
          severity: 'error',
        }),
      ]))
    }
  })

  it.each([
    { heading: 'Hello' },
    123,
  ])('rejects data.content as a strict-write source: %p', (content) => {
    try {
      toCanonicalPageContent(
        {},
        [
          {
            id: 'hero-1',
            type: 'hero-banner',
            parentId: null,
            position: 0,
            data: { content },
            content: { heading: 'Canonical' },
            styles: {},
            metadata: {},
          },
        ],
        { mode: 'strict-write' }
      )
      throw new Error('Expected strict canonical write to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(PageContentNormalizationError)
      expect((error as PageContentNormalizationError).diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: typeof content === 'string'
            ? 'PAGE_CONTENT_COMPONENT_DATA_CONTENT_STRING'
            : 'PAGE_CONTENT_COMPONENT_DATA_CONTENT_LEGACY',
          path: 'components[0].data.content',
          severity: 'error',
        }),
      ]))
    }
  })

  it('accepts canonical component.content in strict-write without props.content', () => {
    const content = toCanonicalPageContent(
      {},
      [
        {
          id: 'hero-1',
          type: 'hero-banner',
          parentId: null,
          position: 0,
          props: {},
          content: { heading: 'Hello' },
          styles: {},
          metadata: {},
        },
      ],
      { mode: 'strict-write' }
    )

    const component = (content.components as Array<Record<string, unknown>>)[0]
    expect(component.content).toEqual({ heading: 'Hello' })
    expect(component.props).toEqual({})
  })

  it('rejects invalid strict-write content with diagnostics', () => {
    expect(() => normalizePageContent('not page content', { mode: 'strict-write' }))
      .toThrow(PageContentNormalizationError)

    try {
      normalizePageContent({ components: { id: 'not-array' } }, { mode: 'strict-write' })
      throw new Error('Expected strict normalization to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(PageContentNormalizationError)
      expect((error as PageContentNormalizationError).diagnostics).toEqual([
        expect.objectContaining({
          code: 'PAGE_CONTENT_COMPONENTS_INVALID',
          severity: 'error',
          path: 'components',
        }),
      ])
    }
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('rejects explicit %s components in strict-write', (_label, components) => {
    try {
      normalizePageContent({ components }, { mode: 'strict-write' })
      throw new Error('Expected strict normalization to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(PageContentNormalizationError)
      expect((error as PageContentNormalizationError).diagnostics).toEqual([
        expect.objectContaining({
          code: 'PAGE_CONTENT_COMPONENTS_INVALID',
          severity: 'error',
          path: 'components',
        }),
      ])
    }
  })

  it('rejects strict-write components that would fabricate ids or types', () => {
    try {
      toCanonicalPageContent({}, [
        null,
        { id: 'missing-type' },
        { type: 'text-block' },
      ], { mode: 'strict-write' })
      throw new Error('Expected strict canonical write to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(PageContentNormalizationError)
      expect((error as PageContentNormalizationError).diagnostics.map(diagnostic => diagnostic.code)).toEqual([
        'PAGE_CONTENT_COMPONENT_INVALID',
        'PAGE_CONTENT_COMPONENT_TYPE_MISSING',
        'PAGE_CONTENT_COMPONENT_ID_MISSING',
      ])
    }
  })

  it('rejects strict-write blog-list entries that would fabricate post fields', () => {
    try {
      toCanonicalPageContent({}, [
        {
          id: 'blog-1',
          type: 'blog-list',
          props: {},
          content: {
            blogs: [
              { excerpt: 'Missing required post fields' },
            ],
          },
        },
      ], { mode: 'strict-write' })
      throw new Error('Expected strict canonical write to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(PageContentNormalizationError)
      expect((error as PageContentNormalizationError).diagnostics.map(diagnostic => diagnostic.code)).toEqual([
        'PAGE_CONTENT_BLOG_ENTRY_TITLE_MISSING',
        'PAGE_CONTENT_BLOG_ENTRY_ID_MISSING',
        'PAGE_CONTENT_BLOG_ENTRY_SLUG_MISSING',
      ])
    }
  })

  it('rejects strict-write component payload fields that canonical-read ignores or strips', () => {
    const malformedComponent = {
      id: 'bad-payload',
      type: 'text-block',
      props: {
        content: JSON.stringify({ text: 'Legacy content mirror' }),
        text: JSON.stringify({ text: 'Legacy text mirror' }),
      },
      data: 'not-an-object',
      content: JSON.stringify({ text: 'Canonical component content' }),
      styles: 'not-an-object',
      metadata: 'not-an-object',
    }

    const canonical = normalizePageContent({ components: [malformedComponent] })
    expect(canonical.pageContent.components[0]).toMatchObject({
      id: 'bad-payload',
      type: 'text-block',
      props: {},
      content: { text: 'Canonical component content' },
      styles: {},
      metadata: {},
    })

    try {
      toCanonicalPageContent({}, [malformedComponent], { mode: 'strict-write' })
      throw new Error('Expected strict canonical write to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(PageContentNormalizationError)
      expect((error as PageContentNormalizationError).diagnostics.map(diagnostic => diagnostic.code)).toEqual([
        'PAGE_CONTENT_COMPONENT_DATA_INVALID',
        'PAGE_CONTENT_COMPONENT_PROPS_CONTENT_STRING',
        'PAGE_CONTENT_COMPONENT_PROPS_TEXT_LEGACY_JSON',
        'PAGE_CONTENT_COMPONENT_CONTENT_INVALID',
        'PAGE_CONTENT_COMPONENT_STYLES_INVALID',
        'PAGE_CONTENT_COMPONENT_METADATA_INVALID',
      ])
    }
  })

  it('rejects any strict-write props.content string payload', () => {
    for (const content of ['plain text content', '{malformed json']) {
      try {
        toCanonicalPageContent({}, [
          {
            id: `string-content-${content.length}`,
            type: 'text-block',
            props: { content },
            content: {},
          },
        ], { mode: 'strict-write' })
        throw new Error('Expected strict canonical write to throw')
      } catch (error) {
        expect(error).toBeInstanceOf(PageContentNormalizationError)
        expect((error as PageContentNormalizationError).diagnostics).toEqual(expect.arrayContaining([
          expect.objectContaining({
            code: 'PAGE_CONTENT_COMPONENT_PROPS_CONTENT_STRING',
            path: 'components[0].props.content',
            severity: 'error',
          }),
        ]))
      }
    }
  })

  it('rejects malformed JSON-like props.text in strict-write', () => {
    for (const text of ['{"heading":', '[{"x":']) {
      try {
        toCanonicalPageContent({}, [
          {
            id: 'text-1',
            type: 'text-block',
            props: { text },
            content: {},
          },
        ], { mode: 'strict-write' })
        throw new Error('Expected strict canonical write to throw')
      } catch (error) {
        expect(error).toBeInstanceOf(PageContentNormalizationError)
        expect((error as PageContentNormalizationError).diagnostics).toEqual(expect.arrayContaining([
          expect.objectContaining({
            code: 'PAGE_CONTENT_COMPONENT_PROPS_TEXT_JSON_PARSE_FAILED',
            path: 'components[0].props.text',
            severity: 'error',
          }),
        ]))
      }
    }
  })

  it.each([
    '[Draft] Title',
    '[todo]',
    '[- draft]',
    '[2026 Roadmap]',
    '[null hypothesis]',
    '{{name}}',
  ])('does not reject plain props.text starting with JSON delimiters in strict-write: %s', (text) => {
    expect(() => toCanonicalPageContent({}, [
      {
        id: 'text-1',
        type: 'text-block',
        props: { text },
        content: {},
      },
    ], { mode: 'strict-write' })).not.toThrow()
  })

  it('rejects invalid strict-write page metadata while canonical-read drops it', () => {
    const canonical = normalizePageContent({
      components: [{ id: 'a', type: 'text-block' }],
      metadata: 'not-an-object',
    })

    expect(canonical.pageContent.metadata).toBeUndefined()

    try {
      normalizePageContent({
        components: [{ id: 'a', type: 'text-block' }],
        metadata: 'not-an-object',
      }, { mode: 'strict-write' })
      throw new Error('Expected strict normalization to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(PageContentNormalizationError)
      expect((error as PageContentNormalizationError).diagnostics).toEqual([
        expect.objectContaining({
          code: 'PAGE_CONTENT_METADATA_INVALID',
          path: 'metadata',
          severity: 'error',
        }),
      ])
    }
  })

  it('omits strict-write legacy source fields while preserving extensions', () => {
    const content = toCanonicalPageContent(
      {
        customField: 'keep-me',
        sections: [{ id: 'legacy-section', type: 'text-block' }],
        metadata: { source: 'test' },
      },
      [
        {
          id: 'hero-1',
          type: 'hero-banner',
          componentType: 'hero-banner',
          props: { eyebrow: 'Keep me' },
          data: { eyebrow: 'Legacy data source' },
          content: { heading: 'Canonical source' },
          bindings: { heading: 'cms.title' },
        },
      ],
      { mode: 'strict-write' }
    )

    expect(content).toMatchObject({
      version: 1,
      customField: 'keep-me',
      metadata: { source: 'test' },
      components: [
        expect.objectContaining({
          id: 'hero-1',
          type: 'hero-banner',
          bindings: { heading: 'cms.title' },
        }),
      ],
    })
    expect(content).not.toHaveProperty('sections')
    const components = content.components as Array<Record<string, unknown>>
    expect(components[0]).not.toHaveProperty('data')
    expect(components[0]).not.toHaveProperty('componentType')
    expect(components[0].content).toEqual({ heading: 'Canonical source' })
    expect(components[0].props).toEqual({ eyebrow: 'Keep me' })
  })
})
