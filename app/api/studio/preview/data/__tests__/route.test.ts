jest.mock('@/lib/db/client', () => ({
  getClient: jest.fn(),
}))

jest.mock('@/lib/studio/preview/access', () => ({
  assertStudioWebsiteAccess: jest.fn(),
  previewAccessErrorResponse: jest.fn(),
}))

jest.mock('@/lib/studio/design-system/design-system-reader', () => ({
  getNormalizedDesignSystem: jest.fn(() => ({
    variables: {},
    darkVariables: {},
  })),
  generateDesignSystemCss: jest.fn(() => ':root {}'),
}))

import { NextRequest } from 'next/server'
import { getClient } from '@/lib/db/client'
import { assertStudioWebsiteAccess } from '@/lib/studio/preview/access'
import {
  GET,
  extractComponents,
  extractComponentsWithDiagnostics,
} from '@/app/api/studio/preview/data/route'

describe('preview data component extraction', () => {
  it('emits props.content from canonical component.content over stale props.content', () => {
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
    expect(component.props.content).toEqual({ heading: 'Canonical heading' })
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
    ;(assertStudioWebsiteAccess as jest.Mock).mockResolvedValue(undefined)
    mockPrisma.website.findUnique.mockResolvedValue({
      id: 'website-1',
      name: 'Website',
    })
    mockPrisma.websiteDesignConcept.findFirst.mockResolvedValue(null)
    mockPrisma.websiteDesignSystem.findFirst.mockResolvedValue(null)
    mockPrisma.websiteStructure.findMany.mockResolvedValue([
      {
        id: 'structure-1',
        parentId: null,
        websitePageId: 'page-1',
        slug: 'about',
        position: 0,
      },
    ])
  })

  afterEach(() => {
    jest.restoreAllMocks()
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
})
