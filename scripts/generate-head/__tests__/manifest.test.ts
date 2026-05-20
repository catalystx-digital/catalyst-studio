import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import type { ComponentMappingSummary } from '../core/component-mapper'
import type { RouteDefinition, SiteSnapshot } from '../core/types'
import { buildManifest } from '../generator/scaffold'

describe('buildManifest loader metadata', () => {
  const createInstance = (overrides: Partial<ComponentInstance>): ComponentInstance => ({
    id: 'component',
    type: ComponentType.BlogList,
    parentId: null,
    position: 0,
    props: {},
    content: {},
    styles: {},
    metadata: {},
    ...overrides
  })

  it('records page loaders and aggregated loader usage', () => {
    const snapshot: SiteSnapshot = {
      site: { id: 'site', name: 'Test Site' },
      pages: [
        {
          id: 'page-blog',
          title: 'Blog',
          fullPath: '/blog',
          templateKey: null,
          templateProps: {},
          regions: [],
          components: [
            createInstance({ id: 'blog-list-component', type: ComponentType.BlogList, props: {} })
          ],
          metadata: {},
          sharedComponentIds: []
        },
        {
          id: 'page-events',
          title: 'Events',
          fullPath: '/events',
          templateKey: null,
          templateProps: {},
          regions: [],
          components: [
            createInstance({ id: 'events-grid', type: ComponentType.FeatureGrid, props: {} })
          ],
          metadata: {},
          sharedComponentIds: []
        }
      ],
      sharedComponents: [],
      structure: [],
      capturedAt: new Date().toISOString()
    }

    const componentSummary: ComponentMappingSummary = {
      pages: [
        {
          pageId: 'page-blog',
          fullPath: '/blog',
          templateKey: null,
          template: undefined,
          components: [
            {
              id: 'blog-list-component',
              componentType: ComponentType.BlogList,
              importName: 'BlogList',
              props: {},
              region: 'main' as any,
              loaderKey: 'blog.latestPosts',
              original: createInstance({
                id: 'blog-list-component',
                type: ComponentType.BlogList,
                props: { loaderKey: 'blog.latestPosts' }
              }),
              diagnostics: []
            }
          ]
        },
        {
          pageId: 'page-events',
          fullPath: '/events',
          templateKey: null,
          template: undefined,
          components: [
            {
              id: 'events-grid',
              componentType: ComponentType.FeatureGrid,
              importName: 'FeatureGrid',
              props: {},
              region: 'main' as any,
              loaderKey: 'blog.latestPosts',
              original: createInstance({
                id: 'events-grid',
                type: ComponentType.FeatureGrid,
                props: { loaderKey: 'blog.latestPosts' }
              }),
              diagnostics: []
            }
          ]
        }
      ],
      diagnostics: [],
      componentImports: new Map()
    }

    const routes: RouteDefinition[] = [
      {
        pageId: 'page-blog',
        fullPath: '/blog',
        routePath: 'blog',
        segments: ['blog'],
        title: 'Blog',
        templateKey: null
      },
      {
        pageId: 'page-events',
        fullPath: '/events',
        routePath: 'events',
        segments: ['events'],
        title: 'Events',
        templateKey: null
      }
    ]

    const manifest = buildManifest(snapshot, 'stub', routes, componentSummary)

    const blogPage = manifest.pages.find(page => page.pageId === 'page-blog')
    const eventsPage = manifest.pages.find(page => page.pageId === 'page-events')
    expect(blogPage?.slugSegments).toEqual(['blog'])
    expect(eventsPage?.slugSegments).toEqual(['events'])
    expect(blogPage?.loaders).toEqual(['blog.latestPosts'])
    expect(eventsPage?.loaders).toEqual(['blog.latestPosts'])
    expect(blogPage?.components[0].loaderKey).toBe('blog.latestPosts')
    expect(eventsPage?.components[0].loaderKey).toBe('blog.latestPosts')

    expect(manifest.loaders).toEqual([
      {
        loaderKey: 'blog.latestPosts',
        componentTypes: [ComponentType.BlogList, ComponentType.FeatureGrid],
        componentIds: ['blog-list-component', 'events-grid'],
        pageIds: ['page-blog', 'page-events'],
        usageCount: 2
      }
    ])
  })

  it('includes shared component payloads in the manifest', () => {
    const snapshot: SiteSnapshot = {
      site: { id: 'site', name: 'Test Site' },
      pages: [
        {
          id: 'page-home',
          title: 'Home',
          fullPath: '/',
          templateKey: null,
          templateProps: {},
          regions: [],
          components: [
            createInstance({
              id: 'navbar-instance',
              type: ComponentType.Navbar,
              props: { sharedComponentId: 'shared-nav' },
              metadata: { region: 'header' }
            })
          ],
          metadata: {},
          sharedComponentIds: ['shared-nav']
        }
      ],
      sharedComponents: [
        {
          id: 'shared-nav',
          name: 'Global Navigation',
          componentType: ComponentType.Navbar,
          componentTypeId: 'type-navbar',
          content: {
            type: 'navbar',
            region: 'header',
            menuItems: []
          },
          config: {
            type: 'navbar',
            category: 'navigation',
            defaultProps: { region: 'header' },
            pattern: {}
          }
        }
      ],
      structure: [],
      capturedAt: new Date().toISOString()
    }

    const componentSummary: ComponentMappingSummary = {
      pages: [
        {
          pageId: 'page-home',
          fullPath: '/',
          templateKey: null,
          template: undefined,
          components: []
        }
      ],
      diagnostics: [],
      componentImports: new Map()
    }

    const routes: RouteDefinition[] = [
      {
        pageId: 'page-home',
        fullPath: '/',
        routePath: '',
        segments: [],
        title: 'Home',
        templateKey: null
      }
    ]

    const manifest = buildManifest(snapshot, 'stub', routes, componentSummary)
    expect(manifest.sharedComponents).toEqual([
      expect.objectContaining({
        sharedComponentId: 'shared-nav',
        componentTypeId: 'type-navbar',
        payload: expect.objectContaining({ type: 'navbar', region: 'header' }),
        config: expect.objectContaining({ type: 'navbar' }),
        usageCount: 1
      })
    ])
  })
})
