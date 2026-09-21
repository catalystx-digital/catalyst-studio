import {
  ComponentRegionManager,
  ComponentRegionPlacementError,
  ComponentRegionValidationError,
  RequiredRegionCoverageError
} from '../page-builder/component-region-manager'
import type {
  ComponentInstance,
  ComponentTree,
  ComponentType as ImportComponentType,
  PageData
} from '../interfaces'
import { PageTemplateCategory } from '@/lib/studio/pages/_core/types'
import type { PageCatalogTemplateSummary } from '@/lib/studio/pages/catalog'

const createComponentType = (type: string): ImportComponentType =>
  ({
    id: `type-${type}`,
    type,
    key: type,
    category: 'content',
    source: 'canonical',
    metadata: {},
    defaultConfig: { props: {} },
    placeholderData: {},
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    aiMetadata: {},
    styles: {},
    version: '1.0.0',
    isGlobal: false
  } as unknown as ImportComponentType)

const createComponent = (
  type: string,
  props: Record<string, any> = {},
  overrides: Partial<ComponentInstance> = {}
): ComponentInstance => ({
  id: `${type}-1`,
  type,
  typeId: `type-${type}`,
  parentId: null,
  position: 0,
  props,
  ...overrides
})

const createTree = (components: ComponentInstance[]): ComponentTree => ({
  components,
  metadata: {
    totalComponents: components.length,
    maxDepth: 1,
    componentTypes: components.map(component => component.type)
  }
})

const createPageData = (): PageData => ({
  title: 'Test Page',
  url: 'https://example.com/test',
  detectedComponents: []
})

const createTemplate = (
  regions: Partial<PageCatalogTemplateSummary>
): PageCatalogTemplateSummary => ({
  templateKey: 'test-template',
  name: 'Test Template',
  category: PageTemplateCategory.Core,
  isHomeEligible: false,
  description: 'Test template',
  requiredRegions: [],
  optionalRegions: [],
  aiMetadata: {
    keywords: [],
    layoutGuidelines: []
  },
  ...regions
})

