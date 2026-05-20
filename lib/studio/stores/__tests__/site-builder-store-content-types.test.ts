import { act } from '@testing-library/react'

import { useSiteBuilderStore } from '../site-builder-store'
import type { ContentTypeWithParsedFields } from '@/lib/services/content-type-service'

const baseTimestamp = new Date('2024-01-01T00:00:00.000Z')

const buildContentType = (overrides: Partial<ContentTypeWithParsedFields> = {}): ContentTypeWithParsedFields => ({
  id: overrides.id ?? `type-${Math.random().toString(16).slice(2)}`,
  websiteId: overrides.websiteId ?? 'site-mock',
  name: overrides.name ?? 'Untitled',
  category: overrides.category ?? 'page',
  fields: overrides.fields ?? {},
  settings: overrides.settings ?? {},
  createdAt: overrides.createdAt ?? baseTimestamp,
  updatedAt: overrides.updatedAt ?? baseTimestamp,
  ...overrides,
})

const buildComponentType = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: overrides.id ?? `component-${Math.random().toString(16).slice(2)}`,
  websiteId: overrides.websiteId ?? 'site-mock',
  type: overrides.type ?? 'hero-banner',
  category: overrides.category ?? 'Hero Header',
  defaultConfig: overrides.defaultConfig ?? { name: 'Hero Banner', description: 'Hero block' },
  placeholderData:
    overrides.placeholderData ??
    {
      title: 'Welcome',
      subtitle: 'Subheading',
      cta: { label: 'Call to action', href: '/cta' },
    },
  createdAt: overrides.createdAt ?? baseTimestamp.toISOString(),
  updatedAt: overrides.updatedAt ?? baseTimestamp.toISOString(),
})

const mockContentResponse = (data: ContentTypeWithParsedFields[]) => ({
  ok: true,
  json: () => Promise.resolve({ data }),
})

const mockComponentResponse = (items: Array<Record<string, unknown>>) => ({
  ok: true,
  json: () =>
    Promise.resolve({
      items,
      total: items.length,
      page: 1,
      limit: Math.max(items.length, 1),
    }),
})

const resetStore = () => {
  act(() => {
    useSiteBuilderStore.setState({
      websiteId: null,
      pageTypes: [],
      pageTypesLoaded: false,
      pageTypesLoading: false,
      pageTypesError: null,
      contentTypesAll: [],
      contentTypeCatalog: {},
      contentTypesLoaded: false,
      contentTypesLoading: false,
      contentTypesError: null,
      contentTypesWebsiteId: null,
      componentTypesAll: [],
      componentTypesLoaded: false,
      componentTypesLoading: false,
      componentTypesError: null,
    })
  })
}

describe('site-builder-store content type catalog', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as typeof globalThis.fetch
    resetStore()
  })

  it('stores the raw catalog and derives page types from it', async () => {
    const homeType = buildContentType({
      id: 'page-home',
      name: 'Home Page',
      category: 'page',
      settings: { description: 'Main landing page' },
    })
    ;(homeType as Record<string, unknown>).key = 'home'

    const catalog = [
      homeType,
      buildContentType({
        id: 'page-article',
        name: 'Article',
        category: 'page',
        settings: { description: 'Editorial template' },
      }),
    ]

    const componentCatalog = [
      buildComponentType({
        id: 'component-hero',
        type: 'hero-block',
        category: 'Hero',
        defaultConfig: { name: 'Hero Block', description: 'Reusable hero' },
        placeholderData: { title: 'Hero', description: 'Value prop', media: { src: '/img.jpg', alt: 'Alt' } },
      }),
    ]

    fetchMock
      .mockResolvedValueOnce(mockContentResponse(catalog))
      .mockResolvedValueOnce(mockComponentResponse(componentCatalog))

    await act(async () => {
      await useSiteBuilderStore.getState().loadContentTypeCatalog('site-one')
    })

    const state = useSiteBuilderStore.getState()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(state.contentTypesAll).toHaveLength(4)
    expect(state.contentTypeCatalog.page?.items).toHaveLength(2)
    expect(state.contentTypeCatalog.component?.items).toHaveLength(1)
    expect(state.contentTypeCatalog.folder?.items).toHaveLength(1)
    expect(state.componentTypesAll).toHaveLength(1)
    expect(state.pageTypes).toHaveLength(2)
    expect(state.pageTypes[0].isHome).toBe(true)
    expect(state.pageTypesLoaded).toBe(true)
    expect(state.contentTypesLoaded).toBe(true)
    expect(state.contentTypesError).toBeNull()
  })

  it('reuses the cached catalog for the same website', async () => {
    const catalog = [buildContentType({ id: 'page-home', name: 'Home Page', category: 'page' })]
    fetchMock
      .mockResolvedValueOnce(mockContentResponse(catalog))
      .mockResolvedValueOnce(mockComponentResponse([]))

    await act(async () => {
      await useSiteBuilderStore.getState().loadContentTypeCatalog('site-cache')
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    fetchMock.mockClear()

    await act(async () => {
      await useSiteBuilderStore.getState().loadContentTypeCatalog('site-cache')
    })

    expect(fetchMock).not.toHaveBeenCalled()
    const state = useSiteBuilderStore.getState()
    expect(state.contentTypesLoaded).toBe(true)
    expect(state.contentTypesWebsiteId).toBe('site-cache')
  })

  it('refetches the catalog when the website changes', async () => {
    const firstCatalog = [buildContentType({ id: 'page-home', name: 'Home', category: 'page' })]
    fetchMock
      .mockResolvedValueOnce(mockContentResponse(firstCatalog))
      .mockResolvedValueOnce(mockComponentResponse([]))

    await act(async () => {
      await useSiteBuilderStore.getState().loadContentTypeCatalog('site-alpha')
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const secondCatalog = [buildContentType({ id: 'page-product', name: 'Product', category: 'page' })]
    fetchMock
      .mockResolvedValueOnce(mockContentResponse(secondCatalog))
      .mockResolvedValueOnce(mockComponentResponse([]))

    await act(async () => {
      await useSiteBuilderStore.getState().loadContentTypeCatalog('site-beta', { force: true })
    })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    const state = useSiteBuilderStore.getState()
    expect(state.contentTypesAll).toHaveLength(2)
    expect(state.contentTypesAll.some((type) => type.id === 'page-product')).toBe(true)
    expect(state.contentTypesWebsiteId).toBe('site-beta')
  })

  it('tracks errors when loading fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    })

    await act(async () => {
      await useSiteBuilderStore.getState().loadContentTypeCatalog('site-error')
    })

    const state = useSiteBuilderStore.getState()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(state.contentTypesLoaded).toBe(false)
    expect(state.pageTypesLoaded).toBe(false)
    expect(state.contentTypesAll).toHaveLength(0)
    expect(state.contentTypeCatalog).toEqual({})
    expect(state.contentTypesError).toBe('Failed to load content types')
    expect(state.pageTypesError).toBe('Failed to load content types')
    expect(state.contentTypesWebsiteId).toBeNull()
  })
})
