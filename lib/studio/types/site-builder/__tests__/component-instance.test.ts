import { ComponentType as CmsComponentType } from '@/lib/studio/components/cms/_core/types'
import type { ComponentInstance } from '../component-instance'
import { resolveSharedComponentReference } from '../component-instance'

const createInstance = (overrides: Partial<ComponentInstance> = {}): ComponentInstance => ({
  id: 'component-1',
  type: 'text-block',
  componentType: CmsComponentType.TextBlock,
  componentTypeId: 'text-block',
  typeId: 'text-block',
  parentId: null,
  position: 0,
  props: {},
  content: {},
  styles: {},
  metadata: {},
  ...overrides
})

describe('resolveSharedComponentReference', () => {
  it('returns props.sharedComponentId', () => {
    const instance = createInstance({
      props: { sharedComponentId: 'props-shared' }
    })

    expect(resolveSharedComponentReference(instance)).toBe('props-shared')
  })

  it('ignores root legacy references', () => {
    const instance = createInstance({
      sharedComponentId: 'legacy-shared',
    } as Partial<ComponentInstance>)

    expect(resolveSharedComponentReference(instance)).toBeUndefined()
  })

  it('returns undefined when no references are present', () => {
    const instance = createInstance()
    expect(resolveSharedComponentReference(instance)).toBeUndefined()
  })
})
