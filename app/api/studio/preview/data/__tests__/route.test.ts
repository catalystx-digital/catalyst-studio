jest.mock('@/lib/db/client', () => ({
  getClient: jest.fn(),
}))

jest.mock('@/lib/studio/preview/access', () => ({
  authorizePreviewRead: jest.fn(),
  previewAccessErrorResponse: jest.fn(),
}))

const mockReadNullableShadcnDesignSystemTokens = jest.fn(() => ({
  variables: {},
  darkVariables: {},
}))
const mockGenerateStrictDesignSystemCss = jest.fn(() => ':root {}')
var mockDesignSystemReaderError: new (
  code: string,
  message: string,
  context?: Record<string, unknown>
) => Error & { code: string; context?: Record<string, unknown> }

jest.mock('@/lib/studio/design-system/design-system-reader', () => {
  mockDesignSystemReaderError = class extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly context?: Record<string, unknown>
    ) {
      super(message)
      this.name = 'DesignSystemReaderError'
    }
  }

  return {
    DesignSystemReaderError: mockDesignSystemReaderError,
    isDesignSystemReaderError: (error: unknown) => {
      const record = error as { code?: unknown; message?: unknown; context?: unknown }
      return (
        typeof record?.message === 'string' &&
        (
          record.code === 'DESIGN_SYSTEM_MISSING' ||
          record.code === 'DESIGN_CONCEPT_NOT_FOUND' ||
          record.code === 'DESIGN_SYSTEM_LEGACY_PAYLOAD' ||
          record.code === 'DESIGN_SYSTEM_INVALID_PAYLOAD'
        ) &&
        (
          record.context === undefined ||
          record.context === null ||
          (typeof record.context === 'object' && !Array.isArray(record.context))
        )
      )
    },
    readNullableShadcnDesignSystemTokens: (...args: unknown[]) => mockReadNullableShadcnDesignSystemTokens(...args),
    generateStrictDesignSystemCss: (...args: unknown[]) => mockGenerateStrictDesignSystemCss(...args),
  }
})

import { NextRequest } from 'next/server'
import { getClient } from '@/lib/db/client'
import { authorizePreviewRead } from '@/lib/studio/preview/access'
import { GET } from '@/app/api/studio/preview/data/route'
import {
  extractComponents,
  extractComponentsWithDiagnostics,
} from '@/lib/studio/preview/component-extraction'

