import { renderToStaticMarkup } from 'react-dom/server'
import { ApiError } from '@/lib/api/errors'
import type React from 'react'

const mockAssertStudioWebsiteAccess = jest.fn()
const mockRenderLocalWebsitePreview = jest.fn()

jest.mock('@/lib/studio/preview/access', () => ({
  __esModule: true,
  assertStudioWebsiteAccess: (...args: unknown[]) => mockAssertStudioWebsiteAccess(...args),
}))

jest.mock('@/lib/studio/preview/local-renderer', () => ({
  __esModule: true,
  renderLocalWebsitePreview: (...args: unknown[]) => mockRenderLocalWebsitePreview(...args),
}))

describe('StudioLocalPreviewPage', () => {
  beforeEach(() => {
    mockAssertStudioWebsiteAccess.mockReset()
    mockRenderLocalWebsitePreview.mockReset()
    mockRenderLocalWebsitePreview.mockResolvedValue(<div>preview</div>)
  })

  it('renders preview unavailable for expected access errors', async () => {
    mockAssertStudioWebsiteAccess.mockRejectedValue(
      new ApiError(403, 'Forbidden: Website access denied', 'FORBIDDEN')
    )

    const { default: StudioLocalPreviewPage } = await import('../page')
    const element = await StudioLocalPreviewPage({
      params: Promise.resolve({ websiteId: 'site-1', slug: ['about'] }),
      searchParams: Promise.resolve({}),
    })

    const html = renderToStaticMarkup(element as React.ReactElement)
    expect(html).toContain('Preview unavailable')
    expect(html).toContain('Forbidden: Website access denied')
    expect(mockRenderLocalWebsitePreview).not.toHaveBeenCalled()
  })

  it('rethrows unexpected access failures instead of rendering fallback UI', async () => {
    mockAssertStudioWebsiteAccess.mockRejectedValue(new Error('database unavailable'))

    const { default: StudioLocalPreviewPage } = await import('../page')
    await expect(StudioLocalPreviewPage({
      params: Promise.resolve({ websiteId: 'site-1' }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow('database unavailable')
    expect(mockRenderLocalWebsitePreview).not.toHaveBeenCalled()
  })

  it('renders local preview after access succeeds', async () => {
    const { default: StudioLocalPreviewPage } = await import('../page')
    const element = await StudioLocalPreviewPage({
      params: Promise.resolve({ websiteId: 'site-1', slug: ['about'] }),
      searchParams: Promise.resolve({ designConcept: 'concept-1' }),
    })

    expect(mockRenderLocalWebsitePreview).toHaveBeenCalledWith({
      websiteId: 'site-1',
      slug: ['about'],
      designConcept: 'concept-1',
    })
    expect(renderToStaticMarkup(element as React.ReactElement)).toContain('preview')
  })
})
