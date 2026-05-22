import {
  buildCanonicalComponentProps,
  getCanonicalComponentProperties,
} from '@/lib/studio/components/site-builder/ComponentPropertiesPanel'
import {
  buildCanonicalPropertyEditorUpdate,
  getCanonicalPropertyEditorContent,
} from '@/lib/studio/components/site-builder/property-editor/PropertyEditorPanel'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'

const makeComponent = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
  id: 'component-1',
  type: 'hero-banner',
  parentId: null,
  position: 0,
  props: {},
  content: {},
  styles: {},
  metadata: {},
  ...overrides,
})

describe('editor canonical component content cleanup', () => {
  it('ComponentPropertiesPanel reads component.content before stale props mirrors', () => {
    const component = makeComponent({
      content: { heading: 'Canonical heading' } as any,
      props: {
        content: JSON.stringify({ heading: 'Stale props.content heading' }),
        text: JSON.stringify({ heading: 'Stale props.text heading' }),
      },
    })

    expect(getCanonicalComponentProperties(component)).toEqual({
      heading: 'Canonical heading',
    })
  })

  it('ComponentPropertiesPanel reads component.content before shared resolved props', () => {
    const component = makeComponent({
      content: { heading: 'Canonical shared instance heading' } as any,
      props: {
        sharedComponentId: 'shared-1',
        _resolvedSharedContent: { heading: 'Resolved shared heading' },
        overrides: { heading: 'Override heading' },
      },
    })

    expect(getCanonicalComponentProperties(component)).toEqual({
      heading: 'Canonical shared instance heading',
    })
  })

  it('ComponentPropertiesPanel uses resolved shared content when shared canonical content is empty', () => {
    const component = makeComponent({
      content: {} as any,
      props: {
        sharedComponentId: 'shared-1',
        _resolvedSharedContent: {
          heading: 'Resolved shared heading',
          cta: { label: 'Shared', href: '/shared' },
        },
        overrides: {
          cta: { label: 'Override' },
        },
      },
    })

    expect(getCanonicalComponentProperties(component)).toEqual({
      heading: 'Resolved shared heading',
      cta: { label: 'Override', href: '/shared' },
    })
  })

  it('ComponentPropertiesPanel rejects invalid canonical content instead of reading stale mirrors', () => {
    const component = makeComponent({
      content: 'not-json' as any,
      props: {
        content: { heading: 'Stale mirror' },
        text: { heading: 'Stale text' },
      },
    })

    expect(() => getCanonicalComponentProperties(component)).toThrow('Component canonical content must be an object')
  })

  it('ComponentPropertiesPanel writes canonical props without content mirrors and preserves metadata/shared props', () => {
    const component = makeComponent({
      props: {
        metadata: { schema: [{ name: 'heading', type: 'string' }] },
        sharedComponentId: 'shared-1',
        _resolvedSharedContent: { heading: 'Shared heading' },
        overrides: { eyebrow: 'Instance eyebrow' },
        unrelatedLegacy: 'drop me',
      },
    })
    const nextContent = { heading: 'Edited heading', cta: { label: 'Start' } }

    expect(buildCanonicalComponentProps(component, nextContent)).toEqual({
      metadata: component.props.metadata,
      sharedComponentId: 'shared-1',
      _resolvedSharedContent: component.props._resolvedSharedContent,
      overrides: nextContent,
      hasOverrides: true,
    })
  })

  it('PropertyEditorPanel reads component.content before stale props mirrors', () => {
    const component = makeComponent({
      content: { title: 'Canonical title' } as any,
      props: {
        content: JSON.stringify({ title: 'Stale props.content title' }),
        text: JSON.stringify({ title: 'Stale props.text title' }),
      },
    })

    expect(getCanonicalPropertyEditorContent(component)).toEqual({
      title: 'Canonical title',
    })
  })

  it('PropertyEditorPanel uses resolved shared content when shared canonical content is empty', () => {
    const component = makeComponent({
      content: {} as any,
      props: {
        sharedComponentId: 'shared-2',
        _resolvedSharedContent: {
          title: 'Resolved title',
          nested: { first: 'shared', second: 'shared' },
        },
        overrides: {
          nested: { second: 'override' },
        },
      },
    })

    expect(getCanonicalPropertyEditorContent(component)).toEqual({
      title: 'Resolved title',
      nested: { first: 'shared', second: 'override' },
    })
  })

  it('PropertyEditorPanel rejects invalid canonical content instead of reading stale mirrors', () => {
    const component = makeComponent({
      content: ['invalid'] as any,
      props: {
        content: { title: 'Stale mirror' },
        text: { title: 'Stale text' },
      },
    })

    expect(() => getCanonicalPropertyEditorContent(component)).toThrow('Component canonical content must be an object')
  })

  it('PropertyEditorPanel edit payload uses canonical content without props mirrors while preserving existing props', () => {
    const component = makeComponent({
      props: {
        metadata: { properties: [{ name: 'title' }] },
        sharedComponentId: 'shared-2',
        overrides: { title: 'Old override' },
        content: JSON.stringify({ title: 'Old mirror' }),
        text: JSON.stringify({ title: 'Old mirror' }),
        analyticsId: 'hero-title',
      },
    })
    const nextContent = { title: 'Edited title', body: { html: '<p>Body</p>' } }

    expect(buildCanonicalPropertyEditorUpdate(component, nextContent)).toEqual({
      content: nextContent,
      props: {
        metadata: component.props.metadata,
        sharedComponentId: 'shared-2',
        analyticsId: 'hero-title',
        overrides: nextContent,
        hasOverrides: true,
      },
    })
  })
})