describe('preview data component extraction', () => {
  it('emits canonical component.content without props.content projection', () => {
    const [component] = extractComponents({
      components: [
        {
          id: 'component-1',
          type: 'hero-banner',
          parentId: null,
          position: 0,
          props: {
            content: { heading: 'Stale props.content heading' },
          },
          content: { heading: 'Canonical heading' },
          styles: {},
          metadata: {},
        },
      ],
    })

    expect(component.content).toEqual({ heading: 'Canonical heading' })
    expect(component.props).not.toHaveProperty('content')
  })

  it('returns diagnostics for malformed page content without changing extractComponents compatibility', () => {
    const compatibleComponents = extractComponents({ components: { id: 'not-array' } })
    const diagnosticResult = extractComponentsWithDiagnostics(
      { components: { id: 'not-array' } },
      {
        pageId: 'page-1',
        pageTitle: 'About',
        slug: 'about',
        fullPath: '/about',
      }
    )

    expect(compatibleComponents).toEqual([])
    expect(diagnosticResult.components).toEqual([])
    expect(diagnosticResult.diagnostics).toEqual([
      expect.objectContaining({
        code: 'PAGE_CONTENT_COMPONENTS_INVALID',
        severity: 'warn',
        path: 'components',
        pageId: 'page-1',
        pageTitle: 'About',
        slug: 'about',
        fullPath: '/about',
      }),
    ])
  })

  it('returns diagnostics for legacy root-array content', () => {
    const compatibleComponents = extractComponents([
      {
        id: 'component-1',
        type: 'text-block',
        content: { text: 'Legacy array content' },
      },
    ])
    const diagnosticResult = extractComponentsWithDiagnostics(
      [
        {
          id: 'component-1',
          type: 'text-block',
          content: { text: 'Legacy array content' },
        },
      ],
      {
        pageId: 'page-1',
        pageTitle: 'About',
        slug: 'about',
        fullPath: '/about',
      }
    )

    expect(compatibleComponents).toEqual([])
    expect(diagnosticResult.components).toEqual([])
    expect(diagnosticResult.diagnostics).toEqual([
      expect.objectContaining({
        code: 'PAGE_CONTENT_LEGACY_ARRAY',
        severity: 'warn',
        path: '$',
        pageId: 'page-1',
        pageTitle: 'About',
        slug: 'about',
        fullPath: '/about',
      }),
    ])
  })

  it('returns diagnostics for legacy sections content', () => {
    const diagnosticResult = extractComponentsWithDiagnostics(
      {
        sections: [
          {
            id: 'section-1',
            type: 'text-block',
            content: { text: 'Legacy sections content' },
          },
        ],
      },
      {
        pageId: 'page-1',
        pageTitle: 'About',
        slug: 'about',
        fullPath: '/about',
      }
    )

    expect(diagnosticResult.components).toEqual([])
    expect(diagnosticResult.diagnostics).toEqual([
      expect.objectContaining({
        code: 'PAGE_CONTENT_LEGACY_SECTIONS',
        severity: 'warn',
        path: 'sections',
        pageId: 'page-1',
        pageTitle: 'About',
        slug: 'about',
        fullPath: '/about',
      }),
    ])
  })

  it('returns diagnostics for legacy single-component content', () => {
    const diagnosticResult = extractComponentsWithDiagnostics(
      {
        id: 'component-1',
        type: 'text-block',
        content: { text: 'Legacy single component content' },
      },
      {
        pageId: 'page-1',
        pageTitle: 'About',
        slug: 'about',
        fullPath: '/about',
      }
    )

    expect(diagnosticResult.components).toEqual([])
    expect(diagnosticResult.diagnostics).toEqual([
      expect.objectContaining({
        code: 'PAGE_CONTENT_LEGACY_SINGLE_COMPONENT',
        severity: 'warn',
        path: '$',
        pageId: 'page-1',
        pageTitle: 'About',
        slug: 'about',
        fullPath: '/about',
      }),
    ])
  })
})

