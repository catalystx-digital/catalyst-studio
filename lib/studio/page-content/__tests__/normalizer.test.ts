import {
  normalizePageContent,
  PageContentNormalizationError,
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

  it('reports non-array components in legacy-read and returns an empty component list', () => {
    const result = normalizePageContent({
      components: { id: 'not-array' },
    })

    expect(result.pageContent.components).toEqual([])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'PAGE_CONTENT_COMPONENTS_INVALID',
        severity: 'warn',
        path: 'components',
      }),
    ])
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('reports explicit %s components in legacy-read', (_label, components) => {
    const result = normalizePageContent({ components })

    expect(result.pageContent.components).toEqual([])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'PAGE_CONTENT_COMPONENTS_INVALID',
        severity: 'warn',
        path: 'components',
      }),
    ])
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

  it('reports JSON string page content with null components diagnostics', () => {
    const result = normalizePageContent(JSON.stringify({
      components: null,
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

  it('reports malformed root JSON-like page string in legacy-read', () => {
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

  it('reports malformed props.content in legacy-read but continues', () => {
    const result = normalizePageContent({
      components: [
        {
          id: 'text-1',
          type: 'text-block',
          props: { content: '{"text":' },
          content: {},
        },
      ],
    })

    expect(result.pageContent.components[0].props.content).toBe('{"text":')
    expect(result.pageContent.components[0].content).toEqual({})
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PAGE_CONTENT_COMPONENT_PROPS_CONTENT_JSON_PARSE_FAILED',
        severity: 'warn',
        path: 'components[0].props.content',
      }),
    ]))
  })

  it('reports malformed props.text in legacy-read while plain text does not', () => {
    const malformed = normalizePageContent({
      components: [
        {
          id: 'text-1',
          type: 'text-block',
          props: { text: '{"heading":' },
          content: {},
        },
      ],
    })
    const plain = normalizePageContent({
      components: [
        {
          id: 'text-2',
          type: 'text-block',
          props: { text: 'plain text' },
          content: {},
        },
      ],
    })

    expect(malformed.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'PAGE_CONTENT_COMPONENT_PROPS_TEXT_JSON_PARSE_FAILED',
        severity: 'warn',
        path: 'components[0].props.text',
      }),
    ]))
    expect(plain.diagnostics.map(diagnostic => diagnostic.code)).not.toContain(
      'PAGE_CONTENT_COMPONENT_PROPS_TEXT_JSON_PARSE_FAILED'
    )
  })

  it.each([
    '[Learn more](https://example.com)',
    '[todo]',
    '[- draft]',
    '[2026 Roadmap]',
    '[null hypothesis]',
    '{{name}}',
  ])('does not report parse diagnostics for plain props.text starting with JSON delimiters in legacy-read: %s', (text) => {
    const result = normalizePageContent({
      components: [
        {
          id: 'text-1',
          type: 'text-block',
          props: { text },
          content: {},
        },
      ],
    })

    expect(result.pageContent.components[0].props.text).toBe(text)
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).not.toContain(
      'PAGE_CONTENT_COMPONENT_PROPS_TEXT_JSON_PARSE_FAILED'
    )
  })

  it('reports malformed component.content in legacy-read', () => {
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

  it('normalizes legacy blog-list props.text blogs into canonical posts', () => {
    const result = normalizePageContent({
      components: [
        {
          id: 'blog-1',
          type: 'blog-list',
          props: {
            text: JSON.stringify({
              heading: 'News',
              blogs: [
                {
                  title: 'Launch notes',
                  excerpt: 'What changed this week',
                  date: '2026-05-01',
                  topic: 'Product',
                  link: '/blog/launch-notes',
                  image: { src: '/launch.jpg' },
                },
              ],
            }),
          },
          content: {},
        },
      ],
    })

    const component = result.pageContent.components[0]
    const expectedContent = {
      heading: 'News',
      title: 'News',
      blogs: [
        {
          title: 'Launch notes',
          excerpt: 'What changed this week',
          date: '2026-05-01',
          topic: 'Product',
          link: '/blog/launch-notes',
          image: { src: '/launch.jpg' },
        },
      ],
      posts: [
        {
          id: 'post-1',
          title: 'Launch notes',
          excerpt: 'What changed this week',
          date: '2026-05-01',
          topic: 'Product',
          link: '/blog/launch-notes',
          image: { src: '/launch.jpg' },
          publishDate: '2026-05-01',
          categories: ['Product'],
          slug: '/blog/launch-notes',
          thumbnail: { src: '/launch.jpg' },
        },
      ],
    }

    expect(component.content).toEqual(expectedContent)
    expect(component.props.content).toEqual(expectedContent)
  })

  it('does not overwrite non-empty blog-list posts with legacy blogs', () => {
    const result = normalizePageContent({
      components: [
        {
          id: 'blog-1',
          type: 'blog-list',
          props: {
            content: {
              posts: [{ id: 'canonical', title: 'Canonical post' }],
            },
            text: JSON.stringify({
              heading: 'Legacy News',
              blogs: [{ title: 'Legacy post' }],
            }),
          },
          content: {},
        },
      ],
    })

    const content = result.pageContent.components[0].content as Record<string, unknown>
    expect(content.posts).toEqual([{ id: 'canonical', title: 'Canonical post' }])
  })

  it('fills empty blog-list posts from legacy blogs', () => {
    const result = normalizePageContent({
      components: [
        {
          id: 'blog-1',
          type: 'blog-list',
          props: {
            content: {
              posts: [],
            },
            text: JSON.stringify({
              blogs: [{ id: 'legacy-id', title: 'Legacy post' }],
            }),
          },
          content: {},
        },
      ],
    })

    const content = result.pageContent.components[0].content as Record<string, unknown>
    expect(content.posts).toEqual([
      {
        id: 'legacy-id',
        title: 'Legacy post',
        slug: 'legacy-id',
      },
    ])
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
          props: {
            content: {
              blogs: [
                { excerpt: 'Missing required post fields' },
              ],
            },
          },
          content: {},
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

  it('rejects strict-write component payload fields that legacy-read coerces', () => {
    const malformedComponent = {
      id: 'bad-payload',
      type: 'text-block',
      props: {
        content: JSON.stringify({ text: 'Legacy content mirror' }),
        text: JSON.stringify({ text: 'Legacy text mirror' }),
      },
      data: 'not-an-object',
      content: JSON.stringify({ text: 'Legacy component content' }),
      styles: 'not-an-object',
      metadata: 'not-an-object',
    }

    const legacy = normalizePageContent({ components: [malformedComponent] })
    expect(legacy.pageContent.components[0]).toMatchObject({
      id: 'bad-payload',
      type: 'text-block',
      props: {
        content: { text: 'Legacy content mirror' },
        text: JSON.stringify({ text: 'Legacy text mirror' }),
      },
      content: { text: 'Legacy component content' },
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

  it('rejects invalid strict-write page metadata while legacy-read drops it', () => {
    const legacy = normalizePageContent({
      components: [{ id: 'a', type: 'text-block' }],
      metadata: 'not-an-object',
    })

    expect(legacy.pageContent.metadata).toBeUndefined()

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
          data: { content: { heading: 'Legacy data source' } },
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
  })
})
