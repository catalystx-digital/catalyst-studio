import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockNotFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
const mockRedirect = jest.fn((target: string) => {
  throw new Error(`NEXT_REDIRECT:${target}`)
})
const mockUnstableRethrow = jest.fn()
const mockResolveUrl = jest.fn()
const mockPageRendererHelper = jest.fn(() => <section data-testid="page-renderer">Rendered page</section>)
const mockFindDesignConcept = jest.fn()
const mockFindDesignSystem = jest.fn()
const mockGenerateDesignSystemCss = jest.fn(() => ':root { --color: red; }')
const mockLoadSharedComponentsById = jest.fn()
const mockEnrichComponentFromShared = jest.fn((component: unknown) => component)
const mockExtractSiteOriginFromMetadata = jest.fn(() => null)

jest.mock('next/navigation', () => ({
  __esModule: true,
  notFound: () => mockNotFound(),
  redirect: (target: string) => mockRedirect(target),
  unstable_rethrow: (error: unknown) => mockUnstableRethrow(error),
}))

jest.mock('@/lib/services/url-resolution/url-resolver', () => ({
  __esModule: true,
  UrlResolver: jest.fn().mockImplementation(() => ({
    resolveUrl: mockResolveUrl,
  })),
}))

jest.mock('@/lib/renderers/page-renderer', () => ({
  __esModule: true,
  PageRendererHelper: (props: unknown) => mockPageRendererHelper(props),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    websiteDesignConcept: {
      findFirst: (...args: unknown[]) => mockFindDesignConcept(...args),
    },
    websiteDesignSystem: {
      findFirst: (...args: unknown[]) => mockFindDesignSystem(...args),
    },
  },
}))

jest.mock('@/lib/studio/design-system/design-system-reader', () => ({
  __esModule: true,
  generateDesignSystemCss: (tokens: unknown) => mockGenerateDesignSystemCss(tokens),
}))

jest.mock('@/lib/studio/headless/ucs/page-resolver', () => ({
  __esModule: true,
  loadSharedComponentsById: (...args: unknown[]) => mockLoadSharedComponentsById(...args),
}))

jest.mock('@/lib/studio/headless/ucs/snapshot-builder', () => ({
  __esModule: true,
  enrichComponentFromShared: (...args: unknown[]) => mockEnrichComponentFromShared(...args),
  extractSiteOriginFromMetadata: (...args: unknown[]) => mockExtractSiteOriginFromMetadata(...args),
}))

function resolvedPage(overrides: Record<string, unknown> = {}) {
  return {
    siteStructure: {
      id: 'structure-1',
      parentId: null,
      slug: 'about',
      fullPath: '/about',
      position: 0,
      websitePageId: 'page-1',
    },
    contentItem: {
      id: 'page-1',
      title: 'About',
      content: {
        components: [
          {
            id: 'component-1',
            type: 'text-block',
            parentId: null,
            position: 0,
            props: { content: { text: 'Hello' } },
          },
        ],
        regions: [],
      },
      metadata: {},
      templateKey: null,
      templateProps: {},
    },
    ...overrides,
  }
}

