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
  it('prefers props.sharedComponentId over other references', () => {
    const instance = createInstance({
      globalComponentId: 'legacy-global',
      sharedComponentId: 'legacy-shared',
      props: { sharedComponentId: 'props-shared' }
    })

    expect(resolveSharedComponentReference(instance)).toBe('props-shared')
  })

  it('falls back to legacy sharedComponentId when props value is missing', () => {
    const instance = createInstance({
      sharedComponentId: 'legacy-shared',
      globalComponentId: 'legacy-global'
    })

    expect(resolveSharedComponentReference(instance)).toBe('legacy-shared')
  })

  it('uses globalComponentId as a last resort', () => {
    const instance = createInstance({
      globalComponentId: 'legacy-global'
    })

    expect(resolveSharedComponentReference(instance)).toBe('legacy-global')
  })

  it('returns undefined when no references are present', () => {
    const instance = createInstance()
    expect(resolveSharedComponentReference(instance)).toBeUndefined()
  })
})