describe('preview data GET diagnostics', () => {
  const mockPrisma = {
    website: {
      findUnique: jest.fn(),
    },
    websiteDesignConcept: {
      findFirst: jest.fn(),
    },
    websiteDesignSystem: {
      findFirst: jest.fn(),
    },
    websitePage: {
      findMany: jest.fn(),
    },
    websiteStructure: {
      findMany: jest.fn(),
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'info').mockImplementation(() => undefined)
    ;(getClient as jest.Mock).mockReturnValue(mockPrisma)
    ;(authorizePreviewRead as jest.Mock).mockResolvedValue({ mode: 'session' })
    mockPrisma.website.findUnique.mockResolvedValue({
      id: 'website-1',
      name: 'Website',
    })
    mockPrisma.websiteDesignConcept.findFirst.mockResolvedValue(null)
    mockPrisma.websiteDesignSystem.findFirst.mockResolvedValue(null)
    mockReadNullableShadcnDesignSystemTokens.mockReturnValue({
      variables: {},
      darkVariables: undefined,
    })
    mockGenerateStrictDesignSystemCss.mockReturnValue(':root {}')
    mockPrisma.websitePage.findMany.mockResolvedValue([
      {
        id: 'page-1',
        title: 'About',
        content: {
          regions: [],
          components: [],
        },
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ])
    mockPrisma.websiteStructure.findMany.mockResolvedValue([
      {
        id: 'structure-1',
        parentId: null,
        websitePageId: 'page-1',
        slug: 'about',
        fullPath: '/about',
        position: 0,
      },
    ])
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns explicit empty/no-style state when design system tokens are missing', async () => {
    mockReadNullableShadcnDesignSystemTokens.mockReturnValue(null)
    mockGenerateStrictDesignSystemCss.mockReturnValue(null)

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.designSystem).toEqual({ variables: {}, darkVariables: undefined })
    expect(body.data.designSystemCss).toBe('')
  })

  it('returns current shadcn token payloads without runtime defaults', async () => {
    mockReadNullableShadcnDesignSystemTokens.mockReturnValue({
      variables: { '--primary': '240 5.9% 10%' },
      darkVariables: undefined,
    })
    mockGenerateStrictDesignSystemCss.mockReturnValue(':root {\n  --primary: 240 5.9% 10%;\n}')

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.designSystem.variables).toEqual({ '--primary': '240 5.9% 10%' })
    expect(body.data.designSystemCss).not.toContain('--background')
  })

  it('preserves page metadata needed by sandbox preview rendering', async () => {
    mockPrisma.websitePage.findMany.mockResolvedValue([
      {
        id: 'page-1',
        title: 'Imported Home',
        templateKey: 'core/generic-default',
        templateProps: { density: 'compact' },
        metadata: {
          importSource: 'https://example.com/',
          importStatus: 'committed',
        },
        content: {
          regions: [],
          components: [],
        },
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.pages[0]).toEqual(expect.objectContaining({
      templateKey: 'core/generic-default',
      templateProps: { density: 'compact' },
      metadata: {
        importSource: 'https://example.com/',
        importStatus: 'committed',
      },
    }))
  })

  it('scopes QA token access to the signed preview path', async () => {
    ;(authorizePreviewRead as jest.Mock).mockResolvedValue({ mode: 'qa-token' })
    mockPrisma.websitePage.findMany.mockResolvedValue([
      {
        id: 'page-home',
        title: 'Home',
        content: { regions: [], components: [] },
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
      {
        id: 'page-about',
        title: 'About',
        content: { regions: [], components: [] },
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
      },
    ])
    mockPrisma.websiteStructure.findMany.mockResolvedValue([
      {
        id: 'structure-home',
        parentId: null,
        websitePageId: 'page-home',
        slug: '',
        fullPath: '/',
        position: 0,
      },
      {
        id: 'structure-about',
        parentId: 'structure-home',
        websitePageId: 'page-about',
        slug: 'about',
        fullPath: '/about',
        position: 1,
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1&path=/about&previewToken=token-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(authorizePreviewRead).toHaveBeenCalledWith(expect.any(NextRequest), 'website-1', {
      previewToken: 'token-1',
      path: '/about',
    })
    expect(body.data.pages).toEqual([
      expect.objectContaining({
        id: 'page-about',
        title: 'About',
        fullPath: '/about',
      }),
    ])
  })

  it('returns 404 when QA token path does not match an existing preview page', async () => {
    ;(authorizePreviewRead as jest.Mock).mockResolvedValue({ mode: 'qa-token' })

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1&path=/missing&previewToken=token-1'))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(body).toEqual({
      success: false,
      error: 'Preview page not found for signed path',
    })
  })

  it('uses WebsiteStructure.fullPath rather than slug when scoping QA token pages', async () => {
    ;(authorizePreviewRead as jest.Mock).mockResolvedValue({ mode: 'qa-token' })
    mockPrisma.websiteStructure.findMany.mockResolvedValue([
      {
        id: 'structure-1',
        parentId: null,
        websitePageId: 'page-1',
        slug: 'home',
        fullPath: '/',
        position: 0,
      },
    ])

    const rootResponse = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1&path=/&previewToken=token-1'))
    const rootBody = await rootResponse.json()
    const slugResponse = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1&path=/home&previewToken=token-1'))

    expect(rootResponse.status).toBe(200)
    expect(rootBody.data.pages).toEqual([
      expect.objectContaining({
        id: 'page-1',
        slug: 'home',
        fullPath: '/',
      }),
    ])
    expect(slugResponse.status).toBe(404)
  })

  it('returns the first renderable page for a signed root QA preview when root has no page', async () => {
    ;(authorizePreviewRead as jest.Mock).mockResolvedValue({ mode: 'qa-token' })
    mockPrisma.websitePage.findMany.mockResolvedValue([
      {
        id: 'page-en-us',
        title: 'Mozilla',
        content: { components: [] },
        templateKey: 'marketing/home-default',
        templateProps: {},
        metadata: {},
      },
    ])
    mockPrisma.websiteStructure.findMany.mockResolvedValue([
      {
        id: 'structure-en-us',
        parentId: null,
        websitePageId: 'page-en-us',
        slug: 'en-us',
        fullPath: '/en-us',
        position: 0,
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1&path=/&previewToken=token-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(body.data.pages).toEqual([
      expect.objectContaining({
        id: 'page-en-us',
        title: 'Mozilla',
        fullPath: '/en-us',
      }),
    ])
  })

  it('uses preview route fallback ordering for signed root QA preview data', async () => {
    ;(authorizePreviewRead as jest.Mock).mockResolvedValue({ mode: 'qa-token' })
    mockPrisma.websitePage.findMany.mockResolvedValue([
      {
        id: 'page-deep',
        title: 'Deep Page',
        content: { components: [] },
        templateKey: 'marketing/home-default',
        templateProps: {},
        metadata: {},
      },
      {
        id: 'page-shallow',
        title: 'Shallow Page',
        content: { components: [] },
        templateKey: 'marketing/home-default',
        templateProps: {},
        metadata: {},
      },
    ])
    mockPrisma.websiteStructure.findMany.mockResolvedValue([
      {
        id: 'structure-deep',
        parentId: 'parent-1',
        websitePageId: 'page-deep',
        slug: 'deep',
        fullPath: '/about/deep',
        pathDepth: 2,
        position: 0,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'structure-shallow',
        parentId: null,
        websitePageId: 'page-shallow',
        slug: 'shallow',
        fullPath: '/shallow',
        pathDepth: 1,
        position: 10,
        createdAt: new Date('2026-02-01T00:00:00Z'),
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1&path=/&previewToken=token-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.pages).toEqual([
      expect.objectContaining({
        id: 'page-shallow',
        fullPath: '/shallow',
      }),
    ])
  })

  it('returns 422 diagnostics for invalid design system tokens', async () => {
    mockReadNullableShadcnDesignSystemTokens.mockImplementation(() => {
      throw new mockDesignSystemReaderError(
        'DESIGN_SYSTEM_INVALID_PAYLOAD',
        'Design-system payload is not valid current shadcn token data.',
        { websiteId: 'website-1', designSystemId: 'design-system-1' }
      )
    })

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1'))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({
      success: false,
      error: 'Design-system payload is not valid current shadcn token data.',
      diagnostics: [
        expect.objectContaining({
          code: 'DESIGN_SYSTEM_INVALID_PAYLOAD',
          severity: 'error',
          context: expect.objectContaining({
            websiteId: 'website-1',
            designSystemId: 'design-system-1',
          }),
        }),
      ],
    })
  })

  it('returns 422 diagnostics for legacy design system tokens', async () => {
    mockReadNullableShadcnDesignSystemTokens.mockImplementation(() => {
      throw new mockDesignSystemReaderError(
        'DESIGN_SYSTEM_LEGACY_PAYLOAD',
        'Legacy palette design-system payloads are not valid runtime shadcn tokens.',
        { websiteId: 'website-1', designSystemId: 'design-system-1' }
      )
    })

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1'))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.diagnostics).toEqual([
      expect.objectContaining({
        code: 'DESIGN_SYSTEM_LEGACY_PAYLOAD',
        severity: 'error',
        message: 'Legacy palette design-system payloads are not valid runtime shadcn tokens.',
      }),
    ])
  })

  it('returns 422 when a requested design concept does not exist', async () => {
    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1&designConcept=missing-concept'))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(mockPrisma.websiteDesignSystem.findFirst).not.toHaveBeenCalled()
    expect(body).toEqual({
      success: false,
      error: 'Design concept "missing-concept" was not found.',
      diagnostics: [
        {
          code: 'DESIGN_CONCEPT_NOT_FOUND',
          severity: 'error',
          message: 'Design concept "missing-concept" was not found.',
          context: { websiteId: 'website-1', selector: 'missing-concept' },
        },
      ],
    })
  })

  it('returns 422 with page-context diagnostics for malformed page content', async () => {
    mockPrisma.websitePage.findMany.mockResolvedValue([
      {
        id: 'page-1',
        title: 'About',
        content: { components: { id: 'not-array' } },
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1'))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({
      success: false,
      error: 'Preview data contains invalid page content',
      diagnostics: [
        expect.objectContaining({
          code: 'PAGE_CONTENT_COMPONENTS_INVALID',
          severity: 'warn',
          message: expect.stringContaining('Components value is not an array'),
          path: 'components',
          pageId: 'page-1',
          pageTitle: 'About',
          slug: 'about',
          fullPath: '/about',
        }),
      ],
    })
  })

  it('returns 422 with page-context diagnostics for legacy root-array page content', async () => {
    mockPrisma.websitePage.findMany.mockResolvedValue([
      {
        id: 'page-1',
        title: 'About',
        content: [
          {
            id: 'component-1',
            type: 'text-block',
            content: { text: 'Legacy array content' },
          },
        ],
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1'))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({
      success: false,
      error: 'Preview data contains invalid page content',
      diagnostics: [
        expect.objectContaining({
          code: 'PAGE_CONTENT_LEGACY_ARRAY',
          severity: 'warn',
          message: expect.stringContaining('Legacy array page content is not valid PageContentV1 content'),
          path: '$',
          pageId: 'page-1',
          pageTitle: 'About',
          slug: 'about',
          fullPath: '/about',
        }),
      ],
    })
  })

  it('returns 422 with page-context diagnostics for legacy sections page content', async () => {
    mockPrisma.websitePage.findMany.mockResolvedValue([
      {
        id: 'page-1',
        title: 'About',
        content: {
          sections: [
            {
              id: 'section-1',
              type: 'text-block',
              content: { text: 'Legacy sections content' },
            },
          ],
        },
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1'))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({
      success: false,
      error: 'Preview data contains invalid page content',
      diagnostics: [
        expect.objectContaining({
          code: 'PAGE_CONTENT_LEGACY_SECTIONS',
          severity: 'warn',
          message: expect.stringContaining('Legacy sections page content is not valid PageContentV1 content'),
          path: 'sections',
          pageId: 'page-1',
          pageTitle: 'About',
          slug: 'about',
          fullPath: '/about',
        }),
      ],
    })
  })

  it('returns 422 with page-context diagnostics for legacy single-component page content', async () => {
    mockPrisma.websitePage.findMany.mockResolvedValue([
      {
        id: 'page-1',
        title: 'About',
        content: {
          id: 'component-1',
          type: 'text-block',
          content: { text: 'Legacy single component content' },
        },
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1'))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({
      success: false,
      error: 'Preview data contains invalid page content',
      diagnostics: [
        expect.objectContaining({
          code: 'PAGE_CONTENT_LEGACY_SINGLE_COMPONENT',
          severity: 'warn',
          message: expect.stringContaining('Single component page content is not valid PageContentV1 content'),
          path: '$',
          pageId: 'page-1',
          pageTitle: 'About',
          slug: 'about',
          fullPath: '/about',
        }),
      ],
    })
  })

  it('passes current design system tokens through the strict runtime reader', async () => {
    const tokens = {
      variables: { '--primary': '240 5.9% 10%' },
      darkVariables: { '--primary': '0 0% 98%' },
      extraction: {
        timestamp: '2024-01-01T00:00:00.000Z',
        confidence: 1,
        source: 'detected',
        detectedCount: 1,
        defaultCount: 0,
      },
    }
    mockPrisma.websiteDesignSystem.findFirst.mockResolvedValue({ id: 'design-system-1', tokens })
    mockReadNullableShadcnDesignSystemTokens.mockReturnValue(tokens)
    mockGenerateStrictDesignSystemCss.mockReturnValue(':root { --primary: 240 5.9% 10%; }')
    mockPrisma.websitePage.findMany.mockResolvedValue([
      {
        id: 'page-1',
        title: 'About',
        content: { components: [] },
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockReadNullableShadcnDesignSystemTokens).toHaveBeenCalledWith(tokens, {
      websiteId: 'website-1',
      designSystemId: 'design-system-1',
    })
    expect(mockGenerateStrictDesignSystemCss).toHaveBeenCalledWith(tokens, {
      websiteId: 'website-1',
      designSystemId: 'design-system-1',
    })
    expect(body.data.designSystem).toEqual({
      variables: tokens.variables,
      darkVariables: tokens.darkVariables,
    })
    expect(body.data.designSystemCss).toBe(':root { --primary: 240 5.9% 10%; }')
  })

  it('does not synthesize default design-system tokens when the record is missing', async () => {
    mockReadNullableShadcnDesignSystemTokens.mockReturnValue(null)
    mockGenerateStrictDesignSystemCss.mockReturnValue(null)
    mockPrisma.websitePage.findMany.mockResolvedValue([
      {
        id: 'page-1',
        title: 'About',
        content: { components: [] },
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.designSystem).toEqual({
      variables: {},
    })
    expect(body.data.designSystemCss).toBe('')
  })

  it('returns 422 when strict design-system parsing rejects a runtime payload', async () => {
    mockPrisma.websiteDesignSystem.findFirst.mockResolvedValue({
      id: 'design-system-1',
      tokens: { palette: { primary: [] } },
    })
    mockReadNullableShadcnDesignSystemTokens.mockImplementation(() => {
      throw new mockDesignSystemReaderError(
        'DESIGN_SYSTEM_LEGACY_PAYLOAD',
        'Legacy palette design-system payloads are not valid runtime shadcn tokens.',
        { websiteId: 'website-1', designSystemId: 'design-system-1' }
      )
    })
    mockPrisma.websitePage.findMany.mockResolvedValue([
      {
        id: 'page-1',
        title: 'About',
        content: { components: [] },
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1'))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({
      success: false,
      error: 'Legacy palette design-system payloads are not valid runtime shadcn tokens.',
      diagnostics: [
        {
          code: 'DESIGN_SYSTEM_LEGACY_PAYLOAD',
          severity: 'error',
          message: 'Legacy palette design-system payloads are not valid runtime shadcn tokens.',
          context: { websiteId: 'website-1', designSystemId: 'design-system-1' },
        },
      ],
    })
  })

  it('returns 422 for structurally equivalent design-system reader errors', async () => {
    mockPrisma.websiteDesignSystem.findFirst.mockResolvedValue({
      id: 'design-system-1',
      tokens: { variables: { '--primary': 123 } },
    })
    mockReadNullableShadcnDesignSystemTokens.mockImplementation(() => {
      throw Object.assign(new Error('Design-system payload is not valid current shadcn token data.'), {
        name: 'DifferentConstructor',
        code: 'DESIGN_SYSTEM_INVALID_PAYLOAD',
        context: { websiteId: 'website-1', designSystemId: 'design-system-1', invalidPath: 'variables' },
      })
    })

    const response = await GET(new NextRequest('http://localhost/api/studio/preview/data?websiteId=website-1'))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body.diagnostics).toEqual([
      expect.objectContaining({
        code: 'DESIGN_SYSTEM_INVALID_PAYLOAD',
        context: expect.objectContaining({ invalidPath: 'variables' }),
      }),
    ])
  })
})