describe('renderLocalWebsitePreview resolver strictness', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'info').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(console, 'debug').mockImplementation(() => undefined)
    mockFindDesignConcept.mockResolvedValue(null)
    mockFindDesignSystem.mockResolvedValue(null)
    mockLoadSharedComponentsById.mockResolvedValue([])
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('throws a resolver error with code, message, path, and website when resolveUrl returns success false', async () => {
    mockResolveUrl.mockResolvedValue({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Path contains invalid characters',
        details: { path: '/bad path' },
      },
    })

    const { renderLocalWebsitePreview } = await import('../local-renderer')

    await expect(renderLocalWebsitePreview({
      websiteId: 'website-1',
      slug: ['bad path'],
    })).rejects.toThrow(
      '[LocalPreview] resolveUrl failed: code=VALIDATION_ERROR message=Path contains invalid characters path=/bad path website=website-1'
    )
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  it('keeps success true with data null as notFound', async () => {
    mockResolveUrl.mockResolvedValue({ success: true, data: null })

    const { renderLocalWebsitePreview } = await import('../local-renderer')

    await expect(renderLocalWebsitePreview({
      websiteId: 'website-1',
      slug: ['missing'],
    })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalledTimes(1)
  })

  it('throws a malformed invariant when success true omits data', async () => {
    mockResolveUrl.mockResolvedValue({ success: true })

    const { renderLocalWebsitePreview } = await import('../local-renderer')

    await expect(renderLocalWebsitePreview({
      websiteId: 'website-1',
      slug: ['about'],
    })).rejects.toThrow(
      '[LocalPreview] Malformed resolver response: success=true data=undefined path=/about website=website-1'
    )
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  it('treats a missing contentItem as notFound when the structure has no page id', async () => {
    mockResolveUrl.mockResolvedValue({
      success: true,
      data: resolvedPage({
        siteStructure: {
          id: 'folder-1',
          parentId: null,
          slug: 'folder',
          fullPath: '/folder',
          position: 0,
          websitePageId: null,
        },
        contentItem: null,
      }),
    })

    const { renderLocalWebsitePreview } = await import('../local-renderer')

    await expect(renderLocalWebsitePreview({
      websiteId: 'website-1',
      slug: ['folder'],
    })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalledTimes(1)
  })

  it('treats an omitted contentItem as notFound when the structure page id is missing', async () => {
    mockResolveUrl.mockResolvedValue({
      success: true,
      data: {
        siteStructure: {
          id: 'folder-1',
          parentId: null,
          slug: 'folder',
          fullPath: '/folder',
          position: 0,
        },
      },
    })

    const { renderLocalWebsitePreview } = await import('../local-renderer')

    await expect(renderLocalWebsitePreview({
      websiteId: 'website-1',
      slug: ['folder'],
    })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalledTimes(1)
  })

  it('throws a broken invariant when the structure points to a page but contentItem is missing', async () => {
    mockResolveUrl.mockResolvedValue({
      success: true,
      data: resolvedPage({
        siteStructure: {
          id: 'structure-1',
          parentId: null,
          slug: 'about',
          fullPath: '/about',
          position: 0,
          websitePageId: 'page-1',
        },
        contentItem: null,
      }),
    })

    const { renderLocalWebsitePreview } = await import('../local-renderer')

    await expect(renderLocalWebsitePreview({
      websiteId: 'website-1',
      slug: ['about'],
    })).rejects.toThrow(
      '[LocalPreview] Broken resolver invariant: siteStructure.websitePageId=page-1 but contentItem is missing path=/about website=website-1'
    )
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  it('propagates thrown resolver errors', async () => {
    mockResolveUrl.mockRejectedValue(new Error('database unavailable'))

    const { renderLocalWebsitePreview } = await import('../local-renderer')

    await expect(renderLocalWebsitePreview({
      websiteId: 'website-1',
      slug: ['about'],
    })).rejects.toThrow('database unavailable')
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  it('renders when resolver returns a linked page', async () => {
    mockResolveUrl.mockResolvedValue({
      success: true,
      data: resolvedPage(),
    })
    mockFindDesignSystem.mockResolvedValue({ tokens: { color: 'red' } })

    const { renderLocalWebsitePreview } = await import('../local-renderer')
    const element = await renderLocalWebsitePreview({
      websiteId: 'website-1',
      slug: ['about'],
    })

    const html = renderToStaticMarkup(element as React.ReactElement)
    expect(html).toContain('studio-local-preview-design-system')
    expect(html).toContain('Rendered page')
    expect(mockPageRendererHelper).toHaveBeenCalledWith(expect.objectContaining({
      page: expect.objectContaining({
        id: 'page-1',
        fullPath: '/about',
      }),
      sharedComponents: [],
    }))
  })

  it('renders a diagnostic error panel and skips PageRendererHelper for invalid page content', async () => {
    mockResolveUrl.mockResolvedValue({
      success: true,
      data: resolvedPage({
        contentItem: {
          ...resolvedPage().contentItem,
          content: { components: { id: 'not-array' } },
        },
      }),
    })

    const { renderLocalWebsitePreview } = await import('../local-renderer')
    const element = await renderLocalWebsitePreview({
      websiteId: 'website-1',
      slug: ['about'],
    })

    const html = renderToStaticMarkup(element as React.ReactElement)
    expect(html).toContain('Preview unavailable')
    expect(html).toContain('PAGE_CONTENT_COMPONENTS_INVALID')
    expect(html).toContain('Components value is not an array')
    expect(html).toContain('components')
    expect(html).toContain('/about')
    expect(html).toContain('page-1')
    expect(mockPageRendererHelper).not.toHaveBeenCalled()
  })

  it('renders a diagnostic error panel and skips PageRendererHelper for legacy root-array content', async () => {
    mockResolveUrl.mockResolvedValue({
      success: true,
      data: resolvedPage({
        contentItem: {
          ...resolvedPage().contentItem,
          content: [
            {
              id: 'component-1',
              type: 'text-block',
              parentId: null,
              position: 0,
              props: { content: { text: 'Hello' } },
            },
          ],
        },
      }),
    })

    const { renderLocalWebsitePreview } = await import('../local-renderer')
    const element = await renderLocalWebsitePreview({
      websiteId: 'website-1',
      slug: ['about'],
    })

    const html = renderToStaticMarkup(element as React.ReactElement)
    expect(html).toContain('Preview unavailable')
    expect(html).toContain('PAGE_CONTENT_LEGACY_ARRAY')
    expect(html).toContain('Legacy array page content is not valid PageContentV1 content')
    expect(html).toContain('$')
    expect(html).toContain('/about')
    expect(html).toContain('page-1')
    expect(mockPageRendererHelper).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith(
      '[LocalPreview] Page content diagnostics blocked preview render',
      expect.objectContaining({
        requestPath: '/about',
        websiteId: 'website-1',
        pageId: 'page-1',
        fullPath: '/about',
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'PAGE_CONTENT_LEGACY_ARRAY',
            severity: 'warn',
            path: '$',
          }),
        ]),
      })
    )
  })
})