describe('ComponentRegionManager strict validation', () => {
  const manager = new ComponentRegionManager()

  it('throws when component.content.region conflicts with props.region', () => {
    const template = createTemplate({
      optionalRegions: [
        { region: 'hero', allowedComponents: ['hero-banner' as any] },
        { region: 'main', allowedComponents: ['hero-banner' as any] }
      ]
    })
    const component = createComponent('hero-banner', {
      region: 'hero'
    }, {
      content: { region: 'main' }
    })

    expect(() =>
      manager.ensureRequiredRegionCoverage({
        tree: createTree([component]),
        template,
        componentTypes: [createComponentType('hero-banner')],
        pageData: createPageData()
      })
    ).toThrow(ComponentRegionValidationError)
    expect(() =>
      manager.ensureRequiredRegionCoverage({
        tree: createTree([component]),
        template,
        componentTypes: [createComponentType('hero-banner')],
        pageData: createPageData()
      })
    ).toThrow('component.content.region "main" conflicts with props.region "hero"')
  })

  it('throws when component.content.region conflicts with metadata.region', () => {
    const template = createTemplate({
      optionalRegions: [
        { region: 'hero', allowedComponents: ['hero-banner' as any] },
        { region: 'main', allowedComponents: ['hero-banner' as any] }
      ]
    })
    const component = createComponent('hero-banner', {
      metadata: { region: 'hero' }
    }, {
      content: { region: 'main' }
    })

    expect(() =>
      manager.ensureRequiredRegionCoverage({
        tree: createTree([component]),
        template,
        componentTypes: [createComponentType('hero-banner')],
        pageData: createPageData()
      })
    ).toThrow('component.content.region "main" conflicts with metadata.region "hero"')
  })

  it('throws when component.content.region conflicts with component.content.metadata.region', () => {
    const template = createTemplate({
      optionalRegions: [
        { region: 'hero', allowedComponents: ['hero-banner' as any] },
        { region: 'main', allowedComponents: ['hero-banner' as any] }
      ]
    })
    const component = createComponent('hero-banner', {}, {
      content: {
        region: 'main',
        metadata: { region: 'hero' }
      }
    })

    expect(() =>
      manager.ensureRequiredRegionCoverage({
        tree: createTree([component]),
        template,
        componentTypes: [createComponentType('hero-banner')],
        pageData: createPageData()
      })
    ).toThrow('component.content.region "main" conflicts with component.content.metadata.region "hero"')
  })

  it('throws when component.content.metadata.region conflicts with props.region', () => {
    const template = createTemplate({
      optionalRegions: [
        { region: 'hero', allowedComponents: ['hero-banner' as any] },
        { region: 'main', allowedComponents: ['hero-banner' as any] }
      ]
    })
    const component = createComponent('hero-banner', {
      region: 'hero'
    }, {
      content: {
        metadata: { region: 'main' }
      }
    })

    expect(() =>
      manager.ensureRequiredRegionCoverage({
        tree: createTree([component]),
        template,
        componentTypes: [createComponentType('hero-banner')],
        pageData: createPageData()
      })
    ).toThrow('component.content.metadata.region "main" conflicts with props.region "hero"')
  })

  it('throws when component.content.metadata.region conflicts with metadata.region', () => {
    const template = createTemplate({
      optionalRegions: [
        { region: 'hero', allowedComponents: ['hero-banner' as any] },
        { region: 'main', allowedComponents: ['hero-banner' as any] }
      ]
    })
    const component = createComponent('hero-banner', {
      metadata: { region: 'hero' }
    }, {
      content: {
        metadata: { region: 'main' }
      }
    })

    expect(() =>
      manager.ensureRequiredRegionCoverage({
        tree: createTree([component]),
        template,
        componentTypes: [createComponentType('hero-banner')],
        pageData: createPageData()
      })
    ).toThrow('component.content.metadata.region "main" conflicts with metadata.region "hero"')
  })

  it('throws when props.region conflicts with metadata.region', () => {
    const template = createTemplate({
      optionalRegions: [
        { region: 'hero', allowedComponents: ['hero-banner' as any] },
        { region: 'main', allowedComponents: ['hero-banner' as any] }
      ]
    })
    const component = createComponent('hero-banner', {
      region: 'hero',
      metadata: { region: 'main' }
    })

    expect(() =>
      manager.ensureRequiredRegionCoverage({
        tree: createTree([component]),
        template,
        componentTypes: [createComponentType('hero-banner')],
        pageData: createPageData()
      })
    ).toThrow('props.region "hero" conflicts with metadata.region "main"')
  })

  it('throws instead of reassigning a disallowed region', () => {
    const template = createTemplate({
      optionalRegions: [
        { region: 'header', allowedComponents: ['navbar' as any] },
        { region: 'main', allowedComponents: ['text-block' as any] }
      ]
    })
    const component = createComponent('navbar', {
      region: 'main',
      metadata: { region: 'main' },
      placementBucket: 'middle'
    })

    expect(() =>
      manager.ensureRequiredRegionCoverage({
        tree: createTree([component]),
        template,
        componentTypes: [createComponentType('navbar')],
        pageData: createPageData()
      })
    ).toThrow('assigned to disallowed region "main"')
    expect(component.props.region).toBe('main')
    expect(component.props.metadata.region).toBe('main')
    expect(component.props.placementBucket).toBe('middle')
  })

  it('throws instead of assigning a preferred region', () => {
    const template = createTemplate({
      optionalRegions: [
        { region: 'header', allowedComponents: ['navbar' as any] }
      ]
    })
    const component = createComponent('navbar', {})

    expect(() =>
      manager.ensureRequiredRegionCoverage({
        tree: createTree([component]),
        template,
        componentTypes: [createComponentType('navbar')],
        pageData: createPageData()
      })
    ).toThrow('has no valid assigned region')
    expect(component.props.region).toBeUndefined()
    expect(component.props.metadata).toBeUndefined()
  })

  it('throws instead of assigning the default main region', () => {
    const template = createTemplate({
      optionalRegions: [
        { region: 'main', allowedComponents: ['text-block' as any] }
      ]
    })
    const component = createComponent('text-block', {})

    expect(() =>
      manager.ensureRequiredRegionCoverage({
        tree: createTree([component]),
        template,
        componentTypes: [createComponentType('text-block')],
        pageData: createPageData()
      })
    ).toThrow('has no valid assigned region')
    expect(component.props.region).toBeUndefined()
    expect(component.props.metadata).toBeUndefined()
  })

  it('still throws RequiredRegionCoverageError when required coverage is missing', () => {
    const template = createTemplate({
      requiredRegions: [
        { region: 'main', allowedComponents: ['text-block' as any], min: 1 }
      ]
    })

    expect(() =>
      manager.ensureRequiredRegionCoverage({
        tree: createTree([]),
        template,
        componentTypes: [createComponentType('text-block')],
        pageData: createPageData()
      })
    ).toThrow(RequiredRegionCoverageError)
  })

  it.each([
    [{ region: 'main' }, { region: 'header' }],
    [{ metadata: { region: 'main' } }, { region: 'header' }],
    [{}, { region: 'main', metadata: { region: 'header' } }],
    [{ region: 'main' }, { metadata: { region: 'header' } }],
    [{ metadata: { region: 'main' } }, { metadata: { region: 'header' } }],
    [{ region: 'main', metadata: { region: 'header' } }, {}],
  ])('throws for conflicting blocks assignments before relocation: %j, %j', (props, content) => {
    const component = createComponent('navbar', {
      ...props,
      metadata: { ...props.metadata, detectionHarness: 'blocks' }
    }, { content })

    expect(() => manager.ensureRequiredRegionCoverage({
      tree: createTree([component]),
      template: createTemplate({ optionalRegions: [{ region: 'header', allowedComponents: ['navbar' as any] }] }),
      componentTypes: [createComponentType('navbar')],
      pageData: createPageData()
    })).toThrow('conflicting region assignments')
  })

  it.each(['hero', undefined])('drops only the blocks component with invalid placement %s', region => {
    const retained = createComponent('text-block', { region: 'main' })
    const dropped = createComponent('text-block', {
      region,
      metadata: { region, detectionHarness: 'blocks' }
    }, { id: 'misplaced-text' })
    const template = createTemplate({
      requiredRegions: [{ region: 'main', min: 1, allowedComponents: ['text-block' as any] }]
    })
    const result = manager.ensureRequiredRegionCoverage({
      tree: createTree([dropped, retained]),
      template,
      componentTypes: [createComponentType('text-block')],
      pageData: createPageData()
    })
    expect(result.components.map(component => component.id)).toEqual([retained.id])
    expect(result.metadata.totalComponents).toBe(1)
    expect(() => manager.ensureRequiredRegionCoverage({
      tree: createTree([{ ...dropped, props: { region } }]),
      template,
      componentTypes: [createComponentType('text-block')],
      pageData: createPageData()
    })).toThrow(ComponentRegionPlacementError)
  })

  it('names all placement drops, including nested components, when required coverage fails', () => {
    const dropped = (id: string) => createComponent('hero-banner', {
      region: 'main', metadata: { region: 'main', detectionHarness: 'blocks' }
    }, { id })
    const tree = createTree([
      dropped('dropped-banner'),
      createComponent('navbar', { region: 'header' }, { children: [dropped('nested-banner')] })
    ])

    expect(() => manager.ensureRequiredRegionCoverage({
      tree,
      template: createTemplate({
        requiredRegions: [{ region: 'main', min: 1, allowedComponents: ['text-block' as any] }],
        optionalRegions: [{ region: 'header', allowedComponents: ['navbar' as any] }]
      }),
      componentTypes: ['hero-banner', 'navbar', 'text-block'].map(createComponentType),
      pageData: createPageData()
    })).toThrow('Components dropped for placement: "dropped-banner" (hero-banner), "nested-banner" (hero-banner).')
  })

  it.each([
    ['navbar', 'header', 'top'],
    ['footer', 'footer', 'bottom']
  ] as const)('updates the placement bucket when %s moves to %s', (type, region, placementBucket) => {
    const component = createComponent(type, {
      region: 'main', metadata: { region: 'main', detectionHarness: 'blocks' }, placementBucket: 'middle'
    })
    const result = manager.ensureRequiredRegionCoverage({
      tree: createTree([component]),
      template: createTemplate({ optionalRegions: [{ region, allowedComponents: [type as any] }] }),
      componentTypes: [createComponentType(type)],
      pageData: createPageData()
    })
    expect(result.components[0].props).toMatchObject({ region, metadata: { region }, placementBucket })
    expect(component.props.placementBucket).toBe('middle')
  })
})
