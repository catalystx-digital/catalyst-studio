import {
  getComponentSummary,
  migrateComponentsToInstances,
} from '@/lib/studio/components/site-builder/professional-nodes'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'

const makeInstance = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
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

describe('professional node canonical content reads', () => {
  it('summarizes component.content before stale props.content and props.text mirrors', () => {
    const component = makeInstance({
      content: { heading: 'Canonical heading' } as any,
      props: {
        content: { heading: 'Stale props.content heading' },
        text: { heading: 'Stale props.text heading' },
      },
    })

    expect(getComponentSummary(component)).toBe('Canonical heading')
  })

  it('migrates component objects using component.content before stale props.content', () => {
    const [component] = migrateComponentsToInstances([
      {
        id: 'component-1',
        type: 'hero-banner',
        props: {
          content: { heading: 'Stale props.content heading' },
        },
        content: { heading: 'Canonical heading' },
      },
    ])

    expect(component.content).toEqual({ heading: 'Canonical heading' })
  })

  it('uses props.content only as a legacy-read fallback when canonical content is empty', () => {
    const [component] = migrateComponentsToInstances([
      makeInstance({
        content: {} as any,
        props: {
          content: { heading: 'Legacy props.content heading' },
        },
      }),
    ])

    expect(component.content).toEqual({ heading: 'Legacy props.content heading' })
  })
})
