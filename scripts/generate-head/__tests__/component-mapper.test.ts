import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { PageTemplateCategory, type PageTemplateRegistration } from '@/lib/studio/pages/_core/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import type { SiteSnapshot } from '../core/types'

jest.mock('../core/registry', () => ({
  getTemplate: jest.fn(),
  isComponentRegistered: jest.fn()
}))

import { mapSnapshotComponents } from '../core/component-mapper'
import { getTemplate, isComponentRegistered } from '../core/registry'

describe('component mapper', () => {
  const baseInstance = (overrides: Partial<ComponentInstance>): ComponentInstance => ({
    ...(() => {
      const resolvedType = overrides.type ?? ComponentType.NavBar
      const resolvedComponentType =
        Object.prototype.hasOwnProperty.call(overrides, 'componentType')
          ? overrides.componentType
          : (typeof resolvedType === 'string' &&
              (Object.values(ComponentType) as string[]).includes(resolvedType as string)
              ? resolvedType as ComponentType
              : undefined)
      const resolvedTypeId =
        overrides.typeId ?? overrides.componentTypeId ?? (resolvedComponentType ? `${resolvedComponentType}-type` : 'type-id')
      return {
        id: 'component',
        type: resolvedType,
        componentType: resolvedComponentType,
        componentTypeId: overrides.componentTypeId ?? resolvedTypeId,
        typeId: resolvedTypeId,
        parentId: null,
        position: 0,
        props: {},
        content: {},
        styles: {},
        metadata: {},
        ...overrides
      }
    })()
  })

  function buildSnapshot(overrides: Partial<SiteSnapshot>): SiteSnapshot {
    return {
      site: { id: 'site', name: 'Test Site' },
      pages: [],
      structure: [],
      sharedComponents: [],
      capturedAt: new Date().toISOString(),
      ...overrides
    }
  }

  function buildTemplate(regions: Array<{ region: string; allowed: ComponentType[] }>): PageTemplateRegistration {
    return {
      templateKey: 'marketing/home-default',
      name: 'Marketing Home',
      category: PageTemplateCategory.Marketing,
      isHomeEligible: true,
      description: 'Mock template',
      requiredRegions: regions.map(entry => ({
        region: entry.region as any,
        allowedComponents: entry.allowed
      })),
      optionalRegions: [],
      propsMeta: undefined,
      aiMetadata: {
        keywords: [],
        layoutGuidelines: []
      }
    }
  }

  beforeEach(() => {
    ;(getTemplate as jest.Mock).mockReset()
    ;(isComponentRegistered as jest.Mock).mockReset()
    ;(isComponentRegistered as jest.Mock).mockReturnValue(true)
  })

  it('maps allowed components with import names', () => {
    ;(getTemplate as jest.Mock).mockReturnValue(
      buildTemplate([
        { region: 'header', allowed: [ComponentType.NavBar] },
        { region: 'hero', allowed: [ComponentType.HeroSplit] },
        { region: 'footer', allowed: [ComponentType.Footer] }
      ])
    )

    const snapshot = buildSnapshot({
      pages: [
        {
          id: 'page',
          title: 'Home',
          fullPath: '/home',
          templateKey: 'marketing/home-default',
          templateProps: {},
          regions: [],
          components: [
            baseInstance({ id: 'nav', type: ComponentType.NavBar, props: { region: 'header' } }),
            baseInstance({ id: 'hero', type: ComponentType.HeroSplit, position: 1, props: { region: 'hero' } }),
            baseInstance({ id: 'footer', type: ComponentType.Footer, position: 2, props: { region: 'footer' } })
          ],
          metadata: {},
          sharedComponentIds: []
        }
      ]
    })

    const summary = mapSnapshotComponents(snapshot)

    expect(summary.pages[0].components.map(component => component.importName)).toEqual([
      'NavBarAdapter',
      'HeroSplitAdapter',
      'FooterAdapter'
    ])
    expect((isComponentRegistered as jest.Mock)).toHaveBeenCalledTimes(3)
  })

  it('emits diagnostics for region violations', () => {
    ;(getTemplate as jest.Mock).mockReturnValue(
      buildTemplate([
        { region: 'header', allowed: [ComponentType.NavBar] },
        { region: 'hero', allowed: [ComponentType.HeroSplit] },
        { region: 'footer', allowed: [ComponentType.Footer] }
      ])
    )

    const snapshot = buildSnapshot({
      pages: [
        {
          id: 'page',
          title: 'Home',
          fullPath: '/home',
          templateKey: 'marketing/home-default',
          templateProps: {},
          regions: [],
          components: [
            baseInstance({ id: 'hero', type: ComponentType.HeroSplit, position: 0, props: { region: 'header' } })
          ],
          metadata: {},
          sharedComponentIds: []
        }
      ]
    })

    const summary = mapSnapshotComponents(snapshot)
    expect(summary.diagnostics.some(diag => diag.code === 'REGION_COMPONENT_VIOLATION')).toBe(true)
  })

  it('flags unknown component types', () => {
    ;(getTemplate as jest.Mock).mockReturnValue(undefined)

    const snapshot = buildSnapshot({
      pages: [
        {
          id: 'page',
          title: 'Home',
          fullPath: '/home',
          templateKey: 'marketing/home-default',
          templateProps: {},
          regions: [],
          components: [
            baseInstance({ id: 'unknown', type: 'non-existent' as ComponentType })
          ],
          metadata: {},
          sharedComponentIds: []
        }
      ]
    })

    const summary = mapSnapshotComponents(snapshot)
    expect(summary.diagnostics.some(diag => diag.code === 'UNKNOWN_COMPONENT_TYPE')).toBe(true)
  })

  it('reports components flagged as unregistered', () => {
    ;(getTemplate as jest.Mock).mockReturnValue(
      buildTemplate([{ region: 'header', allowed: [ComponentType.NavBar] }])
    )
    ;(isComponentRegistered as jest.Mock).mockImplementation((type: ComponentType) => type !== ComponentType.NavBar)

    const snapshot = buildSnapshot({
      pages: [
        {
          id: 'page',
          title: 'Home',
          fullPath: '/home',
          templateKey: 'marketing/home-default',
          templateProps: {},
          regions: [],
          components: [baseInstance({ id: 'nav', type: ComponentType.NavBar, props: { region: 'header' } })],
          metadata: {},
          sharedComponentIds: []
        }
      ]
    })

    const summary = mapSnapshotComponents(snapshot)
    expect(summary.diagnostics.some(diag => diag.code === 'COMPONENT_NOT_REGISTERED')).toBe(true)
  })

  it('emits diagnostics when heuristic canonical fallback is used', () => {
    ;(getTemplate as jest.Mock).mockReturnValue(
      buildTemplate([{ region: 'hero', allowed: [ComponentType.HeroSplit] }])
    )
    ;(isComponentRegistered as jest.Mock).mockReturnValue(true)

    const snapshot = buildSnapshot({
      pages: [
        {
          id: 'page',
          title: 'Home',
          fullPath: '/home',
          templateKey: 'marketing/home-default',
          templateProps: {},
          regions: [],
          components: [
            baseInstance({
              id: 'hero',
              type: ComponentType.HeroSplit,
              componentType: undefined,
              props: { region: 'hero' }
            })
          ],
          metadata: {},
          sharedComponentIds: []
        }
      ]
    })

    const summary = mapSnapshotComponents(snapshot)
    expect(summary.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CANONICAL_TYPE_FALLBACK',
          context: expect.objectContaining({ resolvedType: ComponentType.HeroSplit })
        })
      ])
    )
  })

  it('captures loader keys from component props', () => {
    ;(getTemplate as jest.Mock).mockReturnValue(
      buildTemplate([{ region: 'main', allowed: [ComponentType.BlogList] }])
    )

    const snapshot = buildSnapshot({
      pages: [
        {
          id: 'page',
          title: 'Blog',
          fullPath: '/blog',
          templateKey: 'marketing/home-default',
          templateProps: {},
          regions: [],
          components: [
            baseInstance({
              id: 'blog-list',
              type: ComponentType.BlogList,
              position: 0,
              props: { region: 'main', loaderKey: '  blog.latestPosts  ' }
            })
          ],
          metadata: {},
          sharedComponentIds: []
        }
      ]
    })

    const summary = mapSnapshotComponents(snapshot)
    const [component] = summary.pages[0].components
    expect(component.loaderKey).toBe('blog.latestPosts')
  })

  it('uses canonical componentType when present', () => {
    ;(getTemplate as jest.Mock).mockReturnValue(
      buildTemplate([{ region: 'main', allowed: [ComponentType.CTAWithForm] }])
    )

    const snapshot = buildSnapshot({
      pages: [
        {
          id: 'page',
          title: 'Home',
          fullPath: '/',
          templateKey: 'marketing/home-default',
          templateProps: {},
          regions: [],
          components: [
            baseInstance({
              id: 'cta-newsletter',
              type: ComponentType.CTAWithForm,
              componentType: ComponentType.CTAWithForm,
              componentTypeId: 'ct-newsletter',
              typeId: 'ct-newsletter',
              props: {
                region: 'main',
                type: ComponentType.CTAWithForm,
                content: {
                  heading: 'Stay in the loop',
                  placeholder: 'Email address',
                  buttonText: 'Sign up',
                  privacyLink: { url: 'https://example.com/privacy' }
                }
              },
              content: {}
            })
          ],
          metadata: {},
          sharedComponentIds: []
        }
      ]
    })

    const summary = mapSnapshotComponents(snapshot)
    const [component] = summary.pages[0].components

    expect(component.componentType).toBe(ComponentType.CTAWithForm)
    expect(component.importName).toBe('CTANewsletterAdapter')
    expect(component.props).toMatchObject({
      type: ComponentType.CTAWithForm,
      content: {
        heading: 'Stay in the loop',
        placeholder: 'Email address',
        buttonText: 'Sign up',
        privacyLink: { url: 'https://example.com/privacy' }
      }
    })
  })

  it('falls back to canonical inference when componentType is missing', () => {
    ;(getTemplate as jest.Mock).mockReturnValue(
      buildTemplate([{ region: 'main', allowed: [ComponentType.CTAWithForm] }])
    )

    const snapshot = buildSnapshot({
      pages: [
        {
          id: 'page',
          title: 'Home',
          fullPath: '/',
          templateKey: 'marketing/home-default',
          templateProps: {},
          regions: [],
          components: [
            baseInstance({
              id: 'cta-newsletter',
              type: 'cta-newsletter' as unknown as ComponentType,
              componentType: undefined,
              props: {
                region: 'main',
                content: {
                  heading: 'Stay in the loop'
                }
              },
              content: {}
            })
          ],
          metadata: {},
          sharedComponentIds: []
        }
      ]
    })

    const summary = mapSnapshotComponents(snapshot)
    const [component] = summary.pages[0].components

    expect(component.componentType).toBe(ComponentType.CTAWithForm)
    expect(component.importName).toBe('CTANewsletterAdapter')
  })
})
